# 🚀 Fluxo de Execução e Validação LGPD

## Visão Geral

Este guia descreve como executar o fluxo completo de validação automática com as 55 personas.

**Fluxo:**
```
1. Todas as 55 personas passam por questionário de 4 estágios
2. Sistema gera respostas coerentes com cada persona (via Claude API)
3. Logs são salvos com estrutura completa
4. Resultados são consolidados em relatório final
5. Métricas de acurácia vs oráculos são calculadas
```

---

## 📋 Pré-requisitos

✅ **Já configurado:**
- Node.js 18+
- npm install (dependências instaladas)
- ANTHROPIC_API_KEY no `.env`
- 55 personas (.md)
- 55 oráculos (.yml)

---

## 🚀 Executar Fluxo Completo

### Opção 1: Fluxo MASTER (recomendado)

Executa TUDO automaticamente:

```bash
node executar_fluxo_completo.mjs
```

**O que faz:**
1. ✅ Executa todas as 55 personas
2. ✅ Gera logs completos
3. ✅ Consolida resultados
4. ✅ Exibe relatório final

**Tempo esperado:** ~5-10 minutos (55 personas × 2-3 requisições API cada)

---

### Opção 2: Executar Personas Separadamente

```bash
node scripts/executar_todas_personas.mjs
```

Gera todos os logs em `logs/YYYY-MM-DD/`

---

### Opção 3: Consolidar Resultados Existentes

```bash
node scripts/consolidar_resultados.mjs
```

Analisa logs já gerados e cria relatório final.

---

## 📊 Estrutura dos Logs

Cada persona gera um arquivo JSON:

```
logs/2026-07-02/
├── A01_sessao_01.json       ← Persona adversarial 1
├── A02_sessao_01.json
├── ...
├── A05_sessao_01.json
├── P01_sessao_01.json       ← Persona operacional 1
├── P02_sessao_01.json
├── ...
├── P50_sessao_01.json
└── consolidado_2026-07-02.json  ← RELATÓRIO FINAL
```

### Estrutura do Log Individual

```json
{
  "meta": {
    "persona_id": "P03",
    "data_execucao": "2026-07-02",
    "sessao_numero": 1,
    "modelo_llm": "claude-haiku-4-5-20251001",
    "temperatura": 0.2,
    "executor": "automated-claude"
  },
  "estagios": [
    {
      "estagio": 1,
      "perguntas": [...],
      "respostas_texto": "...",
      "timestamp": "2026-07-02T14:30:00Z"
    },
    ...
  ],
  "relatorio_final": {
    "texto": "...",
    "metricas": {...}
  },
  "avaliacao_vs_oraculo": {
    "nivel_risco_esperado": "critico",
    "nivel_risco_detectado": "critico",
    "pontuacao_rubrica": {
      "deteccao_fragilidade_central": 3,
      "profundidade_perguntas": 2,
      "classificacao_risco_correta": 3,
      "ausencia_falso_positivo": 3,
      "total": 11,
      "maximo": 12
    }
  }
}
```

---

## 📈 Relatório Consolidado

Após execução, um arquivo `consolidado_YYYY-MM-DD.json` é criado com:

```json
{
  "total_sessoes": 55,
  "total_personas_unicas": 55,
  "metricas_gerais": {
    "taxa_acerto_nivel_risco": "87.3%",
    "taxa_falso_positivo": "5.5%",
    "taxa_falso_negativo": "7.2%",
    "media_pontuacao_rubrica": "9.5/12",
    "pontuacao_minima": 7,
    "pontuacao_maxima": 12
  },
  "metricas_por_nivel_risco": {
    "critico": { "total": 15, "acertos": 14, "fp": 1, "fn": 0 },
    "alto": { "total": 20, "acertos": 19, "fp": 1, "fn": 0 },
    "moderado": { "total": 15, "acertos": 12, "fp": 2, "fn": 1 },
    "baixo": { "total": 5, "acertos": 5, "fp": 0, "fn": 0 }
  },
  "conclusoes": {
    "sistema_operacional": true,
    "taxa_acerto_minima_atingida": true,
    "falso_positivo_controlado": true,
    "falso_negativo_controlado": true,
    "recomendacoes": []
  }
}
```

---

## 🎯 Critérios de Sucesso

| Métrica | Mínimo Aceitável | Ideal |
|---------|-----------------|-------|
| Taxa de Acerto | 80% | 90%+ |
| Falso Positivo | < 10% | < 5% |
| Falso Negativo | < 10% | < 5% |
| Pontuação Rubrica | 8/12 | 10/12 |

---

## 💰 Custo Estimado

**Por execução completa (55 personas):**
- Tokens aproximados: ~55,000 (input + output)
- Custo: ~$0.10 USD (R$ 0,50)

**Créditos recomendados:** $5 USD permite ~50 execuções completas

---

## 🔍 Troubleshooting

### Erro: "Cannot find module '@anthropic-ai/sdk'"
```bash
npm install @anthropic-ai/sdk js-yaml dotenv
```

### Erro: "ANTHROPIC_API_KEY ausente"
Verifique `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...seu-token-aqui...
```

### Erro: "Persona não encontrada"
Verifique se os arquivos `.md` existem em `personas/`

---

## 📝 Próximos Passos

1. ✅ Executar fluxo completo
2. ✅ Revisar relatório consolidado
3. ✅ Analisar personas com baixa pontuação
4. ✅ Validar fragilidades detectadas
5. ✅ Gerar gráficos/visualizações (opcional)

---

**Documentação:** Veja `personas/EXECUCAO_E_LOGS.md` para detalhes completos do protocolo.
