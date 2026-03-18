// src/services/databaseService.ts
import { db } from "../lib/firebase";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc as firestoreDoc,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

/**
 * Busca todos os documentos de uma coleção
 */
export async function getCollectionData<T = any>(
  collectionName: string
): Promise<(T & { id: string })[]> {
  const snapshot: QuerySnapshot<DocumentData> = await getDocs(
    collection(db, collectionName)
  );

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as T),
  }));
}

/**
 * Adiciona um novo documento (não sobrescreve)
 * Ideal para histórico / versionamento
 */
export async function addDocument(
  collectionName: string,
  data: any
) {
  return await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza um documento específico
 * Usado SOMENTE quando o usuário volta e altera respostas
 */
export async function updateDocument(
  collectionName: string,
  id: string,
  data: any
) {
  const ref = firestoreDoc(db, collectionName, id);

  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove um documento (uso raro, mas mantido)
 */
export async function deleteDocument(
  collectionName: string,
  id: string
) {
  await deleteDoc(firestoreDoc(db, collectionName, id));
}
