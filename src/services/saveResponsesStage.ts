/**
 * @module services/assessmentService
 * @description Serviço de persistência de avaliações LGPD no Firestore com suporte
 * a versionamento completo. Implementa deduplicação por hash, sincronização de
 * sessão e histórico imutável de respostas e relatórios finais.
 *
 * @architecture Padrão: Para cada sessão, mantém:
 *   - `assessment_sessions/{sessionId}`: metadados da sessão
 *   - `assessment_sessions/{sessionId}/stages/{stage}`: resposta *latest* da etapa
 *   - `assessment_sessions/{sessionId}/stages/{stage}/versions/*`: histórico completo
 *   - `assessment_sessions/{sessionId}/final_report/latest`: relatório *latest*
 *   - `assessment_sessions/{sessionId}/final_report/latest/versions/*`: histórico do relatório
 *
 * @note Hashing (stableStringify) detecta mudanças e evita persistência desnecessária.
 */

import { db } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ======================================================
   TIPOS
====================================================== */

/**
 * Representa uma resposta individual do usuário em uma pergunta de avaliação.
 *
 * @typedef {Object} RawResponse
 * @property {number} [index] - Índice sequencial da pergunta (preferência: usar index em vez de questionId)
 * @property {number} [questionId] - ID da pergunta (legado, usar index)
 * @property {string} question - Texto completo da pergunta apresentada
 * @property {*} answer - Resposta do usuário. Pode ser string, número, booleano, array,
 *   ou objeto com `{ selected, description }` para respostas compostas
 */
type RawResponse = {
  index?: number;
  questionId?: number;
  question: string;
  answer: any;
};

/**
 * Estrutura completa do relatório final de avaliação de maturidade LGPD.
 *
 * Consolidada a partir de todas as etapas da elicitação adaptativa, contém
 * análise computada pelo backend, métricas de conformidade, riscos identificados
 * e controles recomendados.
 *
 * @typedef {Object} FinalReport
 * @property {string} report - Relatório narrativo detalhado em português,
 *   humanizado e contextualizando fragilidades encontradas
 * @property {string} summary - Resumo executivo da avaliação (150-300 palavras)
 * @property {number} score - Score de maturidade LGPD (0-100, onde 100 = total conformidade)
 * @property {Record<string, any>} metrics - Métricas de matriz de confusão e performance:
 *   `{ truePositives, falsePositives, falseNegatives, trueNegatives, precision, recall, f1Score }`
 * @property {Record<string, any>} risks - Mapeamento de riscos por área:
 *   `{ "Coleta de Dados": { severity: "alto", likelihood: "médio", ... }, ... }`
 * @property {Array} controls - Array de controles recomendados com prioridade e esforço
 * @property {RawResponse[]} responses - Todas as respostas do usuário normalizadas
 */
export interface FinalReport {
  report: string;
  summary: string;
  score: number;
  metrics: Record<string, any>;
  risks: Record<string, any>;
  controls: any[];
  responses: RawResponse[];
}

/* ======================================================
   CONFIG
====================================================== */

/**
 * Índice da etapa final na sequência de elicitação (0-indexed).
 * Usado para marcação de sessão como "completed" quando relatório é salvo.
 *
 * @constant {number}
 */
const FINAL_STAGE_INDEX = 4;

/* ======================================================
   NORMALIZAÇÃO
====================================================== */

/**
 * Normaliza uma resposta individual para formato canônico.
 *
 * Converte diferentes tipos de entrada (string, número, booleano, array, objeto)
 * para formato consistente usado em hashing e persistência:
 * - Objetos com `selected/description` → preserva estrutura
 * - Arrays → strings ordenadas
 * - Valores primitivos → strings vazias se null/undefined
 *
 * @function normalizeAnswer
 * @param {*} answer - Resposta raw do usuário (qualquer tipo)
 * @returns {*} Resposta normalizada: string, número, objeto com campos normalizados,
 *   ou array de strings ordenado alfabeticamente
 *
 * @private
 * @example
 * normalizeAnswer("Sim") // → "Sim"
 * normalizeAnswer(0.85) // → 0.85
 * normalizeAnswer(["A", "C", "B"]) // → ["A", "B", "C"]
 * normalizeAnswer({ selected: "Email", description: "via LGPD" })
 * // → { selected: "Email", description: "via LGPD" }
 * normalizeAnswer(null) // → ""
 */
function normalizeAnswer(answer: any) {
  if (answer && typeof answer === "object" && !Array.isArray(answer)) {
    if ("selected" in answer) {
      return {
        selected: String(answer.selected ?? ""),
        description: String(answer.description ?? ""),
      };
    }
    return answer;
  }

  if (Array.isArray(answer)) {
    return [...answer].map(String).sort();
  }

  return answer ?? "";
}

/**
 * Normaliza array de respostas brutas para formato canônico ordenado.
 *
 * Aplica normalização a cada resposta individualmente e ordena por índice.
 * Garante formato consistente para deduplicação por hash.
 *
 * @function normalizeResponses
 * @param {RawResponse[]} responses - Array de respostas brutas do usuário
 * @returns {RawResponse[]} Array normalizado e ordenado por index
 *
 * @private
 * @example
 * const raw = [
 *   { questionId: 2, question: "Coleta?", answer: "Sim" },
 *   { index: 1, question: "Nome?", answer: ["Admin", "User"] }
 * ];
 * normalizeResponses(raw);
 * // → [
 * //   { index: 1, question: "Nome?", answer: ["Admin", "User"] },
 * //   { index: 2, question: "Coleta?", answer: "Sim" }
 * // ]
 */
function normalizeResponses(responses: RawResponse[]) {
  return responses
    .map((r, i) => ({
      index: r.index ?? r.questionId ?? i,
      question: String(r.question ?? ""),
      answer: normalizeAnswer(r.answer),
    }))
    .sort((a, b) => a.index - b.index);
}

/**
 * Serializa objeto com hash determinístico (ordem de chaves normalizada).
 *
 * Ordena chaves recursivamente antes de JSON.stringify para garantir que
 * dois objetos com mesmo conteúdo (ordem diferente) gerem hash idêntico.
 * Detecta ciclos com WeakSet para evitar loops infinitos.
 *
 * Usado em deduplicação: se hash não mudou, não persiste redundantemente.
 *
 * @function stableStringify
 * @param {*} obj - Objeto ou primitivo a serializar
 * @returns {string} String JSON com chaves ordenadas, determinística
 *
 * @private
 * @example
 * stableStringify({ b: 2, a: 1 }) === stableStringify({ a: 1, b: 2 })
 * // → true
 *
 * stableStringify({ arr: [3, 1, 2] })
 * // → '{"arr":[3,1,2]}' (preserva ordem de array)
 */
function stableStringify(obj: any) {
  const seen = new WeakSet();

  const sorter = (value: any): any => {
    if (value && typeof value === "object") {
      if (seen.has(value)) return value;
      seen.add(value);

      if (Array.isArray(value)) return value.map(sorter);

      return Object.keys(value)
        .sort()
        .reduce((acc: any, key) => {
          acc[key] = sorter(value[key]);
          return acc;
        }, {});
    }
    return value;
  };

  return JSON.stringify(sorter(obj));
}

/* ======================================================
   SALVAR RESPOSTAS DE ETAPA
   COM sessionId + assessmentId
====================================================== */

/**
 * Persiste respostas de uma etapa individual com versionamento e deduplicação.
 *
 * Implementa padrão de versionamento completo:
 * 1. Normaliza e calcula hash da resposta
 * 2. Compara com versão *latest* em `stages/{stage}`
 * 3. Se hash não mudou, retorna `unchanged` (idempotente)
 * 4. Se mudou: atualiza latest, adiciona entry ao histórico em `stages/{stage}/versions`
 * 5. Sincroniza metadados de sessão (`currentStage`, `updatedAt`)
 *
 * Útil quando usuário revisita etapas anteriores ou há retransmissões de rede.
 * Histórico permite auditoria completa de mudanças de resposta.
 *
 * @async
 * @function saveResponsesStage
 * @param {string} userId - ID do usuário autenticado
 * @param {string} sessionId - ID único da sessão (ex: UUID gerado no início da avaliação)
 * @param {string|null} assessmentId - ID da avaliação LGPD (pode ser null para sessões ad-hoc)
 * @param {Record<number, any>} stageResponses - Objeto com respostas: `{ 0: {...}, 1: {...}, ... }`
 *   Cada valor contém `{ question: string, answer: any }`
 * @param {number} stage - Número sequencial da etapa atual (ex: 1, 2, 3, 4, 5)
 * @returns {Promise<Object>} Resultado da operação:
 *   - `status: "unchanged"` - Resposta idêntica à anterior, nada persistido
 *   - `status: "saved"` - Resposta salva com sucesso em latest + versions
 *   - Inclui `stage`, `sessionId`, `assessmentId`
 * @throws {Error} Se:
 *   - `userId` ausente
 *   - `sessionId` ausente
 *   - Falha de permissão no Firestore
 *   - Falha de conexão
 *
 * @example
 * // Usuário na etapa 2: coleta de dados e armazenamento
 * const result = await saveResponsesStage(
 *   "user_xyz",
 *   "sess_abc-123-def",
 *   "assess_lgpd_2024",
 *   {
 *     0: { question: "Como são coletados dados?", answer: "Email e formulário" },
 *     1: { question: "Onde armazenam?", answer: { selected: "Cloud", description: "AWS S3" } },
 *     2: { question: "Quem acessa?", answer: ["Admin", "Marketing", "Ti"] }
 *   },
 *   2
 * );
 * // result: { status: "saved", stage: 2, sessionId: "sess_abc-123-def", assessmentId: "..." }
 *
 * @example
 * // Usuário retorna à etapa 2 com MESMAS respostas (retry de rede)
 * const result = await saveResponsesStage(...mesmos dados..., 2);
 * // result: { status: "unchanged", stage: 2, ... }
 * // Nenhuma persistência redundante ocorre (deduplicação por hash)
 *
 * @see saveFinalReport Para persistência do relatório final após todas as etapas
 * @see normalizeAnswer Para compreender normalização de tipos diversos
 */
export async function saveResponsesStage(
  userId: string,
  sessionId: string,
  assessmentId: string | null,
  stageResponses: Record<number, any>,
  stage: number
) {
  if (!userId) throw new Error("userId ausente");
  if (!sessionId) throw new Error("sessionId ausente");

  const normalized = Object.entries(stageResponses)
    .map(([k, v]) => ({
      index: Number(k),
      question: String(v?.question ?? ""),
      answer: normalizeAnswer(v?.answer),
    }))
    .sort((a, b) => a.index - b.index);

  const hash = stableStringify(normalized);

  // latest da etapa dentro da sessão
  const latestRef = doc(
    db,
    "assessment_sessions",
    sessionId,
    "stages",
    String(stage)
  );

  const latestSnap = await getDoc(latestRef);
  const latestData = latestSnap.exists() ? latestSnap.data() : null;

  if (latestData?.hash === hash) {
    return { status: "unchanged", stage, sessionId, assessmentId };
  }

  // cria/atualiza metadados da sessão
  const sessionRef = doc(db, "assessment_sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  await setDoc(
    sessionRef,
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      status: "in_progress",
      currentStage: stage,
      updatedAt: serverTimestamp(),
      createdAt: sessionSnap.exists()
        ? sessionSnap.data()?.createdAt ?? serverTimestamp()
        : serverTimestamp(),
    },
    { merge: true }
  );

  // latest da etapa
  await setDoc(
    latestRef,
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      stage,
      answers: normalized,
      hash,
      updatedAt: serverTimestamp(),
      createdAt: latestData?.createdAt ?? serverTimestamp(),
    },
    { merge: true }
  );

  // histórico da etapa
  await addDoc(
    collection(
      db,
      "assessment_sessions",
      sessionId,
      "stages",
      String(stage),
      "versions"
    ),
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      stage,
      answers: normalized,
      hash,
      createdAt: serverTimestamp(),
      previousHash: latestData?.hash ?? null,
    }
  );

  return { status: "saved", stage, sessionId, assessmentId };
}

/* ======================================================
   SALVAR RELATÓRIO FINAL
   COM sessionId + assessmentId
====================================================== */

/**
 * Persiste relatório final de avaliação com versionamento e marcação de conclusão.
 *
 * Implementa padrão de versionamento para relatório final (análise LLM completa):
 * 1. Normaliza e consolida todas as respostas
 * 2. Calcula hash do payload final
 * 3. Compara com versão *latest* em `final_report/latest`
 * 4. Se hash não mudou, retorna `unchanged` (idempotente)
 * 5. Se mudou: atualiza latest, adiciona entry ao histórico em `final_report/latest/versions`
 * 6. Marca sessão como `status: "completed"` e `currentStage: FINAL_STAGE_INDEX`
 *
 * Este é o ponto final da avaliação adaptativa. Relatório contém score de maturidade,
 * métricas, riscos e controles calculados pelo backend. Histórico permite auditar
 * mudanças em caso de re-análise.
 *
 * @async
 * @function saveFinalReport
 * @param {string} userId - ID do usuário autenticado
 * @param {string} sessionId - ID único da sessão (mesmo utilizado em saveResponsesStage)
 * @param {string|null} assessmentId - ID da avaliação LGPD (pode ser null)
 * @param {FinalReport} reportData - Objeto contendo relatório completo:
 *   - `report`: narrativa detalhada
 *   - `summary`: resumo executivo
 *   - `score`: maturidade LGPD (0-100)
 *   - `metrics`: matriz de confusão (TP, FP, FN, TN, precision, recall, f1)
 *   - `risks`: mapeamento de riscos por área
 *   - `controls`: controles recomendados com prioridade
 *   - `responses`: todas as respostas das etapas (array de RawResponse)
 * @returns {Promise<Object>} Resultado da operação:
 *   - `status: "unchanged"` - Relatório idêntico ao anterior, nada persistido
 *   - `status: "saved"` - Relatório salvo com sucesso
 *   - Inclui `sessionId`, `assessmentId`
 * @throws {Error} Se:
 *   - `userId` ausente
 *   - `sessionId` ausente
 *   - `reportData` ausente
 *   - Falha de permissão no Firestore
 *   - Falha de conexão
 *
 * @example
 * // Backend gera relatório após análise LLM
 * const finalReport = {
 *   report: "Avaliação revela fragilidades críticas...",
 *   summary: "Maturidade baixa em consentimento e direitos.",
 *   score: 38,
 *   metrics: {
 *     truePositives: 12,
 *     falsePositives: 2,
 *     falseNegatives: 3,
 *     trueNegatives: 18,
 *     precision: 0.86,
 *     recall: 0.80,
 *     f1Score: 0.83
 *   },
 *   risks: {
 *     "Coleta de Dados": { severity: "crítico", likelihood: "alta", ... },
 *     "Consentimento": { severity: "alto", likelihood: "alta", ... }
 *   },
 *   controls: [
 *     { name: "Implementar banco de consentimento", effort: "alto", priority: 1 },
 *     { name: "Revisar retenção de dados", effort: "médio", priority: 2 }
 *   ],
 *   responses: [
 *     { index: 0, question: "Como coletam dados?", answer: "Email/formulário" },
 *     { index: 1, question: "Armazenam onde?", answer: { selected: "Cloud", description: "AWS" } }
 *   ]
 * };
 *
 * const result = await saveFinalReport(
 *   "user_xyz",
 *   "sess_abc-123-def",
 *   "assess_lgpd_2024",
 *   finalReport
 * );
 * // result: { status: "saved", sessionId: "sess_abc-123-def", assessmentId: "..." }
 *
 * @see saveResponsesStage Para persistência intermediária de etapas
 * @see FinalReport Para estrutura completa do relatório
 */
export async function saveFinalReport(
  userId: string,
  sessionId: string,
  assessmentId: string | null,
  reportData: FinalReport
) {
  if (!userId) throw new Error("userId ausente");
  if (!sessionId) throw new Error("sessionId ausente");
  if (!reportData) throw new Error("reportData ausente");

  const normalizedResponses = normalizeResponses(reportData.responses);

  const finalPayload = {
    ...reportData,
    responses: normalizedResponses,
  };

  const hash = stableStringify(finalPayload);

  // relatório latest da sessão
  const latestRef = doc(
    db,
    "assessment_sessions",
    sessionId,
    "final_report",
    "latest"
  );

  const latestSnap = await getDoc(latestRef);
  const latestData = latestSnap.exists() ? latestSnap.data() : null;

  if (latestData?.hash === hash) {
    return { status: "unchanged", sessionId, assessmentId };
  }

  // atualiza/garante sessão
  const sessionRef = doc(db, "assessment_sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  await setDoc(
    sessionRef,
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      status: "completed",
      currentStage: FINAL_STAGE_INDEX,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: sessionSnap.exists()
        ? sessionSnap.data()?.createdAt ?? serverTimestamp()
        : serverTimestamp(),
    },
    { merge: true }
  );

  // latest do relatório
  await setDoc(
    latestRef,
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      ...finalPayload,
      hash,
      updatedAt: serverTimestamp(),
      createdAt: latestData?.createdAt ?? serverTimestamp(),
    },
    { merge: true }
  );

  // histórico do relatório
  await addDoc(
    collection(
      db,
      "assessment_sessions",
      sessionId,
      "final_report",
      "latest",
      "versions"
    ),
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      ...finalPayload,
      hash,
      createdAt: serverTimestamp(),
      previousHash: latestData?.hash ?? null,
    }
  );

  return { status: "saved", sessionId, assessmentId };
}