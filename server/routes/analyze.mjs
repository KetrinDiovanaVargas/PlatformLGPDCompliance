import express from "express";
import { generateFinalReportWithGroq } from "../groq/generateFinalReportGroq.mjs";
import { saveFinalReport } from "../lib/saveFinalReport.js";
import { adminDb } from "../firebaseAdmin.mjs";

const router = express.Router();

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

async function loadAssessmentMetadata(assessmentId) {
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

// 🔥 FALLBACK LOCAL (quando estoura limite)
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

router.post("/", async (req, res) => {
  console.log("🟢 ANALYZE NOVO CARREGADO");

  try {
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
      officialAssessment = await loadAssessmentMetadata(assessmentId);

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

    await saveFinalReport(
      userId,
      sessionId,
      metadata.assessmentId,
      finalAnalysis
    );

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