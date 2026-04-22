import express from "express";
import admin from "../firebase.mjs";
import { getAdminDb } from "../firebaseAdmin.mjs";
import { saveStage } from "../services/firestoreStages.mjs";

const router = express.Router();

// ✅ Salva respostas de qualquer etapa
router.post("/", async (req, res) => {
  try {
    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      return res.status(503).json({
        error: "Firebase Admin não configurado no backend.",
        details: err?.message || String(err),
      });
    }

    const {
      stage,
      answers,
      userId = "anon",
      sessionId,
      assessmentId = null,
    } = req.body;

    if (stage === undefined || stage === null) {
      return res.status(400).json({ error: "Stage é obrigatório" });
    }

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "Answers é obrigatório" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId é obrigatório" });
    }

    const numericStage = Number(stage);

    if (!Number.isInteger(numericStage) || numericStage < 1) {
      return res.status(400).json({ error: "Stage inválido" });
    }

    const sessionRef = db.collection("assessment_sessions").doc(String(sessionId));

    await sessionRef.set(
      {
        sessionId: String(sessionId),
        userId: String(userId),
        assessmentId: assessmentId ? String(assessmentId) : null,
        status: "in_progress",
        currentStage: numericStage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await saveStage(userId, sessionId, numericStage, {
      id: numericStage,
      title: `Etapa ${numericStage}`,
      description: "Respostas salvas",
      questions: [],
      answers,
      assessmentId: assessmentId ? String(assessmentId) : null,
      updatedAt: new Date(),
    });

    console.log("✅ Respostas salvas com sucesso:", {
      userId,
      sessionId,
      assessmentId: assessmentId ?? null,
      stage: numericStage,
    });

    return res.json({
      ok: true,
      userId,
      sessionId,
      assessmentId: assessmentId ?? null,
      stage: numericStage,
    });
  } catch (error) {
    console.error("❌ Erro ao salvar respostas:", error);
    return res.status(500).json({
      error: "Erro ao salvar respostas",
      details: error.message,
    });
  }
});

export default router;