/**
 * Cliente Claude Sonnet 5 com suporte a fila de requisições.
 * 
 * Oferece integração com Anthropic SDK com rate limiting via fila,
 * suporte a JSON mode e alta capacidade de tokens/minuto.
 * @module lib/claude-client
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Identificador do modelo Claude utilizado.
 * @constant
 * @type {string}
 */
const CLAUDE_MODEL = 'claude-sonnet-5';

/**
 * Inicializa cliente Anthropic com configurações padrão.
 * 
 * @private
 * @returns {Anthropic|null} Cliente configurado ou null se chave não configurada
 */
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
 * Chama Claude com array de mensagens e retorna texto.
 * 
 * Suporta JSON mode e controle de temperatura (em modelos que aceitam).
 * Modelos recentes (Sonnet 5, Opus 4.8) descontinuaram temperatura explícita.
 * 
 * @async
 * @param {Array<{role: "user"|"assistant", content: string}>} messages - Array de mensagens
 * @param {Object} [opts={}] - Opções
 * @param {number} [opts.temperature=0.2] - Temperatura (apenas modelos antigos)
 * @param {boolean} [opts.jsonMode=false] - Força resposta em JSON válido
 * @param {number} [opts.maxTokens=8192] - Máximo de tokens na resposta
 * 
 * @returns {Promise<string>} Texto da resposta do modelo
 * 
 * @throws {Error} Se ANTHROPIC_API_KEY não configurada ou requisição falha
 * 
 * @example
 * const response = await claudeCompletion([
 *   { role: 'user', content: 'Analise este JSON' }
 * ], { jsonMode: true, maxTokens: 4000 });
 */
export async function claudeCompletion(messages, opts = {}) {
  const { temperature = 0.2, jsonMode = false, maxTokens = 8192 } = opts;

  const client = getClaudeClient();
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  try {
    const params = {
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages,
    };

    const supportsTemperature = /haiku|claude-3|opus-4-5/.test(CLAUDE_MODEL);
    if (supportsTemperature) {
      params.temperature = temperature;
    }

    if (jsonMode && messages[0]?.role === 'system') {
      params.system = messages[0].content + '\n\nImportante: Sua resposta DEVE ser válido JSON. Retorne APENAS JSON, sem markdown ou explicações adicionais.';
      params.messages = messages.slice(1);
    }

    const completion = await client.messages.create(params);

    const textBlock = completion.content.find((b) => b.type === 'text');

    console.log(`✓ Chat com Claude (${CLAUDE_MODEL}) bem-sucedido`);
    return textBlock?.text ?? '';

  } catch (error) {
    console.error(`❌ Erro Claude: ${error.message}`);
    throw error;
  }
}

/**
 * Chama Claude através da fila de requisições com rate limiting.
 * 
 * Integra com AIQueue para respeitar limites de concorrência e delay
 * entre requisições. Suporta priorização de tarefas.
 * 
 * @async
 * @param {Array<{role: "user"|"assistant", content: string}>} messages - Array de mensagens
 * @param {Object} [opts={}] - Opções
 * @param {"high"|"normal"|"low"} [opts.priority="normal"] - Prioridade na fila
 * @param {number} [opts.timeout=30000] - Timeout da tarefa (ms)
 * @param {number} [opts.temperature=0.2] - Temperatura (repassado ao Claude)
 * @param {boolean} [opts.jsonMode=false] - JSON mode (repassado ao Claude)
 * @param {number} [opts.maxTokens=8192] - Max tokens (repassado ao Claude)
 * 
 * @returns {Promise<string>} Texto da resposta do modelo
 * 
 * @throws {Error} Com code QUEUE_FULL se fila estiver no limite
 * @throws {Error} Com code TASK_TIMEOUT se tarefa exceder timeout
 * 
 * @example
 * const response = await queuedClaudeCompletion(
 *   [{ role: 'user', content: 'Gere relatório' }],
 *   { priority: 'high', timeout: 60000 }
 * );
 */
export async function queuedClaudeCompletion(messages, opts = {}) {
  const { priority = 'normal', timeout = 30000, ...chatOpts } = opts;

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
 * Testa disponibilidade e conectividade do Claude.
 * 
 * Valida configuração de API key e faz requisição de teste.
 * Retorna informações de disponibilidade e modelo.
 * 
 * @async
 * @returns {Promise<{available: boolean, model: string, provider: string, message?: string, error?: string}>}
 *   Objeto com status de disponibilidade e detalhes
 * 
 * @example
 * const status = await testClaudeAvailability();
 * if (status.available) {
 *   console.log(`Claude ${status.model} pronto`);
 * } else {
 *   console.error(`Erro: ${status.error}`);
 * }
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

/**
 * Exportações padrão do módulo.
 * @type {{claudeCompletion: Function, queuedClaudeCompletion: Function, testClaudeAvailability: Function}}
 */
export default {
  claudeCompletion,
  queuedClaudeCompletion,
  testClaudeAvailability,
};