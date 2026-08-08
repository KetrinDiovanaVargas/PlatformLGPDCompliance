/**
 * Serviço de Persistência de Estágios LGPD
 * @module firestoreStages.mjs
 * 
 * Módulo responsável por salvar e recuperar dados dos 4 estágios de avaliação
 * LGPD no Firebase Firestore. Mantém histórico completo de respostas e análises.
 * 
 * Estrutura no Firestore:
 * - assessment_sessions/{sessionId} - Sessão de avaliação
 *   - stages/{stageId} - Dados de cada estágio (0-3: Contexto, Controles, Riscos, Maturidade)
 *   - responses/{respondentId} - Respostas do respondente
 *   - analysis/ - Análises geradas
 * 
 * Características:
 * - Sanitização de dados (remove undefined, normaliza valores)
 * - Validação de inputs
 * - Timestamps automáticos
 * - Rastreamento de assessmentId e respondentId
 */

import admin from "../firebase.mjs";
import { getAdminDb } from "../firebaseAdmin.mjs";

/**
 * Sanitiza valores recursivamente para armazenamento em Firestore
 * Remove valores undefined e normaliza estruturas aninhadas
 * 
 * @private
 * @param {*} value - Valor a sanitizar
 * @returns {*} Valor sanitizado (null se undefined)
 */
function sanitize(value) {
  if (value === undefined) return null;

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === "object" && value !== null) {
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      clean[k] = sanitize(v);
    }
    return clean;
  }

  return value;
}

/**
 * Salva dados de um estágio específico no Firestore
 * 
 * Persiste respostas e análises de um dos 4 estágios (0-3):
 * 0: Contexto Organizacional
 * 1: Controles e Processos
 * 2: Riscos e Governança
 * 3: Maturidade e Evidências
 * 
 * @async
 * @param {string} userId - ID do usuário respondente (obrigatório)
 * @param {string} sessionId - ID único da sessão de avaliação (obrigatório)
 * @param {number} stage - Número do estágio 0-3 (obrigatório)
 * @param {Object} [data={}] - Dados do estágio (respostas, scores, análise)
 * @param {string} [data.assessmentId] - ID do questionário/avaliação
 * @param {Object} [data.responses] - Respostas do respondente
 * @param {Object} [data.analysis] - Análise gerada pela IA
 * @returns {Promise<{success: boolean, sessionId: string, stage: number, timestamp: string}>}
 * @throws {Error} Se userId, sessionId ou stage forem inválidos
 * 
 * @example
 * await saveStage('user_123', 'sess_001', 0, {
 *   assessmentId: 'quiz_001',
 *   responses: { q1: 'resposta1', q2: 'resposta2' },
 *   analysis: { score: 75, riskLevel: 'Médio' }
 * });
 */
export async function saveStage(userId, sessionId, stage, data = {}) {
  const db = getAdminDb();

  if (!userId) throw new Error("userId é obrigatório");
  if (!sessionId) throw new Error("sessionId é obrigatório");
  if (stage === undefined || stage === null) throw new Error("stage é obrigatório");

  const numericStage = Number(stage);

  if (!Number.isInteger(numericStage) || numericStage < 0) {
    throw new Error("stage inválido");
  }

  const sanitizedData = sanitize(data);
  const assessmentId =
    sanitizedData?.assessmentId !== undefined && sanitizedData?.assessmentId !== null
      ? String(sanitizedData.assessmentId)
      : null;

  const sessionRef = db.collection("assessment_sessions").doc(String(sessionId));
  const stageRef = sessionRef.collection("stages").doc(String(numericStage));

  const sessionSnap = await sessionRef.get();
  const existingSession = sessionSnap.exists ? sessionSnap.data() : null;

  await sessionRef.set(
    {
      sessionId: String(sessionId),
      userId: String(userId),
      assessmentId: assessmentId ?? existingSession?.assessmentId ?? null,
      currentStage: numericStage,
      status: "in_progress",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt:
        existingSession?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await stageRef.set(
    {
      stage: numericStage,
      assessmentId: assessmentId ?? existingSession?.assessmentId ?? null,
      data: sanitizedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    userId: String(userId),
    sessionId: String(sessionId),
    assessmentId: assessmentId ?? existingSession?.assessmentId ?? null,
    stage: numericStage,
  };
}