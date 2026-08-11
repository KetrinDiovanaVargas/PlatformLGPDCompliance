/**
 * @file Cliente de IA com Cascade Automático
 * @module ai-client
 * @description
 * Cliente centralizado para requisições de IA com fallback automático entre múltiplos provedores.
 * Implementa cascade de LLMs: Claude → Groq → DeepSeek → Gemini (fallback final)
 * 
 * Características principais:
 * - Cascade automático em caso de falha (rate limit, timeout, erro)
 * - Respeito a rate limits via AIQueue (fila inteligente de requisições)
 * - Suporte a modo JSON (response_format: json_object)
 * - Temperatura configurável por requisição
 * - Logging de qual provedor foi utilizado
 * - Fallback para Gemini como último recurso
 * 
 * @requires groq-sdk
 * @requires @google/generative-ai
 * @requires openai
 * @requires ./ai-queue.mjs
 * @requires ./claude-client.mjs
 * 
 * @example
 * import { chatCompletion } from './ai-client.mjs';
 * 
 * const response = await chatCompletion(
 *   [{ role: 'user', content: 'Analise conformidade LGPD' }],
 *   { temperature: 0.7, jsonMode: true }
 * );
 * console.log(response);
 * 
 * @example
 * // Com fila de requisições
 * import { queuedChatCompletion } from './ai-client.mjs';
 * 
 * const response = await queuedChatCompletion(
 *   [{ role: 'user', content: 'Pergunte algo' }],
 *   { priority: 'high', timeout: 60000, preferredProvider: 'claude' }
 * );
 * 
 * @version 1.0.0
 * 
 */

import { getQueue } from './ai-queue.mjs';
/**
 * @typedef {Object} ChatMessage
 * @property {('user'|'assistant'|'system')} role - Papel da mensagem
 * @property {string} content - Conteúdo da mensagem
 */

/**
 * @typedef {Object} ChatCompletionOptions
 * @property {string} [preferredProvider='claude'] - Provedor preferencial ('claude'|'groq'|'deepseek'|'gemini')
 * @property {number} [temperature=0.2] - Temperatura da resposta (0-1)
 * @property {boolean} [jsonMode=false] - Força resposta em JSON válido
 */

/**
 * @typedef {Object} AIProviderStatus
 * @property {boolean} available - Se o provedor está disponível
 * @property {string} provider - Nome do provedor
 * @property {string} [model] - Modelo utilizado
 * @property {string} [error] - Descrição do erro, se houver
 */

/**
 * @typedef {Object} AIStatusResponse
 * @property {AIProviderStatus} claude - Status do Claude
 * @property {AIProviderStatus} groq - Status do Groq
 * @property {AIProviderStatus} deepseek - Status do DeepSeek
 * @property {AIProviderStatus} gemini - Status do Gemini
 * @property {string|null} recommended - Provedor recomendado
 */

/**
 * @typedef {Object} QueuedChatCompletionOptions
 * @property {string} [preferredProvider='claude'] - Provedor preferencial
 * @property {number} [temperature=0.2] - Temperatura
 * @property {boolean} [jsonMode=false] - Modo JSON
 * @property {('high'|'normal'|'low')} [priority='normal'] - Prioridade na fila
 * @property {number} [timeout=30000] - Timeout em milissegundos
 */

/**
 * @typedef {Object} AIQueueStatus
 * @property {number} queued - Número de requisições aguardando
 * @property {number} active - Número de requisições ativas
 * @property {number} completed - Número de requisições completadas
 * @property {number} failed - Número de requisições que falharam
 * @property {string} provider - Provedor configurado para a fila
 */

/**
 * Verifica se um erro é relacionado a rate limit
 * 
 * @private
 * @param {Error} err - Erro a verificar
 * @returns {boolean} true se é rate limit, false caso contrário
 * 
 * @example
 * if (isRateLimit(error)) {
 *   console.log('Rate limit atingido');
 * }
 */
function isRateLimit(err) {
  return err?.status === 429 ||
    String(err?.message ?? '').toLowerCase().includes('rate limit') ||
    String(err?.message ?? '').toLowerCase().includes('tokens per day')
}

/**
 * Obtém instância do cliente Groq
 * 
 * @private
 * @returns {Groq|null} Cliente Groq se chave disponível, null caso contrário
 */
function getGroqClient() {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  return new Groq({ apiKey: key })
}

/**
 * Obtém instância do cliente DeepSeek
 * 
 * @private
 * @returns {OpenAI|null} Cliente DeepSeek se chave disponível, null caso contrário
 */
function getDeepSeekClient() {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) return null
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com',
  })
}

/**
 * Obtém instância do cliente Google Generative AI (Gemini)
 * 
 * @private
 * @returns {GoogleGenerativeAI|null} Cliente Gemini se chave disponível, null caso contrário
 */
function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  return new GoogleGenerativeAI(key)
}

/**
 * Testa disponibilidade de todos os provedores de IA
 * 
 * Envia uma requisição de teste para cada provedor configurado
 * para verificar sua disponibilidade atual. Útil para logging e
 * decisões de fallback.
 * 
 * @async
 * @returns {Promise<AIStatusResponse>} Status de cada provedor e recomendação
 * 
 * @example
 * const status = await checkAIStatus();
 * console.log(status);
 * // {
 * //   claude: { available: true, provider: 'claude', model: 'claude-sonnet-5' },
 * //   groq: { available: false, provider: 'groq', error: 'rate_limit' },
 * //   deepseek: { available: true, provider: 'deepseek', model: 'deepseek-chat' },
 * //   gemini: { available: true, provider: 'gemini', model: 'gemini-2.0-flash' },
 * //   recommended: 'claude'
 * // }
 * 
 * @throws {Error} Lançado se não conseguir conectar a nenhum provedor
 */
export async function checkAIStatus() {
  const probe = [{ role: 'user', content: 'ok' }]
  const status = {}

  try {
    const claudeStatus = await testClaudeAvailability()
    if (claudeStatus.available) {
      status.claude = { available: true, provider: 'claude', model: 'claude-sonnet-5' }
    } else {
      status.claude = {
        available: false,
        provider: 'claude',
        error: claudeStatus.error
      }
    }
  } catch (err) {
    status.claude = {
      available: false,
      provider: 'claude',
      error: err?.message
    }
  }

  try {
    const groq = getGroqClient()
    if (groq) {
      await groq.chat.completions.create({ model: GROQ_MODEL, messages: probe, max_tokens: 1 })
      status.groq = { available: true, provider: 'groq', model: GROQ_MODEL }
    } else {
      status.groq = { available: false, provider: 'groq', error: 'key_missing' }
    }
  } catch (err) {
    status.groq = {
      available: false,
      provider: 'groq',
      model: GROQ_MODEL,
      error: isRateLimit(err) ? 'rate_limit' : err?.message
    }
  }

  try {
    const deepseek = getDeepSeekClient()
    if (deepseek) {
      await deepseek.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages: probe,
        max_tokens: 1
      })
      status.deepseek = { available: true, provider: 'deepseek', model: DEEPSEEK_MODEL }
    } else {
      status.deepseek = { available: false, provider: 'deepseek', error: 'key_missing' }
    }
  } catch (err) {
    status.deepseek = {
      available: false,
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      error: isRateLimit(err) ? 'rate_limit' : err?.message
    }
  }

  try {
    const genai = getGeminiClient()
    if (genai) {
      const model = genai.getGenerativeModel({ model: GEMINI_MODEL })
      await model.generateContent('ok')
      status.gemini = { available: true, provider: 'gemini', model: GEMINI_MODEL }
    } else {
      status.gemini = { available: false, provider: 'gemini', error: 'key_missing' }
    }
  } catch (err) {
    status.gemini = {
      available: false,
      provider: 'gemini',
      model: GEMINI_MODEL,
      error: err?.status === 429 ? 'rate_limit' : err?.message
    }
  }

  const recommended = status.claude?.available ? 'claude'
                    : status.groq?.available ? 'groq'
                    : status.deepseek?.available ? 'deepseek'
                    : status.gemini?.available ? 'gemini'
                    : null

  return { ...status, recommended }
}

/**
 * Executa uma chamada de chat com fallback automático entre provedores
 * 
 * Tenta executar a requisição com os provedores de IA na seguinte ordem:
 * 1. Provedor preferido (se especificado)
 * 2. Claude (padrão)
 * 3. Groq
 * 4. DeepSeek
 * 5. Gemini (último recurso)
 * 
 * Em caso de rate limit ou erro, passa automaticamente para o próximo provedor.
 * 
 * @async
 * @param {ChatMessage[]} messages - Array de mensagens no formato OpenAI
 * @param {ChatCompletionOptions} [options={}] - Opções da requisição
 * @returns {Promise<string>} Conteúdo de texto da resposta
 * 
 * @example
 * const messages = [
 *   { role: 'system', content: 'Você é um assistente LGPD.' },
 *   { role: 'user', content: 'O que é dados pessoais?' }
 * ];
 * 
 * const response = await chatCompletion(messages, {
 *   preferredProvider: 'claude',
 *   temperature: 0.7,
 *   jsonMode: false
 * });
 * console.log(response);
 * 
 * @example
 * // Modo JSON para análise estruturada
 * const jsonResponse = await chatCompletion(
 *   [{ role: 'user', content: 'Liste 3 requisitos LGPD em JSON' }],
 *   { jsonMode: true, temperature: 0.2 }
 * );
 * const data = JSON.parse(jsonResponse);
 * 
 * @throws {Error} Lançado quando nenhum provedor consegue responder
 */
export async function chatCompletion(messages, { preferredProvider = null, temperature = 0.2, jsonMode = false } = {}) {
  const getProviderOrder = (preferred) => {
    if (preferred === 'claude') return ['claude', 'groq', 'deepseek', 'gemini']
    if (preferred === 'groq') return ['groq', 'claude', 'deepseek', 'gemini']
    if (preferred === 'deepseek') return ['deepseek', 'claude', 'groq', 'gemini']
    if (preferred === 'gemini') return ['gemini', 'claude', 'deepseek', 'groq']
    return ['claude', 'groq', 'deepseek', 'gemini']
  }

  const order = getProviderOrder(preferredProvider)
  const errors = {}

  for (const provider of order) {
    try {
      if (provider === 'claude') {
        try {
          const result = await claudeCompletion(messages, {
            temperature,
            jsonMode,
          })
          console.log(`✓ Chat com Claude bem-sucedido`)
          return result
        } catch (err) {
          if (err?.status === 429 || String(err?.message ?? '').includes('rate limit')) {
            errors.claude = 'rate_limit'
          } else {
            errors.claude = err?.message
          }
          continue
        }

      } else if (provider === 'groq') {
        const groq = getGroqClient()
        if (!groq) {
          errors.groq = 'key_missing'
          continue
        }

        const params = {
          model: GROQ_MODEL,
          messages,
          temperature,
        }
        if (jsonMode) params.response_format = { type: 'json_object' }

        const completion = await groq.chat.completions.create(params)
        console.log(`✓ Chat com Groq (${GROQ_MODEL}) bem-sucedido`)
        return completion.choices[0].message.content ?? ''

      } else if (provider === 'deepseek') {
        const deepseek = getDeepSeekClient()
        if (!deepseek) {
          errors.deepseek = 'key_missing'
          continue
        }

        const params = {
          model: DEEPSEEK_MODEL,
          messages,
          temperature,
        }
        if (jsonMode) params.response_format = { type: 'json_object' }

        const completion = await deepseek.chat.completions.create(params)
        console.log(`✓ Chat com DeepSeek (${DEEPSEEK_MODEL}) bem-sucedido`)
        return completion.choices[0].message.content ?? ''

      } else if (provider === 'gemini') {
        const genai = getGeminiClient()
        if (!genai) {
          errors.gemini = 'key_missing'
          continue
        }

        const model = genai.getGenerativeModel({ model: GEMINI_MODEL })
        const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
        const userMsgs = messages.filter(m => m.role !== 'system')

        const history = userMsgs.slice(0, -1).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))

        const lastMsg = userMsgs.at(-1)?.content ?? ''
        const fullPrompt = systemMsg ? `${systemMsg}\n\n${lastMsg}` : lastMsg
        const chat = model.startChat({ history })

        for (let tentativa = 1; tentativa <= 3; tentativa++) {
          try {
            const result = await chat.sendMessage(fullPrompt)
            console.log(`✓ Chat com Gemini (${GEMINI_MODEL}) bem-sucedido`)
            return result.response.text()
          } catch (err) {
            if (err?.status === 429 && tentativa < 3) {
              const segundos = 30
              console.warn(`⚠️  Gemini rate limit. Aguardando ${segundos}s (tentativa ${tentativa}/3)...`)
              await new Promise(r => setTimeout(r, segundos * 1000))
            } else {
              throw err
            }
          }
        }
      }

    } catch (err) {
      if (isRateLimit(err)) {
        console.warn(`⚠️  ${provider} rate limit — tentando próximo...`)
        errors[provider] = 'rate_limit'
      } else {
        console.warn(`⚠️  ${provider} erro: ${err.message} — tentando próximo...`)
        errors[provider] = err.message
      }
      continue
    }
  }

  throw new Error(`Nenhuma IA disponível. Erros: ${JSON.stringify(errors)}`)
}

/**
 * Executa chat completion através de fila de requisições
 * 
 * Usa a fila de IA (AIQueue) para respeitar rate limits de forma inteligente.
 * Requisições com prioridade mais alta são processadas primeiro.
 * 
 * @async
 * @param {ChatMessage[]} messages - Array de mensagens no formato OpenAI
 * @param {QueuedChatCompletionOptions} [options={}] - Opções da requisição
 * @returns {Promise<string>} Conteúdo de texto da resposta
 * 
 * @example
 * // Requisição com alta prioridade
 * const urgentResponse = await queuedChatCompletion(
 *   [{ role: 'user', content: 'Análise urgente LGPD' }],
 *   { priority: 'high', timeout: 60000 }
 * );
 * 
 * @example
 * // Batch de requisições normais
 * const responses = await Promise.all([
 *   queuedChatCompletion(messages1, { priority: 'normal' }),
 *   queuedChatCompletion(messages2, { priority: 'normal' }),
 *   queuedChatCompletion(messages3, { priority: 'low' })
 * ]);
 * 
 * @throws {Error} Timeout ou falha em todos os provedores
 */
export async function queuedChatCompletion(messages, opts = {}) {
  const { priority = 'normal', timeout = 30000, ...chatOpts } = opts
  const queue = getQueue()

  return new Promise((resolve, reject) => {
    queue.add({
      priority,
      timeout,
      fn: async () => {
        return chatCompletion(messages, chatOpts)
      },
    }).then(resolve).catch(reject)
  })
}

/**
 * Configura a fila de IA para um provedor específico
 * 
 * Define delays apropriados baseado nos rate limits do provedor.
 * Deve ser chamado uma vez na inicialização do servidor.
 * 
 * @param {('groq'|'claude'|'deepseek'|'gemini')} [provider='claude'] - Provedor principal
 * 
 * @example
 * // Configurar para usar Groq como primário
 * configureAIQueue('groq');
 * 
 * @example
 * // Configurar no startup da aplicação
 * import { configureAIQueue } from './ai-client.mjs';
 * 
 * const aiStatus = await checkAIStatus();
 * configureAIQueue(aiStatus.recommended);
 */
export function configureAIQueue(provider = 'claude') {
  const queue = getQueue()
  queue.configureForProvider(provider)
}

/**
 * Obtém status atual da fila de IA
 * 
 * Retorna informações sobre requisições aguardando, ativas, completadas e falhadas.
 * Útil para monitoramento e debug.
 * 
 * @returns {AIQueueStatus} Status atual da fila
 * 
 * @example
 * const status = getAIQueueStatus();
 * console.log(`Fila: ${status.queued} aguardando, ${status.active} ativa`);
 * console.log(`Completadas: ${status.completed}, Falhadas: ${status.failed}`);
 * 
 * @example
 * // Monitoramento periódico
 * setInterval(() => {
 *   const queueStatus = getAIQueueStatus();
 *   if (queueStatus.queued > 10) {
 *     console.warn('Fila de IA sobrecarregada');
 *   }
 * }, 5000);
 */
export function getAIQueueStatus() {
  const queue = getQueue()
  return queue.getStatus()
}
