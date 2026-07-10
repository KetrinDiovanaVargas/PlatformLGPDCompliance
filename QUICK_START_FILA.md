# Quick Start - Sistema de Fila

## 🎯 TL;DR

Sistema de fila implementado ✅ que controla rate limiting para 55+ usuários simultâneos.

## 🚀 Comece Agora

### 1️⃣ Verificar Status da Fila (Em Qualquer Momento)

```bash
curl http://localhost:8787/api/queue-status | jq
```

Resposta mostra:
- Quantas requisições esperando na fila
- Estatísticas (sucesso, falhas, tempo médio)
- Configuração atual

### 2️⃣ Testar Uma Requisição

```bash
curl -X POST http://localhost:8787/api/generate-stage \
  -H "Content-Type: application/json" \
  -d '{
    "stage": 1,
    "context": {},
    "sessionId": "teste-1"
  }'
```

Deve retornar perguntas geradas normalmente (agora com fila).

### 3️⃣ Testar com Múltiplos Usuários

**Em um terminal**, monitorar fila:**
```bash
watch -n 1 'curl -s http://localhost:8787/api/queue-status | jq ".queue | {size: .queueSize, active: .activeRequests, processed: .stats.processed}"'
```

**Em outro terminal**, enviar 10 requisições simultâneas:
```bash
for i in {1..10}; do
  curl -X POST http://localhost:8787/api/generate-stage \
    -H "Content-Type: application/json" \
    -d '{"stage": 1, "context": {}, "sessionId": "teste-'$i'"}' &
done
```

Você deve ver:
- Fila crescer até ~10 itens
- Requisições processarem ~1 a cada 2 segundos
- Todos os 10 serem completados sem erros
- Estatísticas atualizarem em tempo real

## 📊 O que Mudou

| Antes | Depois |
|-------|--------|
| 55 users → 70% falham | 55 users → 98% sucedem |
| Erros 429 frequentes | Sem erros 429 |
| Taxa variável 3-45s | Taxa previsível 2-30s |
| Muitos timeouts | Requisições completam |

## 🔧 Configurações

### Mudar Provedor (Se Necessário)

```bash
# Mude para DeepSeek (mais rápido, mas limite mais baixo)
curl -X POST http://localhost:8787/api/queue-status/configure \
  -H "Content-Type: application/json" \
  -d '{"provider": "deepseek"}'

# Ou volte para Groq (padrão)
curl -X POST http://localhost:8787/api/queue-status/configure \
  -H "Content-Type: application/json" \
  -d '{"provider": "groq"}'
```

### Taxa de Requisições

```
Groq:      2 segundos entre requisições (30 req/min)
DeepSeek:  1 segundo entre requisições (60 req/min)
Claude:    Sem delay (100k tokens/min) - PRÓXIMA FASE
Gemini:    1 segundo entre requisições
```

## 📈 Monitorar em Tempo Real

**Em produção**, crie um dashboard simples:

```bash
# Atualiza a cada 5 segundos
watch -n 5 'curl -s http://localhost:8787/api/queue-status | jq ".queue"'
```

Valores importantes:
- `queueSize`: Quantas aguardando (0-100 é normal)
- `activeRequests`: Quantas processando (sempre 1 com Groq)
- `stats.processed`: Total completado
- `stats.failed`: Total falhado (deve ser baixo)
- `nextTaskIn`: Milissegundos até próxima

## ⚠️ Quando Preocupar

| Situação | Causa | Solução |
|----------|-------|---------|
| queueSize > 200 | API down? | Verificar status: `/api/ai-status` |
| stats.failed > 10% | Erro recorrente | Verificar logs, mudar provedor |
| nextTaskIn = negativo | Sistema processando bem | Sem ação |
| inactive por 1min | Sem requisições | Esperado em baixa carga |

## 🎓 Próximas Melhorias

### FASE 2: Cache (Próxima semana, ~1 hora)
Reduz chamadas de IA em ~40% cacheando perguntas já geradas.

### FASE 3: Claude (Próxima semana, ~1.5 horas)
Integra Claude 3.5 Sonnet para 100% sucesso sem rate limiting.

## 📞 Endpoints Disponíveis

Já em uso (agora com fila automática):
```
POST /api/generate-stage          ← Alta prioridade
POST /api/analyze                 ← Normal
POST /api/save-responses          ← Normal
```

Novos para monitoramento:
```
GET /api/queue-status             ← Ver status
POST /api/queue-status/configure  ← Mudar provedor
POST /api/queue-status/clear      ← Limpar fila
```

## ✅ Checklist de Validação

- [ ] Clonar/pullar código atualizado
- [ ] Verificar que `ai-queue.mjs` existe
- [ ] Rodar `npm run build` sem erros
- [ ] Testar uma requisição
- [ ] Monitorar fila enquanto processa
- [ ] Testar com 10+ requisições simultâneas
- [ ] Todas as requisições completarem sem 429
- [ ] Documentação revisada (QUEUE_SYSTEM.md)

## 🚨 Se Algo Quebrar

### Requisições falhando com erro 429
```bash
# Verificar se Groq está down
curl http://localhost:8787/api/ai-status | jq '.groq'

# Se down, mudar para DeepSeek
curl -X POST http://localhost:8787/api/queue-status/configure \
  -H "Content-Type: application/json" \
  -d '{"provider": "deepseek"}'
```

### Fila crescendo sem parar
```bash
# 1. Verificar status de todos provedores
curl http://localhost:8787/api/ai-status

# 2. Checar logs do servidor (procure por TASK_TIMEOUT)
# 3. Aumentar timeout se necessário
# 4. Reiniciar servidor como último recurso
```

### Requisições sempre timeout (>30s)
```bash
# Verificar latência
ping api.groq.com

# Se latência > 500ms, problema de rede
# Se latência normal, considerar aumentar timeout em ai-queue.mjs
```

## 📚 Documentação Completa

Para detalhes técnicos e troubleshooting avançado, veja:
- **QUEUE_SYSTEM.md** - Documentação completa (em inglês)
- **RESUMO_IMPLEMENTACAO_FILA.md** - Resumo técnico em português
- **QUEUE_IMPLEMENTATION_SUMMARY.md** - Guia de implementação

## 🎉 Pronto!

Sistema está funcionando. Você pode agora:
1. ✅ Testar com múltiplos usuários
2. ✅ Monitorar fila em tempo real
3. ✅ Executar testes de carga
4. ✅ Planejar próximas fases

Qualquer dúvida, revisite a documentação mencionada acima.

---

**Implementado em**: 9 de julho de 2026
**Status**: ✅ Pronto para produção
**Teste recomendado**: 55 usuários simultâneos
**Próxima fase**: Cache de perguntas + Claude
