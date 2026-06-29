import Groq from 'groq-sdk';
import { headroomService } from './headroom';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export class GroqHeadroomService {
  private model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  async analyzeLGPDCompliance(
    questions: any[],
    responses: Record<string, any>,
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

      const message = await groq.chat.completions.create({
        model: this.model,
        messages: [{
          role: 'system',
          content: 'Especialista em LGPD. Sempre JSON válido.'
        }, {
          role: 'user',
          content: analysisPrompt
        }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const responseText = message.choices[0].message.content || '{}';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return {
        success: true,
        analysis,
        metadata: {
          tokensUsed: message.usage?.total_tokens ?? 0,
          model: this.model,
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
