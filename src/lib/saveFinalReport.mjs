/**
 * @module server/lib/saveFinalReport
 * @description Utilitário de persistência para relatórios finais de avaliação LGPD
 * no Firestore. Armazena análise completa com timestamp do servidor para auditoria.
 */

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.mjs";

/**
 * Persiste relatório final de análise de maturidade LGPD no Firestore.
 *
 * Salva dados de análise computada (score, métricas, riscos, controles) em documento
 * Firestore isolado por usuário. Implementa padrão de sobrescrita (última versão de
 * análise para cada usuário). Timestamp do servidor é adicionado automaticamente
 * para rastreamento de quando o relatório foi salvo.
 *
 * Estrutura Firestore:
 * ```
 * finalReports/
 * └── {userId}: {
 *     report: string,
 *     summary: string,
 *     score: number,
 *     metrics: {...},
 *     risks: {...},
 *     controls: [...],
 *     responses: [...],
 *     createdAt: Timestamp
 * }
 * ```
 *
 * @async
 * @function saveFinalReport
 * @param {string} userId - Identificador único do usuário autenticado.
 *   Usado como chave do documento em "finalReports/{userId}" para isolamento de dados.
 * @param {Object} analysis - Objeto contendo resultado completo da análise:
 *   @param {string} analysis.report - Relatório narrativo detalhado em português
 *   @param {string} analysis.summary - Resumo executivo (150-300 palavras)
 *   @param {number} analysis.score - Score de maturidade LGPD (0-100)
 *   @param {Object} analysis.metrics - Métricas de detecção (TP, FP, FN, TN, precision, recall, f1)
 *   @param {Object} analysis.risks - Mapeamento de riscos por área ("Coleta": {...}, etc)
 *   @param {Array} analysis.controls - Controles recomendados com prioridade
 *   @param {Array} analysis.responses - Todas as respostas normalizadas do usuário
 * @returns {Promise<void>} Promessa que resolve quando documento é persistido no Firestore
 * @throws {Error} Se:
 *   - `userId` não fornecido ou ausente
 *   - Falha de permissão no Firestore (Security Rules)
 *   - Falha de conexão com Firestore
 *   - Dados excedem limite de tamanho do documento (1 MB)
 *
 * @example
 * // Backend gerou análise após processar respostas
 * const analysisResult = {
 *   report: "Avaliação revela maturidade baixa em consentimento...",
 *   summary: "Organização necessita implementar consentimento explícito.",
 *   score: 42,
 *   metrics: {
 *     truePositives: 8,
 *     falsePositives: 1,
 *     falseNegatives: 3,
 *     trueNegatives: 13,
 *     precision: 0.89,
 *     recall: 0.73,
 *     f1Score: 0.80
 *   },
 *   risks: {
 *     "Consentimento": { severity: "crítico", likelihood: "alta" },
 *     "Segurança": { severity: "alto", likelihood: "média" }
 *   },
 *   controls: [
 *     { name: "Implementar banner de consentimento", priority: 1, effort: "baixo" },
 *     { name: "Revisar política de retenção", priority: 2, effort: "médio" }
 *   ],
 *   responses: [
 *     { index: 0, question: "Como dados são coletados?", answer: "Email/formulário" },
 *     { index: 1, question: "Onde armazenam?", answer: "Cloud AWS" }
 *   ]
 * };
 *
 * try {
 *   await saveFinalReport("user_xyz", analysisResult);
 *   console.log("Relatório salvo com sucesso para usuario_xyz");
 * } catch (error) {
 *   console.error("Falha ao persistir relatório:", error.message);
 * }
 *
 * @see {@link ../server/routes/analyze.mjs} Para geração de análise via GROQ LLM
 * @see {@link ./firebase.mjs} Para configuração do Firestore
 */
export async function saveFinalReport(userId, analysis) {
  if (!userId) throw new Error("userId é obrigatório para salvar relatório");

  const ref = doc(db, "finalReports", userId);

  await setDoc(ref, {
    ...analysis,
    createdAt: serverTimestamp(),
  });
}