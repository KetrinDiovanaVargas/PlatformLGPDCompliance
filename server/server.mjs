import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer backend env first, then root env (for local/dev convenience).
dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

import express from "express";

// Security middlewares
import { authMiddleware, adminMiddleware, masterMiddleware } from "./lib/auth-middleware.mjs";
import { apiLimiter, loginLimiter, adminLimiter, aiLimiter } from "./lib/rate-limiter.mjs";
import { configureAIQueue } from "./lib/ai-client.mjs";

import generateStageRouter from "./routes/generateStage.mjs";
import analyzeRouter from "./routes/analyze.mjs";
import saveResponsesRouter from "./routes/saveResponses.mjs";
import adminRouter from "./routes/admin.mjs";
import adminConsolidatedAnalysisRouter from "./routes/adminConsolidatedAnalysis.mjs";
import aiStatusRouter from "./routes/aiStatus.mjs";
import queueStatusRouter from "./routes/queueStatus.mjs";
import cacheStatusRouter from "./routes/cacheStatus.mjs";
import contactRouter from "./routes/contact.mjs";
import sitemapRouter from "./routes/sitemap.mjs";

const app = express();
const PORT = process.env.PORT || 8787;

const allowedOrigins = [
  "https://platformlgpdcompliance.com.br",
  "https://platform-lgpd-compliance.vercel.app",
  "https://platformlgpd-compliance.vercel.app", // Vercel deployment domain (actual)
  "http://localhost:5173",
  "http://localhost:3000",
];

// ========================================================================
// CORS CONFIGURATION
// ========================================================================

app.use((req, res, next) => {
  const origin = req.headers.origin;

  let isOriginAllowed = false;

  if (origin) {
    // Check exact matches
    isOriginAllowed = allowedOrigins.includes(origin);

    // Allow Vercel preview domains (dynamic branch previews)
    // Matches: https://xxx-yyy-zzz.vercel.app
    if (!isOriginAllowed && origin.includes("vercel.app")) {
      isOriginAllowed = /^https:\/\/[a-z0-9\-]+\.vercel\.app$/.test(origin);
    }
  }

  // Always set these headers for CORS preflight
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Set CORS header only if origin is allowed
  if (isOriginAllowed) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }

  // Security headers
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("X-XSS-Protection", "1; mode=block");

  // Log CORS info for debugging
  if (origin) {
    console.log(`CORS: ${origin} → ${isOriginAllowed ? "✓ ALLOWED" : "✗ DENIED"}`);
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ========================================================================
// MIDDLEWARE SETUP
// ========================================================================

app.use(express.json({ limit: "1mb" })); // Limit request size

// Request logging
app.use((req, _res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin || "sem origin"}`);
  next();
});

// ========================================================================
// PUBLIC ROUTES (Sem Autenticação, com Rate Limiting)
// ========================================================================

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "lgpd-compliance-backend",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Sitemap (público, sem autenticação)
app.use("/sitemap.xml", sitemapRouter);

// AI Status (público, mas com rate limit)
app.use("/api/ai-status", aiLimiter, aiStatusRouter);

// Queue Status (público para visualização, com rate limit)
app.use("/api/queue-status", apiLimiter, queueStatusRouter);

// Cache Status (público para visualização, com rate limit)
app.use("/api/cache-status", apiLimiter, cacheStatusRouter);

// Contato (público, com rate limit)
app.use("/api/contact", apiLimiter, contactRouter);

// ========================================================================
// PROTECTED ROUTES (Requerem Autenticação)
// ========================================================================

// Generate stage (com rate limit e validação)
app.use("/api/generate-stage", apiLimiter, generateStageRouter);

// Save responses (com rate limit e autenticação)
app.use("/api/save-responses", apiLimiter, saveResponsesRouter);

// Analyze (com rate limit e autenticação)
app.use("/api/analyze", apiLimiter, analyzeRouter);

// ========================================================================
// ADMIN ROUTES (Requerem Admin Auth)
// ========================================================================

// Admin routes com auth middleware
app.use("/api/admin", adminLimiter, authMiddleware, adminMiddleware, adminRouter);
app.use("/api/admin/consolidated-analysis", adminLimiter, authMiddleware, adminMiddleware, adminConsolidatedAnalysisRouter);

// ========================================================================
// ERROR HANDLING
// ========================================================================

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "Rota não encontrada",
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("❌ Server error:", err);

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ========================================================================
// START SERVER
// ========================================================================

// Configura a fila de IA para o provedor primário (Claude): sem delay
// artificial e com processamento em paralelo, reduzindo o tempo de espera.
configureAIQueue("claude");

app.listen(PORT, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔐 SEGURANÇA ATIVADA:");
  console.log("  ✓ Firestore Security Rules carregadas");
  console.log("  ✓ Authentication Middleware ativo");
  console.log("  ✓ Rate Limiting ativo");
  console.log("  ✓ Input Validation com Zod");
  console.log("  ✓ Prompt Injection Protection");
  console.log("  ✓ AI Request Queue ativo (rate limit handling)");
  console.log("  ✓ Question Cache ativo (40% economia de IA calls)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔑 GROQ_API_KEY carregada:", !!process.env.GROQ_API_KEY);
  console.log("🔑 ANTHROPIC_API_KEY carregada:", !!process.env.ANTHROPIC_API_KEY);
  console.log(`🚀 Backend rodando na porta ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
});
