#!/usr/bin/env node

/**
 * consolidar_resultados.mjs
 *
 * Consolida todos os logs gerados e cria relatório final com:
 * - Taxa de sucesso por persona
 * - Acurácia vs oráculos
 * - Pontuação média da rubrica
 * - Análise de fragilidades detectadas
 *
 * Uso:
 *   node scripts/consolidar_resultados.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function consolidarResultados() {
  console.log('📊 Consolidando resultados...\n')

  const logsDir = join(ROOT, 'logs')

  // Buscar todos os JSONs de log (exceto consolidado)
  const logFiles = readdirSync(logsDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('consolidado'))
    .sort()

  if (logFiles.length === 0) {
    console.log('⚠️  Nenhum log encontrado em logs/')
    return
  }

  console.log(`📁 Encontrados ${logFiles.length} logs\n`)

  const resultados = []
  const personasAnalisadas = {}

  for (const file of logFiles) {
    try {
      const logPath = join(logsDir, file)
      const logData = JSON.parse(readFileSync(logPath, 'utf8'))

      const personaId = logData.meta.persona_id
      const avaliacao = logData.avaliacao_vs_oraculo
      const rubrica = avaliacao.pontuacao_rubrica

      const resultado = {
        arquivo: file,
        persona_id: personaId,
        risco_esperado: avaliacao.nivel_risco_esperado,
        risco_detectado: avaliacao.nivel_risco_detectado,
        acerto_risco: avaliacao.nivel_risco_esperado === avaliacao.nivel_risco_detectado,
        falso_positivo: avaliacao.falso_positivo,
        falso_negativo: avaliacao.falso_negativo,
        pontuacao_rubrica: rubrica.total,
        pontuacao_max: rubrica.maximo,
        percentual: ((rubrica.total / rubrica.maximo) * 100).toFixed(1),
        timestamp: logData.meta.data_execucao
      }

      resultados.push(resultado)

      // Agrupar por persona
      if (!personasAnalisadas[personaId]) {
        personasAnalisadas[personaId] = []
      }
      personasAnalisadas[personaId].push(resultado)
    } catch (err) {
      console.error(`❌ Erro ao processar ${file}: ${err.message}`)
    }
  }

  // Calcular métricas
  const totalSessoes = resultados.length
  const acertos = resultados.filter(r => r.acerto_risco).length
  const falsoPositivos = resultados.filter(r => r.falso_positivo).length
  const falsoNegativos = resultados.filter(r => r.falso_negativo).length
  const mediaPontuacao = resultados.reduce((s, r) => s + r.pontuacao_rubrica, 0) / totalSessoes
  const pontuacaoMin = Math.min(...resultados.map(r => r.pontuacao_rubrica))
  const pontuacaoMax = Math.max(...resultados.map(r => r.pontuacao_rubrica))

  // Análise por nível de risco
  const porNivel = {}
  for (const r of resultados) {
    const nivel = r.risco_esperado
    if (!porNivel[nivel]) {
      porNivel[nivel] = { total: 0, acertos: 0, fp: 0, fn: 0 }
    }
    porNivel[nivel].total++
    if (r.acerto_risco) porNivel[nivel].acertos++
    if (r.falso_positivo) porNivel[nivel].fp++
    if (r.falso_negativo) porNivel[nivel].fn++
  }

  // Criar consolidado
  const consolidado = {
    gerado_em: new Date().toISOString(),
    periodo: `${resultados[0]?.timestamp} a ${resultados[totalSessoes - 1]?.timestamp}`,
    total_sessoes: totalSessoes,
    total_personas_unicas: Object.keys(personasAnalisadas).length,

    metricas_gerais: {
      taxa_acerto_nivel_risco: `${((acertos / totalSessoes) * 100).toFixed(1)}%`,
      taxa_falso_positivo: `${((falsoPositivos / totalSessoes) * 100).toFixed(1)}%`,
      taxa_falso_negativo: `${((falsoNegativos / totalSessoes) * 100).toFixed(1)}%`,
      media_pontuacao_rubrica: mediaPontuacao.toFixed(2),
      pontuacao_minima: pontuacaoMin,
      pontuacao_maxima: pontuacaoMax,
      total_maximo_possivel: 12
    },

    metricas_por_nivel_risco: porNivel,

    sessoes_por_persona: personasAnalisadas,

    sessoes_detalhadas: resultados,

    conclusoes: {
      sistema_operacional: mediaPontuacao >= 8,
      taxa_acerto_minima_atingida: acertos / totalSessoes >= 0.8,
      falso_positivo_controlado: falsoPositivos / totalSessoes < 0.1,
      falso_negativo_controlado: falsoNegativos / totalSessoes < 0.1,
      recomendacoes: []
    }
  }

  // Adicionar recomendações
  if (mediaPontuacao < 8) {
    consolidado.conclusoes.recomendacoes.push('⚠️  Pontuação média abaixo do esperado (8). Revisar calibração do sistema.')
  }
  if (falsoPositivos / totalSessoes >= 0.1) {
    consolidado.conclusoes.recomendacoes.push('⚠️  Taxa de falso positivo elevada. Verificar personas de controle.')
  }
  if (falsoNegativos / totalSessoes >= 0.1) {
    consolidado.conclusoes.recomendacoes.push('⚠️  Taxa de falso negativo elevada. Revisar questões críticas.')
  }

  // Salvar consolidado
  const dataHoje = new Date().toISOString().split('T')[0]
  const consolidadoPath = join(logsDir, `consolidado_${dataHoje}.json`)
  writeFileSync(consolidadoPath, JSON.stringify(consolidado, null, 2))

  console.log('📊 RELATÓRIO CONSOLIDADO')
  console.log('═'.repeat(60))
  console.log(`Total de sessões: ${totalSessoes}`)
  console.log(`Personas únicas: ${consolidado.total_personas_unicas}`)
  console.log(`Taxa de acerto: ${consolidado.metricas_gerais.taxa_acerto_nivel_risco}`)
  console.log(`Falso Positivo: ${consolidado.metricas_gerais.taxa_falso_positivo}`)
  console.log(`Falso Negativo: ${consolidado.metricas_gerais.taxa_falso_negativo}`)
  console.log(`Pontuação média: ${consolidado.metricas_gerais.media_pontuacao_rubrica}/12`)
  console.log('═'.repeat(60))
  console.log(`\n✅ Consolidado salvo: ${consolidadoPath}`)

  // Exibir resumo por nível
  console.log('\n📈 RESUMO POR NÍVEL DE RISCO:')
  for (const [nivel, dados] of Object.entries(porNivel)) {
    const taxa = ((dados.acertos / dados.total) * 100).toFixed(1)
    console.log(`  ${nivel}: ${dados.acertos}/${dados.total} acertos (${taxa}%)`)
  }

  // Exibir conclusões
  console.log('\n🎯 CONCLUSÕES:')
  console.log(`  Sistema operacional: ${consolidado.conclusoes.sistema_operacional ? '✅ SIM' : '❌ NÃO'}`)
  console.log(`  Acurácia mínima atingida: ${consolidado.conclusoes.taxa_acerto_minima_atingida ? '✅ SIM' : '❌ NÃO'}`)
  console.log(`  Falso positivo controlado: ${consolidado.conclusoes.falso_positivo_controlado ? '✅ SIM' : '❌ NÃO'}`)
  console.log(`  Falso negativo controlado: ${consolidado.conclusoes.falso_negativo_controlado ? '✅ SIM' : '❌ NÃO'}`)

  if (consolidado.conclusoes.recomendacoes.length > 0) {
    console.log('\n⚠️  RECOMENDAÇÕES:')
    consolidado.conclusoes.recomendacoes.forEach(rec => console.log(`  ${rec}`))
  }
}

consolidarResultados()
