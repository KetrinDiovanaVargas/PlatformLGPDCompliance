# 🛡️ Platform LGPD Compliance

[![Deploy Status](https://img.shields.io/badge/deploy-vercel-00C7B7?style=flat-square)](https://platformlgpdcompliance.com.br)
[![Node.js](https://img.shields.io/badge/node-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18+-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**Plataforma SaaS inteligente para avaliação de conformidade LGPD e análise de riscos de segurança da informação com suporte de IA.**

## Resumo

Platform LGPD Compliance é uma solução SaaS abrangente projetada para organizações que precisam validar conformidade com a **Lei Geral de Proteção de Dados (LGPD)** brasileira e identificar vulnerabilidades de segurança alinhadas com os padrões **ISO/IEC 27001**. A plataforma aproveita IA generativa para análise automatizada de respostas, dashboards interativos para visualização de riscos, matriz de confusão para validação de personas, Firebase para armazenamento seguro de dados e Vercel para implantação contínua.

---

## 📋 Estrutura do readme.md

Este repositório contém uma plataforma web completa para avaliação adaptativa de maturidade em proteção de dados. A estrutura está organizada em:

- **`src/`** — Código frontend (React + Vite + TypeScript)
  - `components/` — Componentes UI reutilizáveis
  - `pages/` — Rotas e telas principais
  - `lib/` — Utilitários e integração Firebase
  - `services/` — Serviços de autenticação e banco de dados
  
- **`server/`** — Código backend (Express.js + Node.js)
  - `routes/` — Endpoints da API
  - `lib/` — Lógica de negócio (análise de conformidade, geração de relatórios)
  - `groq/` — Integração com API Groq (IA)
  - `services/` — Serviços Firestore e histórico de sessões

- **`public/`** — Arquivos estáticos
- **`tests/`** — Testes automatizados
- **`scripts/`** — Scripts de utilitários
- **`.env.example`** — Variáveis de ambiente de exemplo

---

## ⚙️ Informações básicas

**Node.js:** >= 18.0.0  
**npm:** >= 9.0.0  
**Navegador:** Chrome 90+, Firefox 88+, Safari 14+  
**RAM:** 2GB mínimo

**Ambiente de Execução:**
- Desenvolvimento: `npm run dev` (frontend em localhost:5173, backend em localhost:8787)
- Produção: Deploy automático via Vercel ao fazer push para branch `main`

---

## 📦 Dependências

**Frontend:** React 18+, TypeScript, Tailwind CSS, Recharts, Firebase, Framer Motion, Lucide Icons, Sonner

**Backend:** Node.js 18+, Express.js, Firebase Admin SDK

**LLM APIs (Cascade - fallback automático):**
1. **Groq API** (primária) — https://console.groq.com
   - Modelo: llama-3.3-70b-versatile
   - Velocidade: ultrarrápida, ideal para produção
   
2. **Claude API** (fallback) — https://console.anthropic.com
   - Modelos: Claude 3.5 Sonnet, Claude 3 Opus
   - Qualidade: análise semântica avançada
   
3. **DeepSeek API** (fallback) — https://platform.deepseek.com
   - Modelos: DeepSeek-V3, DeepSeek-R1
   - Especialidade: raciocínio em conformidade
   
4. **Google Gemini API** (fallback final) — https://aistudio.google.com
   - Modelos: Gemini 2.0, Gemini Pro
   - Multimodal: suporte a imagens e documentos

**Versões críticas:**
- React: 18.3.1
- Vite: 5.0+
- Express: 4.18+
- Firebase: 10.4+
- Groq SDK: última versão estável
- Anthropic SDK: ^0.28.0+ (para Claude API)
- Google AI SDK: ^0.4.0+ (para Gemini API)

**Recursos de terceiros:**
- Firebase Console: https://console.firebase.google.com
- Groq API Console: https://console.groq.com
- Claude API: https://console.anthropic.com
- DeepSeek API: https://platform.deepseek.com
- Gemini API: https://aistudio.google.com
- Vercel Dashboard: https://vercel.com

---

## 🔐 Preocupações com segurança

**Riscos de Execução:** Sem riscos significativos identificados. A plataforma não modifica o sistema de arquivos além do diretório local.

**Dados Sensíveis:** Use uma conta Firebase de teste. Nunca salve dados de clientes reais. Todas as chaves de API devem estar em `.env` (nunca commitadas). 

**Segurança de Chaves de API LLM:**
- ⚠️ **Groq API:** Chave deve estar em `server/.env`, nunca em repositório público
- ⚠️ **Claude API:** Chave é sensível (acesso a modelo premium); revogue regularmente em https://console.anthropic.com
- ⚠️ **DeepSeek API:** Use token de teste em desenvolvimento; rotation recomendada mensalmente
- ⚠️ **Gemini API:** Não use em domínio público sem restricção de origem (CORS)

**Segurança Recomendada:**
- Não compartilhe credenciais Firebase, Groq, Claude, DeepSeek ou Gemini
- Revogue tokens de acesso após testes em desenvolvimento
- Use `server/serviceAccountKey.json` apenas localmente (nunca em repositório público)
- Configure CORS corretamente (verificar `server/server.mjs`)
- Monitore rate limits de API em produção (Groq: 10.000 req/min, Claude: 100.000 tokens/min)
- Implemente retry logic com backoff exponencial para falhas de API

---

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+ e npm 9+ instalados
- Conta Firebase ativa (criar em https://firebase.google.com)

**APIs LLM (obrigatórias/opcionais):**
- ✅ **Groq API** (obrigatória — primária) — https://console.groq.com
- ✅ **Claude API** (recomendada — fallback) — https://console.anthropic.com
- ⚠️ **DeepSeek API** (opcional — fallback) — https://platform.deepseek.com
- ⚠️ **Gemini API** (opcional — fallback final) — https://aistudio.google.com

Pelo menos **1 chave de API LLM é obrigatória** (Groq recomendada para produção).

### Passos de Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance.git
   cd PlatformLGPDCompliance
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure variáveis de ambiente:**
   - Copie `.env.example` para `.env.local` e `server/.env`
   - Preenchа as chaves Firebase e Groq
   - Coloque `serviceAccountKey.json` em `server/`

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   
   Frontend disponível em: http://localhost:5173
   Backend disponível em: http://localhost:8787

### Variáveis de Ambiente

**Frontend (`.env.local`):**
```env
VITE_FIREBASE_API_KEY=seu_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_project_id
VITE_FIREBASE_STORAGE_BUCKET=seu_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

**Backend (`server/.env`):**
```env
# Firebase
FIREBASE_PROJECT_ID=seu_project_id

# LLM APIs (Cascade - fallback automático)
# Obrigatória (primária)
GROQ_API_KEY=sua_chave_groq

# Fallback (recomendadas)
CLAUDE_API_KEY=sua_chave_claude
ANTHROPIC_API_KEY=sua_chave_anthropic

# Fallback (opcionais)
DEEPSEEK_API_KEY=sua_chave_deepseek
GOOGLE_AI_API_KEY=sua_chave_gemini
GOOGLE_GENERATIVE_AI_API_KEY=sua_chave_gemini_alternativa

# Configuração
PORT=8787
NODE_ENV=development

# Opcional: Modelo LLM padrão (padrão: groq)
LLM_PROVIDER=groq
```

**Notas:**
- Apenas `GROQ_API_KEY` é obrigatória
- `CLAUDE_API_KEY` é recomendada para fallback de qualidade
- `DEEPSEEK_API_KEY` e `GOOGLE_AI_API_KEY` são opcionais (fallback final)
- Sistema usa cascade automático: Groq → Claude → DeepSeek → Gemini

---

## 🧪 Teste mínimo

**Tempo estimado:** 5-10 minutos

**Pré-requisito:** Executar `npm run dev`

**Passos:**

1. Abra http://localhost:5173 no navegador
2. Clique em "Login"
3. Use as credenciais: `admin@test.com` / `test123456`
4. Clique em "Criar Questionário"
5. Preencha os campos (título, descrição, público-alvo)
6. Clique em "Gerar Link"
7. Abra o link em aba anônima/incógnita
8. Responda as perguntas e clique em "Enviar Respostas"

**Resultado Esperado:** Dashboard mostra análise com scores e gráficos, sem erros no console.

**Verificação de API LLM:**
- Abra F12 → Console → procure por logs de "LLM Provider: [GROQ|CLAUDE|DEEPSEEK|GEMINI]"
- Se Groq falhar, sistema automaticamente tenta Claude → DeepSeek → Gemini
- Logs mostram qual API foi usada: `"Usando Groq API com modelo llama-3.3-70b-versatile"`

**Dica:** Se teste falhar, verifique:
1. Variáveis `.env` estão configuradas (`GROQ_API_KEY` obrigatória)
2. Conexão com API LLM (teste: `curl https://api.groq.com/health`)
3. Rate limits não foram excedidos
4. Backend está rodando em http://localhost:8787

---

## 📋 Experimentos

Esta seção descreve como reproduzir as reivindicações principais do artigo. Cada reivindicação inclui detalhes sobre arquivos de configuração, comandos, tempo esperado e resultado esperado.

### Reivindicações #1: Questionários Adaptativos Reduzem Tempo de Resposta

**Procedimento:** Crie dois questionários (um adaptativo, um fixo). Responda ambos cronometrando o tempo total de resposta.

**Tempo esperado:** 20 minutos

**APIs LLM utilizadas:** Groq (primária) → Claude (fallback) → DeepSeek → Gemini  
**Modelo padrão:** llama-3.3-70b-versatile

**Resultado esperado:** Questionário adaptativo ~20-30% mais rápido que questionário fixo

**Arquivos relevantes:** 
- `src/components/QuestionnaireScreen.tsx` (renderiza questões adaptativas)
- `server/lib/groq-service.ts` (GroqHeadroomService.analyzeLGPDCompliance() — análise com IA)
- `server/lib/ai-client.mjs` (gerencia cascade de APIs LLM)

---

### Reivindicações #2: Análise Automatizada Identifica Riscos LGPD

**Procedimento:** Responda questionário com perfil de alto risco. Valide que scores e recomendações são gerados automaticamente no dashboard.

**Tempo esperado:** 15 minutos

**APIs LLM utilizadas:** Groq (primária) → Claude (fallback) → DeepSeek → Gemini  
**Modelo padrão:** llama-3.3-70b-versatile (Groq)  
**Processamento:** Análise semântica em cascata com fallback automático em caso de falha

**Resultado esperado:** Scores 0-100, distribuição de riscos por categoria LGPD, recomendações priorizadas

**Arquivos relevantes:**
- `server/lib/groq-service.ts` (GroqHeadroomService.analyzeLGPDCompliance())
- `server/lib/reportGenerator.ts` (ReportGenerator.classifyCompliance() — classifica em 5 níveis: Crítico/Insuficiente/Parcial/Adequado/Exemplar)
- `server/routes/analyze.mjs` (Endpoint /api/analyze — recebe respostas e retorna análise)
- `server/lib/ai-client.mjs` (gerencia cascade: Groq → Claude → DeepSeek → Gemini)

---

### Reivindicações #3: Plataforma Funciona em Novo Ambiente

**Procedimento:** Clone repositório, instale dependências, configure `.env` com chaves de API LLM (mínimo Groq ou Claude), execute teste mínimo.

**Tempo esperado:** 20 minutos

**APIs LLM obrigatórias:** Mínimo 1 (Groq recomendada para produção)  
**APIs LLM recomendadas:** Groq + Claude (para redundância)  
**Fallback automático:** Sistema tenta cascade Groq → Claude → DeepSeek → Gemini

**Resultado esperado:** Instalação sem erros, teste mínimo completado com sucesso, pelo menos 1 API LLM funcional

**Arquivos relevantes:** 
- Estrutura completa em `src/` e `server/`
- `.env.example` (template com todas as variáveis de API)
- `server/lib/ai-client.mjs` (cascade automático de APIs)

---

## 📄 Licença

MIT License © 2026 Ketrin Diovana Alves Rodrigues Vargas

Veja o arquivo [LICENSE](LICENSE) para detalhes completos.

---

## 🔗 Links Adicionais

- **Documentação LGPD:** https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd
- **Norma ISO/IEC 27001:** https://www.iso.org/standard/54534.html
- **Firebase Docs:** https://firebase.google.com/docs
- **Groq API:** https://groq.com/
- **Vercel:** https://vercel.com/

---

## 👥 Suporte

Para dúvidas ou problemas, entre em contato com: ketrin.diovana.vargas@gmail.com
