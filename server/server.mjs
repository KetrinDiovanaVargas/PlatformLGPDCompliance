import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

import express from "express";
import cors from "cors";

import generateStageRouter from "./routes/generateStage.mjs";
import analyzeRouter from "./routes/analyze.mjs";
import saveResponsesRouter from "./routes/saveResponses.mjs";
import adminRouter from "./routes/admin.mjs";
import adminConsolidatedAnalysisRouter from "./routes/adminConsolidatedAnalysis.mjs";

const app = express();
const PORT = process.env.PORT || 8787;

// ===============================
// 🔐 CORS CONFIG
// ===============================
const allowedOrigins = [
  "https://platform-lgpd-compliance.vercel.app",
  "http://localhost:5173",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn("⛔ Origem bloqueada por CORS:", origin);
    return callback(new Error(`Origem não permitida por CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ===============================
// 🧪 LOG DE REQUISIÇÕES
// ===============================
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin}`);
  next();
});

// ===============================
// 🔓 CORS + JSON
// ===============================
app.use(cors(corsOptions));
app.use(express.json());

// ===============================
// 🚨 PRE-FLIGHT (RESOLVE SEU ERRO)
// ===============================
app.options("/*", (req, res) => {
  console.log("✅ Preflight recebido:", req.originalUrl);

  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return res.sendStatus(204);
});

// ===============================
// 🩺 HEALTH CHECK
// ===============================
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "lgpd-compliance-backend",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ===============================
// 📡 ROTAS API
// ===============================
app.use("/api/generate-stage", generateStageRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/save-responses", saveResponsesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/consolidated-analysis", adminConsolidatedAnalysisRouter);

// ===============================
// 🚀 START
// ===============================
app.listen(PORT, () => {
  console.log("🔑 GROQ_API_KEY carregada:", !!process.env.GROQ_API_KEY);
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});