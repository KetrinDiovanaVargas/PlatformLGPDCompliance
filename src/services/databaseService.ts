/**
 * @module services/databaseService
 * @description Serviço de persistência de dados para Firestore. Fornece operações
 * CRUD (Create, Read, Update, Delete) genéricas com suporte a tipagem TypeScript
 * e gerenciamento automático de timestamps do servidor.
 *
 * @note Este serviço é otimizado para elicitação adaptativa, com suporte a
 * versionamento de respostas através de adição de novos documentos e atualização
 * controlada de documentos existentes.
 */

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
 * Recupera todos os documentos de uma coleção Firestore.
 *
 * Esta função realiza uma leitura de todos os documentos presentes na coleção
 * especificada. Cada documento é enriquecido com seu identificador único (id)
 * proveniente do Firestore e tipado através de genérico TypeScript.
 *
 * Útil para carregamentos iniciais de dados, listas completas de histórico de
 * respostas, ou validações que requerem contexto global da coleção.
 *
 * @async
 * @template T - Tipo dos dados contidos nos documentos (padrão: any)
 * @function getCollectionData
 * @param {string} collectionName - Nome da coleção Firestore a consultar
 * @returns {Promise<Array<(T & { id: string })>>} Array de documentos com tipo T
 *   mais campo `id` do Firestore. Se coleção vazia, retorna array vazio `[]`.
 * @throws {Error} Lança erro se:
 *   - Coleção não existe ou foi deletada
 *   - Há falha de permissão (Firestore Security Rules)
 *   - Há falha de conexão com Firestore
 *
 * @example
 * // Recuperar histórico de respostas tipado
 * interface ResponseData {
 *   questionId: string;
 *   answer: string;
 *   timestamp: Timestamp;
 * }
 * const responses = await getCollectionData<ResponseData>("userResponses");
 * responses.forEach(r => console.log(r.id, r.answer));
 *
 * @example
 * // Listar todas as personas de validação
 * const personas = await getCollectionData("personasValidation");
 * console.log(`Total de personas: ${personas.length}`);
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
 * Adiciona um novo documento a uma coleção sem sobrescrever dados existentes.
 *
 * Esta função é ideal para operações de append-only, mantendo histórico completo
 * de mudanças. Cada novo documento recebe automaticamente um timestamp do servidor
 * no campo `createdAt`, facilitando rastreamento temporal e auditoria.
 *
 * Especialmente útil em cenários de elicitação adaptativa onde múltiplas versões
 * de respostas podem ser capturadas ao longo do tempo para análise de padrões
 * de mudança e evolução de maturidade.
 *
 * @async
 * @function addDocument
 * @param {string} collectionName - Nome da coleção Firestore destino
 * @param {*} data - Objeto com dados a serem persistidos. Será enriquecido com
 *   `createdAt: serverTimestamp()` automaticamente. Não sobrescreve se já existe.
 * @returns {Promise<DocumentReference>} Referência ao documento criado, contendo
 *   o ID gerado automaticamente pelo Firestore (acessível via `.id`)
 * @throws {Error} Lança erro se:
 *   - Há falha de permissão (Firestore Security Rules)
 *   - Dados excedem limite de tamanho do documento (1 MB)
 *   - Há falha de conexão com Firestore
 *
 * @example
 * // Registrar nova resposta do usuário (versionamento)
 * const response = {
 *   questionId: "q_001",
 *   answer: "Não implementado",
 *   confidence: 0.3,
 *   sessionId: "sess_123"
 * };
 * const docRef = await addDocument("userResponses", response);
 * console.log("Resposta registrada:", docRef.id);
 *
 * @example
 * // Adicionar novo registro de avaliação ao histórico
 * const evaluation = {
 *   personaId: "P01",
 *   score: 72,
 *   remarksCount: 5
 * };
 * await addDocument("evaluationHistory", evaluation);
 * // Timestamp automático criado no servidor
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
 * Atualiza um documento específico em uma coleção existente.
 *
 * Esta função modifica campos de um documento identificado por seu ID único,
 * sem sobrescrever documentos adicionais na coleção. Operação útil quando
 * usuários revisitam e alteram respostas anteriores, necessitando atualizar
 * valores já persistidos.
 *
 * Cada atualização recebe automaticamente um timestamp do servidor no campo
 * `updatedAt`, permitindo rastreamento de quando as alterações foram realizadas.
 *
 * @async
 * @function updateDocument
 * @param {string} collectionName - Nome da coleção Firestore contendo o documento
 * @param {string} id - ID único do documento a atualizar (obtido via Firestore)
 * @param {*} data - Objeto com campos a atualizar. Campos omitidos não são alterados
 *   (merge behavior). Será enriquecido com `updatedAt: serverTimestamp()` automaticamente.
 * @returns {Promise<void>} Promessa que resolve quando atualização é confirmada
 * @throws {Error} Lança erro se:
 *   - Documento com ID fornecido não existe
 *   - Há falha de permissão (Firestore Security Rules)
 *   - Dados excedem limite de tamanho do documento (1 MB)
 *   - Há falha de conexão com Firestore
 *
 * @example
 * // Usuário revisita pergunta e altera sua resposta
 * const updatedResponse = {
 *   answer: "Implementado parcialmente",
 *   confidence: 0.7,
 *   revisedAt: new Date().toISOString()
 * };
 * await updateDocument("userResponses", "doc_abc123", updatedResponse);
 * // Timestamp automático adicionado ao campo updatedAt
 *
 * @example
 * // Corrigir score de uma avaliação existente
 * await updateDocument("evaluations", "eval_456", {
 *   score: 85,
 *   status: "approved"
 * });
 * // Outros campos do documento permanecem intactos
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
 * Remove um documento de uma coleção Firestore.
 *
 * Esta função deleta permanentemente um documento identificado por seu ID único.
 * Uso raro em contextos de elicitação adaptativa (histórico é geralmente preservado),
 * mas mantido para casos de limpeza, remoção de dados sensíveis ou correção de
 * erros críticos.
 *
 * **Atenção**: Deleção é permanente e não pode ser desfeita. Considere usar
 * soft delete (flag `deleted: true`) para preservar auditoria histórica.
 *
 * @async
 * @function deleteDocument
 * @param {string} collectionName - Nome da coleção Firestore contendo o documento
 * @param {string} id - ID único do documento a remover
 * @returns {Promise<void>} Promessa que resolve quando deleção é confirmada
 * @throws {Error} Lança erro se:
 *   - Documento com ID fornecido não existe (sem efeito na operação)
 *   - Há falha de permissão (Firestore Security Rules)
 *   - Há falha de conexão com Firestore
 *
 * @example
 * // Remover documento específico (CUIDADO: irreversível)
 * await deleteDocument("tempEvaluations", "temp_001");
 * console.log("Documento removido");
 *
 * @example
 * // Alternativa recomendada: Soft delete para auditoria
 * await updateDocument("userResponses", "resp_789", {
 *   deleted: true,
 *   deletedAt: serverTimestamp(),
 *   deletionReason: "Usuário solicitou remoção"
 * });
 * // Documento permanece para auditoria, mas marcado como deletado
 *
 * @see updateDocument Para implementação de soft delete (preserva histórico)
 */
export async function deleteDocument(
  collectionName: string,
  id: string
) {
  await deleteDoc(firestoreDoc(db, collectionName, id));
}