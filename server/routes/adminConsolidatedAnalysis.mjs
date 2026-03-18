import express from "express";
import Groq from "groq-sdk";
import { adminDb } from "../firebaseAdmin.mjs";

const router = express.Router();

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY não carregada no backend");
  }

  return new Groq({ apiKey });
}

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeText(text) {
  return safeString(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    console.error("❌ JSON bruto:", jsonString);
    return null;
  }
}

function normalizePriority(priority) {
  const normalized = safeString(priority).toLowerCase();

  if (normalized === "alta") return "Alta";
  if (normalized === "média" || normalized === "media") return "Média";
  if (normalized === "baixa") return "Baixa";

  return "Média";
}

function normalizeRecommendationArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      title: safeString(item?.title || item),
      priority: normalizePriority(item?.priority),
    }))
    .filter((item) => item.title)
    .slice(0, 6);
}

function normalizeConsolidatedItems(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      label: safeString(item?.label || item?.title || item?.name || item),
      count: Math.max(1, Number(item?.count) || 1),
    }))
    .filter((item) => item.label)
    .slice(0, 6);
}

function average(numbers = []) {
  if (!numbers.length) return 0;
  const total = numbers.reduce((sum, n) => sum + Number(n || 0), 0);
  return Math.round(total / numbers.length);
}

function buildCountMap(items = []) {
  const map = new Map();

  for (const raw of items) {
    const label = safeString(raw);
    if (!label) continue;

    const key = normalizeText(label);
    if (!key) continue;

    const current = map.get(key);

    if (current) {
      current.count += 1;
    } else {
      map.set(key, { label, count: 1 });
    }
  }

  return map;
}

function topItemsFromArray(items = [], limit = 5) {
  const map = buildCountMap(items);

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function topRecommendationsFromReports(reports = [], limit = 5) {
  const map = new Map();

  for (const report of reports) {
    const recommendations = Array.isArray(report?.metrics?.recommendations)
      ? report.metrics.recommendations
      : [];

    for (const rec of recommendations) {
      const title = safeString(rec?.title);
      if (!title) continue;

      const key = normalizeText(title);
      if (!key) continue;

      const priority = normalizePriority(rec?.priority);

      const existing = map.get(key);

      if (existing) {
        existing.count += 1;

        if (priority === "Alta") {
          existing.priority = "Alta";
        } else if (priority === "Média" && existing.priority !== "Alta") {
          existing.priority = "Média";
        }
      } else {
        map.set(key, {
          title,
          priority,
          count: 1,
        });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map(({ title, priority }) => ({ title, priority }));
}

function buildFallbackAnalysis(assessment, reports) {
  const scores = reports
    .map((item) => Number(item?.metrics?.score))
    .filter((n) => Number.isFinite(n));

  const criticalIssues = reports.flatMap((item) =>
    Array.isArray(item?.metrics?.criticalIssues)
      ? item.metrics.criticalIssues
      : []
  );

  const strengths = reports.flatMap((item) =>
    Array.isArray(item?.metrics?.strengths) ? item.metrics.strengths : []
  );

  const attentionPoints = reports.flatMap((item) =>
    Array.isArray(item?.metrics?.attentionPoints)
      ? item.metrics.attentionPoints
      : []
  );

  const recommendations = topRecommendationsFromReports(reports, 5);

  return {
    mode: "fallback",
    message: `Análise consolidada gerada em modo contingência para "${safeString(
      assessment?.title,
      "avaliação"
    )}".`,
    notice:
      "A consolidação foi montada sem consumir IA nesta execução. Os dados foram agrupados automaticamente a partir dos relatórios salvos.",
    reportsCount: reports.length,
    scoreAverage: average(scores),
    topCriticalIssues: topItemsFromArray(criticalIssues, 5),
    topStrengths: topItemsFromArray(strengths, 5),
    topAttentionPoints: topItemsFromArray(attentionPoints, 5),
    recommendations,
  };
}

function normalizeGroqAnalysis(parsed, reportsCount) {
  return {
    mode: "groq",
    message: safeString(parsed?.message, "Análise consolidada gerada com IA."),
    notice: safeString(parsed?.notice),
    reportsCount,
    scoreAverage: Math.max(0, Math.min(100, Number(parsed?.scoreAverage) || 0)),
    topCriticalIssues: normalizeConsolidatedItems(parsed?.topCriticalIssues),
    topStrengths: normalizeConsolidatedItems(parsed?.topStrengths),
    topAttentionPoints: normalizeConsolidatedItems(parsed?.topAttentionPoints),
    recommendations: normalizeRecommendationArray(parsed?.recommendations),
  };
}

function buildGroqPrompt({ assessment, reports }) {
  const compactReports = reports.map((item) => ({
    sessionId: item.sessionId || null,
    score: Number(item?.metrics?.score ?? 0),
    criticalIssues: Array.isArray(item?.metrics?.criticalIssues)
      ? item.metrics.criticalIssues
      : [],
    strengths: Array.isArray(item?.metrics?.strengths)
      ? item.metrics.strengths
      : [],
    attentionPoints: Array.isArray(item?.metrics?.attentionPoints)
      ? item.metrics.attentionPoints
      : [],
    recommendations: Array.isArray(item?.metrics?.recommendations)
      ? item.metrics.recommendations.map((rec) => ({
          title: rec?.title || "",
          priority: rec?.priority || "Média",
        }))
      : [],
    summary: safeString(item?.summary),
  }));

  return `
Você é um especialista em LGPD, ISO/IEC 27001 e análise executiva de resultados consolidados.

Sua função é consolidar múltiplos relatórios de uma mesma avaliação em uma visão gerencial objetiva.

RETORNE APENAS JSON VÁLIDO.
NÃO use markdown.
NÃO escreva texto fora do JSON.
NÃO use crases.

JSON OBRIGATÓRIO:
{
  "message": "string",
  "notice": "string",
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

REGRAS:
- scoreAverage deve ser de 0 a 100.
- topCriticalIssues, topStrengths e topAttentionPoints devem trazer os principais temas recorrentes.
- cada item deve ter:
  - label: texto curto
  - count: quantidade de recorrência
- recommendations deve trazer de 3 a 6 recomendações executivas.
- priority deve ser Alta, Média ou Baixa.
- a análise deve considerar o contexto oficial da avaliação.
- o notice pode explicar brevemente o que foi consolidado.
- não invente dados fora dos relatórios fornecidos.

DADOS OFICIAIS DA AVALIAÇÃO:
${JSON.stringify(
  {
    id: assessment?.id || null,
    title: assessment?.title || "",
    formType: assessment?.formType || "",
    objective: assessment?.objective || "",
    audience: assessment?.audience || "",
    context: assessment?.context || "",
  },
  null,
  2
)}

RELATÓRIOS INDIVIDUAIS:
${JSON.stringify(compactReports, null, 2)}
`.trim();
}

async function tryGroqConsolidation({ assessment, reports }) {
  const groq = getGroqClient();
  const prompt = buildGroqPrompt({ assessment, reports });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Retorne apenas JSON válido e siga rigorosamente o formato solicitado.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = completion?.choices?.[0]?.message?.content || "";
  const parsed = extractJson(raw);

  if (!parsed) {
    throw new Error("Groq retornou JSON inválido na consolidação.");
  }

  return normalizeGroqAnalysis(parsed, reports.length);
}

router.post("/", async (req, res) => {
  try {
    const { assessmentId } = req.body || {};

    if (!assessmentId) {
      return res.status(400).json({ error: "assessmentId é obrigatório." });
    }

    const assessmentSnap = await adminDb
      .collection("assessments")
      .doc(String(assessmentId))
      .get();

    if (!assessmentSnap.exists) {
      return res.status(404).json({ error: "Avaliação não encontrada." });
    }

    const assessment = {
      id: assessmentSnap.id,
      ...(assessmentSnap.data() || {}),
    };

    const sessionsSnap = await adminDb
      .collection("assessment_sessions")
      .where("assessmentId", "==", String(assessmentId))
      .where("status", "==", "completed")
      .get();

    const sessionDocs = sessionsSnap.docs;

    if (!sessionDocs.length) {
      return res.json({
        mode: "empty",
        message: "Nenhum relatório encontrado para esta avaliação.",
        reportsCount: 0,
        scoreAverage: 0,
        topCriticalIssues: [],
        topStrengths: [],
        topAttentionPoints: [],
        recommendations: [],
      });
    }

    const reports = [];

    for (const sessionDoc of sessionDocs) {
      const latestRef = adminDb
        .collection("assessment_sessions")
        .doc(sessionDoc.id)
        .collection("final_report")
        .doc("latest");

      const latestSnap = await latestRef.get();

      if (!latestSnap.exists) continue;

      reports.push({
        sessionId: sessionDoc.id,
        ...(latestSnap.data() || {}),
      });
    }

    if (!reports.length) {
      return res.json({
        mode: "empty",
        message: "Nenhum relatório final encontrado para esta avaliação.",
        reportsCount: 0,
        scoreAverage: 0,
        topCriticalIssues: [],
        topStrengths: [],
        topAttentionPoints: [],
        recommendations: [],
      });
    }

    try {
      const groqResult = await tryGroqConsolidation({ assessment, reports });
      return res.json(groqResult);
    } catch (groqError) {
      console.error("❌ Erro na análise consolidada com Groq:", groqError);

      const fallback = buildFallbackAnalysis(assessment, reports);
      return res.json(fallback);
    }
  } catch (error) {
    console.error("❌ Erro ao gerar análise consolidada:", error);
    return res.status(500).json({
      error: "Erro ao gerar análise consolidada.",
      details: error.message,
    });
  }
});

export default router;