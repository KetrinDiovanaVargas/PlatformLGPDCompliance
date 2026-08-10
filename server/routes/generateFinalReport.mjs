/**
 * 
 * Módulo que expõe endpoints HTTP para análise de conformidade LGPD com
 * suporte a múltiplos provedores de IA. Processa respostas de questionários,
 * valida metadados da avaliação no Firestore e gera relatórios detalhados
 * utilizando cascade configurável de LLMs.
 * 
 * @module routes/analyze
 * 
 * @requires express
 * @requires ../groq/generateFinalReportGroq.mjs
 * @requires ../lib/saveFinalReport.js
 * @requires ../firebaseAdmin.mjs
 * 
 * Integração:
 * - Firebase Firestore para armazenamento de metadados e relatórios
 * - AI Client (cascade LLM) para análise semântica com fallback
 * - Report Generator para formatação estruturada de relatórios
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
 * Converte valor para string segura, trimada e nunca null.
 * 
 * Garante que valores undefined/null sejam convertidos para fallback
 * e remove espaços em branco desnecessários. Essencial para sanitizar
 * dados vindos do Firestore onde podem conter tipos inesperados.
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
 * Carrega metadados completos da avaliação a partir do Firestore.
 * 
 * Busca informações estruturais da avaliação como título, objetivo,
 * público-alvo, contexto, provedor de IA configurado e informações
 * do proprietário. Retorna null se a avaliação não existir.
 * 
 * Dados carregados:
 * - Identificadores e títulos
 * - Objetivo e contexto da avaliação
 * - Público-alvo e texto introdutório
 * - Provedor de IA a utilizar (groq, claude, deepseek, gemini)
 * - Informações de proprietário
 * - Status ativo/inativo da avaliação
 * 
 * @async
 * @param {*} adminDb - Instância de admin Firestore
 * @param {string} assessmentId - ID da avaliação
 * 
 * @returns {Promise<Object|null>} Metadados completos ou null se não encontrado
 * @returns {string} returns.id - ID da avaliação
 * @returns {string} returns.title - Título descritivo
 * @returns {string} returns.formType - Tipo de formulário
 * @returns {string} returns.objective - Objetivo da avaliação
 * @returns {string} returns.context - Contexto de aplicação
 * @returns {string} returns.audience - Público-alvo
 * @returns {string} returns.introText - Texto introdutório
 * @returns {string} returns.aiProvider - Provedor de IA (padrão: "groq")
 * @returns {string} returns.ownerId - ID do proprietário
 * @returns {string} returns.ownerName - Nome do proprietário
 * @returns {boolean} returns.active - Se está ativa
 * 
 * @throws Pode lançar erro se Firestore não estiver acessível
 * 
 * @example
 * const metadata = await loadAssessmentMetadata(adminDb, "assessment-123");
 * // → { id: "assessment-123", title: "LGPD Compliance", aiProvider: "groq", ... }
 */
async function loadAssessmentMetadata(adminDb, assessmentId) {
  if (!assessmentId) return null;

  const snap = await adminDb
    .collection("assessments")
    .doc(String(assessmentId))
    .get();

  if (!snap.exists) {
    return null;
  }

  const data = snap.data() || {};

  return {
    id: snap.id,
    title: safeString(data.title),
    formType: safeString(data.formType),
    objective: safeString(data.objective || data.category),
    context: safeString(data.context),
    audience: safeString(data.audience),
    introText: safeString(data.introText),
    aiProvider: safeString(data.aiProvider, "groq"),
    ownerId: safeString(data.ownerId),
    ownerName: safeString(data.ownerName),
    active: data.active !== false,
  };
}

/**
 * Constrói objeto de métricas seguro, normalizado e completo.
 * 
 * Transforma dados brutos de métricas em estrutura garantida com
 * validação de tipos e valores padrão. Assegura que arrays vazios
 * e valores inválidos sejam tratados graciosamente.
 * 
 * Estrutura de retorno:
 * - Score: número finito entre 0-100
 * - Riscos: contagem por categoria (conforme, parcial, não-conforme)
 * - Strengths: pontos fortes identificados
 * - Attention Points: pontos que precisam de atenção
 * - Critical Issues: problemas críticos encontrados
 * - Controls Status: status de controles (com valores padrão se vazio)
 * - Recommendations: recomendações de remediação
 * 
 * @param {Object} [input={}] - Objeto de métricas bruto
 * @param {number|string} input.score - Score geral (0-100)
 * @param {Object} input.risks - Contagem de riscos
 * @param {number} input.risks.conforme - Itens em conformidade
 * @param {number} input.risks.parcial - Itens em conformidade parcial
 * @param {number} input.risks.naoConforme - Itens não conforme
 * @param {Array<string>} input.strengths - Pontos fortes
 * @param {Array<string>} input.attentionPoints - Pontos de atenção
 * @param {Array<string>} input.criticalIssues - Questões críticas
 * @param {Array<Object>} input.controlsStatus - Status dos controles
 * @param {string} input.controlsStatus[].name - Nome do controle
 * @param {number} input.controlsStatus[].value - Valor do controle (0-100)
 * @param {Array<string>} input.recommendations - Recomendações
 * 
 * @returns {Object} Métricas normalizadas e seguras
 * @returns {number} returns.score - Score numérico validado
 * @returns {Object} returns.risks - Riscos contabilizados
 * @returns {Array} returns.strengths - Pontos fortes
 * @returns {Array} returns.attentionPoints - Pontos de atenção
 * @returns {Array} returns.criticalIssues - Questões críticas
 * @returns {Array} returns.controlsStatus - Status dos controles (com defaults)
 * @returns {Array} returns.recommendations - Recomendações
 * 
 * @example
 * const metrics = buildSafeMetrics({
 *   score: "85.5",
 *   risks: { conforme: "10", parcial: "5" },
 *   strengths: ["Políticas definidas"]
 * });
 * // → { score: 85.5, risks: { conforme: 10, parcial: 5, naoConforme: 0 }, ... }
 * 
 * @example
 * // Com input vazio, retorna estrutura completa com defaults
 * const metrics = buildSafeMetrics();
 * // → { score: 0, risks: {...}, controlsStatus: [{name: "Criptografia", value: 0}, ...] }
 */
function buildSafeMetrics(input = {}) {
  const score = Number.isFinite(Number(input?.score)) ? Number(input.score) : 0;

  const risks = {
    conforme: Number(input?.risks?.conforme) || 0,
    parcial: Number(input?.risks?.parcial) || 0,
    naoConforme: Number(input?.risks?.naoConforme) || 0,
  };

  return {
    score,
    risks,
    strengths: Array.isArray(input?.strengths) ? input.strengths : [],
    attentionPoints: Array.isArray(input?.attentionPoints)
      ? input.attentionPoints
      : [],
    criticalIssues: Array.isArray(input?.criticalIssues)
      ? input.criticalIssues
      : [],
    controlsStatus:
      Array.isArray(input?.controlsStatus) && input.controlsStatus.length > 0
        ? input.controlsStatus
        : [
            { name: "Criptografia", value: 0 },
            { name: "Acesso", value: 0 },
            { name: "Backup", value: 0 },
            { name: "Monitoramento", value: 0 },
            { name: "Documentação", value: 0 },
          ],
    recommendations: Array.isArray(input?.recommendations)
      ? input.recommendations
      : [],
  };
}

/**
 * Analisa respostas de questionário LGPD e gera relatório de conformidade.
 * 
 * Fluxo de processamento:
 * 1. Valida campos obrigatórios (userId, sessionId, respostas)
 * 2. Carrega metadados da avaliação do Firestore (se assessmentId informado)
 * 3. Verifica se avaliação está ativa
 * 4. Seleciona provedor de IA (groq, claude, etc) conforme configurado
 * 5. Gera análise via provedor de IA
 * 6. Valida integridade do resultado
 * 7. Normaliza métricas
 * 8. Persiste em Firestore
 * 9. Retorna relatório completo com métricas
 * 
 * ✅ **Garantia de Qualidade**: Análise vazia ou muito curta (< 20 caracteres)
 * causa rejeição imediata para evitar resultados ruins.
 * 
 * @async
 * @route {POST} /
 * 
 * @param {Object} req.body - Corpo da requisição
 * @param {string} req.body.userId - ID do usuário (obrigatório)
 * @param {string} req.body.sessionId - ID da sessão/requisição (obrigatório)
 * @param {string} [req.body.assessmentId] - ID da avaliação oficial
 * @param {Array|Object} req.body.responses - Respostas ao questionário (obrigatório, não-vazio)
 * 
 * @returns {Object} Resposta de sucesso (200):
 * @returns {string} returns.report - Relatório completo em markdown/texto
 * @returns {string} returns.summary - Resumo executivo da análise
 * @returns {Object} returns.metrics - Objeto completo de métricas
 * @returns {number} returns.score - Score de conformidade (0-100)
 * @returns {Object} returns.risks - Contagem de riscos por categoria
 * @returns {Array<string>} returns.strengths - Pontos fortes identificados
 * @returns {Array<string>} returns.attentionPoints - Pontos que precisam atenção
 * @returns {Array<string>} returns.criticalIssues - Questões críticas
 * @returns {Array<Object>} returns.controlsStatus - Status dos controles implementados
 * @returns {Array<string>} returns.recommendations - Recomendações de remediação
 * @returns {Array<Object>} returns.controls - Lista de controles analisados
 * @returns {Array<string>} returns.framework - Frameworks aplicados (LGPD, ISO/IEC 27001)
 * @returns {Array|Object} returns.responses - Eco das respostas processadas
 * @returns {Object} returns.assessmentMetadata - Metadados da avaliação utilizada
 * @returns {Date} returns.createdAt - Timestamp de criação do relatório
 * 
 * @throws {400} userId ausente
 * @throws {400} sessionId ausente
 * @throws {400} Respostas vazias
 * @throws {404} Avaliação não encontrada no Firestore
 * @throws {403} Avaliação desativada
 * @throws {503} Firebase Admin não configurado (necessário para buscar metadados)
 * @throws {500} Erro ao gerar relatório (análise inválida ou muito curta)
 * @throws {500} Erro geral ao processar análise
 * 
 * @example
 * // POST /api/analyze
 * // Content-Type: application/json
 * {
 *   "userId": "user-123",
 *   "sessionId": "session-456",
 *   "assessmentId": "assessment-789",
 *   "responses": [
 *     { question: "Possui política de dados?", answer: "Sim" },
 *     { question: "Implementou criptografia?", answer: "Parcialmente" }
 *   ]
 * }
 * 
 * @example
 * // Response 200 (sucesso)
 * {
 *   "report": "# Relatório de Conformidade LGPD\n\n...",
 *   "summary": "Organização em conformidade parcial com LGPD",
 *   "score": 78,
 *   "metrics": { "score": 78, "risks": {...}, ... },
 *   "risks": { "conforme": 12, "parcial": 8, "naoConforme": 5 },
 *   "strengths": ["Políticas de dados definidas"],
 *   "attentionPoints": ["Falta de treinamento"],
 *   "criticalIssues": ["Sem DPA assinado"],
 *   "controlsStatus": [{name: "Criptografia", value: 75}, ...],
 *   "recommendations": ["Assiniar DPAs com fornecedores", ...],
 *   "framework": ["LGPD", "ISO/IEC 27001"],
 *   "assessmentMetadata": {...},
 *   "createdAt": "2026-08-09T14:30:00.000Z"
 * }
 * 
 * @example
 * // Response 400 (userId ausente)
 * {
 *   "error": "userId ausente"
 * }
 * 
 * @example
 * // Response 404 (avaliação não encontrada)
 * {
 *   "error": "Avaliação não encontrada"
 * }
 * 
 * @example
 * // Response 403 (avaliação desativada)
 * {
 *   "error": "Avaliação desativada"
 * }
 * 
 * @example
 * // Response 500 (análise inválida)
 * {
 *   "error": "Erro ao gerar relatório final",
 *   "details": "Relatório inválido"
 * }
 */
router.post("/", async (req, res) => {
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

    if (!userId) {
      return res.status(400).json({ error: "userId ausente" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId ausente" });
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

    const aiProvider = officialAssessment?.aiProvider || "groq";

    const officialMetadata = {
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

    console.log("📥 Respostas recebidas para análise", {
      userId,
      sessionId,
      assessmentId: officialMetadata.assessmentId,
      responsesCount: Array.isArray(responses)
        ? responses.length
        : Object.keys(responses || {}).length,
      assessmentTitle: officialMetadata.assessmentTitle || null,
      assessmentObjective: officialMetadata.assessmentObjective || null,
      audience: officialMetadata.audience || null,
      aiProvider,
    });

    const analysis = await generateFinalReportWithGroq({
      responses,
      metadata: officialMetadata,
      aiProvider,
    });

    if (!analysis || typeof analysis !== "object") {
      throw new Error("Análise inválida gerada pelo Groq");
    }

    if (!analysis.report || String(analysis.report).trim().length < 20) {
      throw new Error("Relatório inválido");
    }

    const safeMetrics = buildSafeMetrics(analysis.metrics ?? {});

    const finalAnalysis = {
      report: analysis.report ?? "",
      metrics: safeMetrics,
      summary: analysis.summary ?? "",
      controls: Array.isArray(analysis.controls) ? analysis.controls : [],
      framework: ["LGPD", "ISO/IEC 27001"],
      responses,
      assessmentMetadata: officialMetadata,
      createdAt: new Date(),
    };

    if (adminDb) {
      await saveFinalReport(
        userId,
        sessionId,
        officialMetadata.assessmentId,
        finalAnalysis
      );
    } else {
      finalAnalysis.reportMode = "no_persist";
      finalAnalysis.reportNotice = firebaseAdminNotice;
    }

    console.log("✅ Relatório salvo", {
      sessionId,
      assessmentId: officialMetadata.assessmentId,
    });

    return res.json({
      ...finalAnalysis,
      score: safeMetrics.score,
      risks: safeMetrics.risks,
      strengths: safeMetrics.strengths,
      attentionPoints: safeMetrics.attentionPoints,
      criticalIssues: safeMetrics.criticalIssues,
      controlsStatus: safeMetrics.controlsStatus,
      recommendations: safeMetrics.recommendations,
    });
  } catch (error) {
    console.error("❌ Erro ao gerar relatório final:", error);

    return res.status(500).json({
      error: "Erro ao gerar relatório final",
      details: error.message,
    });
  }
});

export default router;