/**
 * Gerador de perguntas dinâmicas para avaliação de maturidade em proteção de dados.
 * 
 * Utiliza a API Groq com prompt especializado para gerar questões adaptadas
 * ao perfil do respondente e estágio da avaliação.
 * @module server/groq/generateStageGroq
 */

import { chatCompletion } from "../lib/ai-client.mjs";

/**
 * Metadados dos estágios de avaliação.
 * @constant
 * @type {Object<number, {title: string, questions: number}>}
 */
const STAGE_META = {
  1: {
    title: "Perfil e Contexto",
    questions: 4,
  },
  2: {
    title: "Competências e Contato com Dados",
    questions: 5,
  },
  3: {
    title: "Processos Organizacionais",
    questions: 5,
  },
  4: {
    title: "Controles Técnicos e Administrativos",
    questions: 5,
  },
};

/**
 * Gera questões adaptativas para um estágio específico da avaliação.
 * 
 * @async
 * @param {Object} params - Parâmetros de entrada
 * @param {number} params.stage - Número do estágio (1-4)
 * @param {string} params.profile - Perfil do respondente (ex: "Estudante", "Gestor")
 * @param {Object|string} params.context - Respostas anteriores ou histórico
 * 
 * @returns {Promise<{id: number, title: string, description: string, questions: Array<{id: string, type: string, question: string, options?: string[], required: boolean}>}>}
 *   Objeto com questões geradas ou fallback em caso de erro
 * 
 * @throws {Error} Se o estágio for inválido
 */
export async function generateStageGroq({ stage, profile, context }) {
  if (!STAGE_META[stage]) {
    throw new Error(`Stage inválido: ${stage}`);
  }

  const { questions: questionsCount, title } = STAGE_META[stage];

  const academicProfiles = ["Estudante", "Pesquisador"];
  const scope = academicProfiles.includes(profile)
    ? "contexto acadêmico, educacional ou conceitual"
    : "contexto organizacional, profissional e operacional";

  const readableContext =
    typeof context === "object"
      ? JSON.stringify(context, null, 2)
      : String(context ?? "");

  const prompt = `
Você é especialista em LGPD e ISO/IEC 27001.

Etapa: ${title}
Perfil do usuário: ${profile}
Escopo permitido: ${scope}

REGRAS OBRIGATÓRIAS:
- Gere exatamente ${questionsCount} perguntas
- NÃO repita perguntas já feitas
- Perguntas DEVEM ser coerentes com o perfil
- Tipos permitidos: select, checkbox, textarea
- Se houver "Outro", incluir a opção "Outro"
- Retorne APENAS JSON válido
- NÃO use markdown
- NÃO explique nada fora do JSON

FORMATO:
{
  "questions": [
    {
      "id": "q1",
      "type": "select | checkbox | textarea",
      "question": "texto",
      "options": ["opção 1", "opção 2", "Outro"],
      "required": true
    }
  ]
}

Perguntas e respostas anteriores:
${readableContext}
`.trim();

  try {
    const raw = await chatCompletion(
      [{ role: "user", content: prompt }],
      { temperature: 0.3 }
    );
    if (!raw) throw new Error("Resposta vazia");

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON não encontrado");

    const parsed = JSON.parse(match[0]);

    if (!Array.isArray(parsed.questions)) {
      throw new Error("Estrutura inválida");
    }

    const questions = parsed.questions
      .slice(0, questionsCount)
      .map((q, i) => ({
        id: q.id || `q${i + 1}`,
        type: ["select", "checkbox", "textarea"].includes(q.type)
          ? q.type
          : "textarea",
        question: q.question,
        options: Array.isArray(q.options) ? q.options : undefined,
        required: true,
      }));

    while (questions.length < questionsCount) {
      questions.push({
        id: `fallback_${stage}_${questions.length + 1}`,
        type: "textarea",
        question: "Descreva sua experiência sobre este tema.",
        required: true,
      });
    }

    return {
      id: stage,
      title,
      description: `Avaliação — ${title}`,
      questions,
    };
  } catch (err) {
    console.error("❌ GROQ falhou — fallback:", err.message);

    return {
      id: stage,
      title,
      description: "Fallback seguro",
      questions: Array.from({ length: questionsCount }).map((_, i) => ({
        id: `fallback_${stage}_${i + 1}`,
        type: "textarea",
        question: "Descreva sua experiência sobre este tema.",
        required: true,
      })),
    };
  }
}