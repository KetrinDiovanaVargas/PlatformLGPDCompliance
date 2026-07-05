# 🛡️ Platform LGPD Compliance

[![Deploy Status](https://img.shields.io/badge/deploy-vercel-00C7B7?style=flat-square)](https://platformlgpdcompliance.com.br)
[![Node.js](https://img.shields.io/badge/node-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18+-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/license-proprietary-orange?style=flat-square)](LICENSE)

**Intelligent SaaS platform for LGPD compliance assessment and information security risk analysis powered by AI**.

---

## 📋 Overview

Platform LGPD Compliance is a comprehensive SaaS solution designed for organizations that need to validate compliance with the **Brazilian General Data Protection Law (LGPD)** and identify security vulnerabilities aligned with **ISO/IEC 27001** standards.

The platform leverages:
- 🤖 **Generative AI** for automated response analysis
- 📊 **Interactive Dashboards** for risk visualization
- 📈 **Confusion Matrix** for persona validation
- 🔐 **Firebase** for secure data storage
- ⚡ **Vercel** for continuous deployment

---

## 🎯 Key Features

### 🎯 Adaptive Assessment
- Dynamic questionnaires across 4 stages
- Questions adjusted based on respondent profile
- Coverage of 5 LGPD vulnerability dimensions:
  - Data Storage
  - Data Sharing
  - Consent
  - Data Retention
  - Monitoring & Audit

### 📊 Executive Dashboard
- **4 Real-time Compliance KPIs**
- Interactive charts (Recharts)
- Risk analysis by dimension
- Maturity distribution
- Compliance by type

### 🔍 Confusion Matrix
- Expected vs. Detected comparison
- Automatic metric calculation:
  - Accuracy, Precision, Recall
  - F1-Score, Specificity
- Persona validation (P01-P50 + A01-A05)

### 📄 Reports
- PDF export functionality
- 5-week action plan
- Personalized recommendations
- Strategic analysis

### 👥 Access Management
- **MASTER**: Full control, manages admins
- **ADMIN**: Creates assessments, views results
- **USER**: Responds to forms

---

## 🏗️ Architecture

```
Frontend (React + Vite)
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
    ├── server/groq/        (AI integration)
    └── server/services/    (Firebase, Auth)
    ↓
Firebase (Firestore + Auth)
    └── Cloud Storage
```

**Complete Tech Stack:**
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Backend | Express.js (Node.js) |
| AI | Groq API (LLM) |
| Database | Firebase Firestore |
| Authentication | Firebase Auth |
| Hosting | Vercel |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase account
- Groq API key
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance.git
cd PlatformLGPDCompliance

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Configuration

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
Add `server/serviceAccountKey.json`:
```bash
# Get from: Firebase Console → Settings → Service Accounts
# DO NOT commit this file!
```

---

## 📖 Documentation

Access complete documentation:
- **[COMO_EXECUTAR.md](./COMO_EXECUTAR.md)** - Execution guide (Portuguese)
- **[ANALISE_RELATORIO_FINAL.md](./ANALISE_RELATORIO_FINAL.md)** - Strategic analysis
- **[validation_results/](./validation_results/)** - Validation examples

---

## 💻 Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Check syntax
npm run type-check       # TypeScript type checking
```

### Folder Structure

```
src/
├── components/          # Reusable React components
│   ├── ConfusionMatrix.tsx
│   ├── AdminDashboard.tsx
│   └── ValidationDemoPage.tsx
├── pages/              # Main pages
│   ├── Admin/
│   └── Assessment/
├── lib/                # Utilities
│   ├── firebase.ts     # Firebase configuration
│   └── auth.ts
└── styles/             # Global CSS

server/
├── routes/             # Express endpoints
│   ├── analyze.mjs      # POST /api/analyze
│   ├── admin.mjs        # Admin endpoints
│   └── sitemap.mjs      # GET /sitemap.xml
├── lib/                # Business logic
│   ├── auth-middleware.mjs
│   ├── rate-limiter.mjs
│   └── ai-client.mjs
└── server.mjs          # Express configuration
```

---

## 📡 API Endpoints

### Public
```
GET  /health                    # Health check
GET  /sitemap.xml               # SEO sitemap
GET  /api/ai-status             # AI status
```

### Authenticated
```
POST   /api/assessment/create           # Create assessment
POST   /api/assessment/submit            # Submit responses
GET    /api/assessment/:id               # Get assessment
GET    /api/admin/dashboard              # Executive dashboard
GET    /api/admin/consolidated-analysis  # Consolidated analysis
```

---

## 🧪 Testing

### Recommended Test Flow

1. **Login as ADMIN**
   ```
   Email: admin@company.com
   Password: [Firebase credentials]
   ```

2. **Create Assessment**
   - Dashboard → "New Assessment"
   - Type: "LGPD Diagnosis"
   - Audience: "HR Team"

3. **Distribute Link**
   - Copy shareable link
   - Share with respondents

4. **Collect Responses**
   - Wait for 5+ respondents
   - Charts appear automatically

5. **Analyze Results**
   - Compliance score
   - Confusion matrix
   - Recommendations

---

## 🌍 Deployment

### Vercel (Automated)

```bash
# Push to main triggers automatic deployment
git push origin main
```

**Automatic Configuration:**
- Build: `npm run build`
- Output: `.vite/`
- Environment variables: Configured in Vercel console

**URLs:**
- Production: https://platformlgpdcompliance.com.br
- Preview: https://platform-lgpd-compliance.vercel.app

---

## 🔐 Security

### Implemented
- ✅ **Firebase Authentication** with role-based access control
- ✅ **Rate limiting** on critical endpoints
- ✅ **CORS** configured for authorized domains
- ✅ **Input validation** on all APIs
- ✅ **Security headers** (X-Content-Type-Options, X-Frame-Options)
- ✅ **Encryption in transit** (HTTPS/TLS 1.3)
- ✅ **Sensitive variables** in `.env`

### Security Checklist
- [ ] `serviceAccountKey.json` added to `.gitignore`
- [ ] Environment variables configured in production
- [ ] Firebase Firestore with security rules
- [ ] CORS restricted to known domains
- [ ] Rate limiting enabled

---

## 📊 Compliance Metrics

The platform evaluates compliance across 5 dimensions:

| Dimension | What it evaluates | Risk if non-compliant |
|-----------|-----------------|----------------------|
| **Storage** | How data is stored | Compromised security |
| **Sharing** | Who data is shared with | Potential leak |
| **Consent** | Explicit permission | Rights violation |
| **Retention** | How long data is kept | Unnecessary accumulation |
| **Monitoring** | Access monitoring | No audit trail |

---

## 🐛 Troubleshooting

### Port 5173 already in use
```bash
npm run dev -- --port 5174
```

### Firebase credentials not found
```bash
# Check .env.local
cat .env.local | grep VITE_FIREBASE
```

### Charts not appearing
```bash
# Clear cache
rm -rf node_modules
npm install
npm run dev
```

### 403 error accessing endpoints
- Check CORS in `server/server.mjs`
- Confirm frontend URL is in `allowedOrigins`

---

## 📈 Performance

| Operation | Time |
|----------|------|
| Install dependencies | 2-3 min |
| Start dev server | 5-10 sec |
| Load dashboard | 1-2 sec |
| Generate PDF (50 responses) | 3-5 sec |
| Calculate compliance score | <100ms |

---

## 📝 Contributing

This project is private. For contributions, please contact the author.

---

## 📄 License

**Proprietary** - All rights reserved.

Developed by **Ketrin Diovana Vargas**

---

## 📞 Support

For questions or issues:

1. Check [COMO_EXECUTAR.md](./COMO_EXECUTAR.md)
2. Review [ANALISE_RELATORIO_FINAL.md](./ANALISE_RELATORIO_FINAL.md)
3. Explore [validation_results/](./validation_results/)
4. Contact: ketrin.diovana.vargas@gmail.com

---

## 🎓 Educational Stack

Built with:
- React + TypeScript
- Firebase (Auth + Firestore)
- Tailwind CSS
- Express.js
- Groq API (AI)
- Vercel

**Last Updated:** July 5, 2026
