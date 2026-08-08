/**
 * Serviço de Análise LGPD com Groq API
 * 
 * Módulo responsável pela análise automática de conformidade LGPD utilizando
 * a API Groq com fallback para Claude, DeepSeek e Gemini via cascade automático.
 * Implementa compressão de tokens via Headroom para otimização de requisições.
 */

import { headroomService } from './headroom';
// @ts-ignore
import { chatCompletion } from './ai-client.mjs';

/**
 * Classe GroqHeadroomService
 * 
 * Serviço para análise de conformidade LGPD com otimização de tokens.
 * Utiliza cascade automático de LLMs: Groq → Claude → DeepSeek → Gemini
 * 
 * @class
 */
export class GroqHeadroomService {
  /**
   * Analisa respostas de questionário para conformidade LGPD
   * 
   * Processa respostas do usuário e gera análise de risco, scores e recomendações
   * automáticas usando IA. A análise é baseada em 5 dimensões de vulnerabilidade LGPD:
   * Data Storage, Data Sharing, Consent, Data Retention, Monitoring & Audit.
   * 
   * @async
   * @param {unknown[]} questions - Array de perguntas do questionário (primeiras 10 usadas)
   * @param {Record<string, unknown>} responses - Objeto com respostas do usuário (chave: id da pergunta, valor: resposta)
   * @param {string} [sessionId] - ID opcional da sessão para logging
   * @returns {Promise<{success: boolean, analysis: {score: number, riskLevel: string, criticalAreas: string[], recommendations: Array}, metadata: {model: string, timestamp: string}}>}
   * 
   * @throws {Error} Se análise falhar em todas as APIs do cascade
   * 
   * @example
   * const result = await service.analyzeLGPDCompliance(questions, responses, 'sess_123');
   * console.log(result.analysis.score); // 0-100
   * console.log(result.analysis.riskLevel); // Crítico|Alto|Médio|Baixo
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

export const groqHeadroomService = new GroqHeadroomService();
