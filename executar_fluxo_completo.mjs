#!/usr/bin/env node

/**
 * executar_fluxo_completo.mjs
 *
 * Script master que orquestra o fluxo completo de validação:
 * 1. Executa todas as 55 personas
 * 2. Gera logs com estrutura completa
 * 3. Consolida resultados em relatório final
 *
 * Uso:
 *   node executar_fluxo_completo.mjs
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname

console.log('🚀 FLUXO COMPLETO DE VALIDAÇÃO LGPD')
console.log('═'.repeat(70))
console.log(`Iniciado em: ${new Date().toLocaleString('pt-BR')}`)
console.log('═'.repeat(70))

try {
  // Etapa 1: Executar todas as personas
  console.log('\n📋 ETAPA 1: Executando todas as 55 personas...')
  console.log('-'.repeat(70))

  execSync('node scripts/executar_todas_personas.mjs', {
    stdio: 'inherit',
    cwd: ROOT
  })

  // Etapa 2: Consolidar resultados
  console.log('\n📊 ETAPA 2: Consolidando resultados...')
  console.log('-'.repeat(70))

  execSync('node scripts/consolidar_resultados.mjs', {
    stdio: 'inherit',
    cwd: ROOT
  })

  console.log('\n✨ FLUXO COMPLETO FINALIZADO COM SUCESSO!')
  console.log('═'.repeat(70))
  console.log(`Finalizadoem: ${new Date().toLocaleString('pt-BR')}`)
  console.log('═'.repeat(70))

  console.log('\n📁 ARQUIVOS GERADOS:')
  console.log('  ✅ logs/YYYY-MM-DD/A01_sessao_01.json')
  console.log('  ✅ logs/YYYY-MM-DD/A02_sessao_01.json')
  console.log('  ✅ logs/YYYY-MM-DD/...')
  console.log('  ✅ logs/YYYY-MM-DD/P50_sessao_01.json')
  console.log('  ✅ logs/consolidado_YYYY-MM-DD.json (RELATÓRIO FINAL)')

  console.log('\n📊 PRÓXIMOS PASSOS:')
  console.log('  1. Revisar logs/consolidado_YYYY-MM-DD.json')
  console.log('  2. Analisar taxa de acurácia')
  console.log('  3. Validar fragilidades detectadas')
  console.log('  4. Gerar relatório visual (opcional)')

} catch (err) {
  console.error('\n❌ ERRO NO FLUXO:')
  console.error(err.message)
  process.exit(1)
}
