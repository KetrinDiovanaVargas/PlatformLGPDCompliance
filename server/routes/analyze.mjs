/**
 * @fileoverview Rotas de Análise LGPD - Express Router
 * 
 * Módulo que expõe endpoints HTTP para análise de conformidade LGPD.
 * Processa respostas de questionários e gera relatórios automatizados
 * utilizando cascade de LLMs (Groq → Claude → DeepSeek → Gemini).
 * 
 * @module routes/analyze
 * 
 * @requires ../groq/generateFinalReportGroq.mjs
 * @requires ../lib/saveFinalReport.js
 * @requires ../firebaseAdmin.mjs
 * 
 * Integração:
 * - Firebase Firestore para armazenamento de metadados
 * - AI Client (cascade LLM) para análise semântica
 * - Report Generator para formatação de relatórios
 */

import express from "express";
import { generateFinalReportWithGroq } from "../groq/generateFinalReportGroq.mjs";
import { saveFinalReport } from "../lib/saveFinalReport.js";
import { getAdminDb } from "../firebaseAdmin.mjs";

/**
 * Router Express para gerenciar rotas de análise LGPD.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Converte valor para string segura e trimada.
 * 
 * Útil para sanitizar dados vindos do Firestore onde podem conter
 * valores undefined, null ou tipos inesperados.
 * 
 * @param {*} value - Valor a converter para string
 * @param {string} [fallback=""] - Valor padrão se value for falsy
 * @returns {string} String segura, trimada e nunca null
 * 
 * @example
 * safeString(null) // → ""
 * @example
 * safeString("  teste  ") // → "teste"
 * @example
 * safeString(undefined, "padrão") // → "padrão"
 */
function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

/**
 * Carrega metadados do questionário/avaliação do Firestore.
 * 
 * Busca informações como título, objetivo, público-alvo e contexto
 * da avaliação para incluir no relatório final. Retorna null se a
 * avaliação não existir.
 * 
 * @async
 * @param {*} adminDb - Instância de admin Firestore
 * @param {string} assessmentId - ID da avaliação
 * 
 * @returns {Promise<Object|null>} Objeto contendo:
 * @returns {string} returns.id - ID da avaliação
 * @returns {string} returns.title - Título da avaliação
 * @returns {string} returns.formType - Tipo de formulário
 * @returns {string} returns.objective - Objetivo/categoria
 * @returns {string} returns.context - Contexto de aplicação
 * @returns {string} returns.audience - Público-alvo
 * @returns {string} returns.introText - Texto introdutório
 * @returns {string} returns.ownerId - ID do proprietário
 * @returns {string} returns.ownerName - Nome do proprietário
 * @returns {boolean} returns.active - Se a avaliação está ativa
 * 
 * @throws Pode lançar erro se Firestore não estiver acessível
 * 
 * @example
 * const metadata = await loadAssessmentMetadata(adminDb, "assessment-123");
 * // → { id: "assessment-123", title: "LGPD Compliance", ... }
 */
async function loadAssessmentMetadata(adminDb, assessmentId) {
  if (!assessmentId) return null;

  const snap = await adminDb
    .collection("assessments")
    .doc(String(assessmentId))
    .get();

  if (!snap.exists) return null;

  const data = snap.data() || {};

  return {
    id: snap.id,
    title: safeString(data.title),
    formType: safeString(data.formType),
    objective: safeString(data.objective || data.category),
    context: safeString(data.context),
    audience: safeString(data.audience),
    introText: safeString(data.introText),
    ownerId: safeString(data.ownerId),
    ownerName: safeString(data.ownerName),
    active: data.active !== false,
  };
}

/**
 * Constrói objeto de métricas seguro e normalizado.
 * 
 * Garante que as métricas possuem valores numéricos válidos e
 * estruturas esperadas, mesmo que dados incompletos sejam passados.
 * 
 * @param {Object} [input={}] - Objeto de métricas bruto
 * @param {number} input.score - Score geral (0-100)
 * @param {Object} input.risks - Contagem de riscos por categoria
 * @param {number} input.risks.conforme - Quantidade em conformidade
 * @param {number} input.risks.parcial - Quantidade em conformidade parcial
 * @param {number} input.risks.naoConforme - Quantidade não conforme
 * @param {Array} input.strengths - Pontos fortes identificados
 * @param {Array} input.attentionPoints - Pontos de atenção
 * @param {Array} input.criticalIssues - Questões críticas
 * @param {Array} input.controlsStatus - Status dos controles
 * @param {Array} input.recommendations - Recomendações
 * 
 * @returns {Object} Métricas normalizadas e seguras
 * 
 * @example
 * const metrics = buildSafeMetrics({ score: "85", risks: { conforme: "10" } });
 * // → { score: 85, risks: { conforme: 10, parcial: 0, naoConforme: 0 }, ... }
 */
function buildSafeMetrics(input = {}) {
  return {
    score: Number(input.score) || 0,
    risks: {
      conforme: Number(input?.risks?.conforme) || 0,
      parcial: Number(input?.risks?.parcial) || 0,
      naoConforme: Number(input?.risks?.naoConforme) || 0,
    },
    strengths: input.strengths || [],
    attentionPoints: input.attentionPoints || [],
    criticalIssues: input.criticalIssues || [],
    controlsStatus: input.controlsStatus || [],
    recommendations: input.recommendations || [],
  };
}

/**
 * Gera análise simplificada em modo fallback/contingência.
 * 
 * Ativado quando os serviços de IA atingem seu limite de requisições.
 * Retorna um relatório estruturado com recomendações genéricas baseadas
 * no número de respostas recebidas.
 * 
 * @param {Array|Object} [responses={}] - Respostas do questionário
 * 
 * @returns {Object} Análise em modo fallback contendo:
 * @returns {string} returns.report - Relatório em texto estruturado
 * @returns {string} returns.summary - Resumo executivo
 * @returns {Object} returns.metrics - Métricas calculadas
 * 
 * @example
 * const fallback = generateFallbackAnalysis([{}, {}, {}]);
 * // → { report: "Análise simplificada...", summary: "...", metrics: {...} }
 */
function generateFallbackAnalysis(responses = {}) {
  const total = Array.isArray(responses)
    ? responses.length
    : Object.keys(responses || {}).length;

  return {
    report: `
Análise simplificada gerada automaticamente.

Devido a um limite temporário do serviço de IA, este relatório foi construído com base em padrões estruturados de avaliação.

Resumo:
- Total de respostas analisadas: ${total}
- Foram identificados pontos de melhoria em governança, controle e segurança da informação.

Recomendações:
- Formalizar políticas de proteção de dados
- Revisar controles de acesso
- Implementar rotinas de monitoramento
- Estruturar plano de resposta a incidentes

Assim que o sistema estiver totalmente disponível, uma análise mais detalhada poderá ser gerada.
    `,
    summary: "Relatório gerado em modo de contingência",
    metrics: {
      score: 65,
      risks: {
        conforme: Math.floor(total * 0.3),
        parcial: Math.floor(total * 0.4),
        naoConforme: Math.floor(total * 0.3),
      },
      strengths: ["Processos iniciais definidos"],
      attentionPoints: ["Falta de formalização de políticas"],
      criticalIssues: ["Ausência de monitoramento contínuo"],
      controlsStatus: [
        { name: "Criptografia", value: 40 },
        { name: "Acesso", value: 50 },
        { name: "Backup", value: 60 },
        { name: "Monitoramento", value: 30 },
        { name: "Documentação", value: 45 },
      ],
      recommendations: [
        "Implementar políticas LGPD",
        "Criar plano de resposta a incidentes",
        "Melhorar controle de acesso",
      ],
    },
  };
}

/**
 * Analisa respostas de questionário e gera relatório de conformidade LGPD.
 * 
 * Processa um conjunto de respostas, valida metadados da avaliação no Firestore,
 * e utiliza o serviço de IA (Groq com fallback local) para gerar análise detalhada.
 * O relatório é persistido no Firestore quando disponível.
 * 
 * @async
 * @route {POST} /
 * 
 * @param {Object} req.body - Corpo da requisição
 * @param {string} req.body.userId - ID do usuário realizando a análise (obrigatório)
 * @param {string} req.body.sessionId - ID da sessão/requisição (obrigatório)
 * @param {string} [req.body.assessmentId] - ID da avaliação oficial no Firestore
 * @param {Array|Object} req.body.responses - Respostas ao questionário (não vazio)
 * 
 * @returns {Object} Resposta de sucesso (200) contendo:
 * @returns {string} returns.report - Relatório completo em markdown/texto
 * @returns {string} returns.summary - Resumo executivo
 * @returns {Object} returns.metrics - Métricas de conformidade
 * @returns {Array|Object} returns.responses - Eco das respostas enviadas
 * @returns {Object} returns.assessmentMetadata - Metadados da avaliação
 * @returns {string} returns.reportMode - Modo de geração ("groq", "fallback", "no_persist")
 * @returns {string} returns.reportNotice - Mensagens de aviso/notificação
 * @returns {Date} returns.createdAt - Timestamp de criação
 * 
 * @throws {400} Dados obrigatórios ausentes (userId, sessionId)
 * @throws {400} Respostas vazias
 * @throws {404} Avaliação não encontrada no Firestore
 * @throws {403} Avaliação desativada
 * @throws {503} Firebase Admin não configurado
 * @throws {500} Erro geral ao gerar relatório
 * 
 * @example
 * // POST /api/analyze
 * {
 *   "userId": "user-123",
 *   "sessionId": "session-456",
 *   "assessmentId": "assessment-789",
 *   "responses": [
 *     { question: "Possui política de dados?", answer: "Parcialmente" },
 *     { question: "Implementou criptografia?", answer: "Sim" }
 *   ]
 * }
 * 
 * @example
 * // Response 200
 * {
 *   "report": "# Relatório de Conformidade LGPD\n...",
 *   "summary": "Organização em conformidade parcial",
 *   "metrics": { "score": 78, "risks": {...} },
 *   "reportMode": "groq",
 *   "reportNotice": ""
 * }
 */
router.post("/", async (req, res) => {
  console.log("🟢 ANALYZE NOVO CARREGADO");

  try {
    let adminDb = null;
    let firebaseAdminNotice = "";
    try {
      adminDb = getAdminDb();
    } catch (err) {
      firebaseAdminNotice =
        "Aviso: backend sem Firebase Admin configurado; relatório não será persistido.";
    }

    const { userId, sessionId, assessmentId, responses } = req.body;

    if (!userId || !sessionId) {
      return res.status(400).json({ error: "Dados obrigatórios ausentes" });
    }

    const hasResponses = Array.isArray(responses)
      ? responses.length > 0
      : Object.keys(responses || {}).length > 0;

    if (!hasResponses) {
      return res.status(400).json({ error: "Respostas vazias" });
    }

    let officialAssessment = null;

    if (assessmentId) {
      if (!adminDb) {
        return res.status(503).json({
          error:
            "Firebase Admin não configurado no backend (necessário para buscar metadados da avaliação).",
        });
      }

      officialAssessment = await loadAssessmentMetadata(adminDb, assessmentId);

      if (!officialAssessment) {
        return res.status(404).json({ error: "Avaliação não encontrada" });
      }

      if (officialAssessment.active === false) {
        return res.status(403).json({ error: "Avaliação desativada" });
      }
    }

    const metadata = {
      assessmentId: officialAssessment?.id ?? assessmentId ?? null,
      assessmentTitle: officialAssessment?.title || "",
      assessmentFormType: officialAssessment?.formType || "",
      assessmentObjective: officialAssessment?.objective || "",
      assessmentContext: officialAssessment?.context || "",
      audience: officialAssessment?.audience || "",
      introText: officialAssessment?.introText || "",
      ownerId: officialAssessment?.ownerId || "",
      ownerName: officialAssessment?.ownerName || "",
    };

    let analysis = null;
    let reportMode = "groq";
    let reportNotice = "";

    // 🔥 TENTAR GROQ
    try {
      analysis = await generateFinalReportWithGroq({
        responses,
        metadata,
      });
    } catch (err) {
      console.error("⚠️ Limite do GROQ atingido. Gerando fallback local...", err);

      analysis = generateFallbackAnalysis(responses);

      reportMode = "fallback";
      reportNotice =
        "O sistema atingiu o limite temporário da IA. Exibindo versão simplificada.";
    }

    const safeMetrics = buildSafeMetrics(analysis.metrics || {});

    const finalAnalysis = {
      report: analysis.report,
      summary: analysis.summary || "",
      metrics: safeMetrics,
      responses,
      assessmentMetadata: metadata,
      reportMode,
      reportNotice,
      createdAt: new Date(),
    };

    if (adminDb) {
      await saveFinalReport(userId, sessionId, metadata.assessmentId, finalAnalysis);
    } else {
      finalAnalysis.reportMode = "no_persist";
      finalAnalysis.reportNotice =
        finalAnalysis.reportNotice || firebaseAdminNotice || "";
    }

    console.log("✅ Relatório salvo", {
      userId,
      sessionId,
      mode: reportMode,
    });

    return res.json(finalAnalysis);
  } catch (err) {
    console.error("❌ Erro geral:", err);

    return res.status(500).json({
      error: "Erro ao gerar relatório",
      details: err.message,
    });
  }
});

export default router;