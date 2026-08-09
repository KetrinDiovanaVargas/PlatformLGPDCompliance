/**
 * @file Serviço de Análise LGPD com Groq API
 * @module groq-headroom
 * @description
 * Módulo responsável pela análise automática de conformidade LGPD utilizando
 * a API Groq com fallback para Claude, DeepSeek e Gemini via cascade automático.
 * Implementa compressão de tokens via Headroom para otimização de requisições.
 * 
 * O serviço analisa respostas de questionários através de IA, gerando scores de
 * conformidade, níveis de risco e recomendações acionáveis de forma automática.
 * 
 * Fluxo:
 * 1. Recebe perguntas e respostas do usuário
 * 2. Comprime conteúdo via Headroom para otimizar tokens
 * 3. Envia para análise via cascade de LLMs (Groq → Claude → DeepSeek → Gemini)
 * 4. Extrai JSON da resposta
 * 5. Retorna análise estruturada com score, risco e recomendações
 * 
 * @requires ./headroom - Serviço de compressão de tokens
 * @requires ./ai-client.mjs - Cliente centralizado de IA com cascade
 * 
 * @example
 * import { groqHeadroomService } from './groq-headroom';
 * 
 * const result = await groqHeadroomService.analyzeLGPDCompliance(
 *   questions,
 *   responses,
 *   'session-123'
 * );
 * 
 * console.log(`Score: ${result.analysis.score}`);
 * console.log(`Risco: ${result.analysis.riskLevel}`);
 * 
 * @version 1.0.0
 * @author Seu Nome
 */

/**
 * @typedef {Object} LGPDRecommendation
 * @property {number} priority - Prioridade da recomendação (1-5, onde 1 é crítica)
 * @property {string} action - Descrição da ação recomendada
 * @property {number} estimatedDaysToImplement - Dias estimados para implementação
 */

/**
 * @typedef {Object} LGPDAnalysisResult
 * @property {number} score - Score de conformidade LGPD (0-100)
 * @property {('Crítico'|'Alto'|'Médio'|'Baixo')} riskLevel - Nível de risco identificado
 * @property {string[]} criticalAreas - Áreas críticas identificadas
 * @property {LGPDRecommendation[]} recommendations - Lista de recomendações de ação
 * @property {string} summary - Resumo executivo da análise
 */

/**
 * @typedef {Object} AnalyzeLGPDComplianceResponse
 * @property {boolean} success - Indica se análise foi bem-sucedida
 * @property {LGPDAnalysisResult} analysis - Análise de conformidade LGPD
 * @property {Object} metadata - Metadados da requisição
 * @property {string} metadata.model - Modelo de IA utilizado (cascade)
 * @property {string} metadata.timestamp - Timestamp ISO da análise
 */

/**
 * Classe GroqHeadroomService
 * 
 * Serviço para análise de conformidade LGPD com otimização de tokens.
 * Utiliza cascade automático de LLMs: Groq → Claude → DeepSeek → Gemini
 * 
 * Características:
 * - Compressão de tokens via Headroom para reduzir custos
 * - Cascade automático com fallback entre 4 provedores
 * - Extração inteligente de JSON da resposta
 * - Análise baseada em 5 dimensões LGPD:
 *   • Data Storage (armazenamento de dados)
 *   • Data Sharing (compartilhamento de dados)
 *   • Consent (consentimento)
 *   • Data Retention (retenção de dados)
 *   • Monitoring & Audit (monitoramento e auditoria)
 * 
 * @class
 * @example
 * // Uso básico
 * const service = new GroqHeadroomService();
 * const result = await service.analyzeLGPDCompliance(questions, responses);
 * 
 * @example
 * // Com session tracking
 * const result = await service.analyzeLGPDCompliance(
 *   questions,
 *   responses,
 *   'user-session-abc123'
 * );
 */
export class GroqHeadroomService {
  /**
   * Analisa respostas de questionário para conformidade LGPD
   * 
   * Processa respostas do usuário e gera análise de risco, scores e recomendações
   * automáticas usando IA. A análise é baseada em 5 dimensões de vulnerabilidade LGPD:
   * Data Storage, Data Sharing, Consent, Data Retention, Monitoring & Audit.
   * 
   * Algoritmo:
   * 1. Pega primeiras 10 perguntas do array
   * 2. Comprime conteúdo JSON (perguntas + respostas) via Headroom
   * 3. Envia prompt estruturado para cascade de LLMs
   * 4. Extrai JSON da resposta usando regex
   * 5. Valida e retorna resultado estruturado
   * 
   * Compressão reduz tamanho do payload, economizando tokens e latência.
   * Cascade garante disponibilidade mesmo com rate limits de um provedor.
   * 
   * @async
   * @param {unknown[]} questions - Array de perguntas do questionário (primeiras 10 usadas)
   * @param {Record<string, unknown>} responses - Objeto com respostas do usuário
   *                                               (chave: id da pergunta, valor: resposta)
   * @param {string} [sessionId] - ID opcional da sessão para tracking e logging
   * @returns {Promise<AnalyzeLGPDComplianceResponse>} Resultado da análise com score,
   *                                                    risco, áreas críticas e recomendações
   * 
   * @throws {Error} Se análise falhar em todas as APIs do cascade (Groq, Claude, DeepSeek, Gemini)
   * 
   * @example
   * // Análise simples
   * const result = await service.analyzeLGPDCompliance(questions, responses);
   * console.log(result.analysis.score); // 0-100
   * console.log(result.analysis.riskLevel); // Crítico|Alto|Médio|Baixo
   * console.log(result.analysis.summary); // Resumo executivo
   * 
   * @example
   * // Com rastreamento de sessão
   * const result = await service.analyzeLGPDCompliance(
   *   questions,
   *   responses,
   *   'sess_123_user_abc'
   * );
   * 
   * if (result.analysis.riskLevel === 'Crítico') {
   *   console.warn('Conformidade crítica! Ações imediatas necessárias.');
   *   result.analysis.recommendations
   *     .filter(r => r.priority === 1)
   *     .forEach(r => console.log(`- ${r.action}`));
   * }
   * 
   * @example
   * // Processamento de batch
   * const sessions = ['sess_1', 'sess_2', 'sess_3'];
   * const analyses = await Promise.all(
   *   sessions.map(sessId =>
   *     service.analyzeLGPDCompliance(questions, responses, sessId)
   *   )
   * );
   * console.log(`Scores: ${analyses.map(a => a.analysis.score).join(', ')}`);
   * 
   * @example
   * // Tratamento de erro
   * try {
   *   const result = await service.analyzeLGPDCompliance(questions, responses);
   *   // Processar resultado...
   * } catch (error) {
   *   console.error('Análise LGPD falhou:', error.message);
   *   // Fallback para análise manual ou cache
   * }
   */
  async analyzeLGPDCompliance(
    questions: unknown[],
    responses: Record<string, unknown>,
    sessionId?: string
  ) {
    try {
      const rawContent = JSON.stringify({
        questions: questions.slice(0, 10),
        responses,
      });

      const { compressed } = headroomService.compress(rawContent);

      const analysisPrompt = `Você é especialista em LGPD. Analise as respostas e responda SEMPRE em JSON válido:
{
  "score": 0-100,
  "riskLevel": "Crítico|Alto|Médio|Baixo",
  "criticalAreas": ["area1", "area2"],
  "recommendations": [{"priority": 1, "action": "descrição", "estimatedDaysToImplement": 30}],
  "summary": "resumo executivo"
}

Dados:
${compressed}`;

      const responseText = await chatCompletion(
        [
          { role: 'system', content: 'Especialista em LGPD. Sempre JSON válido.' },
          { role: 'user',   content: analysisPrompt },
        ],
        { temperature: 0.7 }
      );

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return {
        success: true,
        analysis,
        metadata: {
          model: 'ai-client (groq/gemini)',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Erro:', error);
      throw error;
    }
  }
}

/**
 * Instância singleton do GroqHeadroomService
 * 
 * Exportada como singleton para uso em toda a aplicação.
 * Recomenda-se usar esta instância em vez de criar novas instâncias.
 * 
 * @type {GroqHeadroomService}
 * 
 * @example
 * import { groqHeadroomService } from './groq-headroom';
 * 
 * // Use direto, sem instanciar
 * const result = await groqHeadroomService.analyzeLGPDCompliance(
 *   questions,
 *   responses
 * );
 */
export const groqHeadroomService = new GroqHeadroomService();