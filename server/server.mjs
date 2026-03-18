import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

import express from "express";

import generateStageRouter from "./routes/generateStage.mjs";
import analyzeRouter from "./routes/analyze.mjs";
import saveResponsesRouter from "./routes/saveResponses.mjs";
import adminRouter from "./routes/admin.mjs";
import adminConsolidatedAnalysisRouter from "./routes/adminConsolidatedAnalysis.mjs";

const app = express();
const PORT = process.env.PORT || 8787;

const allowedOrigins = [
  "https://platform-lgpd-compliance.vercel.app",
  "http://localhost:5173",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Vary", "Origin");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin || "sem origin"}`);
  next();
});

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "lgpd-compliance-backend",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/generate-stage", generateStageRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/save-responses", saveResponsesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/consolidated-analysis", adminConsolidatedAnalysisRouter);

app.listen(PORT, () => {
  console.log("🔑 GROQ_API_KEY carregada:", !!process.env.GROQ_API_KEY);
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});