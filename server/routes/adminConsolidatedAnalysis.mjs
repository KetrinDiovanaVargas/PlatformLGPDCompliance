/**
 * @file Rota administrativa de análise consolidada de avaliações.
 *
 * Agrega os relatórios finais de todas as sessões concluídas de uma avaliação
 * em uma visão gerencial única (score médio, temas recorrentes e recomendações
 * executivas). A consolidação é tentada primeiro via IA e, em caso de falha,
 * recai em um agrupamento determinístico local (modo contingência).
 *
 * @module routes/adminConsolidatedAnalysis
 */

import express from "express";
import { getAdminDb } from "../firebaseAdmin.mjs";
import { queuedChatCompletion } from "../lib/ai-client.mjs";

const router = express.Router();

/**
 * Converte qualquer valor em string aparada, protegendo contra `null`/`undefined`.
 *
 * @param {*} value - Valor de origem.
 * @param {string} [fallback=""] - Valor usado quando `value` é `null` ou `undefined`.
 * @returns {string} String resultante, sem espaços nas extremidades.
 */
function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

/**
 * Normaliza um texto para uso como chave de agrupamento: minúsculas, sem
 * acentuação, sem pontuação e com espaços colapsados.
 *
 * @param {*} text - Texto a normalizar.
 * @returns {string} Texto normalizado (string vazia se não houver conteúdo).
 */
function normalizeText(text) {
  return safeString(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai o primeiro objeto JSON contido em uma resposta da IA, removendo
 * cercas de markdown (```json) e qualquer texto ao redor.
 *
 * @param {string} text - Resposta bruta do modelo.
 * @returns {Object|null} Objeto parseado ou `null` se não houver JSON válido.
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
    console.error("❌ JSON bruto:", jsonString);
    return null;
  }
}

/**
 * Converte uma prioridade arbitrária para um dos rótulos canônicos aceitos.
 *
 * @param {*} priority - Prioridade informada (ex.: "alta", "media", "Baixa").
 * @returns {"Alta"|"Média"|"Baixa"} Prioridade canônica; `"Média"` quando não reconhecida.
 */
function normalizePriority(priority) {
  const normalized = safeString(priority).toLowerCase();

  if (normalized === "alta") return "Alta";
  if (normalized === "média" || normalized === "media") return "Média";
  if (normalized === "baixa") return "Baixa";

  return "Média";
}

/**
 * Recomendação executiva consolidada.
 *
 * @typedef {Object} Recommendation
 * @property {string} title - Título curto da recomendação.
 * @property {"Alta"|"Média"|"Baixa"} priority - Prioridade canônica.
 */

/**
 * Tema recorrente identificado nos relatórios (ponto crítico, força ou atenção).
 *
 * @typedef {Object} ConsolidatedItem
 * @property {string} label - Texto curto do tema.
 * @property {number} count - Quantidade de ocorrências entre os relatórios.
 */

/**
 * Payload de análise consolidada devolvido pela rota.
 *
 * @typedef {Object} ConsolidatedAnalysis
 * @property {"groq"|"fallback"|"demo"|"empty"} mode - Origem da consolidação.
 * @property {string} message - Mensagem executiva principal.
 * @property {string} [notice] - Observação sobre como a consolidação foi montada.
 * @property {number} reportsCount - Quantidade de relatórios considerados.
 * @property {number} scoreAverage - Score médio (0 a 100).
 * @property {ConsolidatedItem[]} topCriticalIssues - Principais pontos críticos.
 * @property {ConsolidatedItem[]} topStrengths - Principais pontos fortes.
 * @property {ConsolidatedItem[]} topAttentionPoints - Principais pontos de atenção.
 * @property {Recommendation[]} recommendations - Recomendações executivas.
 */

/**
 * Normaliza uma lista de recomendações vinda da IA, descartando itens sem
 * título e limitando o resultado a 6 entradas.
 *
 * @param {*} value - Valor bruto; se não for array, retorna lista vazia.
 * @returns {Recommendation[]} Recomendações normalizadas.
 */
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

/**
 * Normaliza uma lista de temas recorrentes vinda da IA, aceitando as chaves
 * `label`, `title` ou `name` (ou strings simples) e garantindo `count >= 1`.
 *
 * @param {*} value - Valor bruto; se não for array, retorna lista vazia.
 * @returns {ConsolidatedItem[]} Itens normalizados, limitados a 6 entradas.
 */
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

/**
 * Calcula a média aritmética arredondada de uma lista numérica.
 *
 * @param {number[]} [numbers=[]] - Valores a considerar.
 * @returns {number} Média arredondada; `0` para lista vazia.
 */
function average(numbers = []) {
  if (!numbers.length) return 0;
  const total = numbers.reduce((sum, n) => sum + Number(n || 0), 0);
  return Math.round(total / numbers.length);
}

/**
 * Agrupa textos equivalentes (comparados via {@link normalizeText}) e conta
 * suas ocorrências, preservando a primeira grafia encontrada como rótulo.
 *
 * @param {*[]} [items=[]] - Textos a agrupar.
 * @returns {Map<string, ConsolidatedItem>} Mapa de chave normalizada para item contado.
 */
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

/**
 * Retorna os textos mais recorrentes de uma lista, ordenados por contagem
 * decrescente e, em caso de empate, alfabeticamente.
 *
 * @param {*[]} [items=[]] - Textos a ranquear.
 * @param {number} [limit=5] - Quantidade máxima de itens retornados.
 * @returns {ConsolidatedItem[]} Temas mais frequentes.
 */
function topItemsFromArray(items = [], limit = 5) {
  const map = buildCountMap(items);

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/**
 * Consolida as recomendações de vários relatórios, agrupando títulos
 * equivalentes e mantendo sempre a maior prioridade observada
 * (Alta > Média > Baixa).
 *
 * @param {Object[]} [reports=[]] - Relatórios finais das sessões.
 * @param {number} [limit=5] - Quantidade máxima de recomendações retornadas.
 * @returns {Recommendation[]} Recomendações mais recorrentes.
 */
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

/**
 * Monta a análise consolidada em modo contingência, sem consumir IA, apenas
 * agregando os dados já presentes nos relatórios salvos.
 *
 * @param {Object} assessment - Documento da avaliação (usado para o título).
 * @param {Object[]} reports - Relatórios finais das sessões concluídas.
 * @returns {ConsolidatedAnalysis} Análise no modo `"fallback"`.
 */
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

/**
 * Sanitiza o JSON devolvido pela IA no formato de resposta da rota, limitando
 * o score ao intervalo 0–100 e normalizando listas e prioridades.
 *
 * @param {Object} parsed - Objeto JSON extraído da resposta da IA.
 * @param {number} reportsCount - Quantidade de relatórios consolidados.
 * @returns {ConsolidatedAnalysis} Análise no modo `"groq"`.
 */
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

/**
 * Constrói o prompt de consolidação enviado à IA, com o contexto oficial da
 * avaliação e uma versão compacta dos relatórios individuais.
 *
 * @param {Object} params
 * @param {Object} params.assessment - Documento da avaliação.
 * @param {Object[]} params.reports - Relatórios finais das sessões.
 * @returns {string} Prompt pronto para envio.
 */
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

/**
 * Executa a consolidação via IA e devolve o resultado já normalizado.
 *
 * @param {Object} params
 * @param {Object} params.assessment - Documento da avaliação.
 * @param {Object[]} params.reports - Relatórios finais das sessões.
 * @param {string} [params.aiProvider="groq"] - Provedor de IA preferencial.
 * @returns {Promise<ConsolidatedAnalysis>} Análise no modo `"groq"`.
 * @throws {Error} Se a chamada à IA falhar ou o retorno não contiver JSON válido;
 *   o chamador deve recair em {@link buildFallbackAnalysis}.
 */
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

/**
 * POST / — Gera a análise consolidada de uma avaliação.
 *
 * Fluxo: valida `assessmentId` → carrega a avaliação e suas sessões com
 * `status === "completed"` → lê o `final_report/latest` de cada sessão →
 * consolida via IA, recaindo no modo contingência se a IA falhar.
 *
 * Modos possíveis na resposta: `"groq"` (IA), `"fallback"` (contingência),
 * `"demo"` (Firebase Admin não configurado), `"empty"` (sem relatórios) e
 * `"error"` (falha inesperada).
 *
 * @param {import("express").Request} req - Requisição; espera `{ assessmentId }` no corpo.
 * @param {import("express").Response} res - Resposta com {@link ConsolidatedAnalysis}
 *   (200), `400` sem `assessmentId`, `404` se a avaliação não existir ou `500` em erro crítico.
 * @returns {Promise<void>}
 */
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