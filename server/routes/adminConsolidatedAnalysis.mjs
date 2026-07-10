import express from "express";
import { getAdminDb } from "../firebaseAdmin.mjs";
import { queuedChatCompletion } from "../lib/ai-client.mjs";

const router = express.Router();

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

async function tryGroqConsolidation({ assessment, reports, aiProvider = "groq" }) {
  const prompt = buildGroqPrompt({ assessment, reports });

  try {
    const raw = await queuedChatCompletion(
      [
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
      {
        preferredProvider: aiProvider,
        temperature: 0.2,
        jsonMode: true,
        priority: 'normal', // Análise consolidada é background job
      }
    );

    const parsed = extractJson(raw);

    if (!parsed) {
      console.warn("⚠️ IA retornou JSON inválido, usando fallback. Raw:", raw.substring(0, 200));
      throw new Error("IA retornou JSON inválido na consolidação.");
    }

    console.log(`✅ Análise consolidada gerada com sucesso via ${aiProvider}`);
    return normalizeGroqAnalysis(parsed, reports.length);
  } catch (err) {
    console.error("❌ Erro ao chamar IA:", err?.message || err);
    throw err;
  }
}

router.post("/", async (req, res) => {
  try {
    console.log("📥 Requisição de análise consolidada recebida");
    const { assessmentId } = req.body || {};

    if (!assessmentId) {
      return res.status(400).json({ error: "assessmentId é obrigatório." });
    }

    console.log(`🔍 Carregando análise para avaliação: ${assessmentId}`);
    let adminDb;
    try {
      adminDb = getAdminDb();
      console.log("✅ Firebase Admin SDK inicializado");
    } catch (err) {
      console.warn("⚠️  Firebase Admin não configurado, retornando análise em modo demo");
      console.error("Detalhes do erro:", err?.message);

      return res.json({
        mode: "demo",
        message: "Análise em modo demonstração (Firebase não configurado)",
        notice: "Configure serviceAccountKey.json ou variáveis de ambiente do Firebase para análise completa.",
        reportsCount: 0,
        scoreAverage: 68,
        topCriticalIssues: [
          { label: "Implementar política de retenção de dados", count: 3 },
          { label: "Documentar fluxos de consentimento", count: 2 },
        ],
        topStrengths: [
          { label: "Criptografia em trânsito implementada", count: 3 },
          { label: "Logs de acesso ativados", count: 2 },
        ],
        topAttentionPoints: [
          { label: "Revisar acessos de terceiros", count: 2 },
          { label: "Atualizar política de privacidade", count: 1 },
        ],
        recommendations: [
          { title: "Implementar Data Protection Impact Assessment (DPIA)", priority: "Alta" },
          { title: "Estabelecer cronograma de treinamento LGPD", priority: "Alta" },
          { title: "Revisar contatos com processadores de dados", priority: "Média" },
        ],
      });
    }

    console.log("📂 Buscando avaliação no Firestore...");
    const assessmentSnap = await adminDb
      .collection("assessments")
      .doc(String(assessmentId))
      .get();

    if (!assessmentSnap.exists) {
      console.warn(`⚠️ Avaliação ${assessmentId} não encontrada`);
      return res.status(404).json({ error: "Avaliação não encontrada." });
    }

    console.log("✅ Avaliação encontrada");
    const assessment = {
      id: assessmentSnap.id,
      ...(assessmentSnap.data() || {}),
    };

    console.log("📋 Buscando sessões completas...");
    const sessionsSnap = await adminDb
      .collection("assessment_sessions")
      .where("assessmentId", "==", String(assessmentId))
      .where("status", "==", "completed")
      .get();

    console.log(`✅ ${sessionsSnap.docs.length} sessões encontradas`);
    const sessionDocs = sessionsSnap.docs;

    if (!sessionDocs.length) {
      console.log("ℹ️ Nenhuma sessão encontrada");
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

    console.log("📊 Carregando relatórios finais...");
    const reports = [];

    for (const sessionDoc of sessionDocs) {
      try {
        const latestRef = adminDb
          .collection("assessment_sessions")
          .doc(sessionDoc.id)
          .collection("final_report")
          .doc("latest");

        const latestSnap = await latestRef.get();

        if (!latestSnap.exists) {
          console.log(`  ℹ️ Sessão ${sessionDoc.id} sem relatório final`);
          continue;
        }

        reports.push({
          sessionId: sessionDoc.id,
          ...(latestSnap.data() || {}),
        });
        console.log(`  ✅ Relatório carregado para sessão ${sessionDoc.id}`);
      } catch (err) {
        console.error(`  ❌ Erro ao carregar relatório da sessão ${sessionDoc.id}:`, err?.message);
      }
    }

    console.log(`✅ ${reports.length} relatórios carregados com sucesso`);

    if (!reports.length) {
      console.log("ℹ️ Nenhum relatório final disponível");
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
      const aiProvider = assessment?.aiProvider || "groq";
      console.log(`🤖 Chamando ${aiProvider} API para análise consolidada...`);
      const groqResult = await tryGroqConsolidation({ assessment, reports, aiProvider });
      console.log("✅ Análise consolidada gerada com sucesso");
      return res.json(groqResult);
    } catch (groqError) {
      console.error("❌ Erro na análise consolidada:", groqError?.message || groqError);
      console.log("📋 Usando análise em modo contingência (fallback)");

      const fallback = buildFallbackAnalysis(assessment, reports);
      return res.json(fallback);
    }
  } catch (error) {
    console.error("❌ ERRO CRÍTICO ao gerar análise consolidada:", error?.message || error);
    console.error("Stack trace completo:", error?.stack);

    return res.status(500).json({
      error: "Erro ao gerar análise consolidada.",
      message: error?.message || "Erro desconhecido",
      details: error?.stack,
      mode: "error"
    });
  }
});

export default router;