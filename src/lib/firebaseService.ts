import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const saveResponses = async (userId: string, responses: Record<string, any>) => {
  try {
    // 🔥 Caminho: responses → userId → respostas individuais
    const userResponsesRef = collection(db, "responses", userId, "items");

    const docRef = await addDoc(userResponsesRef, {
      responses,
      created_at: serverTimestamp(),
    });

    return { id: docRef.id, ...responses };
  } catch (error) {
    console.error("Erro ao salvar respostas:", error);
    throw error;
  }
};
