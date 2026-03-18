// server/lib/saveFinalReport.mjs
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.mjs";

export async function saveFinalReport(userId, analysis) {
  if (!userId) throw new Error("userId é obrigatório para salvar relatório");

  const ref = doc(db, "finalReports", userId);

  await setDoc(ref, {
    ...analysis,
    createdAt: serverTimestamp(),
  });
}
