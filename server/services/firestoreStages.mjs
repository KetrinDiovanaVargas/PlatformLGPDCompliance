import admin from "../firebase.mjs";

const db = admin.firestore();

function sanitize(value) {
  if (value === undefined) return null;

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === "object" && value !== null) {
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      clean[k] = sanitize(v);
    }
    return clean;
  }

  return value;
}

export async function saveStage(userId, sessionId, stage, data = {}) {
  if (!userId) throw new Error("userId é obrigatório");
  if (!sessionId) throw new Error("sessionId é obrigatório");
  if (stage === undefined || stage === null) throw new Error("stage é obrigatório");

  const numericStage = Number(stage);

  if (!Number.isInteger(numericStage) || numericStage < 0) {
    throw new Error("stage inválido");
  }

  const sanitizedData = sanitize(data);
  const assessmentId =
    sanitizedData?.assessmentId !== undefined && sanitizedData?.assessmentId !== null
      ? String(sanitizedData.assessmentId)
      : null;

  const sessionRef = db.collection("assessment_sessions").doc(String(sessionId));
  const stageRef = sessionRef.collection("stages").doc(String(numericStage));

  const sessionSnap = await sessionRef.get();
  const existingSession = sessionSnap.exists ? sessionSnap.data() : null;

  await sessionRef.set(
    {
      sessionId: String(sessionId),
      userId: String(userId),
      assessmentId: assessmentId ?? existingSession?.assessmentId ?? null,
      currentStage: numericStage,
      status: "in_progress",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt:
        existingSession?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await stageRef.set(
    {
      stage: numericStage,
      assessmentId: assessmentId ?? existingSession?.assessmentId ?? null,
      data: sanitizedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    userId: String(userId),
    sessionId: String(sessionId),
    assessmentId: assessmentId ?? existingSession?.assessmentId ?? null,
    stage: numericStage,
  };
}