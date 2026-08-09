/**
 * Gerador de relatórios finais estruturados com análise LGPD/ISO27001.
 * 
 * Processa respostas de avaliação, extrai e normaliza dados, constrói prompts
 * especializados e gera relatórios consolidados com métricas, fragilidades e recomendações.
 * @module lib/report-generator-groq
 */

import { chatCompletion } from "../lib/ai-client.mjs";

/**
 * Extrai JSON válido de texto contendo markdown ou caracteres extras.
 * 
 * @param {string} text - Texto potencialmente contendo JSON
 * @returns {Object|null} Objeto parseado ou null se JSON inválido
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
    console.error("❌ Erro ao fazer parse do JSON do relatório:", err);
    console.error("❌ JSON bruto:", jsonString);
    return null;
  }
}

/**
 * Limita número entre mín e máx.
 * 
 * @param {number} num - Número a limitar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} Número clampado
 */
function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

/**
 * Converte valor para string segura e trimada.
 * 
 * @param {*} value - Valor a converter
 * @param {string} [fallback=""] - Fallback se valor inválido
 * @returns {string} String trimada ou fallback
 */
function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

/**
 * Normaliza array de strings (strings vazias são removidas).
 * 
 * @param {*} value - Array ou valor único
 * @returns {string[]} Array de strings não-vazias
 */
function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => safeString(item)).filter(Boolean)
    : [];
}

/**
 * Normaliza prioridade para padrão (Alta/Média/Baixa).
 * 
 * @param {*} priority - Prioridade em qualquer formato
 * @returns {"Alta"|"Média"|"Baixa"} Prioridade normalizada (padrão: Média)
 */
function normalizePriority(priority) {
  const normalized = safeString(priority).toLowerCase();

  if (normalized === "alta") return "Alta";
  if (normalized === "média" || normalized === "media") return "Média";
  if (normalized === "baixa") return "Baixa";

  return "Média";
}

/**
 * Remove propriedades vazias de objeto.
 * 
 * @param {Object} obj - Objeto a compactar
 * @returns {Object|undefined} Objeto sem vazios ou undefined
 */
function compactObject(obj) {
  if (!obj || typeof obj !== "object") return undefined;

  const entries = Object.entries(obj).filter(([_, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(String(value ?? "").trim());
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Normaliza array de controles com 5 itens padrão (Criptografia, Acesso, etc).
 * 
 * @param {*} value - Array ou valor
 * @returns {Array<{name: string, value: number}>} Array com 5 controles (value: 0-3)
 */
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

/**
 * Normaliza array de recomendações com validação e limite.
 * 
 * @param {*} value - Array de recomendações
 * @returns {Array<{title, description, priority, category, actions, learning}>} Array de até 5 recomendações
 */
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

/**
 * Constrói recomendações fallback baseadas em métricas e metadados.
 * 
 * @param {Object} metrics - Métricas (criticalIssues, etc)
 * @param {Object} [metadata={}] - Metadados da avaliação
 * @returns {Array<{title, description, priority, category, actions}>} Array de recomendações fallback
 */
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

/**
 * Normaliza severidade para padrão (Crítica/Alta/Moderada/Baixa).
 * 
 * @param {*} severity - Severidade em qualquer formato
 * @returns {"Crítica"|"Alta"|"Moderada"|"Baixa"} Severidade normalizada
 */
function normalizeSeverity(severity) {
  const normalized = safeString(severity).toLowerCase();

  if (normalized === "critica" || normalized === "crítica") return "Crítica";
  if (normalized === "alta") return "Alta";
  if (normalized === "baixa") return "Baixa";

  return "Moderada";
}

/**
 * Normaliza array de fragilidades detectadas (eixos F1-F10).
 * 
 * @param {*} value - Array de fragilidades
 * @returns {Array<{codigo, categoria, severidade, evidencia}>} Array de fragilidades validadas
 */
function normalizeFragilidadesDetectadas(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      codigo: safeString(item?.codigo),
      categoria: safeString(item?.categoria),
      severidade: normalizeSeverity(item?.severidade),
      evidencia: safeString(item?.evidencia),
    }))
    .filter((item) => item.codigo && item.evidencia);
}

/**
 * Normaliza riscos (conforme/parcial/naoConforme) para somar 100.
 * Se todos zerados, interpola baseado no score.
 * 
 * @param {number} score - Score geral (0-100)
 * @param {Object} rawRisks - Objeto com conforme, parcial, naoConforme
 * @returns {{conforme: number, parcial: number, naoConforme: number}} Riscos normalizados (soma 100)
 */
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

/**
 * Normaliza análise bruta do modelo em estrutura validada.
 * Aplica fallback de recomendações se insuficientes.
 * 
 * @param {Object} data - Dados brutos da análise
 * @param {Object} [metadata={}] - Metadados de contexto
 * @returns {{report, metrics, summary, controls, fragilidades_detectadas}} Análise normalizada
 */
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
  const fragilidadesDetectadas = normalizeFragilidadesDetectadas(
    data?.fragilidades_detectadas
  );

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
    fragilidades_detectadas: fragilidadesDetectadas,
  };
}

/**
 * Gera análise fallback completa para uso em erro ou falta de dados.
 * 
 * @param {Object} [metadata={}] - Metadados de contexto
 * @returns {{report, metrics, summary, controls, fragilidades_detectadas}} Análise fallback estruturada
 */
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
    fragilidades_detectadas: [],
  };
}

/**
 * Constrói prompt especializado para análise final por IA.
 * Inclui contexto oficial, diretrizes por objetivo, eixos de fragilidade (F1-F10).
 * 
 * @param {Object} params - Parâmetros
 * @param {Array} params.responses - Respostas dos estágios
 * @param {Object} [params.metadata={}] - Metadados da avaliação
 * @returns {string} Prompt estruturado para modelo de IA
 */
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

==================== EIXOS DE FRAGILIDADE (F1-F10) ====================

Ao analisar as respostas, mapeie cada evidência relevante para os eixos de fragilidade abaixo:
  F1: Compartilhamento informal (WhatsApp, e-mail pessoal, grupos, prints)
  F2: Armazenamento indevido (celular pessoal, pendrive, desktop, backup pessoal)
  F3: Retenção excessiva (guardar dados "por garantia", sem prazo/critério claro)
  F4: Coleta excessiva (pedir CPF, documento, laudo ou foto sem necessidade proporcional)
  F5: Acesso excessivo (perfil admin, senha compartilhada, acesso fora da função)
  F6: Falta de transparência/controle (titular não sabe finalidade/destino/prazo)
  F7: Uso secundário (dados coletados para uma finalidade usados em outra sem análise)
  F8: Terceiros sem controle (fornecedores, contatos alternativos sem base/controle formal)
  F9: Dados sensíveis sem salvaguarda (saúde, biometria, filiação, crianças, dependentes)
  F10: Incidente mal tratado (perda de dispositivo, envio errado, vazamento, sem fluxo interno)

SEVERIDADE de cada fragilidade detectada:
- CRÍTICA: expõe dados sensíveis a terceiros, vazamento de CPF/senha, violação de sigilo.
- ALTA: compartilhamento informal, retenção excessiva, acesso amplo, dados sensíveis sem controle.
- MODERADA: coleta desnecessária, falta de política, controles parciais, terceiros sem contrato.
- BAIXA: desvios menores, controles existem mas com falhas pontuais.

Inclua no JSON o campo "fragilidades_detectadas" com cada fragilidade real identificada nas respostas,
citando o código do eixo, a categoria, a severidade e a evidência textual que embasa a detecção.
Não invente fragilidades sem evidência nas respostas.

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
  "controls": ["string"],
  "fragilidades_detectadas": [
    {
      "codigo": "F1",
      "categoria": "Compartilhamento informal",
      "severidade": "Alta",
      "evidencia": "string"
    }
  ]
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

/**
 * Gera relatório final consolidado a partir de respostas usando Groq.
 * 
 * Constrói prompt especializado, chama modelo de IA, extrai e normaliza JSON,
 * com fallback seguro em caso de erro.
 * 
 * @async
 * @param {Object} input - Parâmetros de entrada
 * @param {Array} [input.responses=[]] - Respostas dos estágios
 * @param {Object} [input.metadata={}] - Metadados da avaliação (título, objetivo, contexto, público)
 * @param {string} [input.aiProvider="groq"] - Provider de IA (groq, openai, etc)
 * 
 * @returns {Promise<{report, metrics, summary, controls, fragilidades_detectadas}>} Relatório consolidado
 * 
 * @example
 * const report = await generateFinalReportWithGroq({
 *   responses: stageResponses,
 *   metadata: { assessmentTitle: "LGPD Diagnostico", objective: "diagnostico_inicial" }
 * });
 */
export async function generateFinalReportWithGroq(input) {
  const responses = Array.isArray(input?.responses) ? input.responses : [];
  const metadata = input?.metadata ?? {};
  const aiProvider = input?.aiProvider ?? "groq";

  if (responses.length === 0) {
    return fallbackAnalysis(metadata);
  }

  const prompt = buildPrompt({ responses, metadata });

  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: "Siga rigorosamente as instruções recebidas e retorne apenas JSON válido." },
        { role: "user",   content: prompt },
      ],
      { preferredProvider: aiProvider, temperature: 0.2, jsonMode: true }
    );
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