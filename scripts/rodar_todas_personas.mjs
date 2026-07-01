/**
 * rodar_todas_personas.mjs
 *
 * Executa o teste automatizado para múltiplas personas em sequência.
 * Gera logs individuais e um consolidado ao final.
 *
 * Uso:
 *   node scripts/rodar_todas_personas.mjs              # todas as 50 personas
 *   node scripts/rodar_todas_personas.mjs P01 P03 P42  # personas específicas
 *   node scripts/rodar_todas_personas.mjs --criticas    # só nível crítico
 *   node scripts/rodar_todas_personas.mjs --controle    # só personas de controle
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')

const DELAY_ENTRE_PERSONAS_MS = 3000

function getAllPersonaIds() {
  return readdirSync(join(ROOT, 'personas'))
    .filter(f => f.match(/^P\d{2}_.*\.md$/))
    .map(f => f.match(/^(P\d{2})/)[1])
    .sort()
}

function loadOracle(personaId) {
  const dir   = join(ROOT, 'oraculos')
  const files = readdirSync(dir)
  const match = files.find(f => f.startsWith(personaId + '_') && f.endsWith('.yml'))
  if (!match) return null
  return yaml.load(readFileSync(join(dir, match), 'utf8'))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function consolidarLogs(personaIds) {
  const hoje = new Date().toISOString().split('T')[0]
  const pastaLog = join(ROOT, 'logs', hoje)
  const resultados = []

  for (const id of personaIds) {
    const logPath = join(pastaLog, `${id}_sessao_01.json`)
    if (!existsSync(logPath)) {
      resultados.push({ persona: id, status: 'sem_log' })
      continue
    }

    const log = JSON.parse(readFileSync(logPath, 'utf8'))
    const av  = log.avaliacao_vs_oraculo
    const r   = av.pontuacao_rubrica

    resultados.push({
      persona:          id,
      status:           'executado',
      risco_esperado:   av.nivel_risco_esperado,
      risco_detectado:  av.nivel_risco_detectado,
      acerto_risco:     av.nivel_risco_esperado === av.nivel_risco_detectado,
      falso_positivo:   av.falso_positivo,
      falso_negativo:   av.falso_negativo,
      fragilidades_esperadas:  av.fragilidades_esperadas,
      fragilidades_detectadas: av.fragilidades_detectadas,
      pontuacao:        r.total,
      pontuacao_max:    r.maximo,
    })
  }

  const executados   = resultados.filter(r => r.status === 'executado')
  const total        = executados.length
  const acertos      = executados.filter(r => r.acerto_risco).length
  const fpCount      = executados.filter(r => r.falso_positivo).length
  const fnCount      = executados.filter(r => r.falso_negativo).length
  const mediaPontos  = total > 0
    ? (executados.reduce((s, r) => s + r.pontuacao, 0) / total).toFixed(2)
    : '0.00'

  const consolidado = {
    gerado_em:              new Date().toISOString(),
    total_sessoes:          total,
    taxa_acerto_nivel_risco: total > 0 ? `${((acertos / total) * 100).toFixed(1)}%` : '0%',
    taxa_falso_positivo:    total > 0 ? `${((fpCount  / total) * 100).toFixed(1)}%` : '0%',
    taxa_falso_negativo:    total > 0 ? `${((fnCount  / total) * 100).toFixed(1)}%` : '0%',
    media_pontuacao_rubrica: `${mediaPontos}/12`,
    sessoes: resultados,
  }

  mkdirSync(pastaLog, { recursive: true })
  const outPath = join(pastaLog, 'consolidado.json')
  writeFileSync(outPath, JSON.stringify(consolidado, null, 2), 'utf8')

  console.log('\n━━━ Consolidado ━━━')
  console.log(`  Sessões:          ${total}`)
  console.log(`  Acerto risco:     ${consolidado.taxa_acerto_nivel_risco}`)
  console.log(`  Falso positivo:   ${consolidado.taxa_falso_positivo}`)
  console.log(`  Falso negativo:   ${consolidado.taxa_falso_negativo}`)
  console.log(`  Pontuação média:  ${consolidado.media_pontuacao_rubrica}`)
  console.log(`  Relatório:        logs/${hoje}/consolidado.json\n`)
}

async function main() {
  const args = process.argv.slice(2)

  let personaIds

  if (args.includes('--criticas')) {
    personaIds = getAllPersonaIds().filter(id => {
      const oracle = loadOracle(id)
      return oracle?.nivel_risco_esperado === 'critico'
    })
    console.log(`Executando ${personaIds.length} personas críticas: ${personaIds.join(', ')}\n`)

  } else if (args.includes('--controle')) {
    personaIds = ['P42', 'P47', 'P50']
    console.log(`Executando personas de controle: ${personaIds.join(', ')}\n`)

  } else if (args.length > 0 && !args[0].startsWith('--')) {
    personaIds = args.map(a => a.toUpperCase())
    console.log(`Executando personas específicas: ${personaIds.join(', ')}\n`)

  } else {
    personaIds = getAllPersonaIds()
    console.log(`Executando todas as ${personaIds.length} personas\n`)
  }

  mkdirSync(join(ROOT, 'logs'), { recursive: true })

  const erros = []

  for (let i = 0; i < personaIds.length; i++) {
    const id = personaIds[i]
    console.log(`[${i + 1}/${personaIds.length}] ${id}`)

    try {
      execSync(`node scripts/simular_persona.mjs ${id} 1`, {
        cwd: ROOT,
        stdio: 'inherit',
      })
    } catch (err) {
      console.error(`  ✗ Erro em ${id}:`, err.message)
      erros.push(id)
    }

    if (i < personaIds.length - 1) {
      await sleep(DELAY_ENTRE_PERSONAS_MS)
    }
  }

  consolidarLogs(personaIds)

  if (erros.length > 0) {
    console.warn(`⚠ Personas com erro: ${erros.join(', ')}`)
  }
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
