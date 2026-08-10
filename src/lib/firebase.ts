/**
 * @module lib/firebase
 * @description Configuração centralizada do Firebase SDK. Inicializa serviços de
 * autenticação (Auth), banco de dados (Firestore), e armazenamento (Storage) usando
 * credenciais fornecidas por variáveis de ambiente Vite.
 *
 * @note Firestore está configurado com `experimentalForceLongPolling: true` para
 * máxima compatibilidade em redes restritas (corporativas, móvel 3G, etc).
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * Configuração do Firebase obtida de variáveis de ambiente Vite.
 *
 * Todas as chaves são carregadas em tempo de build a partir do arquivo `.env.local`
 * ou variáveis de ambiente do sistema. Formato esperado:
 * ```
 * VITE_FIREBASE_API_KEY=<chave API do projeto>
 * VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
 * VITE_FIREBASE_PROJECT_ID=<project-id>
 * VITE_FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
 * VITE_FIREBASE_MESSAGING_SENDER_ID=<número>
 * VITE_FIREBASE_APP_ID=<app id>
 * ```
 *
 * @type {Object}
 * @property {string} apiKey - Chave pública para autenticação de requisições (Web API Key)
 * @property {string} authDomain - Domínio para fluxo de autenticação OAuth/Google Sign-In
 * @property {string} projectId - ID único do projeto Firebase
 * @property {string} storageBucket - Bucket de armazenamento Cloud Storage padrão
 * @property {string} messagingSenderId - ID de remetente para Cloud Messaging (Cloud Pub/Sub)
 * @property {string} appId - ID único da aplicação Firebase
 *
 * @const
 * @private
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Instância inicializada do Firebase App.
 *
 * Ponto central de inicialização dos serviços Firebase (Auth, Firestore, Storage).
 * Configurada uma única vez e reutilizada por todos os módulos que dependem de
 * serviços Firebase.
 *
 * @type {FirebaseApp}
 * @const
 * @private
 */
const app = initializeApp(firebaseConfig);

/**
 * Instância de Firebase Authentication.
 *
 * Fornece métodos para registro, login, logout e gerenciamento de sessão de usuários.
 * Integrada com Google Sign-In, email/senha e suporta Multi-Factor Authentication (MFA).
 *
 * @type {Auth}
 * @const
 * @see {@link ../services/authService.ts} Para funções de alto nível (registerUser, loginUser, etc)
 *
 * @example
 * // Não usar diretamente; preferir camada de serviço
 * import { loginUser } from "@/services/authService";
 * const user = await loginUser("email@example.com", "password");
 */
export const auth = getAuth(app);

/**
 * Instância de Firestore Database.
 *
 * Banco de dados NoSQL em tempo real com suporte a queries complexas, transactions
 * e sincronização automática de dados. Configurado com `experimentalForceLongPolling: true`
 * para máxima compatibilidade com redes restritas.
 *
 * Configuração de Conectividade:
 * - Por padrão, Firestore usa WebChannel (WebSocket/gRPC-Web) para comunicação
 * - Alguns navegadores, firewalls corporativos e redes móveis bloqueiam WebChannel
 * - Long-polling fallback é mais lento (requisições HTTP frequentes) mas mais resiliente
 * - Flag `experimentalForceLongPolling: true` força sempre long-polling, evitando timeouts
 *   intermitentes em ambientes restritos
 *
 * @type {Firestore}
 * @const
 * @see {@link ../services/assessmentService.ts} Para operações CRUD (saveResponsesStage, saveFinalReport)
 * @see {@link ../services/databaseService.ts} Para operações genéricas (getCollectionData, addDocument)
 *
 * @example
 * // Não usar diretamente; preferir camada de serviço
 * import { saveResponsesStage } from "@/services/assessmentService";
 * await saveResponsesStage(userId, sessionId, assessmentId, responses, stage);
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

/**
 * Instância de Cloud Storage.
 *
 * Armazenamento em nuvem para arquivos (imagens, PDFs, relatórios, etc).
 * Integrado com Firestore para referências cruzadas e suporta segurança granular
 * via Firebase Storage Security Rules.
 *
 * @type {FirebaseStorage}
 * @const
 * @see Firebase Storage Documentation: https://firebase.google.com/docs/storage
 *
 * @example
 * // Não usar diretamente; preferir camada de serviço quando implementada
 * // Exemplo futuro de serviço de storage:
 * // import { uploadFile } from "@/services/storageService";
 * // const url = await uploadFile("reports/report_123.pdf", pdfBlob);
 */
export const storage = getStorage(app);