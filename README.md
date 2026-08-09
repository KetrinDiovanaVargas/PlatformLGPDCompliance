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
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** 9+ (vem com Node.js)
- **Git** ([Download](https://git-scm.com/))
- Conta **Firebase** ([Criar aqui](https://firebase.google.com/))
- Chave de API **Groq** ([Obter aqui](https://console.groq.com/))

**APIs LLM (obrigatórias/opcionais):**
- ✅ **Groq API** (obrigatória — primária) — https://console.groq.com
- ✅ **Claude API** (recomendada — fallback) — https://console.anthropic.com
- ⚠️ **DeepSeek API** (opcional — fallback) — https://platform.deepseek.com
- ⚠️ **Gemini API** (opcional — fallback final) — https://aistudio.google.com

Pelo menos **1 chave de API LLM é obrigatória** (Groq recomendada para produção).

### Passos de Instalação

---

### 1️⃣ Clone o Repositório

```bash
git clone https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance.git
cd PlatformLGPDCompliance
```

---

### 2️⃣ Instale as Dependências

```bash
npm install
```

---

### 3️⃣ Configure as Variáveis de Ambiente

#### **Frontend** (`.env.local`)

```bash
# Copie o template
cp .env.local.example server/.env
```

Edite `.env.local` e altere o nome para `.env` e utilize o código de exemplo com suas credenciais:

```env
VITE_FIREBASE_API_KEY=sua-chave-api-aqui
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-bucket.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
VITE_FIREBASE_APP_ID=seu-app-id
```

**Como obter:**
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto
3. Settings → Project Settings
4. Copie os valores da seção "Your apps"

---

#### **Backend** (`server/.env`)

```bash
# Copie o template
cp server/.env.example server/.env
```

Edite `server/.env` e altere o nome para `.env` e utilize o código de exemplo com suas credenciais:

```env
GROQ_API_KEY=sua-groq-key-aqui
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=8787
NODE_ENV=development
```

---

#### **Firebase Service Account** (`server/serviceAccountKey.json`)

```bash
# Copie o template
cp server/serviceAccountKey.example.json server/serviceAccountKey.json
```

Edite `server/serviceAccountKey.json` e altere o nome para `serviceAccountKey.json` e utilize o código de exemplo com suas credenciais:


**Como obter:**
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto
3. Settings → Service Accounts
4. Clique em **"Generate New Private Key"**
5. Salve o arquivo JSON baixado
6. Copie o conteúdo completo para `server/serviceAccountKey.json`

---

### 4️⃣ Rode o Projeto

```bash
npm run dev
```

Você verá:
```
[0] ➜  Local:   http://localhost:5173/
[1] 🚀 Backend rodando na porta 8787
```

**Notas:**
- Apenas `GROQ_API_KEY` é obrigatória
- `CLAUDE_API_KEY` é recomendada para fallback de qualidade
- `DEEPSEEK_API_KEY` e `GOOGLE_AI_API_KEY` são opcionais (fallback final)
- Sistema usa cascade automático: Groq → Claude → DeepSeek → Gemini

---

## 🧪 Teste Rápido (5-10 minutos)

1. **Abra** `http://localhost:5173`
2. **Login de teste:**
   - Email: `admin@gmail.com`
   - Senha: `Lgpd2026PL@TFORM`
3. **Crie uma avaliação** clicando em "Nova Avaliação"
4. **Convide respondentes** usando o link gerado
5. **Visualize análises** no dashboard

---

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

## Reivindicação #1: Sistema Adapta Perguntas Baseado em Respostas

**Tempo:** 15 min | **Pré-requisito:** `npm run dev` rodando

---

## PASSOS RÁPIDOS

### 1. Login no Admin
```
http://localhost:5173
Email: admin@gmail.com
Senha: Lgpd2026PL@TFORM
```

### 2. Criar Nova Avaliação
- Clique "+ Nova Avaliação"
- Nome: "Teste LGPD"
- Tipo: "Diagnóstico"
- Provedor: "Claude" (ou o que configurou)
- Clique "Publicar"

```markdown
 ⚠️ IMPORTANTE: Selecione o provedor que foi configurado no arquivo e .env
```

### 3. Copiar Link
- Vá em "Minhas Avaliações"
- Clique "Copiar link"

### 4. Responder em Aba Anônima
- Abra nova aba incógnita
- Cole o link
- Clique "Iniciar Avaliação"
- **Responda as perguntas** (cada resposta muda a próxima pergunta)
- Clique "Enviar"

### 5. Ver Resultado
```
✅ Você recebe:
   - Score de conformidade (ex: 58/100)
   - Fragilidades detectadas
   - Recomendações priorizadas
```

### 6. Verificar Dashboard
- Volte à aba admin
- Recarregue (F5)
- KPIs devem atualizar (resposta contabilizada)

---

## ✅ Validação

- [x] Perguntas mudavam conforme respostas?
- [x] Sistema gerou score e fragilidades?
- [x] LLM funcionou (Claude/Groq/etc)?
- [x] Dashboard atualizou?

**Se tudo Sim → Reivindicação validada! 🏆**

---

## Reivindicação #2: Análise Automatizada Identifica Riscos

**Mesmo experimento acima, mas observe:**
- Score diferente por tipo de resposta
- Fragilidades específicas (F1, F3, F8, etc)
- Recomendações personalizadas

**Validação:** Dois cenários = resultados diferentes ✅

---

## Reivindicação #3: Plataforma Funciona em Novo Ambiente

**Apenas rode:**
```bash
npm install
npm run dev
# Siga os passos 1-6 acima sem erros
```

**Validação:** Tudo funciona sem erro = ✅

---


## 📄 Licença

MIT License © 2026 Ketrin Diovana Alves Rodrigues Vargas

Veja o arquivo [LICENSE](LICENSE) para detalhes completos.

---

## 🔗 Links Adicionais

- **Documentação LGPD:** https://www.gov.br/mds/pt-br/acesso-a-informacao/governanca/integridade/campanhas/lgpd
- **Norma ISO/IEC 27001:** https://www.iso.org/standard/54534.html
- **Firebase Docs:** https://firebase.google.com/docs
- **Groq API:** https://groq.com/
- **Claude API:** https://platform.claude.com/docs/en/api/overview
- **Gemini API:** https://ai.google.dev/gemini-api/docs?hl=pt-br
- **Vercel:** https://vercel.com/

---

## 👥 Suporte

Para dúvidas ou problemas, entre em contato com: ketrin.diovana.vargas@gmail.com
