/**
 * ai-client.mjs
 *
 * Cliente de IA com fallback automático: Groq → DeepSeek → Gemini
 * Suporta seleção de modelo preferencial com fallback automático
 * Todos os módulos do servidor devem usar este cliente em vez de
 * instanciar clientes diretamente.
 *
 * Integrado com AIQueue para respeitar rate limits de cada provedor
 */

import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { OpenAI } from 'openai'
import AIQueue, { getQueue } from './ai-queue.mjs'
import { claudeCompletion, testClaudeAvailability } from './claude-client.mjs'

const GROQ_MODEL     = 'llama-3.3-70b-versatile'
const GEMINI_MODEL   = 'gemini-2.0-flash'
const DEEPSEEK_MODEL = 'deepseek-chat'

function isRateLimit(err) {
  return err?.status === 429 ||
    String(err?.message ?? '').toLowerCase().includes('rate limit') ||
    String(err?.message ?? '').toLowerCase().includes('tokens per day')
}

function getGroqClient() {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  return new Groq({ apiKey: key })
}

function getDeepSeekClient() {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) return null
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com',
  })
}

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  return new GoogleGenerativeAI(key)
}

/**
 * Chama Groq com o array de messages no formato OpenAI.
 * Em caso de rate limit, chama Gemini automaticamente.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} opts
 * @param {number}  opts.temperature
 * @param {boolean} opts.jsonMode  - pede response_format json_object no Groq
 * @returns {Promise<string>}      - texto da resposta
 */
/**
 * Testa disponibilidade de todos os provedores de IA
 * Retorna status de cada um: { claude, groq, deepseek, gemini, recommended }
 */
export async function checkAIStatus() {
  const probe = [{ role: 'user', content: 'ok' }]
  const status = {}

  // Testa CLAUDE (primeiro, pois é preferencial)
  try {
    const claudeStatus = await testClaudeAvailability()
    if (claudeStatus.available) {
      status.claude = { available: true, provider: 'claude', model: 'claude-haiku-4-5-20251001' }
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

  // Testa GROQ
  const groq = getGroqClient()
  if (groq) {
    try {
      await groq.chat.completions.create({ model: GROQ_MODEL, messages: probe, max_tokens: 1 })
      status.groq = { available: true, provider: 'groq', model: GROQ_MODEL }
    } catch (err) {
      status.groq = {
        available: false,
        provider: 'groq',
        model: GROQ_MODEL,
        error: isRateLimit(err) ? 'rate_limit' : err?.message
      }
    }
  } else {
    status.groq = { available: false, provider: 'groq', error: 'key_missing' }
  }

  // Testa DeepSeek
  const deepseek = getDeepSeekClient()
  if (deepseek) {
    try {
      await deepseek.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages: probe,
        max_tokens: 1
      })
      status.deepseek = { available: true, provider: 'deepseek', model: DEEPSEEK_MODEL }
    } catch (err) {
      status.deepseek = {
        available: false,
        provider: 'deepseek',
        model: DEEPSEEK_MODEL,
        error: isRateLimit(err) ? 'rate_limit' : err?.message
      }
    }
  } else {
    status.deepseek = { available: false, provider: 'deepseek', error: 'key_missing' }
  }

  // Testa Gemini
  const genai = getGeminiClient()
  if (genai) {
    try {
      const model = genai.getGenerativeModel({ model: GEMINI_MODEL })
      await model.generateContent('ok')
      status.gemini = { available: true, provider: 'gemini', model: GEMINI_MODEL }
    } catch (err) {
      status.gemini = {
        available: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: err?.status === 429 ? 'rate_limit' : err?.message
      }
    }
  } else {
    status.gemini = { available: false, provider: 'gemini', error: 'key_missing' }
  }

  // Recomenda Claude se disponível, senão Groq, DeepSeek, Gemini
  const recommended = status.claude?.available ? 'claude'
                    : status.groq?.available ? 'groq'
                    : status.deepseek?.available ? 'deepseek'
                    : status.gemini?.available ? 'gemini'
                    : null

  return { ...status, recommended }
}

/**
 * Executa uma chamada de chat com fallback automático
 * @param {Array} messages - Array de mensagens OpenAI format
 * @param {object} opts - Opções
 * @param {string} opts.preferredProvider - 'claude', 'groq', 'deepseek', ou 'gemini' (default: auto)
 * @param {number} opts.temperature - 0-1
 * @param {boolean} opts.jsonMode - Se ativa modo JSON
 * @returns {Promise<string>} - Resposta de texto
 */
export async function chatCompletion(messages, { preferredProvider = null, temperature = 0.2, jsonMode = false } = {}) {
  // Define ordem de fallback baseada na preferência
  const getProviderOrder = (preferred) => {
    if (preferred === 'claude') return ['claude', 'groq', 'deepseek', 'gemini']
    if (preferred === 'groq') return ['groq', 'claude', 'deepseek', 'gemini']
    if (preferred === 'deepseek') return ['deepseek', 'claude', 'groq', 'gemini']
    if (preferred === 'gemini') return ['gemini', 'claude', 'deepseek', 'groq']
    // Default: Claude se disponível, senão Groq
    return ['claude', 'groq', 'deepseek', 'gemini']
  }

  const order = getProviderOrder(preferredProvider)
  const errors = {}

  // Tenta cada provedor em ordem
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

        // Converte do formato OpenAI para Gemini
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

  // Nenhum provedor funcionou
  throw new Error(`Nenhuma IA disponível. Erros: ${JSON.stringify(errors)}`)
}

/**
 * Executa chat completion com fila de requisições
 * Respeita rate limits espaçando requisições
 *
 * @param {Array} messages - Array de mensagens OpenAI format
 * @param {object} opts - Opções
 * @param {string} opts.preferredProvider - Provedor preferencial
 * @param {number} opts.temperature - 0-1
 * @param {boolean} opts.jsonMode - Modo JSON
 * @param {string} opts.priority - 'high', 'normal', 'low'
 * @param {number} opts.timeout - Timeout em ms
 * @returns {Promise<string>} - Resposta de texto
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
 * Configura a fila de IA baseado no provedor preferencial
 * Define o delay apropriado para respeitar rate limits
 *
 * @param {string} provider - 'groq', 'deepseek', 'claude', ou 'gemini'
 */
export function configureAIQueue(provider = 'groq') {
  const queue = getQueue()
  queue.configureForProvider(provider)
}

/**
 * Retorna status atual da fila de IA
 */
export function getAIQueueStatus() {
  const queue = getQueue()
  return queue.getStatus()
}
