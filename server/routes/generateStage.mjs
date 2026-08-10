/**
 * 
 * Módulo que expõe endpoints HTTP para geração dinâmica de perguntas
 * adaptativas por etapa. Implementa detecção semântica de duplicatas,
 * fallbacks inteligentes e normalização rigorosa de payloads.
 * 
 * Pipeline de geração:
 * 1. Valida entrada (stage, contexto, metadados)
 * 2. Carrega metadados da avaliação do Firestore
 * 3. Gera prompt dinâmico considerando etapas anteriores
 * 4. Submete para LLM (Groq/Claude/etc) com cache
 * 5. Extrai JSON da resposta
 * 6. Filtra duplicatas semânticas e lexicais
 * 7. Preenche gaps com fallbacks contextualizados
 * 8. Retorna payload normalizado
 * 
 * @module routes/generate-stage
 * 
 * @requires express
 * @requires ../firebaseAdmin.mjs
 * @requires ../promptGroq.mjs
 * @requires ../lib/question-cache.mjs
 * 
 * Dimensões semânticas suportadas:
 * - backup, dados_sensiveis, incidentes, retenção
 * - terceiros, compartilhamento, acesso, armazenamento
 * - coleta, consentimento, transparência, finalidade
 * - monitoramento, documentação, segurança, perfil, frequência
 */

import express from "express";
import { getAdminDb } from "../firebaseAdmin.mjs";
import { generateStagePrompt } from "../promptGroq.mjs";
import { cachedChatCompletion } from "../lib/question-cache.mjs";

/**
 * Router Express para gerenciar rotas de geração de etapas.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Tipos de campo permitidos para perguntas.
 * @type {Array<string>}
 * @constant
 */
const ALLOWED_TYPES = ["select", "checkbox", "textarea"];

/**
 * Número máximo de etapas no questionário adaptativo.
 * @type {number}
 * @constant
 */
const MAX_STAGE = 4;

/**
 * Extrai JSON válido de uma resposta de texto que pode conter markdown.
 * 
 * Remove marcadores de bloco de código (```json, ```), localiza
 * as chaves delimitadoras { }, e tenta fazer parse JSON.
 * 
 * Tolera formatos híbridos com texto antes/depois do JSON.
 * 
 * @param {string} text - Texto bruto possivelmente contendo JSON
 * @returns {Object|null} Objeto parseado ou null se inválido
 * 
 * @example
 * extractJson("```json\n{\"a\": 1}\n```") // → { a: 1 }
 * @example
 * extractJson("Aqui está: {\"b\": 2} fim") // → { b: 2 }
 * @example
 * extractJson("sem json aqui") // → null
 */
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

/**
 * Converte valor para string segura, trimada e nunca null.
 * 
 * @param {*} value - Valor a converter
 * @param {string} [fallback=""] - Valor padrão se value for falsy
 * @returns {string} String segura e trimada
 * 
 * @example
 * safeString(null, "padrão") // → "padrão"
 */
function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

/**
 * Normaliza texto removendo acentos, convertendo para minúsculas e removendo caracteres especiais.
 * 
 * Transforma "Café com Açúcar!" em "cafe com acucar" para comparações insensíveis.
 * 
 * @param {string} text - Texto a normalizar
 * @returns {string} Texto normalizado
 * 
 * @example
 * normalizeText("São Paulo") // → "sao paulo"
 * @example
 * normalizeText("DADOS!") // → "dados"
 */
function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retorna número esperado de perguntas para uma etapa.
 * 
 * Distribuição:
 * - Stage 0: 1 pergunta
 * - Stage 1: 4 perguntas
 * - Stages 2+: 5 perguntas
 * 
 * @param {number} stage - Número da etapa (1-4)
 * @returns {number} Número esperado de perguntas
 * 
 * @example
 * expectedQuestionsForStage(1) // → 4
 * @example
 * expectedQuestionsForStage(3) // → 5
 */
function expectedQuestionsForStage(stage) {
  if (stage === 0) return 1;
  if (stage === 1) return 4;
  return 5;
}

/**
 * Retorna título localizado para uma etapa.
 * 
 * @param {number} stage - Número da etapa
 * @returns {string} Título em português
 * 
 * @example
 * stageTitle(2) // → "Controles e Processos"
 */
function stageTitle(stage) {
  if (stage === 1) return "Contexto Organizacional";
  if (stage === 2) return "Controles e Processos";
  if (stage === 3) return "Riscos e Governança";
  if (stage === 4) return "Maturidade e Evidências";
  return `Etapa ${stage}`;
}

/**
 * Normaliza e deduplica array de opções.
 * 
 * Remove duplicatas (após normalização), entradas vazias e espaços extras.
 * 
 * @param {Array} options - Array de opções bruto
 * @returns {Array<string>} Array deduplidado de opções seguras
 * 
 * @example
 * normalizeOptions(["Sim", "  sim  ", "Não"]) // → ["Sim", "Não"]
 */
function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];

  const normalized = options
    .map((item) => safeString(item))
    .filter(Boolean);

  return [...new Set(normalized)];
}

/**
 * Infere tipo de pergunta baseado no texto e tipo declarado.
 * 
 * Estratégia:
 * 1. Valida tipo declarado se for permitido
 * 2. Infere tipo a partir de keywords na pergunta
 * 3. Seleciona textarea como fallback universal
 * 
 *  Se tipo select/checkbox mas sem opções, degrada para textarea.
 * 
 * @param {string} question - Texto da pergunta
 * @param {string} rawType - Tipo declarado (select/checkbox/textarea)
 * @param {Array} options - Array de opções disponíveis
 * @returns {string} Tipo de pergunta: "select" | "checkbox" | "textarea"
 * 
 * @example
 * inferQuestionType("Quais dessas...", "auto", ["A", "B"]) // → "checkbox"
 * @example
 * inferQuestionType("Há algo?", "select", []) // → "textarea"
 */
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

/**
 * Normaliza uma pergunta individual com validação completa.
 * 
 * Garante:
 * - ID único (fallback: q${index+1})
 * - Tipo válido (select/checkbox/textarea)
 * - Descrição apropriada para o tipo
 * - Opções sem duplicatas
 * - Campo required true por padrão
 * 
 * @param {Object} question - Pergunta bruta
 * @param {string} question.question - Texto da pergunta
 * @param {string} [question.type] - Tipo declarado
 * @param {string} [question.id] - ID customizado
 * @param {string} [question.description] - Descrição/ajuda
 * @param {Array} [question.options] - Opções (para select/checkbox)
 * @param {boolean} [question.required] - Se obrigatória (padrão: true)
 * @param {number} index - Índice para gerar ID fallback
 * 
 * @returns {Object} Pergunta normalizada e validada
 * 
 * @example
 * normalizeQuestion({ question: "Nome?", type: "select", options: ["A", "B"] }, 0)
 * // → { id: "q1", type: "select", question: "Nome?", options: ["A", "B"], required: true }
 */
function normalizeQuestion(question, index) {
  const normalizedOptions = normalizeOptions(question?.options);
  const normalizedType = inferQuestionType(
    question?.question,
    question?.type,
    normalizedOptions
  );

  const defaultHelp =
    normalizedType === "textarea"
      ? "Explique com base no seu dia a dia. Se não souber responder, escreva: 'Não sei informar'."
      : "Escolha a opção que mais se aproxima da sua realidade. Se não souber, selecione 'Não sei informar' (quando disponível).";

  return {
    id: safeString(question?.id, `q${index + 1}`),
    type: normalizedType,
    question: safeString(
      question?.question,
      "Descreva sua experiência ou entendimento sobre este tema."
    ),
    description: safeString(question?.description, defaultHelp),
    options:
      normalizedType === "select" || normalizedType === "checkbox"
        ? normalizedOptions.length > 0
          ? normalizedOptions
          : undefined
        : undefined,
    required: question?.required === false ? false : true,
  };
}

/**
 * Extrai perguntas anteriores do contexto (histórico de etapas).
 * 
 * Formato esperado: { "Q1: Texto aqui", "Q2: Outro texto", ... }
 * 
 * @param {Object} contextObj - Objeto de contexto (resultado de etapas anteriores)
 * @returns {Array<string>} Array de textos de perguntas já feitas
 * 
 * @example
 * extractPreviousQuestionsFromContext({ "Q1: Como?", "Q2: Quem?" })
 * // → ["Como?", "Quem?"]
 */
function extractPreviousQuestionsFromContext(contextObj) {
  if (!contextObj || typeof contextObj !== "object") return [];

  return Object.keys(contextObj)
    .map((key) => {
      const match = String(key).match(/^Q\d+:(.*)$/);
      return match ? safeString(match[1]) : "";
    })
    .filter(Boolean);
}

/**
 * Tokeniza pergunta removendo stopwords e normalizando.
 * 
 * Converte "Como você faz backup?" em ["backup"] após remover
 * stopwords como "como", "você", "faz".
 * 
 * Stopwords em português: artigos, preposições, verbos auxiliares, etc.
 * 
 * @param {string} text - Texto da pergunta
 * @returns {Array<string>} Array de tokens significativos
 * 
 * @example
 * tokenizeQuestion("Como você faz backup?") // → ["backup"]
 * @example
 * tokenizeQuestion("Qual é a sua área?") // → ["area"]
 */
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

/**
 * Calcula similaridade Jaccard entre dois arrays de tokens.
 * 
 * Métrica: |A ∩ B| / |A ∪ B| (0 = nada em comum, 1 = idêntico)
 * 
 *  Detectar paráfrases próximas e variações de perguntas.
 * 
 * @param {Array<string>} tokensA - Primeiro array de tokens
 * @param {Array<string>} tokensB - Segundo array de tokens
 * @returns {number} Similaridade entre 0 e 1
 * 
 * @example
 * jaccardSimilarity(["dados", "pessoais"], ["dados", "sensíveis"]) // → 0.5
 * @example
 * jaccardSimilarity(["backup"], ["backup"]) // → 1
 */
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

/**
 * Dimensões temáticas para detecção de repetição semântica.
 * 
 * Cada pergunta de diagnóstico LGPD investiga uma dimensão temática.
 * Duas perguntas da mesma dimensão são repetição — mesmo com
 * palavras completamente diferentes.
 * 
 * Ordem importa: dimensões mais específicas primeiro (primeiro match vence).
 * As chaves usam radicias (stems) para tolerar conjugações e sinônimos.
 * 
 * Dimensões cobrem:
 * - Backup e recuperação
 * - Dados sensíveis/especiais
 * - Incidentes e violações
 * - Retenção e descarte
 * - Terceiros e fornecedores
 * - Compartilhamento de dados
 * - Controles de acesso
 * - Armazenamento e localização
 * - Coleta de dados
 * - Consentimento
 * - Transparência
 * - Finalidade
 * - Monitoramento
 * - Documentação
 * - Segurança
 * - Perfil do respondente
 * - Frequência de contato
 * 
 * @type {Array<Object>}
 * @property {string} dim - Identificador da dimensão
 * @property {Array<string>} keys - Radicais de palavras-chave
 * @constant
 */
const QUESTION_DIMENSIONS = [
  { dim: "backup", keys: ["backup", "copia de seguranca", "copias de seguranca", "restaur"] },
  { dim: "dados_sensiveis", keys: ["sensivel", "sensiveis", "biometria", "religi", "orientacao sexual", "dados de crianca", "dados de saude"] },
  { dim: "incidentes", keys: ["incidente", "extravi", "violacao de dados", "vazar", "vazad", "roubad", "perdid", "perda de", "enviado por engano", "enviado errado", "se algo der errado", "caso aconteca"] },
  { dim: "retencao", keys: ["descart", "apag", "exclu", "delet", "quanto tempo", "por quanto", "prazo", "depois que", "quando nao precisa", "retenc", "tempo de guarda"] },
  { dim: "terceiros", keys: ["terceiro", "fornecedor", "parceiro", "empresa externa", "prestador", "servico externo", "outra empresa", "fora da sua equipe", "fora do seu grupo", "de fora"] },
  { dim: "compartilhamento", keys: ["compartilh", "whatsapp", "repass", "divulg", "transmit", "envia os", "envia essas", "manda os", "manda essas", "passar os dados", "passa os dados", "passar essas", "troca de inform", "trocam inform"] },
  { dim: "acesso", keys: ["quem pode acessar", "quem acess", "tem acesso", "quem pode ver", "quem consegue ver", "quem ve ", "permissao", "controle de acesso", "quem mais"] },
  { dim: "armazenamento", keys: ["guard", "armazen", "onde fica", "onde estao", "onde sao mantid", "em qual local", "em que local", "onde voce salva", "ficam salv", "pendrive", "na nuvem", "no servidor", "no computador", "no celular"] },
  { dim: "coleta", keys: ["colet", "quais dados voce pede", "que dados voce pede", "quais informacoes voce pede", "que informacoes pede", "voce pede", "voce solicita", "solicit", "cadastr", "rg e cpf", "cpf", "pede documento", "quais dados sao pedidos"] },
  { dim: "consentimento", keys: ["consentimento", "autoriz", "concord", "aceite", "pediu permissao", "permissao da pessoa", "permissao do titular"] },
  { dim: "transparencia", keys: ["as pessoas sabem", "o titular sabe", "sabem para que", "sabem o que", "informa a pessoa", "informam as pessoas", "avisa as pessoas", "comunica as pessoas", "conhecem a finalidade", "transparencia"] },
  { dim: "finalidade", keys: ["para que voce usa", "para que sao usad", "para que servem", "qual a finalidade", "por que coleta", "por que voce pede", "por que voce coleta", "motivo do uso", "uso secundario", "com qual objetivo", "para qual finalidade", "finalidade"] },
  { dim: "monitoramento", keys: ["monitora", "monitoram", "revis", "acompanh", "audit", "fiscaliz", "verifica como", "verificam como", "controle periodico"] },
  { dim: "documentacao", keys: ["document", "politica", "por escrito", "registr", "norma", "procedimento escrito", "regras escritas"] },
  { dim: "seguranca", keys: ["proteg", "seguranca", "criptografia", "senha", "contra roubo", "contra vazamento", "medidas de protec"] },
  { dim: "perfil", keys: ["seu papel", "sua funcao", "o que voce faz", "qual atividade", "seu cargo", "qual dessas atividades", "melhor descreve", "seu dia a dia", "sua rotina", "qual e a sua area"] },
  { dim: "frequencia_contato", keys: ["com que frequencia", "frequencia com que", "quantas vezes voce", "com que regularidade"] },
];

/**
 * Classifica pergunta de acordo com sua dimensão temática.
 * 
 * Retorna a primeira dimensão cuja chave-raiz aparece no texto normalizado.
 * Útil para detectar repetições semânticas mesmo com palavras diferentes.
 * 
 * @param {string} text - Texto da pergunta
 * @returns {string|null} Identificador da dimensão ou null se não classificada
 * 
 * @example
 * classifyQuestionDimension("Como você faz backup dos dados?") // → "backup"
 * @example
 * classifyQuestionDimension("Quem pode acessar essa base?") // → "acesso"
 */
function classifyQuestionDimension(text) {
  const n = normalizeText(text);
  if (!n) return null;
  for (const { dim, keys } of QUESTION_DIMENSIONS) {
    if (keys.length && keys.some((k) => n.includes(k))) return dim;
  }
  return null;
}

/**
 * Detecta se duas perguntas são semanticamente muito próximas.
 * 
 * Estratégia em 3 níveis:
 * 1. **Bloqueio EXATO**: Igualdade total ou substring
 * 2. **Bloqueio SEMÂNTICO**: Mesma dimensão temática (paráfrases)
 * 3. **Bloqueio LEXICAL**: Jaccard ≥ 0.6 ou Jaccard "strong" ≥ 0.5
 * 
 * Configurada para capturar variações e paráfrases
 * que usuários percebem como "pergunta repetida".
 * 
 * @param {string} a - Primeira pergunta
 * @param {string} b - Segunda pergunta
 * @returns {boolean} True se semanticamente muito próximas
 * 
 * @example
 * isSemanticallyTooClose("Como faz backup?", "Como você faz backup?") // → true
 * @example
 * isSemanticallyTooClose("Quem pode acessar?", "Qual o acesso?") // → true
 * @example
 * isSemanticallyTooClose("Como você armazena dados?", "Quem acessa os dados?") // → false
 */
function isSemanticallyTooClose(a, b) {
  const textA = normalizeText(a);
  const textB = normalizeText(b);

  if (!textA || !textB) return false;
  if (textA === textB) return true;
  if (textA.includes(textB) || textB.includes(textA)) return true;

  // 1) Bloqueio SEMÂNTICO por dimensão
  const dimA = classifyQuestionDimension(textA);
  const dimB = classifyQuestionDimension(textB);
  if (dimA && dimB && dimA === dimB) return true;

  // 2) Bloqueio LEXICAL por sobreposição de palavras
  const tokensA = tokenizeQuestion(textA);
  const tokensB = tokenizeQuestion(textB);

  const similarity = jaccardSimilarity(tokensA, tokensB);
  if (similarity >= 0.6) return true;

  const bigA = tokensA.filter((t) => t.length > 4);
  const bigB = tokensB.filter((t) => t.length > 4);
  const strongSimilarity = jaccardSimilarity(bigA, bigB);

  return strongSimilarity >= 0.5;
}

/**
 * Filtra perguntas duplicadas e semanticamente próximas.
 * 
 * Remove:
 * 1. Perguntas repetidas contra histórico (etapas anteriores)
 * 2. Perguntas repetidas dentro desta etapa
 * 3. Mantém ordem de aparição
 * 
 * Nenhuma pergunta será semanticamente duplicada
 * em relação ao histórico ou entre si.
 * 
 * @param {Array<Object>} questions - Perguntas a filtrar
 * @param {Array<string>} [previousQuestions=[]] - Perguntas de etapas anteriores
 * @returns {Array<Object>} Perguntas filtradas (sem duplicatas)
 * 
 * @example
 * filterDuplicateQuestions(
 *   [{ question: "Como backup?" }, { question: "Como fazer backup?" }],
 *   ["Você faz backup?"]
 * )
 * // → [{ question: "Como backup?" }] // segunda é duplicata da primeira
 */
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

/**
 * Constrói perguntas fallback para uma etapa específica.
 * 
 * Retorna apenas Q1 (hardcoded). Q2+ devem ser geradas pela IA.
 * Se a IA falhar, ensureUniqueStagePayload preenche gaps com fallbacks genéricos.
 * 
 * Cada etapa tem uma pergunta inicial específica que garante progresso
 * mesmo quando LLM falha ou atinge rate limit.
 * 
 * @param {number} stage - Número da etapa (1-4)
 * @returns {Array<Object>} Array com uma pergunta fallback
 * 
 * @example
 * buildFallbackQuestions(2)
 * // → [{ id: "q1", type: "select", question: "Com que frequência...", options: [...] }]
 */
function buildFallbackQuestions(stage) {
  if (stage === 1) {
    return [
      {
        id: "q1",
        type: "select",
        question:
          "Com que frequência você lida com informações ou dados pessoais nesse contexto?",
        options: ["Frequentemente", "Às vezes", "Raramente", "Nunca"],
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
  ];
}

/**
 * Garante que o payload de uma etapa possua quantidade esperada de perguntas.
 * 
 * Fluxo:
 * 1. Filtra duplicatas contra histórico e dentro da etapa
 * 2. Se faltar, adiciona fallbacks Q1 hardcoded
 * 3. Se ainda faltar, preenche com fallbacks genéricos contextualizados
 * 4. Garante que nenhum fallback repete etapas anteriores
 * 5. Retorna exatamente `expectedQuestionsForStage(stage)` perguntas
 * 
 * Sempre retorna array com tamanho correto.
 * 
 * @param {Array<Object>} normalizedQuestions - Perguntas normalizadas (pode estar vazio)
 * @param {number} stage - Número da etapa (1-4)
 * @param {Array<string>} previousQuestions - Perguntas de etapas anteriores
 * @param {string} assessmentContext - Contexto da avaliação
 * @param {string} audience - Público-alvo
 * @param {string} objective - Objetivo da avaliação
 * 
 * @returns {Array<Object>} Array com quantidade exata de perguntas
 */
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
    const fallback = buildFallbackQuestions(stage);

    const combined = [...deduped, ...fallback];
    deduped = filterDuplicateQuestions(combined, previousQuestions).slice(
      0,
      expected
    );
  }

  if (deduped.length < expected) {
    const stageFallbackTemplates = {
      1: [
        "Qual é a situação atual e como você se relaciona com este tema no dia a dia?",
        "Que desafios ou dificuldades você enfrenta neste contexto?",
        "Como você vê a evolução ou maturidade desta área em sua realidade?",
        "Existem aspectos específicos que você gostaria de esclarecer melhor?",
      ],
      2: [
        "Como os dados fluem neste contexto? De onde vêm e para onde vão?",
        "Quem acessa ou trabalha com esses dados no dia a dia?",
        "Que sistemas ou ferramentas são usados para guardar ou compartilhar informações?",
        "Existem práticas informais que complementam os processos formais?",
      ],
      3: [
        "Como as decisões sobre compartilhamento de dados são tomadas?",
        "Quem é responsável por diferentes partes do processo?",
        "Como as informações se movem entre departamentos ou pessoas?",
        "Há integração entre os diferentes sistemas ou processos?",
      ],
      4: [
        "Que medidas de proteção ou cuidado existem para esses dados?",
        "Como você sabe que os dados estão sendo tratados corretamente?",
        "Existem políticas escritas ou documentadas sobre este processo?",
        "Como você mensuraria a maturidade ou qualidade deste tratamento?",
      ],
    };

    const templates = stageFallbackTemplates[stage] || stageFallbackTemplates[1];

    const availableFallbacks = templates.filter(
      (fallback) => !previousQuestions.some(prevQ => isSemanticallyTooClose(fallback, prevQ))
    );

    const fallbacksToUse = availableFallbacks.length > 0 ? availableFallbacks : templates;

    const safeGenericFallbacks = Array.from({
      length: expected - deduped.length,
    }).map((_, index) => ({
      id: `safe_${stage}_${index + 1}`,
      type: "textarea",
      question: fallbacksToUse[index % fallbacksToUse.length],
      required: true,
    }));

    deduped = [...deduped, ...safeGenericFallbacks].slice(0, expected);
  }

  return deduped.map((q, index) => ({
    ...q,
    id: safeString(q.id, `q${index + 1}`),
  }));
}

/**
 * Normaliza o payload completo de uma etapa.
 * 
 * Processa:
 * 1. Converte perguntas brutes em objetos normalizados
 * 2. Filtra duplicatas semânticas
 * 3. Preenche gaps com fallbacks
 * 4. Assegura título e descrição
 * 
 * @param {Object} parsed - Objeto parseado da IA contendo { questions, title, description }
 * @param {number} stage - Número da etapa
 * @param {string} assessmentContext - Contexto da avaliação
 * @param {string} audience - Público-alvo
 * @param {string} objective - Objetivo da avaliação
 * @param {Array<string>} [previousQuestions=[]] - Perguntas de etapas anteriores
 * 
 * @returns {Object} Payload normalizado com title, description, questions
 */
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

/**
 * Constrói resposta HTTP da etapa com metadados.
 * 
 * Inclui:
 * - Payload normalizado (title, description, questions)
 * - generationMode: "groq" | "fallback" | aiProvider
 * - generationNotice: mensagem de status/aviso se aplicável
 * 
 * @param {Object} config - Configuração da resposta
 * @param {Object} config.parsed - Payload parseado da IA
 * @param {number} config.stage - Número da etapa
 * @param {string} config.assessmentContext - Contexto da avaliação
 * @param {string} config.audience - Público-alvo
 * @param {string} config.objective - Objetivo da avaliação
 * @param {Array<string>} config.previousQuestions - Perguntas anteriores
 * @param {string} config.generationMode - Modo de geração (groq/fallback/etc)
 * @param {string} config.generationNotice - Notificação ao usuário
 * 
 * @returns {Object} Response ready para HTTP JSON
 */
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

/**
 * Detecta se um erro é related a rate limit da IA.
 * 
 * Verifica:
 * - HTTP status 429
 * - Código de erro "rate_limit_exceeded"
 * - Mensagens contendo "rate limit", "tokens per day", etc
 * 
 * @param {Error} err - Erro capturado
 * @returns {boolean} True se é rate limit error
 * 
 * @example
 * isGroqRateLimitError({ status: 429 }) // → true
 * @example
 * isGroqRateLimitError({ message: "Rate limit exceeded" }) // → true
 */
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

/**
 * Carrega metadados completos da avaliação do Firestore.
 * 
 * @async
 * @param {*} adminDb - Instância de admin Firestore
 * @param {string} assessmentId - ID da avaliação
 * 
 * @returns {Promise<Object|null>} Metadados ou null se não encontrado
 * @returns {string} returns.id - ID
 * @returns {string} returns.title - Título
 * @returns {string} returns.formType - Tipo de formulário
 * @returns {string} returns.objective - Objetivo
 * @returns {string} returns.context - Contexto
 * @returns {string} returns.audience - Público-alvo
 * @returns {string} returns.introText - Texto intro
 * @returns {string} returns.aiProvider - Provedor de IA (padrão: groq)
 * @returns {boolean} returns.active - Se ativa
 * @returns {string} returns.ownerId - ID do dono
 * @returns {string} returns.ownerName - Nome do dono
 * 
 * @throws Erro se Firestore indisponível
 */
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
    aiProvider: safeString(data.aiProvider, "groq"),
    active: data.active !== false,
    ownerId: safeString(data.ownerId),
    ownerName: safeString(data.ownerName),
  };
}

/**
 * Retorna info sobre a rota (GET).
 * 
 * @route {GET} /
 * @returns {Object} Informações sobre como usar a rota
 */
router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    route: "/api/generate-stage",
    method: "POST",
    message: "Use esta rota com POST para gerar a etapa.",
  });
});

/**
 * Gera perguntas adaptativas para uma etapa do questionário.
 * 
 * Fluxo completo:
 * 1. Valida entrada (stage obrigatório, 1-4)
 * 2. Carrega metadados da avaliação (se assessmentId informado)
 * 3. Verifica se avaliação está ativa
 * 4. Extrai perguntas de etapas anteriores do contexto
 * 5. Gera prompt dinâmico via generateStagePrompt()
 * 6. Submete à IA (com cache e provider preferido)
 * 7. Extrai JSON da resposta
 * 8. Filtra duplicatas semânticas
 * 9. Preenche gaps com fallbacks contextualizados
 * 10. Retorna payload normalizado
 * 
 * Se IA falhar, retorna perguntas fallback genéricas
 * mas estruturadas, garantindo progressão do formulário.
 * 
 * @async
 * @route {POST} /
 * 
 * @param {Object} req.body - Corpo da requisição
 * @param {number} req.body.stage - Número da etapa (1-4, obrigatório)
 * @param {Object} [req.body.context] - Contexto de etapas anteriores
 * @param {string} [req.body.assessmentId] - ID da avaliação oficial
 * @param {string} [req.body.assessmentTitle] - Título (fallback se sem assessmentId)
 * @param {string} [req.body.assessmentFormType] - Tipo de formulário
 * @param {string} [req.body.assessmentObjective] - Objetivo
 * @param {string} [req.body.assessmentCategory] - Categoria (alias para objetivo)
 * @param {string} [req.body.assessmentContext] - Contexto
 * @param {string} [req.body.audience] - Público-alvo
 * @param {string} [req.body.introText] - Texto introdutório
 * @param {string} [req.body.respondentContext] - Contexto do respondente
 * @param {string} [req.body.profile] - Perfil do respondente
 * 
 * @returns {Object} Payload da etapa contendo:
 * @returns {string} returns.title - Título da etapa
 * @returns {string} returns.description - Descrição/instruções
 * @returns {Array<Object>} returns.questions - Array de perguntas
 * @returns {string} returns.questions[].id - ID da pergunta
 * @returns {string} returns.questions[].type - Tipo (select/checkbox/textarea)
 * @returns {string} returns.questions[].question - Texto da pergunta
 * @returns {string} returns.questions[].description - Ajuda/dica
 * @returns {Array<string>} [returns.questions[].options] - Opções (select/checkbox)
 * @returns {boolean} returns.questions[].required - Se obrigatória
 * @returns {string} returns.generationMode - Modo usado (groq/fallback/etc)
 * @returns {string} returns.generationNotice - Aviso/notificação para usuário
 * 
 * @throws {400} Stage ausente ou inválido
 * @throws {404} Avaliação não encontrada
 * @throws {403} Avaliação desativada
 * @throws {503} Firebase Admin não configurado
 * @throws {500} Erro geral ao gerar etapa
 * 
 * @example
 * // POST /api/generate-stage
 * {
 *   "stage": 1,
 *   "assessmentId": "assessment-123",
 *   "context": {}
 * }
 * 
 * @example
 * // Response 200 (sucesso com IA)
 * {
 *   "title": "Contexto Organizacional",
 *   "description": "Perguntas adaptativas...",
 *   "questions": [
 *     {
 *       "id": "q1",
 *       "type": "select",
 *       "question": "Com que frequência você lida com dados pessoais?",
 *       "options": ["Frequentemente", "Às vezes", ...],
 *       "required": true
 *     },
 *     ...
 *   ],
 *   "generationMode": "groq",
 *   "generationNotice": ""
 * }
 * 
 * @example
 * // Response 200 (fallback - IA falhou)
 * {
 *   "title": "Contexto Organizacional",
 *   "description": "...",
 *   "questions": [...],
 *   "generationMode": "fallback",
 *   "generationNotice": "O serviço de IA atingiu temporariamente o limite de uso..."
 * }
 * 
 * @example
 * // Response 400 (stage inválido)
 * {
 *   "error": "Stage inválido"
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
 * // Response 503 (Firebase não configurado)
 * {
 *   "error": "Firebase Admin não configurado no backend."
 * }
 */
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

    const aiProvider = officialAssessment?.aiProvider || "groq";

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

    const prompt = generateStagePrompt(numericStage, context ?? {}, metadata);

    try {
      const raw = await cachedChatCompletion(
        [
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
        {
          preferredProvider: aiProvider,
          temperature: 0.2,
          jsonMode: true,
          priority: 'high',
          stage: numericStage,
          context: context,
          audience: audienceOrProfile,
          useCache: true,
        }
      );

      const parsed = extractJson(raw);

      if (!parsed) {
        console.error("❌ Resposta da IA não é JSON válido.");

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
          generationMode: aiProvider,
          generationNotice: "",
        })
      );
    } catch (err) {
      console.error("❌ /api/generate-stage:", err);

      const isRateLimit = String(err?.message || "").toLowerCase().includes("rate_limit");

      return res.json(
        buildStageResponse({
          parsed: {},
          stage: numericStage,
          assessmentContext: officialContext,
          audience: audienceOrProfile,
          objective: officialObjective,
          previousQuestions,
          generationMode: "fallback",
          generationNotice: isRateLimit
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