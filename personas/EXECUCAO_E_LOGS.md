# Guia de Execução e Geração de Logs — Validação com Personas Sintéticas

> Documento de apoio ao Mestrado Profissional em Engenharia de Software  
> Projeto: PlatformLGPDCompliance — Questionário Dinâmico LGPD

---

## Visão geral

Cada sessão de validação consiste em:

1. Instruir a LLM a assumir uma persona (arquivo `.md`)
2. Executar o questionário dinâmico de 4 estágios pela plataforma
3. Registrar todas as perguntas, respostas e diagnóstico final
4. Comparar a saída com o oráculo oculto (arquivo `.yml`)
5. Atribuir pontuação e arquivar o log

O oráculo **nunca** é entregue à LLM durante a simulação.

---

## 1. Pré-requisitos

### 1.1 Ambiente

```bash
# Node.js 18+ e npm instalados
node -v   # deve retornar v18 ou superior
npm -v

# Clonar o repositório (branch de personas)
git clone https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance.git
cd PlatformLGPDCompliance
git checkout personas/synthetic-lgpd-validation
```

### 1.2 Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
VITE_GROQ_API_KEY=<sua-chave-groq>
GROQ_API_KEY=<sua-chave-groq>
VITE_FIREBASE_API_KEY=<firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<projeto>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<projeto-id>
VITE_FIREBASE_STORAGE_BUCKET=<projeto>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
VITE_FIREBASE_APP_ID=<app-id>
```

### 1.3 Instalação e inicialização

```bash
npm install

# Iniciar frontend (Vite) e backend (Express) simultaneamente
npm run dev
```

O comando `npm run dev` executa:
- `dev:front` → Vite em `http://localhost:5173`
- `dev:back`  → Express em `http://localhost:3000`

---

## 2. Estrutura de arquivos de persona

```
PlatformLGPDCompliance/
├── personas/
│   ├── README.md                          # Matriz de cobertura das 50 personas
│   ├── EXECUCAO_E_LOGS.md                 # Este documento
│   ├── P01_RH_Recrutamento.md             # Prompt da persona para a LLM
│   ├── P02_RH_FolhaPagamento.md
│   └── ... (P03 a P50)
└── oraculos/
    ├── P01_RH_Recrutamento_oraculo.yml    # Gabarito oculto — NÃO entregar à LLM
    ├── P02_RH_FolhaPagamento_oraculo.yml
    └── ... (P03 a P50)
```

---

## 3. Protocolo de execução de uma sessão

### Passo 1 — Selecionar a persona

Escolha a persona pelo critério do experimento (eixo de fragilidade, setor, nível de risco).  
Abra o arquivo `.md` correspondente. Exemplo:

```
personas/P03_SaudeOcupacional.md
```

### Passo 2 — Instruir a LLM

Cole o conteúdo integral do arquivo `.md` no início da sessão com a LLM (ex.: ChatGPT, Claude, Gemini).  
Adicione a instrução de ativação:

```
Assuma completamente a persona descrita abaixo. Responda a todas as perguntas
a seguir exclusivamente a partir da perspectiva, experiência e conhecimento
desta persona. Não quebre o personagem em nenhum momento.

[COLAR CONTEÚDO DO ARQUIVO .md AQUI]
```

### Passo 3 — Executar o questionário pela plataforma

Acesse `http://localhost:5173`, inicie um novo questionário e utilize as respostas
geradas pela LLM-persona como input do respondente.

O fluxo da plataforma é:

```
Estágio 1 (4 perguntas) → Estágio 2 (5 perguntas) → Estágio 3 (5 perguntas) → Estágio 4 (5 perguntas)
                                                                                          ↓
                                                                               Relatório final gerado
```

Cada estágio é gerado dinamicamente pela API `/api/generate-stage` com base nas
respostas anteriores, inferindo o perfil do respondente e evitando repetição semântica.

### Passo 4 — Registrar o log

Para cada sessão, crie um arquivo de log com a estrutura abaixo:

```
logs/
└── P03_SaudeOcupacional_sessao_01.json
```

---

## 4. Formato do log de sessão

Salve um arquivo `.json` por sessão com a estrutura:

```json
{
  "meta": {
    "persona_id": "P03",
    "persona_arquivo": "P03_SaudeOcupacional.md",
    "data_execucao": "2026-06-30",
    "sessao_numero": 1,
    "modelo_llm": "claude-sonnet-4-6",
    "temperatura": 0.2,
    "executor": "nome-do-avaliador",
    "modo_geracao": "groq"
  },
  "estagios": [
    {
      "estagio": 1,
      "perguntas": [
        {
          "id": "q1",
          "texto": "Como você armazena os laudos médicos dos colaboradores?",
          "opcoes": [
            "Em pasta física na minha sala",
            "No sistema de RH da empresa",
            "Em e-mail pessoal ou WhatsApp",
            "Não sei informar"
          ]
        }
      ],
      "respostas": [
        {
          "pergunta_id": "q1",
          "resposta_escolhida": "Em e-mail pessoal ou WhatsApp",
          "justificativa_llm": "Uso meu WhatsApp pessoal mesmo, é mais rápido para passar para o médico do trabalho."
        }
      ]
    },
    {
      "estagio": 2,
      "perguntas": [],
      "respostas": []
    },
    {
      "estagio": 3,
      "perguntas": [],
      "respostas": []
    },
    {
      "estagio": 4,
      "perguntas": [],
      "respostas": []
    }
  ],
  "relatorio_final": {
    "texto": "...",
    "metricas": {
      "score": 23,
      "riscos": [
        { "categoria": "Dados sensíveis sem salvaguarda", "conformidade": 10 }
      ],
      "pontos_criticos": [],
      "recomendacoes": []
    }
  },
  "avaliacao_vs_oraculo": {
    "nivel_risco_esperado": "critico",
    "nivel_risco_detectado": "critico",
    "fragilidades_esperadas": ["F9"],
    "fragilidades_detectadas": ["F9"],
    "falso_positivo": false,
    "falso_negativo": false,
    "pontuacao_rubrica": {
      "deteccao_fragilidade_central": 3,
      "profundidade_perguntas": 2,
      "classificacao_risco_correta": 3,
      "ausencia_falso_positivo": 3,
      "total": 11,
      "maximo": 12
    },
    "observacoes": ""
  }
}
```

---

## 5. Rubrica de pontuação (comparação com o oráculo)

Cada sessão é pontuada em 4 critérios (escala 0–3):

| Critério | 0 | 1 | 2 | 3 |
|----------|---|---|---|---|
| **Detecção da fragilidade central** | Não detectou | Detectou parcialmente | Detectou com evidência fraca | Detectou com evidência clara |
| **Profundidade das perguntas** | Perguntas genéricas | 1 pergunta específica ao contexto | 2–3 perguntas específicas | Ramificação precisa em todos os estágios |
| **Classificação de risco correta** | Errou nível | Nível adjacente | Correto mas sem justificativa | Correto com justificativa alinhada ao oráculo |
| **Ausência de falso positivo** | Detectou fragilidade inexistente | Risco inflado | Leve exagero | Sem falso positivo |

**Pontuação total:** 0–12 por sessão  
**Mínimo aceitável:** 8 (critério `minimo` do oráculo atendido)  
**Ideal:** 10+ (critério `ideal` do oráculo atendido)

---

## 6. Script de geração de log automático

Para automatizar o registro, crie `scripts/gerar_log.mjs` no projeto:

```js
// scripts/gerar_log.mjs
// Uso: node scripts/gerar_log.mjs <persona_id> <sessao_numero>
// Exemplo: node scripts/gerar_log.mjs P03 1

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const [, , personaId, sessaoNum] = process.argv

if (!personaId || !sessaoNum) {
  console.error('Uso: node scripts/gerar_log.mjs <P01-P50> <numero_sessao>')
  process.exit(1)
}

const template = {
  meta: {
    persona_id: personaId,
    data_execucao: new Date().toISOString().split('T')[0],
    sessao_numero: parseInt(sessaoNum),
    modelo_llm: '',
    temperatura: 0.2,
    executor: '',
    modo_geracao: 'groq'
  },
  estagios: [1, 2, 3, 4].map(n => ({
    estagio: n,
    perguntas: [],
    respostas: []
  })),
  relatorio_final: { texto: '', metricas: {} },
  avaliacao_vs_oraculo: {
    nivel_risco_esperado: '',
    nivel_risco_detectado: '',
    fragilidades_esperadas: [],
    fragilidades_detectadas: [],
    falso_positivo: false,
    falso_negativo: false,
    pontuacao_rubrica: {
      deteccao_fragilidade_central: 0,
      profundidade_perguntas: 0,
      classificacao_risco_correta: 0,
      ausencia_falso_positivo: 0,
      total: 0,
      maximo: 12
    },
    observacoes: ''
  }
}

mkdirSync('logs', { recursive: true })
const fileName = `logs/${personaId}_sessao_${sessaoNum.padStart(2, '0')}.json`
writeFileSync(fileName, JSON.stringify(template, null, 2), 'utf8')
console.log(`Log criado: ${fileName}`)
```

Execução:

```bash
node scripts/gerar_log.mjs P03 1
# Cria: logs/P03_sessao_01.json
```

---

## 7. Consolidação de resultados

Após executar todas as sessões, gere o relatório consolidado com:

```bash
node scripts/consolidar_resultados.mjs
```

Crie `scripts/consolidar_resultados.mjs`:

```js
// scripts/consolidar_resultados.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs'

const logs = readdirSync('logs').filter(f => f.endsWith('.json'))

const resultados = logs.map(f => {
  const log = JSON.parse(readFileSync(`logs/${f}`, 'utf8'))
  const av = log.avaliacao_vs_oraculo
  return {
    persona: log.meta.persona_id,
    sessao: log.meta.sessao_numero,
    risco_esperado: av.nivel_risco_esperado,
    risco_detectado: av.nivel_risco_detectado,
    acerto_risco: av.nivel_risco_esperado === av.nivel_risco_detectado,
    falso_positivo: av.falso_positivo,
    falso_negativo: av.falso_negativo,
    pontuacao: av.pontuacao_rubrica.total,
    pontuacao_max: av.pontuacao_rubrica.maximo
  }
})

const totalSessoes = resultados.length
const acertos = resultados.filter(r => r.acerto_risco).length
const falsoPositivos = resultados.filter(r => r.falso_positivo).length
const falsoNegativos = resultados.filter(r => r.falso_negativo).length
const mediaPontuacao = resultados.reduce((s, r) => s + r.pontuacao, 0) / totalSessoes

const consolidado = {
  gerado_em: new Date().toISOString(),
  total_sessoes: totalSessoes,
  taxa_acerto_nivel_risco: `${((acertos / totalSessoes) * 100).toFixed(1)}%`,
  taxa_falso_positivo: `${((falsoPositivos / totalSessoes) * 100).toFixed(1)}%`,
  taxa_falso_negativo: `${((falsoNegativos / totalSessoes) * 100).toFixed(1)}%`,
  media_pontuacao_rubrica: mediaPontuacao.toFixed(2),
  sessoes: resultados
}

writeFileSync('logs/consolidado.json', JSON.stringify(consolidado, null, 2), 'utf8')
console.log(`Consolidado salvo em logs/consolidado.json`)
console.log(`Sessões: ${totalSessoes} | Acerto: ${consolidado.taxa_acerto_nivel_risco} | Pontuação média: ${consolidado.media_pontuacao_rubrica}/12`)
```

---

## 8. Recomendações metodológicas

### Temperatura da LLM

| Nível de risco da persona | Temperatura recomendada |
|---------------------------|------------------------|
| Baixo (controle)          | 0.3                    |
| Moderado                  | 0.2                    |
| Alto                      | 0.2                    |
| Crítico                   | 0.1–0.2                |

### Repetição de sessões

- Personas de nível **crítico**: executar no mínimo **2 sessões** (verificar consistência)
- Personas de **controle** (P42, P47, P50): executar no mínimo **3 sessões** (falso positivo é o principal risco)
- Personas de nível **moderado**: 1 sessão é suficiente para triagem inicial

### Ordem de execução sugerida

1. Executar primeiro as 3 personas de controle (P42, P47, P50) para calibrar o sistema
2. Em seguida, executar 1 persona de cada eixo F1–F10
3. Por último, executar o restante das personas por setor

### Isolamento de sessões

- Iniciar uma **nova sessão de LLM** (sem histórico) para cada persona
- Não reutilizar o mesmo thread entre personas diferentes
- Registrar o `session_id` do Firebase para rastreabilidade

---

## 9. Referência rápida de eixos de fragilidade

| Código | Fragilidade | Personas de referência |
|--------|-------------|------------------------|
| F1 | Compartilhamento informal | P01, P08, P10, P34, P39 |
| F2 | Armazenamento indevido | P04, P14, P23, P29, P32 |
| F3 | Retenção excessiva | P02, P12, P35, P48 |
| F4 | Coleta excessiva | P07, P13, P17, P20, P28 |
| F5 | Acesso excessivo | P11, P26, P27 |
| F6 | Falta de transparência | P18, P24, P45, P46 |
| F7 | Uso secundário | P05, P06, P38, P49 |
| F8 | Terceiros sem controle | P09, P15, P16, P19, P30 |
| F9 | Dados sensíveis sem salvaguarda | P03, P25, P33, P35, P36, P40 |
| F10 | Incidente mal tratado | — (eixo transversal; avaliar em personas críticas) |
| —  | Controle (sem fragilidade) | **P42, P47, P50** |
