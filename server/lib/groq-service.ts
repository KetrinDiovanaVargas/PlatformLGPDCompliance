import { headroomService } from './headroom';
// @ts-ignore
import { chatCompletion } from './ai-client.mjs';

export class GroqHeadroomService {
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
