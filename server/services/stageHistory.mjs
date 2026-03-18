// server/services/stageHistory.mjs

const historyByUser = new Map();

/**
 * Salva histórico de perguntas já feitas
 */
export function saveHistory(userId, questions) {
  // 🔒 BLINDAGEM ABSOLUTA
  if (!Array.isArray(questions)) {
    console.warn("⚠️ saveHistory ignorado: questions não é array", questions);
    return;
  }

  if (!historyByUser.has(userId)) {
    historyByUser.set(userId, []);
  }

  const history = historyByUser.get(userId);

  for (const q of questions) {
    if (q && q.id && !history.some((h) => h.id === q.id)) {
      history.push({
        id: q.id,
        question: q.question ?? "",
      });
    }
  }

  historyByUser.set(userId, history);
}

/**
 * Retorna histórico salvo
 */
export function getHistory(userId) {
  return historyByUser.get(userId) || [];
}
