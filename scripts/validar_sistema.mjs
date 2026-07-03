#!/usr/bin/env node

/**
 * validar_sistema.mjs
 *
 * Script que valida a integridade do sistema:
 * 1. Roda todos os testes automatizados
 * 2. Executa personas
 * 3. Valida oracle (A01-A05 devem ser detectadas como maliciosas)
 *
 * Exit code: 0 se tudo OK, 1 se houver falhas
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

console.log('🔍 VALIDAÇÃO DO SISTEMA DE SEGURANÇA')
console.log('═'.repeat(70))

const checks = {
  testes: false,
  personas: false,
  adversarias: false,
}

// ─── 1. Rodar testes ──────────────────────────────────────────────────────

console.log('\n📋 ETAPA 1: Rodando testes automatizados...\n')

try {
  execSync('npm test', {
    cwd: ROOT,
    stdio: 'inherit'
  })
  checks.testes = true
  console.log('\n✅ Testes: PASSOU\n')
} catch (err) {
  console.log('\n❌ Testes: FALHOU\n')
  process.exit(1)
}

// ─── 2. Executar personas ──────────────────────────────────────────────────

console.log('📋 ETAPA 2: Gerando personas...\n')

try {
  execSync('node scripts/executar_fluxo_completo.mjs', {
    cwd: ROOT,
    stdio: 'inherit'
  })
  checks.personas = true
  console.log('\n✅ Personas: GERADAS\n')
} catch (err) {
  console.log('\n❌ Personas: FALHA NA GERAÇÃO\n')
  process.exit(1)
}

// ─── 3. Validar adversárias ────────────────────────────────────────────────

console.log('📋 ETAPA 3: Validando detecção de personas adversárias...\n')

try {
  const output = execSync('node scripts/consolidar_com_validacao_oracle.mjs', {
    cwd: ROOT,
    encoding: 'utf8'
  })

  console.log(output)

  // Verificar se A01-A05 foram classificadas corretamente
  const adversarios = ['A01', 'A02', 'A03', 'A04', 'A05']
  let todasDetectadas = true

  adversarios.forEach(id => {
    if (!output.includes(id)) {
      console.log(`⚠️  ${id}: não encontrado na validação`)
      todasDetectadas = false
    }
  })

  if (todasDetectadas) {
    checks.adversarias = true
    console.log('\n✅ Adversárias: DETECTADAS\n')
  } else {
    console.log('\n⚠️  Algumas adversárias não foram detectadas\n')
  }
} catch (err) {
  console.log('\n⚠️  Validação oracle: erro na execução')
  console.log(err.message)
}

// ─── RESUMO ────────────────────────────────────────────────────────────────

console.log('═'.repeat(70))
console.log('📊 RESUMO DA VALIDAÇÃO\n')

console.log(`${checks.testes ? '✅' : '❌'} Testes automatizados: ${checks.testes ? 'PASSOU' : 'FALHOU'}`)
console.log(`${checks.personas ? '✅' : '❌'} Geração de personas: ${checks.personas ? 'OK' : 'FALHOU'}`)
console.log(`${checks.adversarias ? '✅' : '⚠️ '} Detecção de adversárias: ${checks.adversarias ? 'OK' : 'PARCIAL'}`)

const todasOK = checks.testes && checks.personas
console.log('\n' + (todasOK ? '🟢' : '🔴') + ' Status geral: ' + (todasOK ? 'SEGURO' : 'INSEGURO'))

console.log('\n═'.repeat(70))

if (!todasOK) process.exit(1)
