/**
 * avaliar_regex_vs_oraculo.mjs
 * ----------------------------------------------------------------------------
 * Avalia o mecanismo de detecção lexical de fragilidades da plataforma
 * (detectFragilityPatterns, server/promptGroq.mjs) contra os arquivos oráculo,
 * usando o corpus de 55 sessões registrado em logs/2026-07-02.
 *
 * Para cada persona:
 *   1. concatena as respostas (respostas_texto) dos quatro estágios;
 *   2. aplica as MESMAS expressões regulares da plataforma (cópia literal);
 *   3. compara o conjunto de categorias detectadas (F1–F10) com o esperado
 *      no oráculo;
 *   4. acumula TP/FP/FN/TN por categoria e calcula acurácia, precisão,
 *      revocação, F1-score e especificidade.
 *
 * Ground truth por categoria:
 *   - F1–F5, F8, F9, F10: valor > 0 no vetor_de_fragilidade do oráculo;
 *   - F6 e F7 (sem detecção lexical na plataforma): presença do código em
 *     categorias_lgpd_esperadas.
 *
 * Saídas: validation_results/metricas_regex_vs_oraculo.{json,csv,md}
 *
 * Uso:  node scripts/avaliar_regex_vs_oraculo.mjs
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const LOG_DIR = "logs/2026-07-02";
const ORACLE_DIR = "oraculos";
const OUT_DIR = "validation_results";

// ---------------------------------------------------------------------------
// Réplica literal de server/promptGroq.mjs (normalize + detectFragilityPatterns)
// ---------------------------------------------------------------------------
function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectFragilityPatterns(text) {
  const fullText = normalize(text);
  return {
    hasInformalChannels: /whatsapp|email pessoal|grupo|print|link|sms pessoal|mensagem privada/i.test(fullText),
    hasPersonalStorage: /celular pessoal|pendrive|desktop|computador pessoal|backup pessoal|meu computador|meu dispositivo/i.test(fullText),
    hasExcessiveRetention: /por garantia|nunca apago|guardo tudo|nao tenho prazo|indefinidamente|antigos/i.test(fullText),
    hasExcessiveCollection: /cpf|documento|laudo|foto|biometria|dados do dependente|sem necessidade/i.test(fullText),
    hasExcessiveAccess: /admin|administrador|acesso total|senha compartilhada|todo mundo ve|sem restricao|super usuario/i.test(fullText),
    hasUncontrolledThirdParties: /fornecedor|terceiro|parceiro|agencia|escritorio|familiar|contato alternativo|outro numero/i.test(fullText),
    hasSensitiveData: /saude|laudo|atestado|dependente|crianca|filho|biometria|filiacao|pcd|deficiencia|medico|psicologo|diagnostico|medicamento/i.test(fullText),
    hasIncidentRisk: /perdi|caiu|vazou|enviou errado|caiu na internet|descobriram|nao sabia|nunca soube|o que faco|como proceder/i.test(fullText),
  };
}

// flag da plataforma -> código da taxonomia
const FLAG_TO_CODE = {
  hasInformalChannels: "F1",
  hasPersonalStorage: "F2",
  hasExcessiveRetention: "F3",
  hasExcessiveCollection: "F4",
  hasExcessiveAccess: "F5",
  hasUncontrolledThirdParties: "F8",
  hasSensitiveData: "F9",
  hasIncidentRisk: "F10",
};

// chave do vetor do oráculo -> código
const VECTOR_TO_CODE = {
  compartilhamento_informal: "F1",
  armazenamento_pessoal: "F2",
  retencao_excessiva: "F3",
  coleta_excessiva: "F4",
  acesso_excessivo: "F5",
  terceiros_sem_controle: "F8",
  dados_sensiveis: "F9",
  incidente_mal_tratado: "F10",
};

const ALL_CODES = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"];

// As personas adversariais (A01-A05) possuem oraculo apenas de nivel de risco e
// score esperado, sem vetor de fragilidades; por isso sao excluidas da matriz
// de confusao (nao ha ground truth de categorias para elas) e tratadas em
// analise separada, junto da verificacao de risco pendente da etapa LLM.
const SEM_GROUND_TRUTH = /^A\d+/;
const REGEX_CODES = Object.values(FLAG_TO_CODE);

// ---------------------------------------------------------------------------
// Carga de dados
// ---------------------------------------------------------------------------
function loadOracles() {
  const oracles = new Map();
  for (const file of fs.readdirSync(ORACLE_DIR).filter((f) => f.endsWith(".yml"))) {
    const doc = yaml.load(fs.readFileSync(path.join(ORACLE_DIR, file), "utf8"));
    const id = doc.persona_id;
    const expected = new Set();
    const severity = {};

    const vector = doc.vetor_de_fragilidade || {};
    for (const [key, code] of Object.entries(VECTOR_TO_CODE)) {
      const v = Number(vector[key] ?? 0);
      if (v > 0) {
        expected.add(code);
        severity[code] = v; // 1 = baixa, 2 = moderada, 3 = alta
      }
    }
    for (const cat of doc.categorias_lgpd_esperadas || []) {
      if (cat.codigo === "F6" || cat.codigo === "F7") expected.add(cat.codigo);
    }

    const central = (doc.categorias_lgpd_esperadas || [])[0]?.codigo || null;

    oracles.set(id, {
      id,
      setor: doc.setor,
      risco: doc.nivel_risco_esperado,
      expected,
      severity,
      central,
      grupo: id.startsWith("A") ? "adversarial" : expected.size === 0 ? "controle" : "operacional",
    });
  }
  return oracles;
}

function loadSessionText(personaId) {
  const file = fs
    .readdirSync(LOG_DIR)
    .find((f) => f.startsWith(personaId + "_") && f.endsWith(".json"));
  if (!file) return null;
  const doc = JSON.parse(fs.readFileSync(path.join(LOG_DIR, file), "utf8"));
  const stages = (doc.estagios || []).map((e) => e.respostas_texto || "");
  return { full: stages.join("\n\n"), stages };
}

// ---------------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------------
function detectCodes(text) {
  const flags = detectFragilityPatterns(text);
  const codes = new Set();
  for (const [flag, code] of Object.entries(FLAG_TO_CODE)) {
    if (flags[flag]) codes.add(code);
  }
  return codes;
}

function metricsFrom(m) {
  const { TP, FP, FN, TN } = m;
  const div = (a, b) => (b === 0 ? null : a / b);
  return {
    ...m,
    acuracia: div(TP + TN, TP + FP + FN + TN),
    precisao: div(TP, TP + FP),
    revocacao: div(TP, TP + FN),
    f1: div(2 * TP, 2 * TP + FP + FN),
    especificidade: div(TN, TN + FP),
  };
}

function run() {
  const oracles = loadOracles();
  const perCat = Object.fromEntries(ALL_CODES.map((c) => [c, { TP: 0, FP: 0, FN: 0, TN: 0 }]));
  const perPersona = [];
  let centralHits = 0, centralTotal = 0;
  const controlFP = [];
  const stageFirstDetection = { 1: 0, 2: 0, 3: 0, 4: 0 };

  const sevAgg = { 1: { tp: 0, fn: 0 }, 2: { tp: 0, fn: 0 }, 3: { tp: 0, fn: 0 } };
  for (const id of [...oracles.keys()].sort()) {
    const oracle = oracles.get(id);
    const session = loadSessionText(id);
    if (!session) {
      console.warn(`[aviso] sem log para ${id}`);
      continue;
    }
    if (SEM_GROUND_TRUTH.test(id)) continue; // ver comentario em SEM_GROUND_TRUTH
    const detected = detectCodes(session.full);

    // estágio em que cada categoria detectada aparece pela primeira vez
    const cumulative = [];
    session.stages.forEach((s, i) => {
      cumulative.push((cumulative[i - 1] || "") + "\n" + s);
    });
    for (const code of detected) {
      for (let i = 0; i < cumulative.length; i++) {
        if (detectCodes(cumulative[i]).has(code)) {
          stageFirstDetection[i + 1]++;
          break;
        }
      }
    }

    const row = { id, grupo: oracle.grupo, risco: oracle.risco, TP: [], FP: [], FN: [], TN: [] };
    for (const code of ALL_CODES) {
      const exp = oracle.expected.has(code);
      const det = detected.has(code);
      const bucket = exp && det ? "TP" : !exp && det ? "FP" : exp && !det ? "FN" : "TN";
      perCat[code][bucket]++;
      row[bucket].push(code);
      if (exp && oracle.severity[code]) {
        sevAgg[oracle.severity[code]][det ? "tp" : "fn"]++;
      }
    }
    perPersona.push(row);

    if (oracle.central) {
      centralTotal++;
      if (detected.has(oracle.central)) centralHits++;
    }
    if (oracle.grupo === "controle" && row.FP.length) controlFP.push({ id, FP: row.FP });
  }

  // agregados
  const agg = (codes) => {
    const m = { TP: 0, FP: 0, FN: 0, TN: 0 };
    for (const c of codes) for (const k of Object.keys(m)) m[k] += perCat[c][k];
    return metricsFrom(m);
  };
  const results = {
    gerado_em: new Date().toISOString(),
    corpus: LOG_DIR,
    personas_avaliadas: perPersona.length,
    por_categoria: Object.fromEntries(ALL_CODES.map((c) => [c, metricsFrom(perCat[c])])),
    agregado_regex_8cat: agg(REGEX_CODES),
    agregado_10cat: agg(ALL_CODES),
    fragilidade_central: { detectadas: centralHits, total: centralTotal, taxa: centralHits / centralTotal },
    falsos_positivos_personas_controle: controlFP,
    revocacao_por_severidade: Object.fromEntries(
      Object.entries(sevAgg).map(([s, v]) => [s, { ...v, revocacao: v.tp / (v.tp + v.fn) }])
    ),
    primeiro_estagio_de_deteccao: stageFirstDetection,
    por_persona: perPersona,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "metricas_regex_vs_oraculo.json"), JSON.stringify(results, null, 2));

  // CSV por categoria
  const fmt = (v) => (v === null ? "" : v.toFixed(3));
  const csv = ["categoria,TP,FP,FN,TN,acuracia,precisao,revocacao,f1,especificidade"];
  for (const c of ALL_CODES) {
    const m = results.por_categoria[c];
    csv.push([c, m.TP, m.FP, m.FN, m.TN, fmt(m.acuracia), fmt(m.precisao), fmt(m.revocacao), fmt(m.f1), fmt(m.especificidade)].join(","));
  }
  for (const [label, m] of [["AGREGADO_8_REGEX", results.agregado_regex_8cat], ["AGREGADO_10", results.agregado_10cat]]) {
    csv.push([label, m.TP, m.FP, m.FN, m.TN, fmt(m.acuracia), fmt(m.precisao), fmt(m.revocacao), fmt(m.f1), fmt(m.especificidade)].join(","));
  }
  fs.writeFileSync(path.join(OUT_DIR, "metricas_regex_vs_oraculo.csv"), csv.join("\n"));

  // resumo no console
  console.log(`\nPersonas avaliadas: ${results.personas_avaliadas}`);
  console.log(`Fragilidade central detectada: ${centralHits}/${centralTotal} (${(100 * centralHits / centralTotal).toFixed(1)}%)`);
  console.log(`FP em personas de controle: ${controlFP.length ? JSON.stringify(controlFP) : "nenhum ... verificar"}`);
  console.log(`Primeiro estágio de detecção: ${JSON.stringify(stageFirstDetection)}`);
  console.log(`Revocação por severidade: ${JSON.stringify(results.revocacao_por_severidade)}`);
  console.log("\ncategoria  TP  FP  FN  TN   acur  prec  rev   f1    espec");
  for (const c of ALL_CODES) {
    const m = results.por_categoria[c];
    console.log(
      `${c.padEnd(9)} ${String(m.TP).padStart(3)} ${String(m.FP).padStart(3)} ${String(m.FN).padStart(3)} ${String(m.TN).padStart(3)}   ${fmt(m.acuracia)} ${fmt(m.precisao)} ${fmt(m.revocacao)} ${fmt(m.f1)} ${fmt(m.especificidade)}`
    );
  }
  for (const [label, m] of [["AGREG-8", results.agregado_regex_8cat], ["AGREG-10", results.agregado_10cat]]) {
    console.log(
      `${label.padEnd(9)} ${String(m.TP).padStart(3)} ${String(m.FP).padStart(3)} ${String(m.FN).padStart(3)} ${String(m.TN).padStart(3)}   ${fmt(m.acuracia)} ${fmt(m.precisao)} ${fmt(m.revocacao)} ${fmt(m.f1)} ${fmt(m.especificidade)}`
    );
  }
}

run();
