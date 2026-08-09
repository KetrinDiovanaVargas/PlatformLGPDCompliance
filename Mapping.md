# 🎯 Mapeamento de Reivindicações — Código-Fonte

Documento que mapeia cada reivindicação do artigo aos arquivos e funções correspondentes no código-fonte. Facilita identificar a implementação de cada claim no repositório.

---

## Reivindicação #1: Questionários Adaptativos Reduzem Tempo de Resposta

**Descrição do Claim:**  
Questionários com perguntas adaptativas (ajustadas dinamicamente baseadas em respostas anteriores) reduzem o tempo de resposta em aproximadamente 20-30% comparado a questionários com perguntas fixas.

### 📂 Arquivos Relevantes

#### 1. **Componente Frontend (UI)**
- **Arquivo:** `src/components/QuestionnaireScreen.tsx` (linhas 70-150)
- **Função/Componente:** `QuestionnaireScreen` (React Component)
- **Responsabilidade:** Renderiza a interface do questionário com perguntas dinâmicas
- **JSDoc:** ✅ Documentado (linhas 1-30)

**Principais Features:**
- Renderização de 4 estágios adaptativos
- Progresso visual com barra de progresso
- Navegação entre questões
- Validação de campos obrigatórios
- Chamadas para IA a cada resposta (para próxima pergunta adaptativa)

#### 2. **Lógica de Adaptação (IA)**
- **Arquivo:** `server/lib/groq-service.ts` (linhas 40-85)
- **Classe/Método:** `GroqHeadroomService.analyzeLGPDCompliance()`
- **Responsabilidade:** Analisa respostas e gera recomendações de próximas perguntas
- **JSDoc:** ✅ Documentado (linhas 1-50)

**Lógica:**
- Recebe respostas do usuário
- Comprime dados com Headroom (otimização de tokens)
- Chama cascade de LLMs (Groq → Claude → DeepSeek → Gemini)
- Retorna análise com scores, riscos e recomendações
- Baseado em resposta, seleciona próximas perguntas relevantes

#### 3. **Orquestração de APIs (Cascade)**
- **Arquivo:** `server/lib/ai-client.mjs` (linhas 60-200)
- **Função:** `chatCompletion(messages, options)`
- **Responsabilidade:** Gerencia cascade automático de LLMs
- **JSDoc:** ✅ Documentado (linhas 1-45)

**Cascade Implementado:**
```
Groq (primária, ultrarrápida)
  ↓ (se falhar por rate limit/timeout)
Claude (recomendada, alta qualidade)
  ↓ (se falhar)
DeepSeek (fallback)
  ↓ (se falhar)
Gemini (fallback final)
```

### 🧪 Como Testar

1. **Setup:**
   ```bash
   npm install
   npm run dev
   ```

2. **Teste Manual:**
   - Abrir `http://localhost:5173`
   - Login: `admin@gmail.com` / `Lgpd2026PL@TFORM`
   - Criar 2 questionários: 1 com perguntas fixas, 1 com adaptativas
   - Cronometrar tempo de resposta em cada um
   - Resultado esperado: Adaptativo ~20-30% mais rápido

3. **Logs para Debug:**
   - Abrir F12 → Console
   - Procurar por: `"LLM Provider: [GROQ|CLAUDE|DEEPSEEK|GEMINI]"`
   - Tempo de resposta será registrado em logs do servidor

---

## Reivindicação #2: Análise Automatizada Identifica Riscos LGPD

**Descrição do Claim:**  
A plataforma identifica automaticamente riscos LGPD nas respostas do usuário, gerando scores (0-100), classificação de risco (Crítico/Alto/Médio/Baixo) e recomendações priorizadas.

### 📂 Arquivos Relevantes

#### 1. **Análise Semântica com IA**
- **Arquivo:** `server/lib/groq-service.ts` (linhas 40-85)
- **Método:** `GroqHeadroomService.analyzeLGPDCompliance()`
- **Responsabilidade:** Processa respostas e gera análise de risco
- **JSDoc:** ✅ Documentado (linhas 23-50)

**Análise Realizada:**
- Recebe respostas estruturadas
- Comprime dados com Headroom (35% redução de tokens)
- Envia prompt especializado em LGPD para LLM
- Retorna JSON com:
  - `score` (0-100): nível de conformidade geral
  - `riskLevel` (Crítico|Alto|Médio|Baixo): classificação de risco
  - `criticalAreas` (array): áreas mais críticas
  - `recommendations` (array): ações prioritárias com timeline

#### 2. **Classificação de Maturidade**
- **Arquivo:** `server/lib/reportGenerator.ts` (linhas 60-100)
- **Método:** `ReportGenerator.classifyCompliance(score)`
- **Responsabilidade:** Mapeia score 0-100 para nível de maturidade
- **JSDoc:** ✅ Documentado (linhas 30-50)

**Classificação (5 Níveis):**
```
Score 0-20:   Crítico     (não está conforme)
Score 21-40:  Insuficiente (precisa melhorias urgentes)
Score 41-60:  Parcial     (conformidade parcial)
Score 61-85:  Adequado    (conforme com pontos de melhoria)
Score 86-100: Exemplar    (melhor prática LGPD)
```

#### 3. **Geração de Relatório**
- **Arquivo:** `server/lib/reportGenerator.ts` (linhas 40-90)
- **Classe:** `ReportGenerator`
- **Método:** `generate(sessionId, userId, stages)`
- **Responsabilidade:** Consolida análises dos 4 estágios em relatório
- **JSDoc:** ✅ Documentado (linhas 44-50)

**Relatório Consolidado Inclui:**
- Score geral (média dos 4 estágios)
- Nível de conformidade (5 níveis)
- Top 10 problemas críticos (com frequência)
- Top 10 pontos fortes (com frequência)
- Recomendações priorizadas (Alta/Média/Baixa)
- Resumo executivo

#### 4. **Endpoint HTTP**
- **Arquivo:** `server/routes/analyze.mjs` (linhas 100-200)
- **Endpoint:** `POST /api/analyze`
- **Responsabilidade:** Recebe respostas, retorna análise
- **JSDoc:** ✅ Documentado (linhas 1-40)

**Formato da Requisição:**
```json
{
  "sessionId": "sess_001",
  "userId": "user_123",
  "stageResponses": [
    { "stage": 0, "responses": { "q1": "resposta1" } },
    { "stage": 1, "responses": { "q2": "resposta2" } }
  ],
  "assessmentId": "quiz_001"
}
```

**Formato da Resposta:**
```json
{
  "success": true,
  "analysis": {
    "score": 75,
    "riskLevel": "Médio",
    "criticalAreas": ["Data Storage", "Consent"],
    "recommendations": [
      {
        "priority": 1,
        "action": "Implementar encriptação em repouso",
        "estimatedDaysToImplement": 30
      }
    ],
    "summary": "Conformidade parcial com necessidade de melhorias urgentes em armazenamento de dados"
  },
  "metadata": {
    "model": "groq (llama-3.3-70b-versatile)",
    "timestamp": "2026-08-08T10:30:45Z"
  }
}
```

### 🧪 Como Testar

1. **Setup:**
   ```bash
   npm install
   npm run dev
   ```

2. **Teste Manual:**
   - Abrir `http://localhost:5173`
   - Login: `admin@test.com` / `test123456`
   - Criar questionário
   - Responder com perfil de ALTO RISCO (ex: "não", "não conforme", etc)
   - Enviando respostas → Dashboard mostra scores e análise

3. **Teste API Diretamente:**
   ```bash
   curl -X POST http://localhost:8787/api/analyze \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test_001",
       "userId": "admin@test.com",
       "stageResponses": [
         { "stage": 0, "responses": { "q1": "não", "q2": "não" } }
       ]
     }'
   ```

4. **Resultado Esperado:**
   - Status 200 OK
   - Score 0-100 retornado
   - Nível de risco classificado
   - Recomendações priorizadas

---

## Reivindicação #3: Plataforma Funciona em Novo Ambiente

**Descrição do Claim:**  
A plataforma é facilmente reproduzível em um novo ambiente (máquina virtual, container, etc.) seguindo apenas as instruções do README.md e instalando as dependências.

### 📂 Arquivos Relevantes

#### 1. **Configuração de Ambiente**
- **Arquivo:** `.env.example`
- **Responsabilidade:** Template das variáveis de ambiente necessárias
- **Documentação:** ✅ Presente no README.md (seção Instalação)

**Variáveis Requeridas:**
```env
# Firebase (obrigatório)
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx

# LLM APIs (mínimo 1 obrigatória)
GROQ_API_KEY=xxx              # Obrigatória
CLAUDE_API_KEY=xxx            # Recomendada
DEEPSEEK_API_KEY=xxx          # Opcional
GOOGLE_AI_API_KEY=xxx         # Opcional
```

#### 2. **Instalação de Dependências**
- **Arquivo:** `package.json`
- **Frontend:** React 18+, Vite, TypeScript, Tailwind, Firebase
- **Backend:** Express.js, Node 18+, Groq SDK, Firebase Admin SDK

**Instalação:**
```bash
npm install
npm run build
```

#### 3. **Execução**
- **Frontend:** `npm run dev` (localhost:5173)
- **Backend:** Integrado, escuta em localhost:8787
- **Produção:** Deploy automático via Vercel ao fazer push em `main`

#### 4. **Verificação de Reprodutibilidade**
- **Arquivo:** README.md (seção "Teste mínimo")
- **Passos:** 8 passos documentados para verificar funcionamento
- **Tempo esperado:** 5-10 minutos

**Teste Mínimo:**
1. Abrir http://localhost:5173
2. Login com admin@gmail.com / Lgpd2026PL@TFORM
3. Criar questionário
4. Gerar link
5. Responder questionário (aba anônima)
6. Verificar dashboard com análise
7. Sem erros no console

### 📂 Arquivos de Suporte

- **`server/server.mjs`** — Configuração Express (CORS, ports)
- **`vite.config.ts`** — Configuração Vite (proxy /api)
- **`tsconfig.json`** — Configuração TypeScript
- **`package.json`** — Dependências e scripts

### 🧪 Como Testar Reprodutibilidade

1. **Em VM/Container novo:**
   ```bash
   git clone https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance.git
   cd PlatformLGPDCompliance
   npm install
   cp .env.example server/.env
   # Editar server/.env com chaves de API
   npm run dev
   ```

2. **Verificar:**
   - Frontend rodando em http://localhost:5173 ✅
   - Backend rodando em http://localhost:8787 ✅
   - Sem erros de dependências ✅
   - Teste mínimo funciona ✅

3. **Resultado Esperado:**
   - Instalação sem erros
   - Aplicação inicia
   - Dashboard carrega
   - Análise é gerada

---

## 📊 Resumo de Mapeamento

| Reivindicação | Componentes | Arquivos | Métodos | JSDoc | Status |
|---|---|---|---|---|---|
| #1 - Adaptativo | Frontend, IA, Cascade | 3 arquivos | `QuestionnaireScreen`, `analyzeLGPDCompliance`, `chatCompletion` | ✅ | ✅ |
| #2 - Análise | Groq, Generator, API | 4 arquivos | `analyzeLGPDCompliance`, `classifyCompliance`, `generate`, POST /api/analyze | ✅ | ✅ |
| #3 - Reprodutível | Config, Install, Verify | Full stack | npm install, npm run dev | ✅ | ✅ |

---


