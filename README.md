# 🛡️ Platform LGPD Compliance

[![Deploy Status](https://img.shields.io/badge/deploy-vercel-00C7B7?style=flat-square)](https://platformlgpdcompliance.com.br)
[![Node.js](https://img.shields.io/badge/node-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18+-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/license-proprietary-orange?style=flat-square)](LICENSE)

**Plataforma inteligente para avaliação de conformidade LGPD e análise de risco em segurança da informação com IA**.

---

## 📋 Visão Geral

Platform LGPD Compliance é uma solução SaaS desenvolvida para organizações que precisam validar sua conformidade com a **Lei Geral de Proteção de Dados (LGPD)** e identificar fragilidades em segurança da informação alinhadas com **ISO/IEC 27001**.

A plataforma utiliza:
- 🤖 **IA Generativa** para análise automatizada de respostas
- 📊 **Dashboards Interativos** para visualização de risco
- 📈 **Matriz de Confusão** para validação de personas
- 🔐 **Firebase** para armazenamento seguro
- ⚡ **Vercel** para deploy contínuo

---

## 🎯 Funcionalidades Principais

### 🎯 Avaliação Adaptativa
- Questionários dinâmicos em 4 estágios
- Perguntas ajustadas ao perfil do respondente
- Cobertura de 5 eixos de fragilidade LGPD:
  - Armazenamento de dados
  - Compartilhamento
  - Consentimento
  - Retenção
  - Monitoramento

### 📊 Dashboard Executivo
- **4 KPIs** de conformidade em tempo real
- Gráficos interativos (Recharts)
- Análise de risco por eixo
- Distribuição de maturidade
- Conformidade por tipo

### 🔍 Matriz de Confusão
- Comparação Esperado vs Detectado
- Cálculo automático de métricas:
  - Acurácia, Precisão, Recall
  - F1-Score, Especificidade
- Validação de personas (P01-P50 + A01-A05)

### 📄 Relatórios
- Exportação em PDF
- Plano de ação de 5 semanas
- Recomendações personalizadas
- Análise estratégica

### 👥 Gestão de Acesso
- **MASTER**: Controle total, gerencia admins
- **ADMIN**: Cria avaliações, visualiza resultados
- **USUÁRIO**: Responde formulários

---

## 🏗️ Arquitetura

```
frontend (React + Vite)
    ↓
    ├── src/
    │   ├── components/     (UI components)
    │   ├── pages/          (Routes)
    │   ├── lib/            (Utilities, Firebase)
    │   └── styles/         (Tailwind)
    ↓
API Backend (Express.js)
    ├── server/routes/      (API endpoints)
    ├── server/lib/         (Business logic)
    ├── server/groq/        (IA integration)
    └── server/services/    (Firebase, Auth)
    ↓
Firebase (Firestore + Auth)
    └── Cloud Storage
```

**Stack Completo:**
| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Gráficos | Recharts |
| Backend | Express.js (Node.js) |
| IA | Groq API (LLM) |
| Banco de Dados | Firebase Firestore |
| Autenticação | Firebase Auth |
| Hospedagem | Vercel |

---

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Conta Firebase
- Chave de API Groq
- Git

### Instalação

```bash
# Clone o repositório
git clone https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance.git
cd PlatformLGPDCompliance

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env.local

# Inicie o servidor de desenvolvimento
npm run dev
```

### Configuração de Ambiente

#### Frontend (`.env.local`)
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

#### Backend (`server/.env`)
```env
GROQ_API_KEY=your_groq_api_key
FIREBASE_PROJECT_ID=your_project_id
PORT=8787
NODE_ENV=development
```

#### Firebase Credentials
Adicione `server/serviceAccountKey.json`:
```bash
# Obtenha em: Firebase Console → Settings → Service Accounts
# NÃO commite este arquivo!
```

---

## 📖 Documentação

Acesse a documentação completa em:
- **[COMO_EXECUTAR.md](./COMO_EXECUTAR.md)** - Guia de execução com screenshots
- **[ANALISE_RELATORIO_FINAL.md](./ANALISE_RELATORIO_FINAL.md)** - Análise estratégica
- **[validation_results/](./validation_results/)** - Exemplos de validação

---

## 💻 Desenvolvimento

### Scripts Disponíveis

```bash
npm run dev              # Iniciar servidor de desenvolvimento
npm run build            # Build para produção
npm run preview          # Preview da build
npm run lint             # Verificar sintaxe
npm run type-check       # Verificar tipos TypeScript
```

### Estrutura de Pastas

```
src/
├── components/          # Componentes React reutilizáveis
│   ├── ConfusionMatrix.tsx
│   ├── AdminDashboard.tsx
│   └── ValidationDemoPage.tsx
├── pages/              # Páginas principais
│   ├── Admin/
│   └── Assessment/
├── lib/                # Utilities
│   ├── firebase.ts     # Configuração Firebase
│   └── auth.ts
└── styles/             # CSS global

server/
├── routes/             # Endpoints Express
│   ├── analyze.mjs      # POST /api/analyze
│   ├── admin.mjs        # Admin endpoints
│   └── sitemap.mjs      # GET /sitemap.xml
├── lib/                # Lógica de negócio
│   ├── auth-middleware.mjs
│   ├── rate-limiter.mjs
│   └── ai-client.mjs
└── server.mjs          # Configuração Express
```

---

## 📡 API Endpoints

### Público
```
GET  /health                    # Health check
GET  /sitemap.xml               # Sitemap para SEO
GET  /api/ai-status             # Status da IA
```

### Autenticado
```
POST   /api/assessment/create           # Criar avaliação
POST   /api/assessment/submit            # Submeter respostas
GET    /api/assessment/:id               # Obter avaliação
GET    /api/admin/dashboard              # Dashboard executivo
GET    /api/admin/consolidated-analysis  # Análise consolidada
```

---

## 🧪 Testes

### Fluxo de Teste Recomendado

1. **Login como ADMIN**
   ```
   Email: admin@empresa.com
   Senha: [credenciais Firebase]
   ```

2. **Criar Avaliação**
   - Dashboard → "Nova Avaliação"
   - Tipo: "Diagnóstico LGPD"
   - Público: "Equipe de RH"

3. **Distribuir Link**
   - Copiar link compartilhável
   - Compartilhar com respondentes

4. **Coletar Respostas**
   - Aguardar 5+ respondentes
   - Gráficos aparecem automaticamente

5. **Analisar Resultados**
   - Score de conformidade
   - Matriz de confusão
   - Recomendações

---

## 🌍 Deploy

### Vercel (Automatizado)

```bash
# Push para main faz deploy automático
git push origin main
```

**Configuração automática:**
- Build: `npm run build`
- Output: `.vite/`
- Variaáveis de ambiente: Configuradas no console Vercel

**URLs:**
- Produção: https://platformlgpdcompliance.com.br
- Preview: https://platform-lgpd-compliance.vercel.app

---

## 🔐 Segurança

### Implementado
- ✅ **Autenticação Firebase** com controle de role
- ✅ **Rate limiting** em endpoints críticos
- ✅ **CORS** configurado para domínios autorizados
- ✅ **Validação de entrada** em todas as APIs
- ✅ **Headers de segurança** (X-Content-Type-Options, X-Frame-Options)
- ✅ **Criptografia em trânsito** (HTTPS/TLS 1.3)
- ✅ **Variáveis sensíveis** em `.env`

### Checklist de Segurança
- [ ] `serviceAccountKey.json` adicionado ao `.gitignore`
- [ ] Variáveis de ambiente configuradas em produção
- [ ] Firebase Firestore com regras de segurança
- [ ] CORS restrito a domínios conhecidos
- [ ] Rate limiting ativado

---

## 📊 Métricas de Conformidade

A plataforma avalia conformidade em 5 eixos:

| Eixo | O que avalia | Risco se não conformar |
|------|-------------|----------------------|
| **Armazenamento** | Como dados são guardados | Segurança comprometida |
| **Compartilhamento** | Com quem dados são compartilhados | Vazamento potencial |
| **Consentimento** | Se há permissão explícita | Violação de direitos |
| **Retenção** | Por quanto tempo dados são guardados | Acúmulo desnecessário |
| **Monitoramento** | Se acessos são monitorados | Sem auditoria |

---

## 🐛 Troubleshooting

### Port 5173 já está em uso
```bash
npm run dev -- --port 5174
```

### Firebase credentials not found
```bash
# Verifique .env.local
cat .env.local | grep VITE_FIREBASE
```

### Gráficos não aparecem
```bash
# Limpar cache
rm -rf node_modules
npm install
npm run dev
```

### Erro 403 ao acessar endpoints
- Verifique CORS em `server/server.mjs`
- Confirme que frontend URL está em `allowedOrigins`

---

## 📈 Performance

| Operação | Tempo |
|----------|-------|
| Instalar dependências | 2-3 min |
| Iniciar dev server | 5-10 seg |
| Carregar dashboard | 1-2 seg |
| Gerar PDF com 50 respostas | 3-5 seg |
| Calcular score conformidade | <100ms |

---

## 📝 Contribuindo

Este projeto é privado. Para contribuições, entre em contato com a autora.

---

## 📄 Licença

**Proprietary** - Todos os direitos reservados.

Desenvolvido por **Ketrin Diovana Vargas**

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique [COMO_EXECUTAR.md](./COMO_EXECUTAR.md)
2. Consulte [ANALISE_RELATORIO_FINAL.md](./ANALISE_RELATORIO_FINAL.md)
3. Acesse [validation_results/](./validation_results/)
4. Entre em contato: ketrin.diovana.vargas@gmail.com

---

## 🎓 Stack Educacional

Desenvolvido com:
- React + TypeScript
- Firebase (Auth + Firestore)
- Tailwind CSS
- Express.js
- Groq API (IA)
- Vercel

**Última atualização:** 2026-07-05
