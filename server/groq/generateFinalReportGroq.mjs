import Groq from "groq-sdk";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY ausente no backend (verifique .env e dotenv.config no server.mjs)"
    );
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

  if (firstBrace === -1 || lastBrace === -1) return null;

  const jsonString = cleaned.substring(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("❌ Erro ao fazer parse do JSON do relatório:", err);
    console.error("❌ JSON bruto:", jsonString);
    return null;
  }
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => safeString(item)).filter(Boolean)
    : [];
}

function normalizePriority(priority) {
  const normalized = safeString(priority).toLowerCase();

  if (normalized === "alta") return "Alta";
  if (normalized === "média" || normalized === "media") return "Média";
  if (normalized === "baixa") return "Baixa";

  return "Média";
}

function compactObject(obj) {
  if (!obj || typeof obj !== "object") return undefined;

  const entries = Object.entries(obj).filter(([_, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(String(value ?? "").trim());
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeControlsStatus(value) {
  const expectedNames = [
    "Criptografia",
    "Acesso",
    "Backup",
    "Monitoramento",
    "Documentação",
  ];

  if (!Array.isArray(value) || value.length === 0) {
    return expectedNames.map((name) => ({ name, value: 0 }));
  }

  const normalized = value.map((item, index) => ({
    name: safeString(item?.name, expectedNames[index] ?? `Controle ${index + 1}`),
    value: clamp(Number(item?.value ?? 0), 0, 3),
  }));

  return expectedNames.map((name) => {
    const found = normalized.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    return found ?? { name, value: 0 };
  });
}

function normalizeRecommendations(value) {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((rec) => {
      const learning = compactObject({
        book: safeString(rec?.learning?.book),
        video: safeString(rec?.learning?.video),
        references: safeString(rec?.learning?.references),
        steps: normalizeStringArray(rec?.learning?.steps),
        isoRefs: safeString(rec?.learning?.isoRefs),
        lgpdRefs: safeString(rec?.learning?.lgpdRefs),
      });

      return {
        title: safeString(rec?.title, "Recomendação"),
        description: safeString(rec?.description),
        priority: normalizePriority(rec?.priority),
        category: safeString(rec?.category),
        actions: normalizeStringArray(rec?.actions),
        learning,
      };
    })
    .filter((rec) => rec.title);

  return normalized.slice(0, 5);
}

function buildFallbackRecommendations(metrics, metadata = {}) {
  const contextLabel =
    safeString(metadata.assessmentContext) ||
    safeString(metadata.assessmentTitle) ||
    "processo avaliado";

  const audienceLabel = safeString(metadata.audience, "público avaliado");
  const objectiveLabel = safeString(
    metadata.assessmentObjective || metadata.assessmentCategory,
    "diagnóstico inicial"
  );

  const fallback = [];

  if ((metrics.criticalIssues?.length ?? 0) > 0) {
    fallback.push({
      title: "Tratar riscos críticos prioritários",
      description: `Endereçar imediatamente os pontos com maior impacto no contexto de "${contextLabel}", considerando o objetivo "${objectiveLabel}".`,
      priority: "Alta",
      category: "Risco",
      actions: [
        "Classificar os riscos críticos por impacto e urgência.",
        "Definir responsável para cada item crítico.",
        "Registrar plano de mitigação com prazo.",
      ],
    });
  }

  fallback.push({
    title: "Fortalecer controles de proteção de dados",
    description: `Melhorar controles técnicos e administrativos aderentes ao escopo da avaliação, ao objetivo "${objectiveLabel}" e ao público "${audienceLabel}".`,
    priority: "Média",
    category: "Controles",
    actions: [
      "Revisar acesso a dados pessoais.",
      "Mapear evidências de conformidade.",
      "Atualizar documentação de segurança e privacidade.",
    ],
  });

  fallback.push({
    title: "Estruturar governança e monitoramento contínuo",
    description: `Criar rotina de acompanhamento compatível com o contexto de "${contextLabel}" e com o objetivo da avaliação.`,
    priority: "Média",
    category: "Governança",
    actions: [
      "Definir responsáveis internos.",
      "Criar revisões periódicas.",
      "Acompanhar indicadores de maturidade.",
    ],
  });

  fallback.push({
    title: "Capacitar o público avaliado",
    description: `Reforçar o conhecimento prático do público "${audienceLabel}" sobre tratamento e proteção de dados, alinhado ao objetivo "${objectiveLabel}".`,
    priority: "Baixa",
    category: "Capacitação",
    actions: [
      "Promover treinamento orientado ao contexto.",
      "Divulgar orientações práticas.",
      "Revisar procedimentos com as equipes envolvidas.",
    ],
  });

  return fallback.slice(0, 5);
}

function normalizeRisks(score, rawRisks) {
  let conforme = Number(rawRisks?.conforme ?? 0);
  let parcial = Number(rawRisks?.parcial ?? 0);
  let naoConforme = Number(rawRisks?.naoConforme ?? 0);

  if (conforme + parcial + naoConforme === 0) {
    conforme = Math.max(0, Math.round(score * 0.6));
    parcial = Math.max(0, Math.round((100 - score) * 0.6));
    naoConforme = Math.max(0, 100 - conforme - parcial);
  } else {
    const total = conforme + parcial + naoConforme;
    conforme = Math.round((conforme / total) * 100);
    parcial = Math.round((parcial / total) * 100);
    naoConforme = Math.max(0, 100 - conforme - parcial);
  }

  return {
    conforme: clamp(conforme, 0, 100),
    parcial: clamp(parcial, 0, 100),
    naoConforme: clamp(naoConforme, 0, 100),
  };
}

function normalizeAnalysis(data, metadata = {}) {
  const score = clamp(Number(data?.metrics?.score ?? data?.score ?? 0), 0, 100);

  const risks = normalizeRisks(score, data?.metrics?.risks);

  const strengths = normalizeStringArray(data?.metrics?.strengths);
  const attentionPoints = normalizeStringArray(data?.metrics?.attentionPoints);
  const criticalIssues = normalizeStringArray(data?.metrics?.criticalIssues);
  const controlsStatus = normalizeControlsStatus(data?.metrics?.controlsStatus);

  let recommendations = normalizeRecommendations(data?.metrics?.recommendations);

  if (recommendations.length < 3) {
    const fallbackRecommendations = buildFallbackRecommendations(
      { criticalIssues },
      metadata
    );

    recommendations = [...recommendations, ...fallbackRecommendations].slice(0, 5);
  }

  const report = safeString(data?.report);
  const summary = safeString(data?.summary);
  const controls = normalizeStringArray(data?.controls);

  return {
    report:
      report ||
      "1. Visão Geral: Não foi possível consolidar completamente a análise textual.\n2. Diagnóstico: As respostas indicam necessidade de revisão manual complementar.\n3. Pontos Fortes:\n- Não identificados automaticamente.\n4. Pontos de Atenção:\n- Revisar respostas e evidências informadas.\n5. Riscos Críticos:\n- Confirmar manualmente os pontos mais sensíveis.",
    metrics: {
      score,
      risks,
      strengths,
      attentionPoints,
      criticalIssues,
      controlsStatus,
      recommendations,
    },
    summary:
      summary ||
      "A análise foi gerada com normalização automática e pode exigir validação complementar.",
    controls,
  };
}

function fallbackAnalysis(metadata = {}) {
  const contextLabel =
    safeString(metadata.assessmentContext) ||
    safeString(metadata.assessmentTitle) ||
    "contexto da avaliação";

  const objectiveLabel = safeString(
    metadata.assessmentObjective || metadata.assessmentCategory,
    "diagnóstico inicial"
  );

  return {
    report:
      `1. Visão Geral: Não foi possível gerar um relatório estruturado completo nesta execução.\n` +
      `2. Diagnóstico: O sistema aplicou um fallback seguro mantendo o escopo de "${contextLabel}" e o objetivo "${objectiveLabel}".\n` +
      `3. Pontos Fortes:\n- Não foi possível consolidar automaticamente os pontos fortes.\n` +
      `4. Pontos de Atenção:\n- Não foi possível consolidar automaticamente os pontos de atenção.\n` +
      `5. Riscos Críticos:\n- Falha na geração estruturada do relatório final.`,
    metrics: {
      score: 0,
      risks: {
        conforme: 0,
        parcial: 0,
        naoConforme: 100,
      },
      strengths: [],
      attentionPoints: [
        "Não foi possível consolidar automaticamente os pontos de atenção.",
      ],
      criticalIssues: ["Falha na geração estruturada do relatório final."],
      controlsStatus: [
        { name: "Criptografia", value: 0 },
        { name: "Acesso", value: 0 },
        { name: "Backup", value: 0 },
        { name: "Monitoramento", value: 0 },
        { name: "Documentação", value: 0 },
      ],
      recommendations: buildFallbackRecommendations(
        { criticalIssues: ["Falha"] },
        metadata
      ),
    },
    summary:
      "A geração estruturada falhou e um fallback seguro foi aplicado.",
    controls: [],
  };
}

function buildPrompt({ responses, metadata = {} }) {
  const assessmentTitle = safeString(metadata.assessmentTitle, "Não informado");
  const assessmentFormType = safeString(metadata.assessmentFormType, "Não informado");
  const assessmentObjective = safeString(
    metadata.assessmentObjective || metadata.assessmentCategory,
    "Não informado"
  );
  const assessmentContext = safeString(metadata.assessmentContext, "Não informado");
  const audience = safeString(metadata.audience, "Não informado");
  const introText = safeString(metadata.introText, "Não informado");

  return `
Você é um especialista em LGPD, ISO/IEC 27001 e NIST Privacy Framework.

Sua função é analisar as respostas recebidas e gerar um relatório final estruturado.
Você deve seguir prioritariamente as definições oficiais do administrador da avaliação.

==================== DEFINIÇÕES OFICIAIS DO ADMINISTRADOR ====================

TÍTULO DA AVALIAÇÃO:
${assessmentTitle}

TIPO DA AVALIAÇÃO:
${assessmentFormType}

OBJETIVO DA AVALIAÇÃO:
${assessmentObjective}

PÚBLICO-ALVO DEFINIDO PELO ADMINISTRADOR:
${audience}

TEXTO DE INTRODUÇÃO DEFINIDO PELO ADMINISTRADOR:
${introText}

CONTEXTO OFICIAL DEFINIDO PELO ADMINISTRADOR:
${assessmentContext}

==================== AUTORIDADE DO ADMINISTRADOR ====================

- As definições do administrador são obrigatórias e possuem prioridade máxima.
- O relatório final deve respeitar estritamente o escopo oficial da avaliação.
- As respostas do usuário devem ser interpretadas à luz do contexto definido pelo administrador.
- Nunca desvie o diagnóstico para outro domínio que não seja o definido pelo administrador.
- O público-alvo definido pelo administrador deve orientar a linguagem, os exemplos e o enquadramento do relatório.
- O objetivo da avaliação deve orientar a ênfase da análise, o enquadramento dos riscos e a natureza das recomendações.
- Se houver conflito entre o contexto do respondente e o contexto oficial da avaliação, prevalece o contexto oficial definido pelo administrador.

==================== OBJETIVO DA ANÁLISE ====================

- Produza uma análise técnica, coerente, objetiva e útil.
- O relatório deve refletir maturidade, riscos, controles, pontos fortes, pontos de atenção e recomendações.
- O relatório deve ser consistente com o tipo, objetivo, contexto e público-alvo da avaliação.
- Não invente evidências inexistentes.
- Baseie-se estritamente nas respostas fornecidas, mas interpretando-as dentro do escopo administrativo oficial.

==================== DIRETRIZ POR OBJETIVO ====================

- Se o objetivo for "Diagnóstico inicial", produza uma visão ampla e estruturada do cenário atual.
- Se o objetivo for "Mapeamento de maturidade", enfatize nível de formalização, consistência, repetibilidade e evolução dos processos.
- Se o objetivo for "Levantamento de percepção", valorize entendimento, percepção prática, clareza e vivência do público respondente.
- Se o objetivo for "Auditoria interna", enfatize verificabilidade, conformidade prática, evidências, responsabilidades e controles existentes.
- Se o objetivo for "Treinamento e conscientização", destaque lacunas de conhecimento, comportamento, preparo e necessidades de capacitação.
- Se o objetivo for "Identificação de riscos", priorize fragilidades, exposições, pontos críticos e impactos potenciais.

==================== ESTRUTURA OBRIGATÓRIA ====================

Retorne APENAS um JSON válido.
NÃO use markdown.
NÃO escreva explicações fora do JSON.
NÃO use crases.
NÃO inclua texto antes ou depois do JSON.

{
  "report": "texto técnico, claro e estruturado em português",
  "metrics": {
    "score": 0,
    "risks": {
      "conforme": 0,
      "parcial": 0,
      "naoConforme": 0
    },
    "strengths": ["string"],
    "attentionPoints": ["string"],
    "criticalIssues": ["string"],
    "controlsStatus": [
      { "name": "Criptografia", "value": 0 },
      { "name": "Acesso", "value": 0 },
      { "name": "Backup", "value": 0 },
      { "name": "Monitoramento", "value": 0 },
      { "name": "Documentação", "value": 0 }
    ],
    "recommendations": [
      {
        "title": "string",
        "description": "string",
        "priority": "Alta",
        "category": "string",
        "actions": ["string"],
        "learning": {
          "book": "string",
          "video": "string",
          "references": "string",
          "steps": ["string"],
          "isoRefs": "string",
          "lgpdRefs": "string"
        }
      }
    ]
  },
  "summary": "resumo executivo em português",
  "controls": ["string"]
}

==================== REGRAS OBRIGATÓRIAS ====================

- score deve ser um número entre 0 e 100.
- conforme + parcial + naoConforme devem somar 100.
- controlsStatus deve conter EXATAMENTE 5 itens:
  1. Criptografia
  2. Acesso
  3. Backup
  4. Monitoramento
  5. Documentação
- cada value em controlsStatus deve ser um número de 0 a 3.
- strengths, attentionPoints e criticalIssues devem conter frases curtas e objetivas.
- recommendations deve conter entre 3 e 5 recomendações práticas.
- summary deve ser executivo e objetivo.
- report deve ser uma análise técnica completa, em português, coerente com as respostas e com o escopo oficial da avaliação.
- o report deve vir preferencialmente com seções numeradas:
  1. Visão Geral
  2. Diagnóstico
  3. Pontos Fortes
  4. Pontos de Atenção
  5. Riscos Críticos
- não gere conclusões fora do contexto oficial definido pelo administrador.
- não transforme um formulário acadêmico em corporativo, nem um corporativo em acadêmico, a menos que isso tenha sido definido oficialmente pelo administrador.
- o objetivo da avaliação deve ser perceptível no diagnóstico, nas métricas e nas recomendações.

==================== RESPOSTAS ====================

${JSON.stringify(responses, null, 2)}
`.trim();
}

export async function generateFinalReportWithGroq(input) {
  const groq = getGroqClient();

  const responses = Array.isArray(input?.responses) ? input.responses : [];
  const metadata = input?.metadata ?? {};

  if (responses.length === 0) {
    return fallbackAnalysis(metadata);
  }

  const prompt = buildPrompt({ responses, metadata });

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Siga rigorosamente as instruções recebidas e retorne apenas JSON válido.",
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
      console.error("❌ O modelo não retornou JSON válido.");
      return fallbackAnalysis(metadata);
    }

    const normalized = normalizeAnalysis(parsed, metadata);

    if (!normalized.report || normalized.report.trim().length < 20) {
      console.error("❌ Relatório final insuficiente após normalização.");
      return fallbackAnalysis(metadata);
    }

    return normalized;
  } catch (err) {
    console.error("❌ Erro ao gerar relatório estruturado com Groq:", err);
    throw err;
  }
}