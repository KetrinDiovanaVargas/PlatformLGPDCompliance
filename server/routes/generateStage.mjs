import express from "express";
import Groq from "groq-sdk";
import { getAdminDb } from "../firebaseAdmin.mjs";
import { generateStagePrompt } from "../promptGroq.mjs";

const router = express.Router();

const ALLOWED_TYPES = ["select", "checkbox", "textarea"];
const MAX_STAGE = 4;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY não carregada no backend");
  }

  return new Groq({ apiKey });
}

function extractJson(text) {
  if (!text) return null;

  const cleaned = String(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    return null;
  }

  const jsonString = cleaned.substring(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("❌ JSON parse error:", err);
    console.error("❌ JSON bruto:", jsonString);
    return null;
  }
}

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expectedQuestionsForStage(stage) {
  if (stage === 0) return 1;
  if (stage === 1) return 4;
  return 5;
}

function stageTitle(stage) {
  if (stage === 1) return "Contexto Organizacional";
  if (stage === 2) return "Controles e Processos";
  if (stage === 3) return "Riscos e Governança";
  if (stage === 4) return "Maturidade e Evidências";
  return `Etapa ${stage}`;
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];

  const normalized = options
    .map((item) => safeString(item))
    .filter(Boolean);

  return [...new Set(normalized)];
}

function inferQuestionType(question, rawType, options) {
  const normalizedType = safeString(rawType).toLowerCase();

  if (ALLOWED_TYPES.includes(normalizedType)) {
    if (
      (normalizedType === "select" || normalizedType === "checkbox") &&
      options.length === 0
    ) {
      return "textarea";
    }
    return normalizedType;
  }

  const q = safeString(question).toLowerCase();

  if (
    q.includes("quais") ||
    q.includes("quais desses") ||
    q.includes("selecione todas") ||
    q.includes("marque as opções")
  ) {
    return options.length > 0 ? "checkbox" : "textarea";
  }

  if (
    q.includes("há") ||
    q.includes("existe") ||
    q.includes("qual") ||
    q.includes("com que frequência") ||
    q.includes("nível") ||
    q.includes("grau")
  ) {
    return options.length > 0 ? "select" : "textarea";
  }

  return "textarea";
}

function normalizeQuestion(question, index) {
  const normalizedOptions = normalizeOptions(question?.options);
  const normalizedType = inferQuestionType(
    question?.question,
    question?.type,
    normalizedOptions
  );

  return {
    id: safeString(question?.id, `q${index + 1}`),
    type: normalizedType,
    question: safeString(
      question?.question,
      "Descreva sua experiência ou entendimento sobre este tema."
    ),
    description: safeString(question?.description),
    options:
      normalizedType === "select" || normalizedType === "checkbox"
        ? normalizedOptions.length > 0
          ? normalizedOptions
          : undefined
        : undefined,
    required: question?.required === false ? false : true,
  };
}

function extractPreviousQuestionsFromContext(contextObj) {
  if (!contextObj || typeof contextObj !== "object") return [];

  return Object.keys(contextObj)
    .map((key) => {
      const match = String(key).match(/^Q\d+:(.*)$/);
      return match ? safeString(match[1]) : "";
    })
    .filter(Boolean);
}

function tokenizeQuestion(text) {
  const stopwords = new Set([
    "a",
    "as",
    "o",
    "os",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "em",
    "para",
    "por",
    "com",
    "sem",
    "na",
    "no",
    "nas",
    "nos",
    "que",
    "como",
    "qual",
    "quais",
    "ha",
    "existe",
    "existem",
    "voce",
    "você",
    "ja",
    "já",
    "seu",
    "sua",
    "seus",
    "suas",
    "esse",
    "essa",
    "esses",
    "essas",
    "neste",
    "nesta",
    "nesse",
    "nessa",
    "sobre",
    "mais",
    "menos",
    "atual",
    "hoje",
    "contexto",
    "tema",
    "processo",
  ]);

  return normalizeText(text)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t && !stopwords.has(t));
}

function jaccardSimilarity(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function isSemanticallyTooClose(a, b) {
  const textA = normalizeText(a);
  const textB = normalizeText(b);

  if (!textA || !textB) return false;
  if (textA === textB) return true;
  if (textA.includes(textB) || textB.includes(textA)) return true;

  const tokensA = tokenizeQuestion(textA);
  const tokensB = tokenizeQuestion(textB);

  const similarity = jaccardSimilarity(tokensA, tokensB);

  if (similarity >= 0.72) return true;

  const bigA = tokensA.filter((t) => t.length > 4);
  const bigB = tokensB.filter((t) => t.length > 4);
  const strongSimilarity = jaccardSimilarity(bigA, bigB);

  return strongSimilarity >= 0.62;
}

function filterDuplicateQuestions(questions, previousQuestions = []) {
  const unique = [];
  const seenQuestions = [];

  for (const q of questions) {
    const currentQuestion = safeString(q?.question);
    if (!currentQuestion) continue;

    const repeatedAgainstHistory = previousQuestions.some((prev) =>
      isSemanticallyTooClose(currentQuestion, prev)
    );

    if (repeatedAgainstHistory) continue;

    const repeatedInsideStage = seenQuestions.some((prev) =>
      isSemanticallyTooClose(currentQuestion, prev)
    );

    if (repeatedInsideStage) continue;

    unique.push(q);
    seenQuestions.push(currentQuestion);
  }

  return unique;
}

function buildFallbackQuestions(stage, assessmentContext, audience, objective) {
  const baseContext = safeString(
    assessmentContext,
    "avaliação de conformidade LGPD"
  );
  const normalizedAudience = safeString(audience, "respondente");
  const normalizedObjective = safeString(objective, "diagnóstico inicial");

  if (stage === 1) {
    return [
      {
        id: "q1",
        type: "textarea",
        question: `Considerando o contexto "${baseContext}" e o objetivo "${normalizedObjective}", como esse tema aparece na realidade do ${normalizedAudience}?`,
        required: true,
      },
      {
        id: "q2",
        type: "select",
        question:
          "Com que frequência você lida com informações ou dados pessoais nesse contexto?",
        options: ["Frequentemente", "Às vezes", "Raramente", "Nunca"],
        required: true,
      },
      {
        id: "q3",
        type: "checkbox",
        question:
          "Quais elementos estão mais presentes na sua rotina relacionada a esse tema?",
        options: [
          "Coleta de informações",
          "Armazenamento de dados",
          "Compartilhamento de informações",
          "Uso de sistemas/plataformas",
          "Documentos e registros",
          "Outro (especifique)",
        ],
        required: true,
      },
      {
        id: "q4",
        type: "textarea",
        question:
          "Quais dificuldades ou preocupações você percebe hoje em relação a esse processo?",
        required: true,
      },
    ];
  }

  if (stage === 2) {
    return [
      {
        id: "q1",
        type: "select",
        question:
          "Com que frequência dados pessoais são coletados ou utilizados nesse contexto?",
        options: ["Frequentemente", "Às vezes", "Raramente", "Nunca"],
        required: true,
      },
      {
        id: "q2",
        type: "checkbox",
        question:
          "Quais formas de uso ou tratamento das informações você percebe nesse processo?",
        options: [
          "Cadastro ou registro",
          "Compartilhamento interno",
          "Compartilhamento externo",
          "Armazenamento em sistemas",
          "Consulta por terceiros",
          "Outro (especifique)",
        ],
        required: true,
      },
      {
        id: "q3",
        type: "textarea",
        question:
          "Em quais situações você percebe maior exposição ou circulação de dados nesse contexto?",
        required: true,
      },
      {
        id: "q4",
        type: "select",
        question:
          "O acesso às informações parece ocorrer de forma controlada ou aberta demais?",
        options: [
          "Bem controlado",
          "Parcialmente controlado",
          "Pouco controlado",
          "Não sei informar",
        ],
        required: true,
      },
      {
        id: "q5",
        type: "textarea",
        question:
          "Quais pontos desta etapa mais chamam sua atenção em relação ao uso ou tratamento das informações?",
        required: true,
      },
    ];
  }

  if (stage === 3) {
    return [
      {
        id: "q1",
        type: "textarea",
        question:
          "Como você descreveria o fluxo principal das informações dentro desse processo?",
        required: true,
      },
      {
        id: "q2",
        type: "select",
        question:
          "As responsabilidades sobre o tratamento dos dados parecem bem definidas?",
        options: ["Sim", "Parcialmente", "Não", "Não sei informar"],
        required: true,
      },
      {
        id: "q3",
        type: "checkbox",
        question:
          "Quais atores ou áreas parecem participar do fluxo das informações?",
        options: [
          "Equipe interna",
          "Gestão",
          "Terceiros",
          "Sistemas/plataformas",
          "Usuários finais",
          "Outro (especifique)",
        ],
        required: true,
      },
      {
        id: "q4",
        type: "textarea",
        question:
          "Em que pontos você percebe mais dependência de pessoas, processos ou sistemas?",
        required: true,
      },
      {
        id: "q5",
        type: "textarea",
        question:
          "Quais responsabilidades ou etapas do processo poderiam estar mais claras ou melhor organizadas?",
        required: true,
      },
    ];
  }

  return [
    {
      id: "q1",
      type: "select",
      question:
        "Existem orientações ou cuidados definidos para o tratamento das informações nesse contexto?",
      options: ["Sim", "Parcialmente", "Não", "Não sei informar"],
      required: true,
    },
    {
      id: "q2",
      type: "checkbox",
      question:
        "Quais práticas ou controles você percebe atualmente nesse processo?",
      options: [
        "Controle de acesso",
        "Registro de atividades",
        "Treinamento/orientação",
        "Backup",
        "Políticas/documentação",
        "Outro (especifique)",
      ],
      required: true,
    },
    {
      id: "q3",
      type: "textarea",
      question: `Como o ${normalizedAudience} percebe o fluxo de uso, armazenamento ou compartilhamento das informações nesse contexto?`,
      required: true,
    },
    {
      id: "q4",
      type: "select",
      question:
        "Esse processo parece ser revisado ou acompanhado periodicamente?",
      options: ["Sim", "Às vezes", "Raramente", "Não"],
      required: true,
    },
    {
      id: "q5",
      type: "textarea",
      question: `Quais são os principais desafios para evoluir a maturidade desse processo em "${baseContext}", considerando o objetivo "${normalizedObjective}"?`,
      required: true,
    },
  ];
}

function ensureUniqueStagePayload(
  normalizedQuestions,
  stage,
  previousQuestions,
  assessmentContext,
  audience,
  objective
) {
  const expected = expectedQuestionsForStage(stage);

  let deduped = filterDuplicateQuestions(normalizedQuestions, previousQuestions);

  if (deduped.length < expected) {
    const fallback = buildFallbackQuestions(
      stage,
      assessmentContext,
      audience,
      objective
    );

    const combined = [...deduped, ...fallback];
    deduped = filterDuplicateQuestions(combined, previousQuestions).slice(
      0,
      expected
    );
  }

  if (deduped.length < expected) {
    const safeGenericFallbacks = Array.from({
      length: expected - deduped.length,
    }).map((_, index) => ({
      id: `safe_${stage}_${index + 1}`,
      type: "textarea",
      question: `Descreva um aspecto novo e relevante sobre este tema que ainda não foi abordado na etapa ${stage}.`,
      required: true,
    }));

    deduped = [...deduped, ...safeGenericFallbacks].slice(0, expected);
  }

  return deduped.map((q, index) => ({
    ...q,
    id: safeString(q.id, `q${index + 1}`),
  }));
}

function normalizeStagePayload(
  parsed,
  stage,
  assessmentContext,
  audience,
  objective,
  previousQuestions = []
) {
  const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  let normalizedQuestions = rawQuestions.map((q, index) =>
    normalizeQuestion(q, index)
  );

  normalizedQuestions = ensureUniqueStagePayload(
    normalizedQuestions,
    stage,
    previousQuestions,
    assessmentContext,
    audience,
    objective
  );

  return {
    title: safeString(parsed?.title, stageTitle(stage)),
    description: safeString(
      parsed?.description,
      "Perguntas adaptativas geradas com base no contexto informado."
    ),
    questions: normalizedQuestions,
  };
}

function buildStageResponse({
  parsed,
  stage,
  assessmentContext,
  audience,
  objective,
  previousQuestions,
  generationMode,
  generationNotice,
}) {
  const normalized = normalizeStagePayload(
    parsed,
    stage,
    assessmentContext,
    audience,
    objective,
    previousQuestions
  );

  return {
    ...normalized,
    generationMode,
    generationNotice,
  };
}

function isGroqRateLimitError(err) {
  const message = safeString(err?.message).toLowerCase();
  const code = safeString(err?.code).toLowerCase();

  return (
    err?.status === 429 ||
    code === "rate_limit_exceeded" ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("tokens per day") ||
    message.includes("rate_limit_exceeded")
  );
}

async function loadAssessmentMetadata(adminDb, assessmentId) {
  if (!assessmentId) {
    return null;
  }

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
    active: data.active !== false,
    ownerId: safeString(data.ownerId),
    ownerName: safeString(data.ownerName),
  };
}

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    route: "/api/generate-stage",
    method: "POST",
    message: "Use esta rota com POST para gerar a etapa.",
  });
});

router.post("/", async (req, res) => {
  try {
    const {
      stage,
      context,
      assessmentId,
      assessmentTitle,
      assessmentFormType,
      assessmentObjective,
      assessmentCategory,
      assessmentContext,
      audience,
      introText,
      respondentContext,
      profile,
    } = req.body;

    if (stage === undefined || stage === null) {
      return res.status(400).json({ error: "Stage é obrigatório" });
    }

    const numericStage = Number(stage);

    if (
      !Number.isInteger(numericStage) ||
      numericStage < 1 ||
      numericStage > MAX_STAGE
    ) {
      return res.status(400).json({ error: "Stage inválido" });
    }

    let officialAssessment = null;

    if (assessmentId) {
      let adminDb;
      try {
        adminDb = getAdminDb();
      } catch (err) {
        return res.status(503).json({
          error: "Firebase Admin não configurado no backend.",
          details: err?.message || String(err),
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

    const officialTitle =
      officialAssessment?.title || safeString(assessmentTitle);

    const officialFormType =
      officialAssessment?.formType || safeString(assessmentFormType);

    const officialObjective =
      officialAssessment?.objective ||
      safeString(assessmentObjective) ||
      safeString(assessmentCategory);

    const officialContext =
      officialAssessment?.context || safeString(assessmentContext);

    const officialAudience =
      officialAssessment?.audience || safeString(audience);

    const officialIntroText =
      officialAssessment?.introText || safeString(introText);

    const metadata = {
      assessmentTitle: officialTitle,
      assessmentFormType: officialFormType,
      assessmentObjective: officialObjective,
      assessmentContext: officialContext,
      audience: officialAudience,
      introText: officialIntroText,
    };

    const previousQuestions = extractPreviousQuestionsFromContext(context ?? {});
    const audienceOrProfile =
      officialAudience || profile || respondentContext || "respondente";

    const groq = getGroqClient();
    const prompt = generateStagePrompt(numericStage, context ?? {}, metadata);

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Siga rigorosamente as instruções recebidas. Retorne apenas JSON válido.",
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
        console.error("❌ Resposta do Groq não é JSON válido.");

        return res.json(
          buildStageResponse({
            parsed: {},
            stage: numericStage,
            assessmentContext: officialContext,
            audience: audienceOrProfile,
            objective: officialObjective,
            previousQuestions,
            generationMode: "fallback",
            generationNotice:
              "As perguntas desta etapa foram geradas em modo de contingência, pois a resposta da IA não retornou em formato válido.",
          })
        );
      }

      return res.json(
        buildStageResponse({
          parsed,
          stage: numericStage,
          assessmentContext: officialContext,
          audience: audienceOrProfile,
          objective: officialObjective,
          previousQuestions,
          generationMode: "groq",
          generationNotice: "",
        })
      );
    } catch (err) {
      console.error("❌ /api/generate-stage:", err);

      return res.json(
        buildStageResponse({
          parsed: {},
          stage: numericStage,
          assessmentContext: officialContext,
          audience: audienceOrProfile,
          objective: officialObjective,
          previousQuestions,
          generationMode: "fallback",
          generationNotice: isGroqRateLimitError(err)
            ? "O serviço de IA atingiu temporariamente o limite de uso. Por isso, esta etapa foi montada com perguntas automáticas de contingência."
            : "Não foi possível gerar esta etapa com a IA no momento. Por isso, foram aplicadas perguntas automáticas de contingência.",
        })
      );
    }
  } catch (err) {
    console.error("❌ /api/generate-stage erro geral:", err);

    const fallbackStage = Number(req.body?.stage);
    const previousQuestions = extractPreviousQuestionsFromContext(
      req.body?.context ?? {}
    );

    if (
      Number.isInteger(fallbackStage) &&
      fallbackStage >= 1 &&
      fallbackStage <= MAX_STAGE
    ) {
      return res.json(
        buildStageResponse({
          parsed: {},
          stage: fallbackStage,
          assessmentContext: req.body?.assessmentContext,
          audience:
            req.body?.audience || req.body?.profile || req.body?.respondentContext,
          objective: req.body?.assessmentObjective || req.body?.assessmentCategory,
          previousQuestions,
          generationMode: "fallback",
          generationNotice:
            "Esta etapa foi carregada em modo de contingência para não interromper o preenchimento do formulário.",
        })
      );
    }

    return res.status(500).json({ error: "Erro ao gerar etapa" });
  }
});

export default router;