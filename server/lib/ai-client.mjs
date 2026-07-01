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
  const result = await chat.sendMessage(fullPrompt)
  return result.response.text()
}
