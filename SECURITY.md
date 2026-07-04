# 🔒 GUIA DE SEGURANÇA - Platform LGPD Compliance

## 📋 Índice

1. [Checklist de Segurança](#checklist-de-segurança)
2. [Configuração de Segurança](#configuração-de-segurança)
3. [Firestore Security Rules](#firestore-security-rules)
4. [Autenticação & Autorização](#autenticação--autorização)
5. [Rate Limiting](#rate-limiting)
6. [Input Validation](#input-validation)
7. [Proteção contra Prompt Injection](#proteção-contra-prompt-injection)
8. [Deployment Seguro](#deployment-seguro)
9. [Monitoramento & Audit](#monitoramento--audit)

---

## ✅ Checklist de Segurança

**ANTES DE FAZER DEPLOY EM PRODUÇÃO:**

- [ ] Firestore rules deployadas (`firebase deploy --only firestore:rules`)
- [ ] Todas variáveis de ambiente definidas (não em .env commitado)
- [ ] Firebase Admin SDK credenciais configuradas (não commitadas)
- [ ] Rate limiting ativo
- [ ] Autenticação middleware em todas rotas protegidas
- [ ] Input validation com Zod em todos endpoints
- [ ] Prometheus/Datadog monitoring configurado
- [ ] Logs persistidos e rotacionados (Winston/Pino)
- [ ] HTTPS enforçado em produção
- [ ] CORS restrito a origins conhecidos apenas
- [ ] Backup automático do Firestore configurado
- [ ] Disaster recovery plan testado

---

## 🔐 Configuração de Segurança

### 1. Variáveis de Ambiente

**NUNCA commitar .env:**

```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

**Copiar .env.example para .env local:**

```bash
cp .env.example .env
# Editar com valores reais
```

**Em CI/CD (GitHub Actions, Vercel, etc):**

Usar secrets do provider, não arquivo .env:

```yaml
# GitHub Actions
jobs:
  deploy:
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
```

### 2. Firebase Admin SDK

**Opção 1: Service Account JSON (CI/CD)**

```bash
# Em GitHub Secrets, como base64:
export FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=$(cat server/serviceAccountKey.json | base64)
```

**Opção 2: Env vars (Vercel, etc)**

```bash
# Copiar valores de Firebase Console → Project Settings → Service Accounts
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Opção 3: Application Default Credentials (GCP)**

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
export FIREBASE_USE_ADC=true
```

---

## 🛡️ Firestore Security Rules

### Deploy das Rules

```bash
# 1. Instalar Firebase CLI
npm install -g firebase-tools

# 2. Fazer login
firebase login

# 3. Deploy apenas firestore rules
firebase deploy --only firestore:rules

# 4. Ver status
firebase describe
```

### Regras Implementadas

**Arquivo:** `firestore.rules`

**Estrutura:**

```
/assessments/{assessmentId}
  └─ Apenas admins podem ler/escrever
  └─ Admins normais: apenas seus próprios assessments
  └─ MASTER: todos assessments
  └─ /assessment_sessions/{sessionId}
     └─ Usuários podem ler/escrever suas próprias sessões
     └─ /stages/{stageNumber}
        └─ Apenas respondente pode editar
     └─ /final_report/{reportId}
        └─ Apenas respondente pode ler

/admins/{uid}
  └─ Apenas MASTER pode criar/editar admins

/admin_sessions/{sessionId}
  └─ Rastreamento de logins
```

### Testar Rules Localmente

```bash
# Emulator do Firestore
firebase emulators:start

# Em outro terminal
npm run dev:back  # Backend vai usar emulator

# Acessar console
http://localhost:4000
```

---

## 🔑 Autenticação & Autorização

### Middleware de Autenticação

**Arquivo:** `server/lib/auth-middleware.mjs`

**Uso:**

```javascript
// Middleware que valida Firebase ID Token
app.post('/api/protected', authMiddleware, (req, res) => {
  // req.user = { uid, email, isAdmin }
});
```

**Frontend:** Obter token

```javascript
import { auth } from '@/lib/firebase';

const token = await auth.currentUser?.getIdToken();
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Roles & Permissões

```
MASTER
  ├─ Gerenciar admins (criar, desativar)
  ├─ Acessar todos assessments
  └─ Gerar relatórios consolidados

ADMIN
  ├─ Criar/editar próprios assessments
  ├─ Ver resultados dos assessments
  └─ Não pode gerenciar outros admins

USER
  ├─ Responder questionários
  ├─ Ver própios resultados
  └─ Não pode acessar dados de outros usuários
```

---

## ⏱️ Rate Limiting

### Configuração

**Arquivo:** `server/lib/rate-limiter.mjs`

**Limites Atuais:**

| Rota | Limite | Janela | Propósito |
|------|--------|--------|----------|
| `/api/generate-stage` | 100 req | 15 min | Geração de questões |
| `/api/save-responses` | 100 req | 15 min | Salvar respostas |
| `/api/analyze` | 100 req | 15 min | Análise final |
| `/api/admin/*` | 50 req | 15 min | Admin operations |
| `/api/admin/login` | 5 tentativas | 15 min | Login protection |

### Aumentar Limites

```javascript
// Em server/lib/rate-limiter.mjs
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,  // Aumentar de 100 para 200
});
```

### Per-User Rate Limiting (Futuro)

```javascript
// Limitar por usuário, não por IP
apiLimiter = rateLimit({
  keyGenerator: (req) => req.user?.uid || req.ip,
  max: 1000, // 1000 por usuário por dia
});
```

---

## ✔️ Input Validation

### Zod Schemas

**Arquivo:** `server/lib/validation.mjs`

**Schemas:**

```javascript
export const generateStageSchema = z.object({
  stage: z.number().min(1).max(4),
  assessmentId: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  respondentContext: z.string().max(2000).optional(),
});

export const saveResponsesSchema = z.object({
  stage: z.number().min(0).max(4),
  sessionId: z.string().uuid(),
  userId: z.string(),
  assessmentId: z.string().nullable().optional(),
  answers: z.record(z.unknown()),
});
```

**Usar em Routes:**

```javascript
import { validateRequest, saveResponsesSchema } from '../lib/validation.mjs';

router.post('/save', validateRequest(saveResponsesSchema), (req, res) => {
  const { stage, sessionId, answers } = req.validated;
  // req.validated já passou por Zod validation
});
```

---

## 🛡️ Proteção contra Prompt Injection

### Sanitização de Personas

**Arquivo:** `server/lib/prompt-safety.mjs`

**Função:**

```javascript
import { buildSafePersonaPrompt, sanitizePersonaMarkdown } from '../lib/prompt-safety.mjs';

const personaMd = readFileSync('personas/A01.md', 'utf8');
const safeMarkdown = sanitizePersonaMarkdown(personaMd);
const safePrompt = buildSafePersonaPrompt(safeMarkdown);

// Usar safePrompt com Claude/Groq
```

**O que faz:**

- Remove patterns de injection (ignore, override, forget, etc)
- Limita tamanho (5000 chars)
- Usa XML tags estruturados ao invés de interpolação
- Valida estrutura de persona (8 seções obrigatórias)

### Estrutura Segura de Persona

```markdown
# Persona A01 - Titulo

## 1. Identidade profissional
...

## 2. Rotina de trabalho
...

[... todas 8 seções ...]
```

**Validar antes de usar:**

```javascript
import { validatePersonaStructure } from '../lib/prompt-safety.mjs';

const validation = validatePersonaStructure(personaMd);
if (!validation.valid) {
  console.error('❌ Persona inválida:', validation.errors);
}
```

---

## 🚀 Deployment Seguro

### Vercel (Frontend)

```bash
# .env.local (NUNCA commitar)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...

# Vercel Secrets (via CLI ou console)
vercel env add VITE_FIREBASE_API_KEY
```

### Backend (Cloud Run, Heroku, ou VPS)

**Deploy com secrets:**

```bash
# Google Cloud Run
gcloud run deploy platform-lgpd \
  --set-env-vars GROQ_API_KEY=$GROQ_KEY,FIREBASE_PROJECT_ID=$FBP \
  --set-secrets FIREBASE_PRIVATE_KEY=firebase_key:latest
```

**HTTPS em Produção:**

```javascript
// Enforce HTTPS
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure) {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}
```

### CORS em Produção

```javascript
// Apenas origins específicos
const allowedOrigins = [
  'https://platform-lgpd-compliance.vercel.app',
  'https://yourdomain.com',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  next();
});
```

---

## 📊 Monitoramento & Audit

### Estrutura de Logging

**Implementar Winston/Pino:**

```bash
npm install winston
```

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

logger.info('Usuario autenticado', { uid: req.user.uid });
logger.error('Falha na validação', { error: err.message });
```

### Audit Trail

**Registrar em Firestore:**

```javascript
// Quando admin cria assessment
const auditLog = {
  action: 'assessment_created',
  adminId: req.user.uid,
  assessmentId: newAssessment.id,
  timestamp: new Date(),
  details: { title, objective },
};

await db.collection('audit_logs').add(auditLog);
```

### Alertas & Monitoramento

**Sentry (Error Tracking):**

```bash
npm install @sentry/node
```

```javascript
import * as Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN });

try {
  // code
} catch (err) {
  Sentry.captureException(err);
}
```

**Prometheus/Datadog:**

- Requisições por segundo
- Taxa de erro por rota
- Latência de resposta
- Taxa de rate limit

---

## 🔍 Teste de Segurança

```bash
# OWASP Top 10 tests

# 1. Autenticação faltante
curl http://localhost:8787/api/protected
# Deve retornar 401 Unauthorized

# 2. Rate limiting
for i in {1..150}; do
  curl http://localhost:8787/api/generate-stage &
done
# Deve retornar 429 Too Many Requests após 100

# 3. Input validation
curl -X POST http://localhost:8787/api/generate-stage \
  -H "Content-Type: application/json" \
  -d '{"stage": "invalid"}'
# Deve retornar 400 Bad Request

# 4. SQL Injection (NoSQL)
curl -X POST http://localhost:8787/api/save-responses \
  -H "Content-Type: application/json" \
  -d '{"assessmentId": {"$ne": null}}'
# Deve rejeitar ou sanitizar
```

---

## 📞 Suporte

- 🐛 Report security issues: ketrin.diovana.vargas@gmail.com
- 📖 Docs: README.md, EXECUTAR_FLUXO.md
- ⚙️ Firebase: console.firebase.google.com
