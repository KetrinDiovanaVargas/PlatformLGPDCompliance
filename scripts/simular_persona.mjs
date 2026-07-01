/**
 * simular_persona.mjs
 *
 * Executa uma sessão de validação completa para uma persona sintética.
 * A LLM assume a persona (.md) e responde o questionário de 4 estágios.
 * O resultado é comparado com o oráculo (.yml) e salvo como log JSON.
 *
 * Uso:
 *   node scripts/simular_persona.mjs <PERSONA_ID> [sessao]
 *
 * Exemplos:
 *   node scripts/simular_persona.mjs P03
 *   node scripts/simular_persona.mjs P03 2
 *
 * Pré-requisitos:
 *   - Backend rodando em http://localhost:3000  (npm run dev:back)
 *   - GROQ_API_KEY no .env
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import yaml from 'js-yaml'
import dotenv from 'dotenv'

const __dirnameEarly = dirname(fileURLToPath(import.meta.url))
const ROOT_EARLY = join(__dirnameEarly, '..')
dotenv.config({ path: join(ROOT_EARLY, 'server', '.env') })
dotenv.config({ path: join(ROOT_EARLY, '.env') })

const __dirname = __dirnameEarly
const ROOT = ROOT_EARLY

// ─── Config ──────────────────────────────────────────────────────────────────

const BACKEND_URL  = process.env.BACKEND_URL || 'http://localhost:8787'
const GROQ_MODEL   = 'llama-3.3-70b-versatile'
const GEMINI_MODEL = 'gemini-2.0-flash'
const TEMPERATURE = 0.2

const ASSESSMENT_META = {
  assessmentTitle:     'Diagnóstico de Conformidade LGPD',
  assessmentFormType:  'Identificação de riscos',
  assessmentObjective: 'Identificação de riscos',
  assessmentContext:   'Tratamento de dados pessoais no ambiente organizacional',
  audience:            'Colaborador da organização',
  introText:           'Responda com base na sua rotina de trabalho real.',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function buildPersonaSystemPrompt(personaMd) {
  return `Você é um participante de uma pesquisa sobre conformidade com a LGPD.
Assuma completamente a persona descrita abaixo.
Responda TODAS as perguntas exclusivamente a partir da perspectiva, rotina e conhecimento desta persona.
Não quebre o personagem em nenhum momento.
Quando a pergunta for de múltipla escolha, escolha UMA das opções fornecidas e justifique brevemente.
Quando for dissertativa, responda como a persona responderia naturalmente — incluindo eventuais omissões ou naturalizações de práticas problemáticas que a persona não reconhece como erro.

━━━ PERSONA ━━━
${personaMd}`
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRateLimit(err) {
  return err?.status === 429 ||
    String(err?.message ?? '').toLowerCase().includes('rate limit') ||
    String(err?.message ?? '').toLowerCase().includes('tokens per day')
}

async function askPersonaGroq(groq, personaSystemPrompt, conversationHistory, userMessage) {
  const messages = [
    { role: 'system', content: personaSystemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]
  const completion = await groq.chat.completions.create({ model: GROQ_MODEL, messages, temperature: TEMPERATURE })
  return completion.choices[0].message.content
}

async function askPersonaGemini(personaSystemPrompt, conversationHistory, userMessage, tentativa = 1) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY ausente')
  const genai = new GoogleGenerativeAI(key)
  const model = genai.getGenerativeModel({ model: GEMINI_MODEL })

  const history = conversationHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const chat = model.startChat({ history })
  const fullPrompt = `${personaSystemPrompt}\n\n${userMessage}`

  try {
    const result = await chat.sendMessage(fullPrompt)
    return result.response.text()
  } catch (err) {
    if (err?.status === 429 && tentativa <= 5) {
      const retryDelay = err?.errorDetails?.find(d => d['@type']?.includes('RetryInfo'))?.retryDelay
      const segundos = parseInt(retryDelay ?? '60') + 5
      const minutos = Math.ceil(segundos / 60)
      console.log(`  ⏳ Gemini rate limit. Aguardando ${minutos} min (tentativa ${tentativa}/5)...`)
      await sleep(segundos * 1000)
      return askPersonaGemini(personaSystemPrompt, conversationHistory, userMessage, tentativa + 1)
    }
    throw err
  }
}

async function askPersona(groq, personaSystemPrompt, conversationHistory, questions) {
  const questionsText = questions.map((q, i) => {
    let text = `Pergunta ${i + 1}: ${q.question}`
    if (Array.isArray(q.options) && q.options.length > 0) {
      text += `\nOpções: ${q.options.join(' | ')}`
    }
    return text
  }).join('\n\n')

  const userMessage = `Por favor, responda as seguintes perguntas do questionário:\n\n${questionsText}\n\nResponda cada pergunta separadamente, identificando-as por número.`

  let responseText
  try {
    responseText = await askPersonaGroq(groq, personaSystemPrompt, conversationHistory, userMessage)
  } catch (err) {
    if (isRateLimit(err)) {
      console.warn('  ⚠️  Groq rate limit — usando Gemini para esta persona')
      responseText = await askPersonaGemini(personaSystemPrompt, conversationHistory, userMessage)
    } else {
      throw err
    }
  }

  conversationHistory.push({ role: 'user', content: userMessage })
  conversationHistory.push({ role: 'assistant', content: responseText })

  return { responseText, conversationHistory }
}

async function generateStage(stage, context) {
  const body = {
    stage,
    context,
    ...ASSESSMENT_META,
  }

  const res = await fetch(`${BACKEND_URL}/api/generate-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`generate-stage falhou: ${res.status}`)
  return res.json()
}

async function generateFinalReport(allResponses, personaId, sessaoNum) {
  const res = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: `simulacao-automatizada`,
      sessionId: `${personaId}-sessao-${sessaoNum}-${Date.now()}`,
      responses: allResponses,
      ...ASSESSMENT_META,
    }),
  })

  if (!res.ok) throw new Error(`generate-final-report falhou: ${res.status}`)
  return res.json()
}

function parseAnswersFromText(responseText, questions) {
  return questions.map((q, i) => {
    const patterns = [
      new RegExp(`Pergunta\\s+${i + 1}[:.\\s]+([\\s\\S]*?)(?=Pergunta\\s+${i + 2}[:.\\s]|$)`, 'i'),
      new RegExp(`${i + 1}[.)\\s]+([\\s\\S]*?)(?=${i + 2}[.)\\s]|$)`, 'i'),
    ]

    let answer = ''
    for (const pattern of patterns) {
      const match = responseText.match(pattern)
      if (match && match[1]) {
        answer = match[1].trim()
        break
      }
    }

    if (!answer) answer = responseText

    return {
      questionId: q.id,
      question: q.question,
      answer: answer.slice(0, 800),
    }
  })
}

function compareWithOracle(relatorio, oracle) {
  const riscoDetectado = (() => {
    const score = relatorio?.metrics?.score ?? 0
    if (score >= 75) return 'baixo'
    if (score >= 50) return 'moderado'
    if (score >= 25) return 'alto'
    return 'critico'
  })()

  const riscoEsperado = oracle.nivel_risco_esperado ?? 'desconhecido'
  const acertouRisco  = riscoDetectado === riscoEsperado

  const fragilidadesEsperadas = (oracle.categorias_lgpd_esperadas ?? []).map(c => c.codigo)
  const criticalIssues        = relatorio?.metrics?.criticalIssues ?? []
  const attentionPoints       = relatorio?.metrics?.attentionPoints ?? []
  const todasSaidas           = [...criticalIssues, ...attentionPoints, relatorio?.report ?? ''].join(' ').toLowerCase()

  const mapeamentoFragilidades = {
    F1: ['compartilhamento', 'whatsapp', 'informal', 'pessoal'],
    F2: ['armazenamento', 'pendrive', 'celular', 'pessoal', 'indevido'],
    F3: ['retenção', 'prazo', 'indefinido', 'descarte'],
    F4: ['coleta', 'excessiv', 'desnecessári', 'minimização'],
    F5: ['acesso', 'privilégio', 'admin', 'compartilhad'],
    F6: ['transparência', 'consentimento', 'aviso', 'política'],
    F7: ['uso secundário', 'finalidade', 'marketing', 'benchmark'],
    F8: ['terceiro', 'dpa', 'fornecedor', 'operador', 'contrato'],
    F9: ['sensív', 'saúde', 'médic', 'biométr', 'racial', 'sindical'],
    F10: ['incidente', 'vazamento', 'notificação', 'anpd'],
  }

  const fragilidadesDetectadas = fragilidadesEsperadas.filter(codigo => {
    const keywords = mapeamentoFragilidades[codigo] ?? []
    return keywords.some(kw => todasSaidas.includes(kw))
  })

  const falsoPositivo = oracle.nivel_risco_esperado === 'baixo' && riscoDetectado !== 'baixo'
  const falsoNegativo = fragilidadesEsperadas.length > 0 && fragilidadesDetectadas.length === 0

  // Rubrica 0–3 por critério
  const deteccaoFragilidadeCentral = (() => {
    if (fragilidadesEsperadas.length === 0) return 3
    const taxa = fragilidadesDetectadas.length / fragilidadesEsperadas.length
    if (taxa >= 1)   return 3
    if (taxa >= 0.5) return 2
    if (taxa > 0)    return 1
    return 0
  })()

  const profundidadePerguntas = acertouRisco ? 2 : 1

  const classificacaoRiscoCorreta = (() => {
    if (acertouRisco) return 3
    const niveis = ['baixo', 'moderado', 'alto', 'critico']
    const diff = Math.abs(niveis.indexOf(riscoDetectado) - niveis.indexOf(riscoEsperado))
    if (diff === 1) return 1
    return 0
  })()

  const ausenciaFalsoPositivo = falsoPositivo ? 0 : 3

  const total = deteccaoFragilidadeCentral + profundidadePerguntas + classificacaoRiscoCorreta + ausenciaFalsoPositivo

  return {
    nivel_risco_esperado:   riscoEsperado,
    nivel_risco_detectado:  riscoDetectado,
    score_plataforma:       relatorio?.metrics?.score ?? 0,
    fragilidades_esperadas: fragilidadesEsperadas,
    fragilidades_detectadas: fragilidadesDetectadas,
    falso_positivo:  falsoPositivo,
    falso_negativo:  falsoNegativo,
    pontuacao_rubrica: {
      deteccao_fragilidade_central: deteccaoFragilidadeCentral,
      profundidade_perguntas:       profundidadePerguntas,
      classificacao_risco_correta:  classificacaoRiscoCorreta,
      ausencia_falso_positivo:      ausenciaFalsoPositivo,
      total,
      maximo: 12,
    },
    observacoes: '',
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [, , personaId, sessaoArg] = process.argv

  if (!personaId || !personaId.match(/^P\d{2}$/i)) {
    console.error('Uso: node scripts/simular_persona.mjs <P01-P50> [numero_sessao]')
    process.exit(1)
  }

  const sessaoNum = parseInt(sessaoArg ?? '1')
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  console.log(`\n━━━ Iniciando simulação: ${personaId} | Sessão ${sessaoNum} ━━━\n`)

  // Carregar persona e oráculo
  const personaPath = findPersonaFile(personaId.toUpperCase())
  const personaMd   = readFileSync(personaPath, 'utf8')
  const oracle      = loadOracle(personaId.toUpperCase())

  const personaSystemPrompt = buildPersonaSystemPrompt(personaMd)
  const conversationHistory = []
  const allResponses        = []
  const estagiosLog         = []

  // Executar os 4 estágios
  for (let stage = 1; stage <= 4; stage++) {
    console.log(`  → Estágio ${stage}...`)

    // Montar contexto acumulado
    const context = {}
    for (const r of allResponses) {
      context[`Q${r.questionId}: ${r.question}`] = r.answer
    }

    // Gerar perguntas via backend
    const stageData = await generateStage(stage, context)
    const questions = stageData.questions ?? []

    console.log(`     ${questions.length} perguntas geradas (modo: ${stageData.generationMode})`)

    // LLM-persona responde
    const { responseText, conversationHistory: updatedHistory } = await askPersona(
      groq,
      personaSystemPrompt,
      conversationHistory,
      questions
    )
    conversationHistory.length = 0
    conversationHistory.push(...updatedHistory)

    // Parsear respostas
    const answers = parseAnswersFromText(responseText, questions)
    allResponses.push(...answers)

    estagiosLog.push({
      estagio:   stage,
      titulo:    stageData.title,
      modo:      stageData.generationMode,
      perguntas: questions.map(q => ({ id: q.id, texto: q.question, opcoes: q.options ?? [] })),
      respostas: answers.map(a => ({ pergunta_id: a.questionId, resposta: a.answer })),
    })
  }

  // Gerar relatório final
  console.log('\n  → Gerando relatório final...')
  let relatorio = null
  try {
    relatorio = await generateFinalReport(allResponses, personaId.toUpperCase(), sessaoNum)
  } catch (err) {
    console.warn('  ⚠ Relatório final falhou, usando fallback:', err.message)
    relatorio = { metrics: { score: 0 }, report: 'Falha na geração do relatório.' }
  }

  // Comparar com oráculo
  const avaliacao = compareWithOracle(relatorio, oracle)

  // Montar log
  const hoje = new Date().toISOString().split('T')[0]
  const nomeArquivo = `${personaId.toUpperCase()}_sessao_${String(sessaoNum).padStart(2, '0')}.json`
  const log = {
    meta: {
      persona_id:    personaId.toUpperCase(),
      persona_arquivo: personaPath.split(/[\\/]/).pop(),
      data_execucao: new Date().toISOString().split('T')[0],
      sessao_numero: sessaoNum,
      modelo_llm:    GROQ_MODEL,
      temperatura:   TEMPERATURE,
      executor:      'simular_persona.mjs (automatizado)',
    },
    estagios:       estagiosLog,
    relatorio_final: relatorio,
    avaliacao_vs_oraculo: avaliacao,
  }

  const pastaLog = join(ROOT, 'logs', hoje)
  mkdirSync(pastaLog, { recursive: true })
  const logPath = join(pastaLog, nomeArquivo)
  writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8')

  // Resultado no terminal
  const { pontuacao_rubrica: r } = avaliacao
  console.log('\n━━━ Resultado ━━━')
  console.log(`  Persona:          ${personaId.toUpperCase()}`)
  console.log(`  Risco esperado:   ${avaliacao.nivel_risco_esperado}`)
  console.log(`  Risco detectado:  ${avaliacao.nivel_risco_detectado}`)
  console.log(`  Score plataforma: ${avaliacao.score_plataforma}`)
  console.log(`  Fragilidades esperadas:  ${avaliacao.fragilidades_esperadas.join(', ') || '—'}`)
  console.log(`  Fragilidades detectadas: ${avaliacao.fragilidades_detectadas.join(', ') || '—'}`)
  console.log(`  Falso positivo: ${avaliacao.falso_positivo} | Falso negativo: ${avaliacao.falso_negativo}`)
  console.log(`  Rubrica: ${r.total}/${r.maximo}`)
  console.log(`  Log salvo em: logs/${nomeArquivo}\n`)
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
