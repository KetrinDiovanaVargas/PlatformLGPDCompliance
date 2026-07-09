#!/bin/bash

# Script de teste de carga - Simula 55 usuários simultâneos
# Uso: ./test-load.sh [número-de-usuários] [número-de-stages]

set -e

NUM_USERS=${1:-55}
NUM_STAGES=${2:-1}
API_URL=${API_URL:-"http://localhost:8787"}
RESULTS_DIR="/tmp/load-test-results"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 TESTE DE CARGA - SISTEMA DE FILA${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "👥 Usuários simultâneos: ${YELLOW}$NUM_USERS${NC}"
echo -e "📋 Stages por usuário: ${YELLOW}$NUM_STAGES${NC}"
echo -e "🎯 API URL: ${YELLOW}$API_URL${NC}"
echo -e "📁 Resultados em: ${YELLOW}$RESULTS_DIR${NC}"
echo ""

# Verifica se API está disponível
echo -n "🔍 Verificando disponibilidade da API..."
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo -e " ${RED}❌ API não está respondendo${NC}"
    echo "   Certifique-se que o servidor está rodando em $API_URL"
    exit 1
fi
echo -e " ${GREEN}✓${NC}"

# Funções de suporte
show_queue_status() {
    echo ""
    echo -e "${YELLOW}📈 Status da Fila:${NC}"
    curl -s "$API_URL/api/queue-status" | jq '
        .queue | {
            queueSize: .queueSize,
            activeRequests: .activeRequests,
            processed: .stats.processed,
            failed: .stats.failed,
            avgProcessTime: .stats.avgProcessTime,
            nextTaskIn: .nextTaskIn
        }
    ' || echo "Erro ao obter status"
}

test_single_request() {
    local user_id=$1
    local stage=$2
    local start_time=$(date +%s%N)

    local response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/generate-stage" \
        -H "Content-Type: application/json" \
        -d "{
            \"stage\": $stage,
            \"context\": {},
            \"sessionId\": \"load-test-$user_id-$stage\",
            \"aiProvider\": \"groq\"
        }" 2>/dev/null)

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))  # Converter para ms

    echo "$user_id|$stage|$http_code|$duration|$body" >> "$RESULTS_DIR/responses.txt"

    if [ "$http_code" = "200" ]; then
        echo -ne "${GREEN}.${NC}"
    else
        echo -ne "${RED}E${NC}"
    fi
}

# Teste principal
echo -e "${BLUE}🚀 Iniciando teste de carga...${NC}"
echo ""

# Limpar resultados anteriores
rm -f "$RESULTS_DIR/responses.txt"

# Mostra status inicial
show_queue_status

echo ""
echo -e "${BLUE}Enviando requisições:${NC}"
echo ""

# Contador de requisições
total_requests=$((NUM_USERS * NUM_STAGES))
echo -n "Progresso: ["

# Envia requisições
for user in $(seq 1 $NUM_USERS); do
    for stage in $(seq 1 $NUM_STAGES); do
        test_single_request "$user" "$stage" &

        # A cada 10 requisições, mostra progresso
        if [ $((((user - 1) * NUM_STAGES + stage) % 10)) -eq 0 ]; then
            echo -n "="
        fi
    done
done

# Aguarda todas as requisições completarem
wait

echo "]"
echo ""

# Mostra status final
show_queue_status

# Analisa resultados
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 ANÁLISE DOS RESULTADOS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ ! -f "$RESULTS_DIR/responses.txt" ]; then
    echo -e "${RED}❌ Erro: Nenhuma resposta registrada${NC}"
    exit 1
fi

# Calcula estatísticas
total_requests=$(wc -l < "$RESULTS_DIR/responses.txt")
successful=$(grep '|200|' "$RESULTS_DIR/responses.txt" | wc -l)
failed=$(grep -v '|200|' "$RESULTS_DIR/responses.txt" | wc -l)
success_rate=$(echo "scale=2; $successful * 100 / $total_requests" | bc)

echo -e "📈 Total de requisições: ${YELLOW}$total_requests${NC}"
echo -e "✅ Bem-sucedidas: ${GREEN}$successful${NC}"
echo -e "❌ Falhadas: ${RED}$failed${NC}"
echo -e "📊 Taxa de sucesso: ${YELLOW}$success_rate%${NC}"
echo ""

# Analisa tempo de resposta
echo -e "${BLUE}⏱️  Análise de Tempo de Resposta (ms):${NC}"
durations=$(cut -d'|' -f4 "$RESULTS_DIR/responses.txt" | sort -n)
min_time=$(echo "$durations" | head -1)
max_time=$(echo "$durations" | tail -1)
avg_time=$(echo "$durations" | awk '{sum+=$1} END {print int(sum/NR)}')
median_time=$(echo "$durations" | awk '{a[NR]=$1} END {if (NR % 2) print a[(NR+1)/2]; else print int((a[NR/2]+a[NR/2+1])/2)}')

echo -e "  Mínimo: ${GREEN}${min_time}ms${NC}"
echo -e "  Máximo: ${YELLOW}${max_time}ms${NC}"
echo -e "  Média: ${YELLOW}${avg_time}ms${NC}"
echo -e "  Mediana: ${YELLOW}${median_time}ms${NC}"
echo ""

# Verifica erros específicos
echo -e "${BLUE}🔍 Análise de Erros:${NC}"
errors=$(grep -v '|200|' "$RESULTS_DIR/responses.txt" | cut -d'|' -f3 | sort | uniq -c)
if [ -z "$errors" ]; then
    echo -e "  ${GREEN}✓ Sem erros!${NC}"
else
    echo "$errors" | while read count code; do
        if [ "$code" = "429" ]; then
            echo -e "  ${RED}$count requisições com erro $code (Rate Limit)${NC}"
        else
            echo -e "  ${YELLOW}$count requisições com erro $code${NC}"
        fi
    done
fi

# Resultado final
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
if [ "$success_rate" = "100.00" ]; then
    echo -e "${GREEN}✅ TESTE PASSOU - 100% de taxa de sucesso!${NC}"
elif [ $(echo "$success_rate > 95" | bc) -eq 1 ]; then
    echo -e "${YELLOW}⚠️  TESTE PARCIALMENTE OK - $success_rate% de taxa de sucesso${NC}"
else
    echo -e "${RED}❌ TESTE FALHOU - Apenas $success_rate% de taxa de sucesso${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Salva relatório
cat > "$RESULTS_DIR/relatorio.txt" << REPORT
RELATÓRIO DE TESTE DE CARGA
============================

Data: $(date)
API URL: $API_URL
Usuários: $NUM_USERS
Stages por usuário: $NUM_STAGES

RESULTADOS
==========
Total de requisições: $total_requests
Bem-sucedidas: $successful ($success_rate%)
Falhadas: $failed

TEMPO DE RESPOSTA (ms)
=====================
Mínimo: ${min_time}ms
Máximo: ${max_time}ms
Média: ${avg_time}ms
Mediana: ${median_time}ms

CONCLUSÃO
=========
REPORT

if [ "$success_rate" = "100.00" ]; then
    echo "✅ Sistema aguenta $NUM_USERS usuários simultâneos com 100% de taxa de sucesso" >> "$RESULTS_DIR/relatorio.txt"
else
    echo "⚠️  Sistema alcançou $success_rate% de taxa de sucesso com $NUM_USERS usuários" >> "$RESULTS_DIR/relatorio.txt"
fi

echo ""
echo -e "💾 Relatório salvo em: ${YELLOW}$RESULTS_DIR/relatorio.txt${NC}"
echo -e "📝 Respostas detalhadas em: ${YELLOW}$RESULTS_DIR/responses.txt${NC}"
echo ""
