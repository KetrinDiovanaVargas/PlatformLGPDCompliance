// server/routes/analyze.mjs
import express from "express";
import { generateFinalReportWithGroq } from "../groq/generateFinalReportGroq.mjs";
import { saveFinalReport } from "../lib/saveFinalReport.js";
import { getAdminDb } from "../firebaseAdmin.mjs";

const router = express.Router();

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

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
    ownerId: safeString(data.ownerId),
    ownerName: safeString(data.ownerName),
    active: data.active !== false,
  };
}

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
    });

    const analysis = await generateFinalReportWithGroq({
      responses,
      metadata: officialMetadata,
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