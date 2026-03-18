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

// ✅ ORIGENS PERMITIDAS
const allowedOrigins = [
  "http://localhost:5173",
  "https://platform-lgpd-compliance.vercel.app",
];

// ✅ CONFIGURAÇÃO COMPLETA DO CORS
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// 🔥 APLICA CORS
app.use(cors(corsOptions));

// 🔥 LIBERA PREFLIGHT (ESSENCIAL)
app.options("*", cors(corsOptions));

// 🔥 BODY PARSER
app.use(express.json());

// 🔥 HEALTH CHECK
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "lgpd-compliance-backend",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 🔥 ROTAS
app.use("/api/generate-stage", generateStageRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/save-responses", saveResponsesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/consolidated-analysis", adminConsolidatedAnalysisRouter);

// 🔥 FALLBACK
app.all(/.*/, (_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// 🔥 START SERVER
app.listen(PORT, () => {
  console.log("🔑 GROQ_API_KEY carregada:", !!process.env.GROQ_API_KEY);
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});