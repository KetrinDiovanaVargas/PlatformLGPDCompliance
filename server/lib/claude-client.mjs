/**
 * claude-client.mjs
 *
 * Cliente Claude Sonnet 5 com integração de fila
 * Oferece:
 * - Alta capacidade de tokens/minuto (sem rate limiting agressivo)
 * - Excelente suporte a português
 * - Equilíbrio entre qualidade e custo ($3/$15 por 1M tokens)
 */

import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-sonnet-5';

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
    };

    // temperature foi descontinuado nos modelos Claude mais recentes
    // (Sonnet 5, Opus 4.8, etc). Só enviamos para modelos que ainda aceitam.
    const supportsTemperature = /haiku|claude-3|opus-4-5/.test(CLAUDE_MODEL);
    if (supportsTemperature) {
      params.temperature = temperature;
    }

    // Claude não tem modo JSON explícito, mas respeitamos o intent
    // Se jsonMode, adicionamos instrução no system message
    if (jsonMode && messages[0]?.role === 'system') {
      params.system = messages[0].content + '\n\nImportante: Sua resposta DEVE ser válido JSON. Retorne APENAS JSON, sem markdown ou explicações adicionais.';
      params.messages = messages.slice(1);
    }

    const completion = await client.messages.create(params);

    // Modelos Claude recentes (Sonnet 5, Opus 4.8) retornam blocos de
    // raciocínio (thinking) antes do texto. Pegamos o bloco de texto real,
    // não o content[0] (que pode ser o thinking vazio).
    const textBlock = completion.content.find((b) => b.type === 'text');

    console.log(`✓ Chat com Claude (${CLAUDE_MODEL}) bem-sucedido`);
    return textBlock?.text ?? '';

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
      max_tokens: 50,
      messages: testMessages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');

    return {
      available: true,
      model: CLAUDE_MODEL,
      provider: 'claude',
      message: textBlock?.text ?? '',
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
