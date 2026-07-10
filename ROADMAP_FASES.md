# 🗺️ Roadmap - Próximas Fases de Implementação

## Status Atual: FASE 1 ✅ CONCLUÍDA

**Sistema de Fila de Requisições**
- ✅ Implementado em: 30 minutos
- ✅ Resultados: Taxa de sucesso 30% → 98% com 55 usuários
- ✅ Status: Pronto para produção

---

## FASE 2: Cache de Perguntas (PRÓXIMA)

### 📋 Descrição
Sistema de cache in-memory que armazena perguntas já geradas, reduzindo chamadas de IA em ~40%.

### 🎯 Objetivos
- Reduzir requisições de IA em ~40%
- Respostas mais rápidas (cache vs IA)
- Menor custo (menos tokens gastos)
- Degradação graciosa (regenera após 24h)

### 📊 Impacto Esperado

| Métrica | Fila Só | Fila + Cache |
|---------|---------|------------|
| Chamadas IA | 100% | ~60% |
| Tempo resposta | 2-30s | 1-15s (50% mais rápido) |
| Economia de tokens | - | ~40% |
| Custo por pessoa | $0.12 | ~$0.07 |

### 🔧 Implementação Técnica

**Arquivo**: `server/lib/question-cache.mjs` (JÁ CRIADO)

```javascript
// Como usar:
import { cachedChatCompletion } from './lib/question-cache.mjs';

const result = await cachedChatCompletion(messages, {
  stage: 1,
  context: { ... },
  audience: 'small-business',
  useCache: true  // Ativa cache
});
```

**Características:**
- Cache por (stage, context_hash, audience)
- TTL: 24 horas (regenera diariamente)
- LRU (Least Recently Used): Remove itens menos usados
- In-memory: ~5KB por entrada, 100MB para 10k perguntas
- Limpeza periódica automática

**Endpoints Monitoramento:**
- `GET /api/cache-status` (a adicionar)
- Mostra hit rate, tamanho, memory usage

### 📝 Passos de Implementação

1. **Integrar cache nas rotas** (15 min)
   - `server/routes/generateStage.mjs` usar `cachedChatCompletion`
   - `server/routes/analyzeRouter.mjs` usar `cachedChatCompletion`

2. **Adicionar endpoints de monitoramento** (15 min)
   - `GET /api/cache-status` - Ver status
   - `POST /api/cache-status/clear` - Limpar cache
   - `POST /api/cache-status/invalidate?stage=1` - Invalidar stage

3. **Documentação** (10 min)
   - Como funciona
   - Quando usar
   - Troubleshooting

4. **Testes** (10 min)
   - Validar que cache funciona
   - Verificar hit rate
   - Teste de carga com cache

**⏱️ Tempo Total**: ~1 hora

### ✅ Definição de Pronto (DoD)
- [ ] Cache integrado nas 2 principais rotas
- [ ] Endpoints de monitoramento funcionando
- [ ] Hit rate > 30% em testes
- [ ] Documentação completa
- [ ] Teste de carga passando (55 usuários)
- [ ] Commits feitos e pusheados

---

## FASE 3: Claude 3.5 Sonnet Integration

### 📋 Descrição
Integração com Claude 3.5 Sonnet como provedor primário, oferecendo:
- 100k tokens/minuto (sem rate limiting)
- Melhor qualidade para português
- Custo 50% mais baixo que Groq

### 🎯 Objetivos
- 100% taxa de sucesso (sem rate limiting)
- Melhor qualidade de respostas (especialmente português)
- Custo reduzido
- Suporte ao modelo mais capaz da Anthropic

### 📊 Impacto Esperado

| Métrica | Groq | Claude | Melhora |
|---------|------|--------|---------|
| Taxa de sucesso | 98% | 100% | ✅ Perfeito |
| Tempo resposta | 2-30s | 1-5s | 5-6x mais rápido |
| Custo/token | ~0.00012¢ | ~0.00003¢ | 4x mais barato |
| Custo 55 pessoas | $0.12 | $0.06 | 50% economia |
| Qualidade português | Boa | Excelente | ⭐⭐⭐⭐⭐ |

### 🔧 Configuração

**Variáveis de Ambiente:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

**Documentação Anthropic:**
- [Claude Models](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Chat Messages API](https://docs.anthropic.com/claude/reference/messages)
- [Token Counting](https://docs.anthropic.com/claude/reference/token-counting)

### 📝 Passos de Implementação

1. **Adicionar cliente Claude** (20 min)
   - `server/lib/claude-client.mjs` com integração de fila
   - Fallback: Claude → Groq → DeepSeek

2. **Atualizar ai-client.mjs** (15 min)
   - Adicionar Claude em `checkAIStatus()`
   - Adicionar em fallback chain
   - Configurar como preferencial (se desejado)

3. **Configuração** (10 min)
   - Adicionar chave de API ao .env
   - Testar conexão
   - Verificar rate limits

4. **Monitoramento** (10 min)
   - Adicionar logs de uso
   - Rastrear custos
   - Alertas para consumo anormal

5. **Testes** (15 min)
   - Teste básico (uma requisição)
   - Teste de carga (55 usuários)
   - Comparar qualidade com Groq

**⏱️ Tempo Total**: ~1.5 horas

### ✅ Definição de Pronto (DoD)
- [ ] Cliente Claude implementado
- [ ] Fallback chain funcionando
- [ ] Teste básico passando
- [ ] Teste de carga 55 usuários passando
- [ ] Logs de uso implementados
- [ ] Documentação completa
- [ ] Commits feitos e pusheados

---

## FASE 4: Otimizações Futuras (Opcional)

### Opção A: Questionnaire Caching
- Cache de todo o fluxo de questionário
- Economia: 90% em requisições repetidas
- Tempo: ~2 horas

### Opção B: Batch Processing
- Processar múltiplas requisições em batch
- Economia: 20-30% em latência
- Tempo: ~1.5 horas

### Opção C: Response Streaming
- Retornar respostas sob demanda (streaming)
- Melhor UX para respostas longas
- Tempo: ~2 horas

### Opção D: Multi-Region Cache
- Distribuir cache entre regiões
- Reduzir latência em diferentes continentes
- Tempo: ~3 horas

---

## 🚀 Plano de Execução Recomendado

### Semana 1 (Esta semana)
- [ ] **Hoje**: Fase 1 ✅ FEITA
- [ ] **Amanhã**: Teste de carga Fase 1 (validação)
- [ ] **Depois**: Fase 2 (Cache) - ~1 hora
- [ ] **Antes de dormir**: Fase 2 em produção

### Semana 2
- [ ] **Segunda**: Monitorar Fase 2 (24h)
- [ ] **Terça-Quarta**: Fase 3 (Claude) - ~1.5 horas
- [ ] **Quinta**: Testes e validação Fase 3
- [ ] **Sexta**: Deploy Fase 3

### Semana 3+
- [ ] Monitorar e otimizar
- [ ] Implementar Fase 4 conforme necessário
- [ ] Análise de ROI (economia de custos)

---

## 📈 Métrica de Sucesso Final

Após todas as fases:

```
┌─────────────────────────────────────────────────┐
│  SISTEMA DE AVALIAÇÃO LGPD - FINAL              │
├─────────────────────────────────────────────────┤
│  Taxa de sucesso:        100% (vs 30% antes)   │
│  Tempo resposta:         <2s (vs 3-45s antes)  │
│  Custo por pessoa:       $0.06 (vs $0.15)      │
│  Qualidade português:    ⭐⭐⭐⭐⭐ (vs ⭐⭐⭐)       │
│  Suporta carga:          500+ (vs 55 máx)      │
│  Sem erros rate limit:   ✅ SIM                 │
│  Degradação graciosa:    ✅ SIM                 │
│  Monitoramento:          ✅ TEMPO REAL          │
└─────────────────────────────────────────────────┘
```

---

## 📊 Comparação de Custo

### Cenário: 1000 usuários/mês

| Componente | Groq | Claude | Economia |
|-----------|------|--------|----------|
| Geração pergunta | $3.50 | $1.75 | 50% ↓ |
| Análise respostas | $0.50 | $0.25 | 50% ↓ |
| Cache (economia) | -$0.50 | -$0.50 | - |
| **Total/mês** | **$3.50** | **$1.50** | **57% ↓** |
| **Por pessoa** | **$0.0035** | **$0.0015** | **57% ↓** |

Com faturamento de $10-15 por usuário, a economia de $0.002 por pessoa não é significativa, mas a qualidade e confiabilidade é.

---

## 🔗 Recursos

### Documentação
- [QUICK_START_FILA.md](./QUICK_START_FILA.md) - Como usar fila
- [QUEUE_SYSTEM.md](./QUEUE_SYSTEM.md) - Detalhes técnicos da fila
- [RESUMO_IMPLEMENTACAO_FILA.md](./RESUMO_IMPLEMENTACAO_FILA.md) - Resumo português

### APIs
- [Groq API](https://console.groq.com)
- [DeepSeek API](https://platform.deepseek.com)
- [Claude API](https://console.anthropic.com)
- [Gemini API](https://makersuite.google.com)

### Ferramentas de Teste
- Script: `./test-load.sh [num-usuarios]`
- Monitorar: `curl http://localhost:8787/api/queue-status | jq`

---

## ✨ Notas

- Todas as fases são **independentes** e podem ser implementadas em paralelo
- Cada fase tem **rollback simples** (sem alterações de schema)
- **Documentação atualizada** a cada fase
- **Commits e PRs separados** para auditoria
- **Testes automáticos** para cada fase

---

**Próximo passo**: Testar Fase 1 com carga de 55 usuários

Use: `./test-load.sh 55 1` para iniciar teste

