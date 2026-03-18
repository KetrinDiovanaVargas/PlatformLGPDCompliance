import express from "express";
import Groq from "groq-sdk";
import { adminDb } from "../firebaseAdmin.mjs";

const router = express.Router();

router.options("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.status(204).end();
});

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não encontrada");
  return new Groq({ apiKey });
}

function safeString(v) {
  return String(v ?? "").trim();
}

function average(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function flatten(arr) {
  return arr.flat().filter(Boolean);
}

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

function isRateLimit(err) {
  const msg = safeString(err?.message).toLowerCase();
  return msg.includes("rate limit") || err?.status === 429;
}

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

async function generateWithGroq(reports, assessmentTitle = "") {
  const groq = getGroqClient();

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

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "Retorne apenas JSON válido." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = completion?.choices?.[0]?.message?.content || "";
  const parsed = extractJson(raw);

  if (!parsed) {
    throw new Error("Resposta inválida do GROQ na análise consolidada");
  }

  return parsed;
}

router.post("/", async (req, res) => {
  try {
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

    // 🔥 BUSCA RELATÓRIOS MAIS RECENTES
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