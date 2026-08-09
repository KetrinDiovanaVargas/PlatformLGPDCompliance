/**
 * Rotas de consolidação de relatórios de avaliação.
 * 
 * Consolida múltiplos relatórios finais em uma análise agregada com top issues,
 * pontos fortes, recomendações e score médio. Suporta fallback se IA indisponível.
 * @module routes/consolidate
 */

import express from "express";
import admin from "firebase-admin";
import { getAdminDb } from "../firebaseAdmin.mjs";
import { chatCompletion } from "./ai-client.mjs";

const router = express.Router();

/**
 * Salva relatório final em Firestore.
 * 
 * Persiste relatório final e atualiza status da sessão para 'completed'.
 * Cria/atualiza documento na subcoleção final_report/latest.
 * 
 * @async
 * @param {string} userId - ID do usuário (obrigatório)
 * @param {string} sessionId - ID da sessão (obrigatório)
 * @param {string} [assessmentId] - ID da avaliação (opcional)
 * @param {Object} payload - Conteúdo do relatório (report, metrics, summary, etc)
 * 
 * @returns {Promise<{ok: boolean, sessionId: string}>} Confirmação de salvamento
 * 
 * @throws {Error} Se userId ou sessionId não fornecidos
 * 
 * @example
 * await saveFinalReport('user_123', 'sess_456', 'assess_789', {
 *   report: '...',
 *   metrics: { score: 75, ... },
 *   summary: '...'
 * });
 */
export async function saveFinalReport(userId, sessionId, assessmentId, payload) {
  const db = getAdminDb();

  if (!userId) throw new Error("userId é obrigatório");
  if (!sessionId) throw new Error("sessionId é obrigatório");

  const sessionRef = db.collection("assessment_sessions").doc(String(sessionId));
  const reportRef = sessionRef.collection("final_report").doc("latest");

  const now = admin.firestore.FieldValue.serverTimestamp();

  await sessionRef.set(
    {
      sessionId: String(sessionId),
      userId: String(userId),
      assessmentId: assessmentId ? String(assessmentId) : null,
      status: "completed",
      updatedAt: now,
      completedAt: now,
      createdAt: now,
    },
    { merge: true }
  );

  await reportRef.set(
    {
      sessionId: String(sessionId),
      userId: String(userId),
      assessmentId: assessmentId ? String(assessmentId) : null,
      ...(payload && typeof payload === "object" ? payload : { payload }),
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );

  return { ok: true, sessionId: String(sessionId) };
}

router.options("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.status(204).end();
});

/**
 * Converte valor para string segura e trimada.
 * @private
 * @param {*} v - Valor a converter
 * @returns {string} String trimada ou vazia
 */
function safeString(v) {
  return String(v ?? "").trim();
}

/**
 * Calcula média aritmética de array de números.
 * @private
 * @param {number[]} arr - Array de números
 * @returns {number} Média arredondada ou 0 se array vazio
 */
function average(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

/**
 * Achata array multidimensional e remove valores falsy.
 * @private
 * @param {Array} arr - Array potencialmente aninhado
 * @returns {Array} Array plano sem valores falsy
 */
function flatten(arr) {
  return arr.flat().filter(Boolean);
}

/**
 * Conta frequência de strings e retorna top 5.
 * @private
 * @param {string[]} list - Lista de strings
 * @returns {Array<{label: string, count: number}>} Top 5 strings por frequência
 */
function countFrequency(list) {
  const map = {};

  list.forEach((item) => {
    const key = safeString(item);
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  });

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({
      label: key,
      count,
    }));
}

/**
 * Extrai métricas estruturadas de relatório.
 * @private
 * @param {Object} report - Relatório final
 * @returns {{score: number, criticalIssues: Array, strengths: Array, attentionPoints: Array, recommendations: Array, risks: Object}}
 *   Métricas extraídas
 */
function extractMetrics(report) {
  return {
    score: Number(report?.metrics?.score ?? 0),
    criticalIssues: report?.metrics?.criticalIssues ?? [],
    strengths: report?.metrics?.strengths ?? [],
    attentionPoints: report?.metrics?.attentionPoints ?? [],
    recommendations: report?.metrics?.recommendations ?? [],
    risks: report?.metrics?.risks ?? {},
  };
}

/**
 * Consolida múltiplos relatórios em análise agregada (fallback).
 * 
 * Agrupa issues críticos, pontos fortes, pontos de atenção e recomendações
 * por frequência quando a IA não está disponível.
 * 
 * @private
 * @param {Array<Object>} reports - Array de relatórios finais
 * @returns {{scoreAverage: number, topCriticalIssues: Array, topStrengths: Array, topAttentionPoints: Array, recommendations: Array, reportsCount: number, mode: "fallback"}}
 *   Análise consolidada
 */
function fallbackConsolidation(reports) {
  const metricsList = reports.map(extractMetrics);
  const scores = metricsList.map((m) => m.score);

  const allCritical = flatten(metricsList.map((m) => m.criticalIssues));
  const allStrengths = flatten(metricsList.map((m) => m.strengths));
  const allAttention = flatten(metricsList.map((m) => m.attentionPoints));

  const allRecommendations = flatten(
    metricsList.map((m) =>
      Array.isArray(m.recommendations)
        ? m.recommendations.map((r) => ({
            title: safeString(r?.title || r),
            priority: safeString(r?.priority || "Média") || "Média",
          }))
        : []
    )
  );

  return {
    scoreAverage: average(scores),
    topCriticalIssues: countFrequency(allCritical),
    topStrengths: countFrequency(allStrengths),
    topAttentionPoints: countFrequency(allAttention),
    recommendations:
      allRecommendations.length > 0
        ? allRecommendations.slice(0, 5)
        : [
            {
              title: "Priorizar riscos mais recorrentes",
              priority: "Alta",
            },
            {
              title: "Padronizar controles de proteção de dados",
              priority: "Média",
            },
          ],
    reportsCount: reports.length,
    mode: "fallback",
  };
}

/**
 * Verifica se erro é por rate limit de IA.
 * @private
 * @param {Error} err - Erro capturado
 * @returns {boolean} true se erro é rate limit
 */
function isRateLimit(err) {
  const msg = safeString(err?.message).toLowerCase();
  return msg.includes("rate limit") || err?.status === 429;
}

/**
 * Extrai JSON válido de texto contendo markdown ou caracteres extras.
 * @private
 * @param {string} text - Texto potencialmente contendo JSON
 * @returns {Object|null} Objeto parseado ou null se JSON inválido
 */
function extractJson(text) {
  if (!text) return null;

  const cleaned = String(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) return null;

  const jsonString = cleaned.substring(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("❌ Erro ao fazer parse do JSON consolidado:", err);
    return null;
  }
}

/**
 * Gera análise consolidada usando Groq.
 * 
 * Chama IA para sintetizar múltiplos relatórios em métricas agregadas
 * (score médio, top issues, recomendações priorizadas).
 * 
 * @private
 * @async
 * @param {Array<Object>} reports - Array de relatórios finais
 * @param {string} [assessmentTitle=""] - Título da avaliação para contexto
 * 
 * @returns {Promise<{scoreAverage: number, topCriticalIssues: Array, topStrengths: Array, topAttentionPoints: Array, recommendations: Array}>}
 *   Análise consolidada estruturada
 * 
 * @throws {Error} Se resposta da IA inválida
 */
async function generateWithGroq(reports, assessmentTitle = "") {
  const compactReports = reports.map((report) => ({
    assessmentId: report.assessmentId ?? null,
    sessionId: report.sessionId ?? null,
    summary: report.summary ?? "",
    metrics: report.metrics ?? {},
    report: safeString(report.report).slice(0, 2000),
  }));

  const prompt = `
Você é um especialista em LGPD.

Analise os relatórios abaixo e gere uma análise consolidada da avaliação "${assessmentTitle}".

Retorne APENAS JSON válido neste formato:

{
  "scoreAverage": 0,
  "topCriticalIssues": [
    { "label": "string", "count": 0 }
  ],
  "topStrengths": [
    { "label": "string", "count": 0 }
  ],
  "topAttentionPoints": [
    { "label": "string", "count": 0 }
  ],
  "recommendations": [
    {
      "title": "string",
      "priority": "Alta"
    }
  ]
}

RELATÓRIOS:
${JSON.stringify(compactReports).slice(0, 12000)}
`.trim();

  const raw = await chatCompletion(
    [
      { role: "system", content: "Retorne apenas JSON válido." },
      { role: "user",   content: prompt },
    ],
    { temperature: 0.2, jsonMode: true }
  );

  const parsed = extractJson(raw);

  if (!parsed) {
    throw new Error("Resposta inválida do GROQ na análise consolidada");
  }

  return parsed;
}

/**
 * POST /consolidate
 * 
 * Consolida múltiplos relatórios de uma avaliação em análise agregada.
 * 
 * Busca todos os relatórios finais de uma avaliação no Firestore,
 * tenta gerar consolidação via IA, com fallback automático se indisponível.
 * 
 * @async
 * @param {Object} req - Request Express
 * @param {string} req.body.assessmentId - ID da avaliação (obrigatório)
 * @param {Object} res - Response Express
 * 
 * @returns {Object} Análise consolidada com:
 *   - scoreAverage: número (0-100)
 *   - topCriticalIssues: array de {label, count}
 *   - topStrengths: array de {label, count}
 *   - topAttentionPoints: array de {label, count}
 *   - recommendations: array de {title, priority}
 *   - reportsCount: número
 *   - mode: "groq" ou "fallback"
 *   - notice?: string (se fallback)
 * 
 * @example
 * POST /consolidate
 * Body: { "assessmentId": "assess_123" }
 * Response:
 * {
 *   "scoreAverage": 72,
 *   "topCriticalIssues": [{ "label": "...", "count": 3 }],
 *   "reportsCount": 5,
 *   "mode": "groq"
 * }
 */
router.post("/", async (req, res) => {
  try {
    let adminDb;
    try {
      adminDb = getAdminDb();
    } catch (err) {
      return res.status(503).json({
        error: "Firebase Admin não configurado no backend.",
        details: err?.message || String(err),
      });
    }

    const { assessmentId } = req.body;

    if (!assessmentId) {
      return res.status(400).json({ error: "assessmentId obrigatório" });
    }

    const assessmentSnap = await adminDb
      .collection("assessments")
      .doc(String(assessmentId))
      .get();

    const assessmentTitle = assessmentSnap.exists
      ? safeString(assessmentSnap.data()?.title, "Avaliação")
      : "Avaliação";

    const reportsSnap = await adminDb
      .collectionGroup("final_report")
      .where("assessmentId", "==", assessmentId)
      .get();

    const reports = reportsSnap.docs.map((doc) => doc.data());

    if (reports.length === 0) {
      return res.json({
        message: "Nenhum relatório encontrado",
        mode: "empty",
        reportsCount: 0,
      });
    }

    try {
      const aiResult = await generateWithGroq(reports, assessmentTitle);

      return res.json({
        ...aiResult,
        reportsCount: reports.length,
        mode: "groq",
      });
    } catch (err) {
      console.error("❌ GROQ CONSOLIDADO:", err);

      const fallback = fallbackConsolidation(reports);

      if (isRateLimit(err)) {
        return res.json({
          ...fallback,
          notice:
            "A análise consolidada foi gerada em modo contingência porque a IA atingiu o limite temporário.",
        });
      }

      return res.json({
        ...fallback,
        notice:
          "A análise consolidada foi gerada em modo contingência por indisponibilidade temporária da IA.",
      });
    }
  } catch (err) {
    console.error("❌ CONSOLIDADO:", err);
    return res.status(500).json({ error: "Erro ao consolidar" });
  }
});

export default router;