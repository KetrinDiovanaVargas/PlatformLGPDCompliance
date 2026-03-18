export function parseGroqReport(text: string) {
  if (!text) return null;

  // remove markdown
  const clean = text.replace(/\*\*/g, "").trim();

  // função universal para encontrar blocos
  function getSection(title: string) {
    // regex que aceita:
    // - número opcional "3. "
    // - espaço opcional
    // - título (case-insensitive)
    // - dois pontos opcionais
    const regex = new RegExp(`\\d*\\.?\\s*${title}\\s*:`, "i");

    const startMatch = clean.match(regex);
    if (!startMatch) return "";

    const startIndex = clean.indexOf(startMatch[0]) + startMatch[0].length;
    const after = clean.slice(startIndex);

    // possíveis títulos seguintes
    const titles = [
      "Score de Conformidade",
      "Percentuais de Risco",
      "Pontos Fortes",
      "Pontos de Atenção",
      "Riscos Críticos",
      "Conclusão e Recomendações",
    ];

    let endIndex = after.length;

    for (const t of titles) {
      if (t.toLowerCase() === title.toLowerCase()) continue;

      const r = new RegExp(`\\d*\\.?\\s*${t}\\s*:`, "i");
      const m = after.match(r);
      if (m) {
        const idx = after.indexOf(m[0]);
        if (idx !== -1 && idx < endIndex) endIndex = idx;
      }
    }

    return after.slice(0, endIndex).trim();
  }

  function parseList(block: string) {
    return block
      .split("\n")
      .map((l) => l.replace(/^[-•\s]+/, "").trim())
      .filter((l) => l.length > 3);
  }

  // SCORE
  const scoreMatch = clean.match(/Score de Conformidade\s*:?\s*(\d+)/i);
  const score = scoreMatch ? Number(scoreMatch[1]) : 0;

  // RISCOS
  const risksBlock = getSection("Percentuais de Risco");

  const conforme = Number((risksBlock.match(/Conforme\s*:?\s*(\d+)/i) || [])[1] || 0);
  const parcial = Number((risksBlock.match(/Parcial\s*:?\s*(\d+)/i) || [])[1] || 0);
  const naoConforme = Number((risksBlock.match(/Não Conforme\s*:?\s*(\d+)/i) || [])[1] || 0);

  return {
    score,
    risks: { conforme, parcial, naoConforme },
    strengths: parseList(getSection("Pontos Fortes")),
    weaknesses: parseList(getSection("Pontos de Atenção")),
    criticalRisks: parseList(getSection("Riscos Críticos")),
    recommendations: parseList(getSection("Conclusão e Recomendações")),
  };
}
