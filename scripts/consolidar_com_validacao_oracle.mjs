

/**
 * Script de consolidação: Valida resultados de personas contra oráculos
 * 
 * Detecta riscos errados, scores fora do esperado, fragilidades não detectadas.
 * Compara nível de risco (crítico, alto, moderado, baixo) e score.
 * 
 * Uso: node scripts/consolidar_com_validacao_oracle.mjs [YYYY-MM-DD]
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/**
 * Encontra arquivo oráculo de uma persona.
 */
function findOracleFile(personaId) {
  const dir = join(ROOT, 'oraculos')
  const files = readdirSync(dir)
  const match = files.find(f => f.startsWith(personaId + '_') && f.endsWith('.yml'))
  if (!match) return null
  return join(dir, match)
}

/**
 * Carrega oráculo YAML de uma persona.
 */
function loadOracle(personaId) {
  const path = findOracleFile(personaId)
  if (!path) return null
  try {
    return yaml.load(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(` Erro loading oracle ${personaId}:`, err.message)
    return null
  }
}

/**
 * Infere nível de risco do relatório por keywords.
 */
function getRiskLevel(report) {
  if (!report) return 'desconhecido'

  const text = report.toLowerCase()

  if (
    text.includes('crítico') ||
    text.includes('risco crítico') ||
    text.includes('não conforme') ||
    text.includes('grave') ||
    text.includes('urgente')
  ) {
    return 'crítico'
  }

  if (
    text.includes('alto') ||
    text.includes('risco alto') ||
    text.includes('parcialmente') ||
    text.includes('inadequado')
  ) {
    return 'alto'
  }

  if (
    text.includes('moderado') ||
    text.includes('risco moderado') ||
    text.includes('atenção')
  ) {
    return 'moderado'
  }

  if (
    text.includes('baixo') ||
    text.includes('risco baixo') ||
    text.includes('conforme') ||
    text.includes('adequado')
  ) {
    return 'baixo'
  }

  return 'desconhecido'
}

/**
 * Compara nível de risco esperado vs obtido.
 * Retorna: 'match', 'false_negative', 'false_positive'
 */
function compareRiskLevels(expected, actual) {
  const levels = { crítico: 3, alto: 2, moderado: 1, baixo: 0, desconhecido: -1 }

  const exp = levels[expected?.toLowerCase()] ?? -1
  const act = levels[actual?.toLowerCase()] ?? -1

  if (exp === act) return 'match'
  if (act > exp) return 'false_negative'
  return 'false_positive'
}

/**
 * Extrai score do relatório ou infere do nível de risco.
 */
function getScore(report) {
  if (!report) return null

  const scoreMatch = report.match(/score[:\s]+(\d+)/i)
  if (scoreMatch) return parseInt(scoreMatch[1])

  const risk = getRiskLevel(report)
  const scores = {
    crítico: 0,
    alto: 25,
    moderado: 50,
    baixo: 75,
  }

  return scores[risk] ?? 50
}

/**
 * Executa consolidação e validação.
 */
async function main() {
  const dateArg = process.argv[2]
  const logsDir = dateArg
    ? join(ROOT, 'logs', dateArg)
    : join(ROOT, 'logs', new Date().toISOString().split('T')[0])

  console.log(`\n CONSOLIDAÇÃO COM VALIDAÇÃO ORACLE`)
  console.log(`══════════════════════════════════════════════════════════════════════`)
  console.log(`Data: ${logsDir}`)
  console.log(`══════════════════════════════════════════════════════════════════════\n`)

  let personaFiles = []
  try {
    personaFiles = readdirSync(logsDir).filter(f => f.endsWith('_sessao_01.json'))
  } catch (err) {
    console.error(` Diretório não encontrado: ${logsDir}`)
    process.exit(1)
  }

  if (personaFiles.length === 0) {
    console.error(` Nenhum log encontrado em ${logsDir}`)
    process.exit(1)
  }

  console.log(` Encontrados ${personaFiles.length} logs\n`)

  const results = {
    total: 0,
    válidos: 0,
    inválidos: 0,
    advertências: 0,
    personas: [],
  }

  const adversarios = new Set(['A01', 'A02', 'A03', 'A04', 'A05'])
  const categoryStats = {
    adversarial: { total: 0, válidos: 0, inválidos: 0 },
    operational: { total: 0, válidos: 0, inválidos: 0 },
  }

  personaFiles.sort().forEach(file => {
    const personaId = file.split('_')[0]
    const category = adversarios.has(personaId) ? 'adversarial' : 'operational'

    const logPath = join(logsDir, file)
    const logContent = readFileSync(logPath, 'utf8')
    const log = JSON.parse(logContent)

    const oracle = loadOracle(personaId)

    const report = log.relatorio_final?.report || ''
    const actualRisk = getRiskLevel(report)
    const actualScore = getScore(report)
    const expectedRisk = oracle?.nivel_risco_esperado || 'desconhecido'
    const expectedScore = oracle?.score_esperado ?? null

    const riskComparison = compareRiskLevels(expectedRisk, actualRisk)
    const isValid = riskComparison === 'match'

    results.total++
    categoryStats[category].total++

    if (isValid) {
      results.válidos++
      categoryStats[category].válidos++
    } else {
      results.inválidos++
      categoryStats[category].inválidos++
    }

    let warnings = []
    if (actualRisk === 'desconhecido') {
      warnings.push('Risco não detectado no relatório')
      results.advertências++
    }

    if (expectedScore !== null && Math.abs(actualScore - expectedScore) > 20) {
      warnings.push(`Score diferente (esperado: ${expectedScore}, obtido: ${actualScore})`)
    }

    results.personas.push({
      personaId,
      category,
      riskExpected: expectedRisk,
      riskActual: actualRisk,
      riskMatch: isValid ? '✅' : '❌',
      scoreExpected: expectedScore,
      scoreActual: actualScore,
      warnings,
    })

    const status = isValid ? '✅' : '❌'
    console.log(`${status} ${personaId.padEnd(4)} | Esperado: ${expectedRisk.padEnd(10)} | Obtido: ${actualRisk.padEnd(10)} | Score: ${actualScore}/${expectedScore}`)

    if (warnings.length > 0) {
      warnings.forEach(w => console.log(`   ⚠️  ${w}`))
    }
  })

  console.log(`\n══════════════════════════════════════════════════════════════════════`)
  console.log(`RESUMO GERAL\n`)
  console.log(`Total de personas: ${results.total}`)
  console.log(` Válidas (match oracle): ${results.válidos} (${((results.válidos / results.total) * 100).toFixed(1)}%)`)
  console.log(` Inválidas (mismatch): ${results.inválidos} (${((results.inválidos / results.total) * 100).toFixed(1)}%)`)
  console.log(`  Advertências: ${results.advertências}`)

  console.log(`\n POR CATEGORIA\n`)
  console.log(`Adversárias (A01-A05):`)
  console.log(`  Total: ${categoryStats.adversarial.total}`)
  console.log(`  Válidas: ${categoryStats.adversarial.válidos}`)
  console.log(`  Inválidas: ${categoryStats.adversarial.inválidos}`)

  console.log(`\nOperacionais (P01-P50):`)
  console.log(`  Total: ${categoryStats.operational.total}`)
  console.log(`   Válidas: ${categoryStats.operational.válidos}`)
  console.log(`   Inválidas: ${categoryStats.operational.inválidos}`)

  const falseNegatives = results.personas.filter(p => {
    const comparison = compareRiskLevels(p.riskExpected, p.riskActual)
    return comparison === 'false_negative'
  })

  const falsePositives = results.personas.filter(p => {
    const comparison = compareRiskLevels(p.riskExpected, p.riskActual)
    return comparison === 'false_positive'
  })

  if (falseNegatives.length > 0) {
    console.log(`\n  FALSOS NEGATIVOS (Sistema subestimou o risco):\n`)
    falseNegatives.forEach(p => {
      console.log(`  ${p.personaId}: ${p.riskExpected} → ${p.riskActual}`)
    })
  }

  if (falsePositives.length > 0) {
    console.log(`\n FALSOS POSITIVOS (Sistema superestimou o risco):\n`)
    falsePositives.forEach(p => {
      console.log(`  ${p.personaId}: ${p.riskExpected} → ${p.riskActual}`)
    })
  }

  console.log(`\n══════════════════════════════════════════════════════════════════════`)
  console.log(` Consolidação completa!\n`)

  process.exit(results.inválidos > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(' Fatal error:', err)
  process.exit(1)
})