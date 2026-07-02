/**
 * gerar_com_claude.mjs
 *
 * Gera logs das personas usando Claude API (Haiku 4.5)
 * Rápido e barato!
 *
 * Uso:
 *   node scripts/gerar_com_claude.mjs              # todas as personas
 *   node scripts/gerar_com_claude.mjs P01 P03 P42  # personas específicas
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import yaml from 'js-yaml'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

dotenv.config({ path: join(ROOT, '.env') })

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

// ─── Helpers ──────────────────────────────────────────────────────────────

function findPersonaFile(personaId) {
  const dir = join(ROOT, 'personas')
  const files = readdirSync(dir)
  const match = files.find(f => f.startsWith(personaId + '_') && f.endsWith('.md'))
  if (!match) throw new Error(`Persona não encontrada: ${personaId}`)
  return join(dir, match)
}

function findOracleFile(personaId) {
  const dir = join(ROOT, 'oraculos')
  const files = readdirSync(dir)
  const match = files.find(f => f.startsWith(personaId + '_') && f.endsWith('.yml'))
  if (!match) throw new Error(`Oráculo não encontrado: ${personaId}`)
  return join(dir, match)
}

function loadOracle(personaId) {
  const path = findOracleFile(personaId)
  return yaml.load(readFileSync(path, 'utf8'))
}

function getAllPersonaIds() {
  const dir = join(ROOT, 'personas')
  return readdirSync(dir)
    .filter(f => f.match(/^(P|A)\d{2}_.*\.md$/))
    .map(f => f.match(/^([PA]\d{2})/)[1])
    .sort()
}

function buildPersonaSystemPrompt(personaMd) {
  return `Você é um participante de uma pesquisa sobre conformidade com a LGPD.
Assuma completamente a persona descrita abaixo.
Responda TODAS as perguntas exclusivamente a partir da perspectiva, rotina e conhecimento desta persona.
Não quebre o personagem em nenhum momento.

━━━ PERSONA ━━━
${personaMd}`
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function simulatePersona(personaId) {
  console.log(`\n📋 Simulando persona: ${personaId}...`)

  try {
    const personaMdPath = findPersonaFile(personaId)
    const personaMd = readFileSync(personaMdPath, 'utf8')
    const oracle = loadOracle(personaId)

    const systemPrompt = buildPersonaSystemPrompt(personaMd)

    // Simular uma resposta simples
    const testQuestion = `Qual é o seu nível de risco esperado em relação à conformidade LGPD? Responda brevemente.`

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: testQuestion
        }
      ]
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''

    // Gerar log
    const hoje = new Date().toISOString().split('T')[0]
    const pastaLog = join(ROOT, 'logs', hoje)

    if (!existsSync(pastaLog)) {
      mkdirSync(pastaLog, { recursive: true })
    }

    const logData = {
      persona_id: personaId,
      timestamp: new Date().toISOString(),
      oracle: oracle,
      answer: answer,
      model: CLAUDE_MODEL,
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
      cost_usd: (response.usage.input_tokens * 0.001 + response.usage.output_tokens * 0.005) / 1000
    }

    const logPath = join(pastaLog, `${personaId}_sessao_01.json`)
    writeFileSync(logPath, JSON.stringify(logData, null, 2))

    console.log(`✅ ${personaId}: ${response.usage.input_tokens + response.usage.output_tokens} tokens | $${logData.cost_usd.toFixed(4)}`)

    return logData
  } catch (err) {
    console.error(`❌ ${personaId}: ${err.message}`)
    return null
  }
}

async function main() {
  console.log('🚀 Iniciando geração de logs com Claude API (Haiku 4.5)...\n')

  let personasToRun = process.argv.slice(2).filter(arg => !arg.startsWith('-'))

  if (personasToRun.length === 0) {
    personasToRun = getAllPersonaIds()
  }

  console.log(`📊 Rodando ${personasToRun.length} personas...`)

  let totalCost = 0
  let successCount = 0

  for (const personaId of personasToRun) {
    const result = await simulatePersona(personaId)
    if (result) {
      totalCost += result.cost_usd
      successCount++
    }
    await sleep(500) // Delay entre chamadas
  }

  console.log(`\n✨ Concluído!`)
  console.log(`✅ ${successCount}/${personasToRun.length} personas simuladas`)
  console.log(`💰 Custo total: $${totalCost.toFixed(4)} (R$ ${(totalCost * 5).toFixed(2)})`)
}

main().catch(console.error)
