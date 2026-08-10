/**
 * @module services/apiService
 * @description Serviço de comunicação com backend API para persistência e análise
 * de respostas de elicitação adaptativa. Integra com variáveis de ambiente Vite
 * para configuração dinâmica de endpoints.
 *
 * @note Todas as operações são assíncronas e implementam tratamento robusto de
 * erros com logging em console e propagação de exceções para consumidor.
 */

const API_URL = import.meta.env.VITE_API_URL;

/* ========================================================
   TIPOS
======================================================== */

/**
 * Estrutura de payload para persistência de respostas de uma etapa específica
 * da elicitação adaptativa.
 *
 * @typedef {Object} SaveResponsesPayload
 * @property {string} userId - Identificador único do usuário (obtido via Auth)
 * @property {string} sessionId - ID da sessão de avaliação (para rastreamento)
 * @property {number} stageId - Número sequencial da etapa atual (ex: 1, 2, 3)
 * @property {*} answers - Objeto contendo respostas do usuário à etapa.
 *   Estrutura flexível para acomodar diferentes tipos de perguntas
 * @property {string} [assessmentId] - ID da avaliação de maturidade LGPD (opcional)
 */
export interface SaveResponsesPayload {
  userId: string;
  sessionId: string;
  stageId: number;
  answers: any;
  assessmentId?: string;
}

/**
 * Estrutura de payload para envio de relatório final com todas as respostas
 * para análise e cálculo de métricas de conformidade.
 *
 * @typedef {Object} SaveFinalReportPayload
 * @property {string} userId - Identificador único do usuário
 * @property {string} sessionId - ID da sessão de avaliação completa
 * @property {*} responses - Objeto contendo TODAS as respostas coletadas nas etapas.
 *   Chave esperada: stage ID ou identificador da pergunta
 * @property {string} [assessmentId] - ID da avaliação LGPD (opcional)
 */
export interface SaveFinalReportPayload {
  userId: string;
  sessionId: string;
  responses: any;
  assessmentId?: string;
}

/* ========================================================
   SALVA RESPOSTAS DE CADA ETAPA
======================================================== */

/**
 * Persiste as respostas de uma etapa individual da elicitação adaptativa.
 *
 * Esta função envia as respostas fornecidas pelo usuário para uma etapa específica
 * ao backend. Permite checkpoints intermediários e facilita recuperação de sessão
 * em caso de desconexão. Implementa retry logic no lado do consumidor recomendado.
 *
 * O payload é enriquecido no backend com timestamps e auditoria antes de persistência
 * no banco de dados. Útil para análise posterior de padrões de resposta e
 * mudanças entre sessões.
 *
 * @async
 * @function saveResponses
 * @param {SaveResponsesPayload} params - Objeto contendo dados da etapa
 * @param {string} params.userId - ID do usuário autenticado
 * @param {string} params.sessionId - ID único da sessão (recomendado: UUID)
 * @param {number} params.stageId - Número da etapa (1-indexed)
 * @param {*} params.answers - Objeto com respostas do usuário
 * @param {string} [params.assessmentId] - ID da avaliação (se aplicável)
 * @returns {Promise<*>} Resposta JSON do servidor contendo:
 *   - `success: boolean` - Status da operação
 *   - `docId?: string` - ID do documento criado (se sucesso)
 *   - `message?: string` - Mensagem descritiva
 * @throws {Error} Lança erro se:
 *   - Falha na requisição de rede
 *   - Backend retorna status != 2xx
 *   - Resposta JSON é inválida
 *   - Validação de payload falha no servidor
 *
 * @example
 * // Usuário completa etapa 2 com respostas sobre coleta de dados
 * try {
 *   const result = await saveResponses({
 *     userId: "user_123",
 *     sessionId: "sess_abc-def-ghi",
 *     stageId: 2,
 *     answers: {
 *       q1: "Sim, aplicamos consentimento",
 *       q2: "Banco de dados centralizado",
 *       q3: 0.8
 *     },
 *     assessmentId: "assess_lgpd_001"
 *   });
 *   console.log("Etapa 2 salva:", result.docId);
 * } catch (error) {
 *   console.error("Falha ao salvar etapa:", error.message);
 *   // Implementar retry ou notificar usuário
 * }
 *
 * @see saveFinalReport Para envio final de todas as respostas após completar todas as etapas
 */
export async function saveResponses({
  userId,
  sessionId,
  stageId,
  answers,
  assessmentId,
}: SaveResponsesPayload) {
  try {
    const response = await fetch(`${API_URL}/api/save-responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        sessionId,
        stage: stageId,
        answers,
        assessmentId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Erro ao salvar respostas da etapa");
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao salvar respostas:", error);
    throw error;
  }
}

/* ========================================================
   ENVIA DADOS FINAIS PARA ANÁLISE
======================================================== */

/**
 * Envia relatório final com todas as respostas da sessão para análise de
 * maturidade e conformidade com LGPD.
 *
 * Esta função marca o término da elicitação adaptativa, consolidando todas as
 * respostas coletadas nas etapas anteriores. O backend processa dados, calcula
 * métricas de matriz de confusão (TP, FP, FN, TN) e gera relatório de
 * fragilidades identificadas com score de maturidade.
 *
 * Operação crítica que desencadeia análise LLM e geração de insights. Recomenda-se
 * implementar handling de timeout estendido, pois processamento pode levar 10-30s.
 *
 * @async
 * @function saveFinalReport
 * @param {SaveFinalReportPayload} params - Objeto contendo dados completos
 * @param {string} params.userId - ID do usuário autenticado
 * @param {string} params.sessionId - ID da sessão completa
 * @param {*} params.responses - Todas as respostas: `{ stageId: answers, ... }`
 * @param {string} [params.assessmentId] - ID da avaliação (se aplicável)
 * @returns {Promise<*>} Resposta JSON contendo:
 *   - `success: boolean` - Status da análise
 *   - `maturityScore?: number` - Score de maturidade (0-100)
 *   - `fragilidades?: Array` - Lista de fragilidades detectadas
 *   - `recommendations?: Array` - Recomendações de remediação
 *   - `reportId?: string` - ID do relatório gerado
 * @throws {Error} Lança erro se:
 *   - Falha na requisição de rede
 *   - Backend retorna status != 2xx
 *   - Respostas insuficientes para análise
 *   - Timeout durante processamento LLM
 *
 * @example
 * // Usuário completa todas as 5 etapas e submete para análise
 * try {
 *   const report = await saveFinalReport({
 *     userId: "user_123",
 *     sessionId: "sess_abc-def-ghi",
 *     responses: {
 *       1: { q1: "Sim", q2: "Email e WhatsApp" },
 *       2: { q1: "Não", q2: "Cloud" },
 *       3: { q1: "Parcial", q2: 0.5 },
 *       4: { q1: "Sim", q2: "Automático" },
 *       5: { q1: "Não", q2: "Terceiros" }
 *     },
 *     assessmentId: "assess_lgpd_001"
 *   });
 *   console.log("Score de maturidade:", report.maturityScore);
 *   console.log("Fragilidades encontradas:", report.fragilidades.length);
 *   // Redirecionar para tela de resultados com reportId
 * } catch (error) {
 *   console.error("Análise falhou:", error.message);
 *   // Oferecer opção de salvar rascunho e tentar depois
 * }
 *
 * @see saveResponses Para persistência incremental de etapas durante sessão
 */
export async function saveFinalReport({
  userId,
  sessionId,
  responses,
  assessmentId,
}: SaveFinalReportPayload) {
  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        sessionId,
        responses,
        assessmentId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Erro ao gerar relatório final");
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    throw error;
  }
}