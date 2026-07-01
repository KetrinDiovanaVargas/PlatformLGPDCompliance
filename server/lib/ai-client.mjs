/**
 * ai-client.mjs
 *
 * Cliente de IA com fallback automático: Groq → Gemini.
 * Todos os módulos do servidor devem usar este cliente em vez de
 * instanciar Groq diretamente.
 */

import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GROQ_MODEL   = 'llama-3.3-70b-versatile'
const GEMINI_MODEL = 'gemini-2.0-flash'

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
 * Testa se um provedor de IA está disponível e com tokens.
 * Retorna { available: bool, provider, model, error? }
 */
export async function checkAIStatus() {
  const probe = [{ role: 'user', content: 'ok' }]

  const groq = getGroqClient()
  if (groq) {
    try {
      await groq.chat.completions.create({ model: GROQ_MODEL, messages: probe, max_tokens: 1 })
      return { available: true, provider: 'groq', model: GROQ_MODEL }
    } catch (err) {
      const rateLimited = isRateLimit(err)
      const groqStatus = { available: false, provider: 'groq', model: GROQ_MODEL,
        error: rateLimited ? 'rate_limit' : err?.message }

      // Groq caiu — testa Gemini
      const genai = getGeminiClient()
      if (genai) {
        try {
          const model = genai.getGenerativeModel({ model: GEMINI_MODEL })
          await model.generateContent('ok')
          return { available: true, provider: 'gemini', model: GEMINI_MODEL, groq: groqStatus }
        } catch (geminiErr) {
          return {
            available: false,
            provider: null,
            error: 'both_unavailable',
            groq: groqStatus,
            gemini: { available: false, provider: 'gemini', model: GEMINI_MODEL,
              error: geminiErr?.status === 429 ? 'rate_limit' : geminiErr?.message },
          }
        }
      }

      return { available: false, provider: null, error: 'gemini_key_missing', groq: groqStatus }
    }
  }

  // Sem chave Groq — testa só Gemini
  const genai = getGeminiClient()
  if (!genai) {
    return { available: false, provider: null, error: 'no_keys_configured' }
  }
  try {
    const model = genai.getGenerativeModel({ model: GEMINI_MODEL })
    await model.generateContent('ok')
    return { available: true, provider: 'gemini', model: GEMINI_MODEL }
  } catch (err) {
    return { available: false, provider: null, error: err?.status === 429 ? 'rate_limit' : err?.message }
  }
}

export async function chatCompletion(messages, { temperature = 0.2, jsonMode = false } = {}) {
  const groq = getGroqClient()

  if (groq) {
    try {
      const params = {
        model: GROQ_MODEL,
        messages,
        temperature,
      }
      if (jsonMode) params.response_format = { type: 'json_object' }

      const completion = await groq.chat.completions.create(params)
      return completion.choices[0].message.content ?? ''

    } catch (err) {
      if (isRateLimit(err)) {
        console.warn('⚠️  Groq rate limit atingido — usando Gemini como fallback')
      } else {
        throw err
      }
    }
  } else {
    console.warn('⚠️  GROQ_API_KEY ausente — usando Gemini')
  }

  // ── Fallback: Gemini ──────────────────────────────────────────────────────
  const genai = getGeminiClient()
  if (!genai) {
    throw new Error('Nenhuma IA disponível: GROQ_API_KEY e GEMINI_API_KEY ausentes')
  }

  const model = genai.getGenerativeModel({ model: GEMINI_MODEL })

  // Converte o formato OpenAI para o formato Gemini
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const userMsgs  = messages.filter(m => m.role !== 'system')

  const history = userMsgs.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const lastMsg = userMsgs.at(-1)?.content ?? ''
  const fullPrompt = systemMsg ? `${systemMsg}\n\n${lastMsg}` : lastMsg

  const chat = model.startChat({ history })

  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      const result = await chat.sendMessage(fullPrompt)
      return result.response.text()
    } catch (err) {
      if (err?.status === 429 && tentativa < 5) {
        const retryDelay = err?.errorDetails?.find(d => d['@type']?.includes('RetryInfo'))?.retryDelay
        const segundos = (parseInt(retryDelay ?? '60') + 5)
        console.warn(`⚠️  Gemini rate limit. Aguardando ${Math.ceil(segundos / 60)} min (tentativa ${tentativa}/5)...`)
        await new Promise(r => setTimeout(r, segundos * 1000))
      } else {
        throw err
      }
    }
  }
}
