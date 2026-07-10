/**
 * claude-client.mjs
 *
 * Cliente Claude 3.5 Sonnet com integração de fila
 * Oferece:
 * - 100k tokens/minuto (sem rate limiting)
 * - Melhor suporte a português
 * - Custo 50% mais baixo que Groq
 */

import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

function getClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  return new Anthropic({
    apiKey,
    defaultHeaders: {
      'user-agent': 'lgpd-compliance-platform/1.0',
    },
  });
}

/**
 * Chama Claude com array de messages
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} opts - Opções
 * @returns {Promise<string>} Resposta de texto
 */
export async function claudeCompletion(messages, opts = {}) {
  const { temperature = 0.2, jsonMode = false } = opts;

  const client = getClaudeClient();
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  try {
    const params = {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages,
      temperature,
    };

    // Claude não tem modo JSON explícito, mas respeitamos o intent
    // Se jsonMode, adicionamos instrução no system message
    if (jsonMode && messages[0]?.role === 'system') {
      params.system = messages[0].content + '\n\nImportante: Sua resposta DEVE ser válido JSON. Retorne APENAS JSON, sem markdown ou explicações adicionais.';
      params.messages = messages.slice(1);
    }

    const completion = await client.messages.create(params);

    console.log(`✓ Chat com Claude (${CLAUDE_MODEL}) bem-sucedido`);
    return completion.content[0].text ?? '';

  } catch (error) {
    console.error(`❌ Erro Claude: ${error.message}`);
    throw error;
  }
}

/**
 * Versão queued do Claude (integra com fila de requisições)
 * @param {Array} messages
 * @param {object} opts
 * @returns {Promise<string>}
 */
export async function queuedClaudeCompletion(messages, opts = {}) {
  const { priority = 'normal', timeout = 30000, ...chatOpts } = opts;

  // Importa fila dinamicamente para evitar circular dependency
  const { getQueue } = await import('./ai-queue.mjs');
  const queue = getQueue();

  return new Promise((resolve, reject) => {
    queue.add({
      priority,
      timeout,
      fn: async () => {
        return claudeCompletion(messages, chatOpts);
      },
    }).then(resolve).catch(reject);
  });
}

/**
 * Testa se Claude está disponível
 */
export async function testClaudeAvailability() {
  try {
    const client = getClaudeClient();
    if (!client) {
      return {
        available: false,
        error: 'key_missing',
      };
    }

    const testMessages = [{ role: 'user', content: 'ok' }];
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 10,
      messages: testMessages,
    });

    return {
      available: true,
      model: CLAUDE_MODEL,
      provider: 'claude',
      message: response.content[0].text,
    };

  } catch (error) {
    return {
      available: false,
      error: error.message,
      model: CLAUDE_MODEL,
      provider: 'claude',
    };
  }
}

export default {
  claudeCompletion,
  queuedClaudeCompletion,
  testClaudeAvailability,
};
