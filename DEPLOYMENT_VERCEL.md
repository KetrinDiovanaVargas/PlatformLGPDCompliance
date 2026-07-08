# 🚀 Guia de Deployment no Vercel

## Pré-requisitos

- Conta Vercel ativa
- GitHub repository conectado
- Projeto Firebase configurado
- Chaves de API: Groq, DeepSeek (optional: Gemini)

---

## 1. Configuração no Vercel Dashboard

### 1.1 Frontend Environment Variables

Acesse: **Vercel Dashboard → Seu Projeto → Settings → Environment Variables**

Adicione as seguintes variáveis:

```
VITE_API_BASE_URL = https://platformlgpdcompliance.com.br
```

> **Nota**: Em desenvolvimento (localhost), deixe vazio para usar URLs relativas.

### 1.2 Backend Environment Variables

Para a API backend (se deployada como função Vercel):

```
# AI Providers
GROQ_API_KEY = sua_chave_groq_aqui
DEEPSEEK_API_KEY = sua_chave_deepseek_aqui
GEMINI_API_KEY = sua_chave_gemini_aqui (opcional)

# Firebase
FIREBASE_PROJECT_ID = lgpd-compliance-platform-6a991
FIREBASE_PRIVATE_KEY = sua_chave_privada_firebase_aqui
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@lgpd-compliance-platform-6a991.iam.gserviceaccount.com

# Port
PORT = 3001
```

---

## 2. CORS Configuration

O backend está configurado para aceitar requisições de:
- `https://platformlgpdcompliance.com.br`
- `https://platform-lgpd-compliance.vercel.app`
- `https://platformlgpd-compliance.vercel.app` ← Domínio Vercel atual
- `http://localhost:5173` (desenvolvimento)

> **Importante**: Se o domínio Vercel mudar, atualize `server/server.mjs` line 34-38

---

## 3. Firestore Rules Deployment

### 3.1 Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### 3.2 Deploy das Rules

```bash
firebase login
firebase deploy --only firestore:rules --project=lgpd-compliance-platform-6a991
```

---

## 4. Segurança - Boas Práticas

### ❌ NÃO fazer:
- Commitar `.env` ou `server/.env` com chaves
- Expor chaves em código frontend
- Usar variáveis hardcoded

### ✅ FAZER:
- Usar Vercel Environment Variables
- Configurar Firebase serviceAccountKey.json como arquivo local (não versionado)
- Girar chaves regularmente
- Usar .env.local para desenvolvimento (gitignored)

---

## 5. Troubleshooting

### Erro: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solução**: Verificar se o domínio está na whitelist do backend (`server/server.mjs`).

### Erro: "Failed to fetch from API"

**Solução**: Verificar se `VITE_API_BASE_URL` está configurado corretamente no Vercel.

### Erro: "Firebase initialization failed"

**Solução**: Verificar se as credenciais Firebase estão definidas em Environment Variables.

---

## 6. Checklist de Deploy

- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] CORS whitelist atualizado em `server/server.mjs`
- [ ] Firestore Rules deployadas
- [ ] Chaves de API geradas e ativas
- [ ] `.env` e `server/.env` em .gitignore
- [ ] Domínio customizado (se aplicável) configurado em DNS
- [ ] HTTPS habilitado (automático no Vercel)
- [ ] Testes E2E executados em produção

---

## 7. URLs de Produção

- **Frontend**: https://platformlgpdcompliance.com.br
- **Backend API**: https://lgpd-backend.onrender.com (ou mesmo domínio se Vercel)
- **Admin**: https://platformlgpdcompliance.com.br/admin
- **Sitemap**: https://platformlgpdcompliance.com.br/sitemap.xml

---

**Última atualização**: 2026-07-08
**Status**: ✅ Pronto para produção
