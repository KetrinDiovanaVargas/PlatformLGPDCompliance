/**
 * 
 * Módulo que expõe endpoint HTTP para persister respostas de etapas
 * do questionário adaptativo LGPD no Firestore.
 * 
 * Fluxo:
 * 1. Valida entrada (stage, answers, sessionId obrigatórios)
 * 2. Conecta ao Firestore Admin
 * 3. Atualiza/cria sessão de avaliação
 * 4. Salva respostas da etapa
 * 5. Retorna confirmação com IDs
 * 
 *  Todas as respostas são salvas em
 * Firestore, mesmo que erros ocorram em etapas subsequentes.
 * 
 * @module routes/save-stage
 * 
 * @requires express
 * @requires ../firebase.mjs
 * @requires ../firebaseAdmin.mjs
 * @requires ../services/firestoreStages.mjs
 * 
 * Estrutura de dados:
 * - Collection: assessment_sessions/{sessionId}
 * - Collection: user_responses/{userId}/stages/{sessionId}/{stage}
 */

import express from "express";
import admin from "../firebase.mjs";
import { getAdminDb } from "../firebaseAdmin.mjs";
import { saveStage } from "../services/firestoreStages.mjs";

/**
 * Router Express para gerenciar rotas de salvamento de respostas.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Salva respostas de qualquer etapa do questionário.
 * 
 * Fluxo de processamento:
 * 1. Valida conectividade com Firestore Admin
 * 2. Valida campos obrigatórios (stage, answers, sessionId)
 * 3. Normaliza tipos numéricos
 * 4. Atualiza documento de sessão (merge)
 * 5. Persiste respostas via saveStage()
 * 6. Registra em log operação bem-sucedida
 * 7. Retorna confirmação com IDs
 * 
 * A sessão usa `merge: true`, então dados existentes
 * são preservados. Apenas os campos presentes no request são atualizados.
 * 
 * Se o mesmo request for enviado duas vezes,
 * a segunda sobrescreve a primeira (última resposta vence). sessionId
 * deve ser único por tentativa.
 * 
 * @async
 * @route {POST} /
 * 
 * @param {Object} req.body - Corpo da requisição
 * @param {number} req.body.stage - Número da etapa (obrigatório, ≥ 1)
 * @param {Object} req.body.answers - Respostas mapeadas por ID (obrigatório)
 *                                    Formato: { "q1": "resposta", "q2": "...", ... }
 * @param {string} [req.body.userId="anon"] - ID do usuário
 *                                            Padrão: "anon" para anônimos
 * @param {string} req.body.sessionId - ID único da sessão (obrigatório)
 *                                      Idealmente UUID v4
 * @param {string} [req.body.assessmentId] - ID da avaliação oficial
 *                                           Se null, sessão é ad-hoc
 * 
 * @returns {Object} Confirmação de salvamento (200):
 * @returns {boolean} returns.ok - Sempre true em caso de sucesso
 * @returns {string} returns.userId - ID do usuário (mesmo do request)
 * @returns {string} returns.sessionId - ID da sessão (mesmo do request)
 * @returns {string|null} returns.assessmentId - ID da avaliação (eco do request)
 * @returns {number} returns.stage - Número da etapa (eco do request)
 * 
 * @throws {400} Stage ausente, inválido ou < 1
 * @throws {400} Answers ausente ou não é objeto
 * @throws {400} sessionId ausente
 * @throws {503} Firebase Admin não configurado
 * @throws {500} Erro ao salvar em Firestore
 * 
 * @example
 * // POST /api/save-stage
 * // Content-Type: application/json
 * {
 *   "stage": 1,
 *   "sessionId": "session-abc-123",
 *   "userId": "user-456",
 *   "assessmentId": "assessment-789",
 *   "answers": {
 *     "q1": "Frequentemente",
 *     "q2": "Sim, temos políticas",
 *     "q3": "Implementada parcialmente"
 *   }
 * }
 * 
 * @example
 * // Response 200 (sucesso)
 * {
 *   "ok": true,
 *   "userId": "user-456",
 *   "sessionId": "session-abc-123",
 *   "assessmentId": "assessment-789",
 *   "stage": 1
 * }
 * 
 * @example
 * // Request com usuário anônimo (userId omitido)
 * {
 *   "stage": 2,
 *   "sessionId": "session-xyz-789",
 *   "answers": { "q1": "Não", "q2": "..." }
 * }
 * 
 * @example
 * // Response 200 (userId fica "anon")
 * {
 *   "ok": true,
 *   "userId": "anon",
 *   "sessionId": "session-xyz-789",
 *   "assessmentId": null,
 *   "stage": 2
 * }
 * 
 * @example
 * // Response 400 (stage ausente)
 * {
 *   "error": "Stage é obrigatório"
 * }
 * 
 * @example
 * // Response 400 (answers inválido)
 * {
 *   "error": "Answers é obrigatório"
 * }
 * 
 * @example
 * // Response 400 (sessionId ausente)
 * {
 *   "error": "sessionId é obrigatório"
 * }
 * 
 * @example
 * // Response 400 (stage < 1)
 * {
 *   "error": "Stage inválido"
 * }
 * 
 * @example
 * // Response 503 (Firebase não configurado)
 * {
 *   "error": "Firebase Admin não configurado no backend.",
 *   "details": "Falha ao carregar credenciais"
 * }
 * 
 * @example
 * // Response 500 (erro ao salvar)
 * {
 *   "error": "Erro ao salvar respostas",
 *   "details": "Permission denied on resource 'projects/...'"
 * }
 * 
 * @internal
 * - Usa `admin.firestore.FieldValue.serverTimestamp()` para timestamp consistente
 * - Se saveStage() falhar mas a sessão foi criada, dados ficam inconsistentes
 * - TODO: Implementar transação ou compensação
 */
router.post("/", async (req, res) => {
  try {
    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      return res.status(503).json({
        error: "Firebase Admin não configurado no backend.",
        details: err?.message || String(err),
      });
    }

    const {
      stage,
      answers,
      userId = "anon",
      sessionId,
      assessmentId = null,
    } = req.body;

    if (stage === undefined || stage === null) {
      return res.status(400).json({ error: "Stage é obrigatório" });
    }

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "Answers é obrigatório" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId é obrigatório" });
    }

    const numericStage = Number(stage);

    if (!Number.isInteger(numericStage) || numericStage < 1) {
      return res.status(400).json({ error: "Stage inválido" });
    }

    const sessionRef = db.collection("assessment_sessions").doc(String(sessionId));

    await sessionRef.set(
      {
        sessionId: String(sessionId),
        userId: String(userId),
        assessmentId: assessmentId ? String(assessmentId) : null,
        status: "in_progress",
        currentStage: numericStage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await saveStage(userId, sessionId, numericStage, {
      id: numericStage,
      title: `Etapa ${numericStage}`,
      description: "Respostas salvas",
      questions: [],
      answers,
      assessmentId: assessmentId ? String(assessmentId) : null,
      updatedAt: new Date(),
    });

    console.log("✅ Respostas salvas com sucesso:", {
      userId,
      sessionId,
      assessmentId: assessmentId ?? null,
      stage: numericStage,
    });

    return res.json({
      ok: true,
      userId,
      sessionId,
      assessmentId: assessmentId ?? null,
      stage: numericStage,
    });
  } catch (error) {
    console.error("❌ Erro ao salvar respostas:", error);
    return res.status(500).json({
      error: "Erro ao salvar respostas",
      details: error.message,
    });
  }
});

export default router;