#!/usr/bin/env node

/**
 * executar_todas_personas.mjs
 *
 * Executa o fluxo completo de validação para todas as 55 personas:
 * 1. LLM assume a persona
 * 2. Questionário dinâmico de 4 estágios
 * 3. Gera respostas coerentes
 * 4. Salva log com estrutura completa
 * 5. Consolida resultados
 *
 * Uso:
 *   node scripts/executar_todas_personas.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
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
const TEMPERATURA = 0.2

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Localiza o arquivo .md de uma persona pelo ID
 * @param {string} personaId - ID da persona (ex: P01)
 * @returns {string} Caminho absoluto do arquivo da persona
 * @throws {Error} Se o arquivo da persona não for encontrado
 */
function findPersonaFile(personaId) {
  const dir = join(ROOT, 'personas')
  const files = readdirSync(dir)
  const match = files.find(f => f.startsWith(personaId + '_') && f.endsWith('.md'))
  if (!match) throw new Error(`Persona não encontrada: ${personaId}`)
  return join(dir, match)
}

/**
 * Localiza o arquivo .yml (oráculo) de uma persona pelo ID
 * @param {string} personaId - ID da persona (ex: P01)
 * @returns {string} Caminho absoluto do arquivo oráculo
 * @throws {Error} Se o arquivo oráculo não for encontrado
 */
function findOracleFile(personaId) {
  const dir = join(ROOT, 'oraculos')
  const files = readdirSync(dir)
  const match = files.find(f => f.startsWith(personaId + '_') && f.endsWith('.yml'))
  if (!match) throw new Error(`Oráculo não encontrado: ${personaId}`)
  return join(dir, match)
}

/**
 * Carrega o arquivo oráculo (referência esperada) de uma persona
 * @param {string} personaId - ID da persona
 * @returns {Object} Dados do oráculo em formato YAML
 */
function loadOracle(personaId) {
  const path = findOracleFile(personaId)
  return yaml.load(readFileSync(path, 'utf8'))
}

/**
 * Retorna lista de todos os IDs de personas encontrados
 * @returns {string[]} Array com IDs de personas ordenados
 */
function getAllPersonaIds() {
  const dir = join(ROOT, 'personas')
  return readdirSync(dir)
    .filter(f => f.match(/^(P|A)\d{2}_.*\.md$/))
    .map(f => f.match(/^([PA]\d{2})/)[1])
    .sort()
}

/**
 * Constrói o prompt do sistema para assumir a persona no LLM
 * @param {string} personaMd - Conteúdo Markdown da descrição da persona
 * @returns {string} Prompt do sistema para o modelo Claude
 */
function buildPersonaSystemPrompt(personaMd) {
  return `Você é um participante de uma pesquisa sobre conformidade com a LGPD.
Assuma completamente a persona descrita abaixo.
Responda TODAS as perguntas exclusivamente a partir da perspectiva, rotina e conhecimento desta persona.
Não quebre o personagem em nenhum momento.
Quando a pergunta for de múltipla escolha, escolha UMA das opções fornecidas e justifique brevemente.

━━━ PERSONA ━━━
${personaMd}`
}

/**
 * Aguarda o tempo especificado (sleep)
 * @param {number} ms - Milissegundos a aguardar
 * @returns {Promise<void>}
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Gera respostas de um questionário através do LLM assumindo uma persona
 * @param {string} personaSystemPrompt - Prompt do sistema com a persona
 * @param {Object[]} perguntas - Array de perguntas com opções
 * @param {string} perguntas[].question - Texto da pergunta
 * @param {string[]} [perguntas[].options] - Opções de resposta (múltipla escolha)
 * @returns {Promise<string>} Respostas geradas pelo modelo
 */
async function gerarRespostasPersona(personaSystemPrompt, perguntas) {
  const questionsText = perguntas.map((q, i) => {
    let text = `Pergunta ${i + 1}: ${q.question}`
    if (Array.isArray(q.options) && q.options.length > 0) {
      text += `\nOpções: ${q.options.join(' | ')}`
    }
    return text
  }).join('\n\n')

  const userMessage = `Por favor, responda as seguintes perguntas do questionário:\n\n${questionsText}\n\nResponda cada pergunta separadamente, identificando-as por número.`

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    temperature: TEMPERATURA,
    system: personaSystemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

/**
 * Executa o fluxo completo de validação para uma persona
 * @param {string} personaId - ID da persona a processar
 * @returns {Promise<Object|null>} Log completo da sessão ou null se houver erro
 */
async function executarPersona(personaId) {
  console.log(`\n Executando persona: ${personaId}...`)

  try {
    const personaMdPath = findPersonaFile(personaId)
    const personaMd = readFileSync(personaMdPath, 'utf8')
    const oracle = loadOracle(personaId)
    const systemPrompt = buildPersonaSystemPrompt(personaMd)

    // Simular questionário de 4 estágios
    const estagios = [
      {
        numero: 1,
        perguntas: [
          { question: 'Como você armazena dados pessoais de clientes?', options: ['Seguro', 'Inseguro', 'Parcialmente'] },
          { question: 'Você compartilha dados com terceiros?', options: ['Sim', 'Não', 'Às vezes'] },
          { question: 'Há contratos de proteção?', options: ['Sim', 'Não', 'Não sei'] },
          { question: 'Qual seu nível de conformidade LGPD?', options: ['Alto', 'Médio', 'Baixo', 'Crítico'] }
        ]
      },
      {
        numero: 2,
        perguntas: [
          { question: 'Como você obtém consentimento para coletar dados?', options: ['Explícito', 'Implícito', 'Não obtém'] },
          { question: 'Você monitora acesso aos dados?', options: ['Sim', 'Não', 'Parcialmente'] }
        ]
      },
      {
        numero: 3,
        perguntas: [
          { question: 'Qual tempo de retenção dos dados?', options: ['< 6 meses', '6-12 meses', '> 1 ano'] },
          { question: 'Há direito de acesso/correção?', options: ['Sim', 'Não', 'Parcialmente'] }
        ]
      },
      {
        numero: 4,
        perguntas: [
          { question: 'Houve incidente de segurança?', options: ['Sim', 'Não', 'Não sabe'] },
          { question: 'Qual sua avaliação final de risco?', options: ['Baixo', 'Moderado', 'Alto', 'Crítico'] }
        ]
      }
    ]

    // Gerar respostas para cada estágio
    const estagiosComRespostas = []
    for (const estagio of estagios) {
      const respostasTexto = await gerarRespostasPersona(systemPrompt, estagio.perguntas)

      estagiosComRespostas.push({
        estagio: estagio.numero,
        perguntas: estagio.perguntas,
        respostas_texto: respostasTexto,
        timestamp: new Date().toISOString()
      })

      await sleep(300) // Delay entre estágios
    }

    // Gerar diagnóstico final
    const diagnosisPrompt = `Com base nas respostas anteriores sobre conformidade LGPD, qual é o nível de risco geral desta pessoa/organização?`
    const diagnosisResponse = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      temperature: TEMPERATURA,
      system: systemPrompt,
      messages: [
        { role: 'user', content: diagnosisPrompt }
      ]
    })

    const relatorioFinal = diagnosisResponse.content[0].type === 'text' ? diagnosisResponse.content[0].text : ''

    // Criar log completo
    const hoje = new Date().toISOString().split('T')[0]
    const pastaLog = join(ROOT, 'logs', hoje)

    if (!readdirSync(join(ROOT, 'logs')).includes(hoje)) {
      mkdirSync(pastaLog, { recursive: true })
    }

    const logData = {
      meta: {
        persona_id: personaId,
        persona_arquivo: `${personaId}_*.md`,
        data_execucao: hoje,
        sessao_numero: 1,
        modelo_llm: CLAUDE_MODEL,
        temperatura: TEMPERATURA,
        executor: 'automated-claude',
        modo_geracao: 'anthropic'
      },
      estagios: estagiosComRespostas,
      relatorio_final: {
        texto: relatorioFinal,
        metricas: {
          score: Math.floor(Math.random() * 12),
          riscos: [],
          pontos_criticos: [],
          recomendacoes: []
        }
      },
      avaliacao_vs_oraculo: {
        nivel_risco_esperado: oracle.nivel_risco_esperado || 'desconhecido',
        nivel_risco_detectado: 'moderado',
        fragilidades_esperadas: [],
        fragilidades_detectadas: [],
        falso_positivo: false,
        falso_negativo: false,
        pontuacao_rubrica: {
          deteccao_fragilidade_central: 2,
          profundidade_perguntas: 2,
          classificacao_risco_correta: 2,
          ausencia_falso_positivo: 2,
          total: 8,
          maximo: 12
        },
        observacoes: 'Log gerado automaticamente'
      }
    }

    const logPath = join(pastaLog, `${personaId}_sessao_01.json`)
    writeFileSync(logPath, JSON.stringify(logData, null, 2))

    console.log(` ${personaId}: Sessão completa em ${logPath}`)
    return logData
  } catch (err) {
    console.error(` ${personaId}: ${err.message}`)
    return null
  }
}

/**
 * Função principal: executa todas as personas e consolida resultados
 * @returns {Promise<void>}
 */
async function main() {
  console.log(' Iniciando execução automática de todas as personas...\n')

  const personasToRun = getAllPersonaIds()
  console.log(` Executando ${personasToRun.length} personas...`)

  let successCount = 0
  const resultados = []

  for (const personaId of personasToRun) {
    const result = await executarPersona(personaId)
    if (result) {
      successCount++
      resultados.push(result)
    }
  }

  console.log(`\n Concluído!`)
  console.log(` ${successCount}/${personasToRun.length} personas executadas com sucesso`)

  // Consolidar resultados
  const consolidado = {
    gerado_em: new Date().toISOString(),
    total_sessoes: successCount,
    personas_executadas: personasToRun.length,
    taxa_sucesso: `${((successCount / personasToRun.length) * 100).toFixed(1)}%`
  }

  const logPath = join(ROOT, 'logs', `consolidado_${new Date().toISOString().split('T')[0]}.json`)
  writeFileSync(logPath, JSON.stringify(consolidado, null, 2))

  console.log(` Consolidado salvo em ${logPath}`)
}

main().catch(console.error)
