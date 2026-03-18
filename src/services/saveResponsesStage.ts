import { db } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ======================================================
   TIPOS
====================================================== */

type RawResponse = {
  index?: number;
  questionId?: number;
  question: string;
  answer: any;
};

export interface FinalReport {
  report: string;
  summary: string;
  score: number;
  metrics: Record<string, any>;
  risks: Record<string, any>;
  controls: any[];
  responses: RawResponse[];
}

/* ======================================================
   CONFIG
====================================================== */

const FINAL_STAGE_INDEX = 4;

/* ======================================================
   NORMALIZAÇÃO
====================================================== */

function normalizeAnswer(answer: any) {
  if (answer && typeof answer === "object" && !Array.isArray(answer)) {
    if ("selected" in answer) {
      return {
        selected: String(answer.selected ?? ""),
        description: String(answer.description ?? ""),
      };
    }
    return answer;
  }

  if (Array.isArray(answer)) {
    return [...answer].map(String).sort();
  }

  return answer ?? "";
}

function normalizeResponses(responses: RawResponse[]) {
  return responses
    .map((r, i) => ({
      index: r.index ?? r.questionId ?? i,
      question: String(r.question ?? ""),
      answer: normalizeAnswer(r.answer),
    }))
    .sort((a, b) => a.index - b.index);
}

function stableStringify(obj: any) {
  const seen = new WeakSet();

  const sorter = (value: any): any => {
    if (value && typeof value === "object") {
      if (seen.has(value)) return value;
      seen.add(value);

      if (Array.isArray(value)) return value.map(sorter);

      return Object.keys(value)
        .sort()
        .reduce((acc: any, key) => {
          acc[key] = sorter(value[key]);
          return acc;
        }, {});
    }
    return value;
  };

  return JSON.stringify(sorter(obj));
}

/* ======================================================
   SALVAR RESPOSTAS DE ETAPA
   COM sessionId + assessmentId
====================================================== */

export async function saveResponsesStage(
  userId: string,
  sessionId: string,
  assessmentId: string | null,
  stageResponses: Record<number, any>,
  stage: number
) {
  if (!userId) throw new Error("userId ausente");
  if (!sessionId) throw new Error("sessionId ausente");

  const normalized = Object.entries(stageResponses)
    .map(([k, v]) => ({
      index: Number(k),
      question: String(v?.question ?? ""),
      answer: normalizeAnswer(v?.answer),
    }))
    .sort((a, b) => a.index - b.index);

  const hash = stableStringify(normalized);

  // latest da etapa dentro da sessão
  const latestRef = doc(
    db,
    "assessment_sessions",
    sessionId,
    "stages",
    String(stage)
  );

  const latestSnap = await getDoc(latestRef);
  const latestData = latestSnap.exists() ? latestSnap.data() : null;

  if (latestData?.hash === hash) {
    return { status: "unchanged", stage, sessionId, assessmentId };
  }

  // cria/atualiza metadados da sessão
  const sessionRef = doc(db, "assessment_sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  await setDoc(
    sessionRef,
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      status: "in_progress",
      currentStage: stage,
      updatedAt: serverTimestamp(),
      createdAt: sessionSnap.exists()
        ? sessionSnap.data()?.createdAt ?? serverTimestamp()
        : serverTimestamp(),
    },
    { merge: true }
  );

  // latest da etapa
  await setDoc(
    latestRef,
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      stage,
      answers: normalized,
      hash,
      updatedAt: serverTimestamp(),
      createdAt: latestData?.createdAt ?? serverTimestamp(),
    },
    { merge: true }
  );

  // histórico da etapa
  await addDoc(
    collection(
      db,
      "assessment_sessions",
      sessionId,
      "stages",
      String(stage),
      "versions"
    ),
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      stage,
      answers: normalized,
      hash,
      createdAt: serverTimestamp(),
      previousHash: latestData?.hash ?? null,
    }
  );

  return { status: "saved", stage, sessionId, assessmentId };
}

/* ======================================================
   SALVAR RELATÓRIO FINAL
   COM sessionId + assessmentId
====================================================== */

export async function saveFinalReport(
  userId: string,
  sessionId: string,
  assessmentId: string | null,
  reportData: FinalReport
) {
  if (!userId) throw new Error("userId ausente");
  if (!sessionId) throw new Error("sessionId ausente");
  if (!reportData) throw new Error("reportData ausente");

  const normalizedResponses = normalizeResponses(reportData.responses);

  const finalPayload = {
    ...reportData,
    responses: normalizedResponses,
  };

  const hash = stableStringify(finalPayload);

  // relatório latest da sessão
  const latestRef = doc(
    db,
    "assessment_sessions",
    sessionId,
    "final_report",
    "latest"
  );

  const latestSnap = await getDoc(latestRef);
  const latestData = latestSnap.exists() ? latestSnap.data() : null;

  if (latestData?.hash === hash) {
    return { status: "unchanged", sessionId, assessmentId };
  }

  // atualiza/garante sessão
  const sessionRef = doc(db, "assessment_sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  await setDoc(
    sessionRef,
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      status: "completed",
      currentStage: FINAL_STAGE_INDEX,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: sessionSnap.exists()
        ? sessionSnap.data()?.createdAt ?? serverTimestamp()
        : serverTimestamp(),
    },
    { merge: true }
  );

  // latest do relatório
  await setDoc(
    latestRef,
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      ...finalPayload,
      hash,
      updatedAt: serverTimestamp(),
      createdAt: latestData?.createdAt ?? serverTimestamp(),
    },
    { merge: true }
  );

  // histórico do relatório
  await addDoc(
    collection(
      db,
      "assessment_sessions",
      sessionId,
      "final_report",
      "latest",
      "versions"
    ),
    {
      sessionId,
      userId,
      assessmentId: assessmentId ?? null,
      ...finalPayload,
      hash,
      createdAt: serverTimestamp(),
      previousHash: latestData?.hash ?? null,
    }
  );

  return { status: "saved", sessionId, assessmentId };
}