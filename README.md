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

## 🏆 Selos Considerados

Os selos considerados são: **Disponível** e **Funcional**.

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

**Backend:** Node.js 18+, Express.js, Groq API, Firebase Admin SDK

**Versões críticas:**
- React: 18.3.1
- Vite: 5.0+
- Express: 4.18+
- Firebase: 10.4+
- Groq SDK: última versão estável

**Recursos de terceiros:**
- Firebase Console: https://console.firebase.google.com
- Groq API Console: https://console.groq.com
- Vercel Dashboard: https://vercel.com

---

## 🔐 Preocupações com segurança

**Riscos de Execução:** Sem riscos significativos identificados. A plataforma não modifica o sistema de arquivos além do diretório local.

**Dados Sensíveis:** Use uma conta Firebase de teste. Nunca salve dados de clientes reais. Todas as chaves de API devem estar em `.env` (nunca commitadas). 

**Segurança Recomendada:**
- Não compartilhe credenciais Firebase
- Revogue tokens de acesso após uso
- Use `server/serviceAccountKey.json` apenas localmente (nunca em repositório público)
- Configure CORS corretamente (verificar `server/server.mjs`)

---

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+ e npm 9+ instalados
- Conta Firebase ativa (criar em https://firebase.google.com)
- Chave API Groq (obter em https://console.groq.com)

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
GROQ_API_KEY=sua_chave_groq
FIREBASE_PROJECT_ID=seu_project_id
PORT=8787
NODE_ENV=development
```

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

---

## 📋 Experimentos

Esta seção descreve como reproduzir as reivindicações principais do artigo. Cada reivindicação inclui detalhes sobre arquivos de configuração, comandos, tempo esperado e resultado esperado.

### Reivindicações #1: Questionários Adaptativos Reduzem Tempo de Resposta

**Procedimento:** Crie dois questionários (um adaptativo, um fixo). Responda ambos cronometrando o tempo total de resposta.

**Tempo esperado:** 20 minutos

**Resultado esperado:** Questionário adaptativo ~20-30% mais rápido que questionário fixo

**Arquivos relevantes:** 
- `src/components/QuestionnaireScreen.tsx` (renderiza questões adaptativas)
- `server/lib/groq-service.ts` (GroqHeadroomService.analyzeLGPDCompliance() — análise com IA)

---

### Reivindicações #2: Análise Automatizada Identifica Riscos LGPD

**Procedimento:** Responda questionário com perfil de alto risco. Valide que scores e recomendações são gerados automaticamente no dashboard.

**Tempo esperado:** 15 minutos

**Resultado esperado:** Scores 0-100, distribuição de riscos por categoria LGPD, recomendações priorizadas

**Arquivos relevantes:**
- `server/lib/groq-service.ts` (GroqHeadroomService.analyzeLGPDCompliance())
- `server/lib/reportGenerator.ts` (ReportGenerator.classifyCompliance() — classifica em 5 níveis)
- `server/routes/analyze.mjs` (Endpoint /api/analyze — recebe respostas e retorna análise)

---

### Reivindicações #3: Plataforma Funciona em Novo Ambiente

**Procedimento:** Clone repositório, instale dependências, execute teste mínimo.

**Tempo esperado:** 20 minutos

**Resultado esperado:** Instalação sem erros, teste mínimo completado com sucesso

**Arquivos relevantes:** Estrutura completa em `src/` e `server/`

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
