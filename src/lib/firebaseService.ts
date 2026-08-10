/**
 * @module lib/firebaseStorage
 * @description Utilitário simplificado para persistência de respostas de avaliação
 * no Firestore. Implementa padrão de subcoleção por usuário para isolamento de dados
 * e escalabilidade horizontal.
 *
 * @architecture Estrutura Firestore:
 *   ```
 *   responses/
 *   └── {userId}/
 *       └── items/
 *           ├── {docId1}: { responses: {...}, created_at: timestamp }
 *           ├── {docId2}: { responses: {...}, created_at: timestamp }
 *           └── ...
 *   ```
 * 
 * @note Alternativa simplificada a `assessmentService.ts` quando versionamento
 * não é necessário. Útil para prototipagem rápida ou sessões sem histórico.
 */

import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Persiste respostas de uma sessão de avaliação em subcoleção isolada por usuário.
 *
 * Implementa modelo de armazenamento simples (append-only) sem deduplicação ou
 * versionamento. Cada chamada cria um novo documento dentro da subcoleção
 * `responses/{userId}/items`. Útil para sessões únicas ou quando histórico
 * granular não é necessário.
 *
 * O timestamp é gerado no servidor (serverTimestamp()), garantindo sincronização
 * de relógio entre clientes.
 *
 * @async
 * @function saveResponses
 * @param {string} userId - Identificador único do usuário autenticado.
 *   Usado como chave de partição para subcoleção (isolamento de dados).
 * @param {Record<string, any>} responses - Objeto arbitrário contendo respostas
 *   da avaliação. Estrutura flexível: pode ser `{ 0: answer0, 1: answer1, ... }`
 *   ou `{ questionId: { question, answer }, ... }` ou qualquer mapeamento.
 * @returns {Promise<Object>} Objeto contendo:
 *   - `id: string` - ID único do documento Firestore criado (pode referenciar depois)
 *   - `...responses` - Spread do objeto responses (todos os campos inclusos)
 *   - Implícito: campo `created_at` foi adicionado no servidor
 * @throws {Error} Se:
 *   - `userId` ausente ou inválido
 *   - Falha de permissão no Firestore (Security Rules)
 *   - Falha de conexão com Firestore
 *   - Responses ultrapassa limite de tamanho do documento (1 MB)
 *
 * @example
 * // Usuário completa avaliação e salva todas as respostas
 * const responses = {
 *   0: "Email e formulário",
 *   1: "AWS S3 Cloud",
 *   2: ["Admin", "RH", "Ti"],
 *   3: "Renovado anualmente",
 *   4: 0.75
 * };
 *
 * try {
 *   const result = await saveResponses("user_123", responses);
 *   console.log("Documento criado:", result.id);
 *   console.log("Respostas confirmadas:", result[0]); // "Email e formulário"
 * } catch (error) {
 *   console.error("Falha ao persistir:", error.message);
 * }
 *
 * @example
 * // Estrutura alternativa com metadados
 * const responses = {
 *   assessment: {
 *     personaId: "P01",
 *     stage: 2,
 *     answers: [
 *       { questionId: 0, answer: "Sim" },
 *       { questionId: 1, answer: "Não" }
 *     ]
 *   }
 * };
 *
 * const result = await saveResponses("user_456", responses);
 * // Firestore: responses/user_456/items/{docId}
 * // Content: {
 * //   responses: { assessment: {...} },
 * //   created_at: <server timestamp>
 * // }
 *
 * @see {@link ./assessmentService.ts} Para padrão com versionamento e deduplicação
 *   (recomendado para sessões com múltiplas revisões de respostas)
 */
export const saveResponses = async (
  userId: string,
  responses: Record<string, any>
) => {
  try {
    //  Caminho: responses → userId → respostas individuais
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