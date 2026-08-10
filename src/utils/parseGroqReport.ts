/**
 * Parseia relatório de conformidade LGPD (texto formatado) em estrutura JSON
 *
 * Remove formatação markdown, extrai seções por padrão de título e retorna
 * métricas organizadas. Tolerante a variações de formatação (numeração, espaços, maiúsculas).
 *
 * @param {string} text - Texto do relatório gerado pela IA 
 *
 * @returns {Object|null} Relatório estruturado ou null se texto vazio
 * @returns {number} .score - Score de conformidade LGPD (0-100)
 * @returns {Object} .risks - Percentuais de classificação
 * @returns {number} .risks.conforme - Porcentagem de itens conforme (0-100)
 * @returns {number} .risks.parcial - Porcentagem de conformidade parcial (0-100)
 * @returns {number} .risks.naoConforme - Porcentagem não conforme (0-100)
 * @returns {string[]} .strengths - Pontos fortes detectados
 * @returns {string[]} .weaknesses - Pontos de atenção/fragilidades
 * @returns {string[]} .criticalRisks - Riscos críticos identificados
 * @returns {string[]} .recommendations - Recomendações e próximas ações
 *
 * @example
 * const reportText = `
 *   Score de Conformidade: 72
 *   Percentuais de Risco:
 *   - Conforme: 72%
 *   - Parcial: 20%
 *   - Não Conforme: 8%
 *   Pontos Fortes:
 *   - Política de dados implementada
 *   - Consentimento documentado
 *   Pontos de Atenção:
 *   - Retenção indefinida de logs
 *   Riscos Críticos:
 *   - Acesso excessivo de admins
 *   Conclusão e Recomendações:
 *   - Implementar política de retenção
 *   - Revisar privilégios de acesso
 * `;
 *
 * const parsed = parseGroqReport(reportText);
 * // → {
 * //   score: 72,
 * //   risks: { conforme: 72, parcial: 20, naoConforme: 8 },
 * //   strengths: ['Política de dados implementada', 'Consentimento documentado'],
 * //   weaknesses: ['Retenção indefinida de logs'],
 * //   criticalRisks: ['Acesso excessivo de admins'],
 * //   recommendations: ['Implementar política de retenção', 'Revisar privilégios de acesso']
 * // }
 */


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

    /**
   * Parseia lista de texto em array de strings
   *
   * Remove bullets (-, •), espaçamento, linhas vazias.
   * Filtra strings muito curtas (< 3 caracteres) como ruído.
   *
   * @param {string} block - Bloco de texto contendo lista com bullets
   * @returns {string[]} Array de itens da lista, limpos e filtrados
   *
   * @private
   * @example
   * parseList("- Ponto 1\n• Ponto 2\n  \n")
   * // → ['Ponto 1', 'Ponto 2']
   */

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
