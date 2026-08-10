/**
 * 
 * Módulo responsável por:
 * 1. Resolver credenciais do Firebase Admin com fallbacks inteligentes
 * 2. Inicializar a aplicação Firebase Admin
 * 3. Fornecer acesso seguro ao Firestore e Auth
 * 
 * Estratégia de resolução de credenciais (ordem de prioridade):
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (env, base64-encoded)
 * 2. FIREBASE_SERVICE_ACCOUNT_JSON (env, JSON completo)
 * 3. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (env vars individuais)
 * 4. Fallback: VITE_FIREBASE_* (não recomendado para admin)
 * 5. server/serviceAccountKey.json (arquivo, dev local)
 * 6. GOOGLE_APPLICATION_CREDENTIALS (ADC - Application Default Credentials)
 * 
 * Credenciais de navegador (VITE_FIREBASE_APIKEY, authDomain, etc)
 * NÃO substituem credenciais Admin. Admin sempre precisa de uma Service Account.
 * 
 * @module firebaseAdmin
 * 
 * @requires firebase-admin
 * @requires dotenv
 * @requires fs
 * @requires path
 * @requires url (ESM fileURLToPath)
 * 
 * Variáveis de ambiente suportadas:
 * - FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: Service Account em base64
 * - FIREBASE_SERVICE_ACCOUNT_JSON: Service Account JSON (string)
 * - FIREBASE_PROJECT_ID: Project ID do Firebase
 * - FIREBASE_CLIENT_EMAIL: E-mail da Service Account
 * - FIREBASE_PRIVATE_KEY: Private key (com \n escapados)
 * - GOOGLE_APPLICATION_CREDENTIALS: Caminho para arquivo ADC
 * - FIREBASE_USE_ADC: "true" para forçar Application Default Credentials
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Configuração de paths para ESM (import.meta.url).
 * 
 * Em módulos ES6, não temos __filename e __dirname disponíveis.
 * Estas linhas os reconstroem a partir de import.meta.url.
 * 
 * @type {string}
 * @const
 */
const __filename = fileURLToPath(import.meta.url);

/**
 * Diretório do arquivo atual (server/).
 * 
 * Usado para:
 * - Resolver caminhos de .env e serviceAccountKey.json
 * - Garantir que path.resolve() aponte para o diretório correto
 * 
 * @type {string}
 * @const
 */
const __dirname = path.dirname(__filename);

/**
 * Carrega variáveis de ambiente de múltiplas fontes.
 * 
 * Carrega em ordem:
 * 1. server/.env (local backend)
 * 2. .env root (configuração compartilhada)
 * 
 * Variáveis em .env posterior sobrescrevem anteriores.
 * 
 * @type {void}
 */
dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

/**
 * Retorna primeiro valor não-vazio de uma lista de nomes de variáveis de ambiente.
 * 
 * Útil para fallback entre nomes de variáveis (ex: FIREBASE_PROJECT_ID ou VITE_FIREBASE_PROJECT_ID).
 * Retorna undefined se nenhum valor for encontrado ou todos forem vazios.
 * 
 *  Primeiro match vence.
 * 
 * @param {...string} names - Nomes de variáveis de ambiente a tentar
 * @returns {string|undefined} Valor da primeira variável encontrada ou undefined
 * 
 * @example
 * firstEnv("FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID")
 * // → process.env.FIREBASE_PROJECT_ID se definida
 * // → process.env.VITE_FIREBASE_PROJECT_ID caso contrário
 * // → undefined se nenhuma estiver definida
 */
function firstEnv(...names) {
  for (const name of names) {
    const v = process.env[name];
    if (v && String(v).trim().length > 0) return v;
  }
  return undefined;
}

/**
 * Lê e parseia arquivo JSON com validação robusta.
 * 
 * Verifica:
 * - Existência do arquivo
 * - Se é um arquivo (não diretório)
 * - Se não está vazio
 * - Se contém JSON válido
 * 
 * Retorna objeto com propriedade `__error` se falhar, facilitando detecção de erro.
 * 
 * @param {string} filePath - Caminho absoluto ao arquivo JSON
 * @returns {Object|null} Objeto parseado, objeto com `__error`, ou null se não existe
 * @returns {string} returns.__error - Tipo de erro: "EMPTY_FILE" | "INVALID_JSON"
 * @returns {string} [returns.message] - Mensagem de erro do parser
 * 
 * @example
 * const json = readJsonFromFile("/path/to/serviceAccountKey.json");
 * if (json?.__error) {
 *   console.error("Erro:", json.message);
 * } else {
 *   // json é um objeto válido
 * }
 */
function readJsonFromFile(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return null;
  if (stat.size === 0) return { __error: "EMPTY_FILE" };

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return { __error: "INVALID_JSON", message: err?.message };
  }
}

/**
 * Parseia JSON a partir de uma string de variável de ambiente.
 * 
 * Útil quando a Service Account inteira é passada como uma variável de ambiente
 * (comum em CI/CD e containers).
 * 
 *  JSON válido em uma única linha ou multi-linha com
 * caracteres de escape corretos (backslash-n para quebra de linha, etc).
 * 
 * @param {string|undefined} value - Conteúdo da variável de ambiente
 * @returns {Object|null} Objeto parseado, objeto com `__error`, ou null se vazio
 * @returns {string} returns.__error - Tipo de erro: "INVALID_JSON"
 * 
 * @example
 * const json = parseJsonEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
 * // Espera: '{"type":"service_account","project_id":"..."}'
 */
function parseJsonEnv(value) {
  if (!value) return null;
  try {
    return JSON.parse(String(value));
  } catch (err) {
    return { __error: "INVALID_JSON", message: err?.message };
  }
}

/**
 * Parseia JSON a partir de uma string base64 de variável de ambiente.
 * 
 * Fluxo:
 * 1. Decodifica base64 → UTF-8
 * 2. Parseia resultado como JSON
 * 
 * Útil em CI/CD onde passar JSON literal em env vars causa problemas com quotes/escapes.
 * 
 *
 * 
 * @param {string|undefined} value - Conteúdo base64 da variável de ambiente
 * @returns {Object|null} Objeto parseado, objeto com `__error`, ou null se vazio
 * @returns {string} returns.__error - Tipo de erro: "INVALID_BASE64_JSON"
 * 
 * @example
 * const b64 = Buffer.from('{"type":"service_account","project_id":"my-project"}').toString('base64');
 * const json = parseBase64JsonEnv(b64);
 * // → { type: "service_account", project_id: "my-project" }
 */
function parseBase64JsonEnv(value) {
  if (!value) return null;

  try {
    const decoded = Buffer.from(String(value), "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch (err) {
    return { __error: "INVALID_BASE64_JSON", message: err?.message };
  }
}

/**
 * Resolve e retorna credencial do Firebase Admin com estratégia de fallback.
 * 
 * Ordem de tentativa (primeira que sucessa é usada):
 * 1. **Base64-encoded Service Account** (FIREBASE_SERVICE_ACCOUNT_JSON_BASE64)
 *    - Mais seguro em CI/CD; evita problemas com escapes
 * 2. **Service Account JSON inline** (FIREBASE_SERVICE_ACCOUNT_JSON)
 *    - Útil para containers; JSON inteiro em uma env var
 * 3. **Campos individuais** (PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY)
 *    - Melhor para ambientes com restrições de tamanho de env var
 *    - Fallback para VITE_* (não recomendado)
 * 4. **Arquivo local** (server/serviceAccountKey.json)
 *    - Padrão para desenvolvimento local
 * 5. **Application Default Credentials** (GOOGLE_APPLICATION_CREDENTIALS)
 *    - Último recurso; busca credenciais do sistema/GCP
 * 
 *  Se nenhuma estratégia funcionar, lança erro detalhado
 * com instruções de como configurar.
 * 
 * @returns {admin.ServiceAccount} Credencial para inicializar Firebase Admin
 * @throws {Error} Se nenhuma credencial válida for encontrada (com instruções)
 * 
 * 
function getFirebaseAdminCredential() {
  // 0) Full service account JSON via env (útil para CI/CD, containers)
  const saJsonB64 = firstEnv("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
  const saJson = firstEnv("FIREBASE_SERVICE_ACCOUNT_JSON");

  if (saJsonB64) {
    const parsed = parseBase64JsonEnv(saJsonB64);
    if (parsed?.__error) {
      throw new Error(
        `❌ FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 inválida: ${parsed.message || parsed.__error}`
      );
    }

    return admin.credential.cert(parsed);
  }

  if (saJson) {
    const parsed = parseJsonEnv(saJson);
    if (parsed?.__error) {
      throw new Error(
        `❌ FIREBASE_SERVICE_ACCOUNT_JSON inválida: ${parsed.message || parsed.__error}`
      );
    }

    return admin.credential.cert(parsed);
  }

  const projectId = firstEnv("FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID");
  const clientEmail = firstEnv("FIREBASE_CLIENT_EMAIL", "VITE_FIREBASE_CLIENT_EMAIL");
  const privateKeyRaw = firstEnv("FIREBASE_PRIVATE_KEY", "VITE_FIREBASE_PRIVATE_KEY");

  // 1) Env-based credentials (campos individuais)
  if (projectId && clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  // 2) File-based credentials (service account JSON local)
  const serviceAccountPath = path.resolve(__dirname, "serviceAccountKey.json");
  const fileJson = readJsonFromFile(serviceAccountPath);
  if (fileJson && !fileJson.__error) {
    return admin.credential.cert(fileJson);
  }

  if (fileJson?.__error) {
    const hint =
      fileJson.__error === "EMPTY_FILE"
        ? "O arquivo existe, mas está vazio (0 bytes)."
        : `O arquivo existe, mas não é JSON válido (${fileJson.message || "erro desconhecido"}).`;

    throw new Error(
      [
        "❌ serviceAccountKey.json inválido.",
        hint,
        "",
        "Corrija criando um arquivo de Service Account real em server/serviceAccountKey.json",
        "ou use as variáveis de ambiente FIREBASE_SERVICE_ACCOUNT_JSON(_BASE64).",
      ].join("\n")
    );
  }

  // 3) Application Default Credentials (ex: GOOGLE_APPLICATION_CREDENTIALS)
  if (firstEnv("GOOGLE_APPLICATION_CREDENTIALS") || firstEnv("FIREBASE_USE_ADC") === "true") {
    return admin.credential.applicationDefault();
  }

  // Falha com mensagem de ajuda
  throw new Error(
    [
      "❌ Credenciais do Firebase Admin não configuradas.",
      "",
      "Este backend usa o Firebase Admin SDK e precisa de uma Service Account (client_email + private_key).",
      "As variáveis VITE_FIREBASE_* (apiKey/authDomain/etc) são do SDK de navegador e NÃO substituem isso.",
      "",
      "Opções:",
      "  A) Coloque server/serviceAccountKey.json (gerado no Firebase Console) no servidor.",
      "  B) Ou defina no server/.env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.",
      "  C) Ou defina FIREBASE_SERVICE_ACCOUNT_JSON (JSON inteiro) / FIREBASE_SERVICE_ACCOUNT_JSON_BASE64.",
      "  D) Ou use ADC definindo GOOGLE_APPLICATION_CREDENTIALS apontando para um JSON válido.",
      "",
      "Firebase Console → Project settings → Service accounts → Generate new private key.",
    ].join("\n")
  );
}

/**
 * Cache local para erro de inicialização do Firebase Admin.
 * 
 * Se a inicialização falhar, armazena o erro aqui para:
 * - Evitar múltiplas tentativas
 * - Permitir recuperação do erro via getFirebaseAdminInitError()
 * 
 * @type {Error|null}
 * @private
 */
let firebaseAdminInitError = null;

/**
 * Garante que Firebase Admin está inicializado (apenas uma vez).
 * 
 * Comportamento:
 * 1. Se já inicializado, retorna silenciosamente
 * 2. Se já falhou, retorna silenciosamente (sem re-tentar)
 * 3. Caso contrário, tenta inicializar
 * 4. Registra erro em console se falhar (mas não lança)
 * 
 *  Nunca lança erro; servidor continua rodando.
 * Erro é acessível via getFirebaseAdminInitError().
 * 
 * @returns {void}
 * @internal
 */
function ensureFirebaseAdminInitialized() {
  if (admin.apps.length) return;
  if (firebaseAdminInitError) return;

  try {
    admin.initializeApp({
      credential: getFirebaseAdminCredential(),
    });
  } catch (err) {
    firebaseAdminInitError = err;
    console.error("❌ Falha ao inicializar Firebase Admin:", err?.message || err);
  }
}

/**
 * Tenta inicializar Firebase Admin no import.
 * 
 * Execução imediata ao carregar o módulo. Se falhar,
 * a falha é silenciosa para não impedir que o servidor inicie.
 * Endpoints que precisam de Firebase podem verificar o erro com
 * getFirebaseAdminInitError().
 * 
 * @type {void}
 */
ensureFirebaseAdminInitialized();

/**
 * Retorna erro de inicialização do Firebase Admin, se houver.
 * 
 * Use para verificar se Firebase Admin falhou ao inicializar
 * e o motivo. Útil em endpoints que precisam de Firebase para
 * decidir se retornar 503 (Service Unavailable).
 * 
 * @returns {Error|null} Erro de inicialização ou null se OK
 * 
 * @example
 * const err = getFirebaseAdminInitError();
 * if (err) {
 *   return res.status(503).json({ error: "Firebase não configurado", details: err.message });
 * }
 * const db = getAdminDb();
 * // ... usar db
 */
export function getFirebaseAdminInitError() {
  return firebaseAdminInitError;
}

/**
 * Retorna instância do Firestore Admin.
 * 
 * Garante que Firebase Admin está inicializado antes de retornar.
 * Se inicialização falhou, lança o erro armazenado.
 * 
 * ⚠️ **Pode lançar**: Erro de inicialização (credenciais inválidas, etc).
 * Sempre use try-catch ou verifique getFirebaseAdminInitError() antes.
 * 
 * @returns {admin.firestore.Firestore} Cliente Firestore
 * @throws {Error} Se Firebase Admin falhou ao inicializar
 * 
 * @example
 * try {
 *   const db = getAdminDb();
 *   const doc = await db.collection("users").doc("user-123").get();
 * } catch (err) {
 *   console.error("Firebase indisponível:", err.message);
 *   return res.status(503).json({ error: "Database unavailable" });
 * }
 */
export function getAdminDb() {
  ensureFirebaseAdminInitialized();
  if (firebaseAdminInitError) throw firebaseAdminInitError;
  return admin.firestore();
}

/**
 * Retorna instância do Firebase Authentication Admin.
 * 
 * Garante que Firebase Admin está inicializado antes de retornar.
 * Se inicialização falhou, lança o erro armazenado.
 * 
 *  Erro de inicialização (credenciais inválidas, etc).
 * Sempre use try-catch ou verifique getFirebaseAdminInitError() antes.
 * 
 * @returns {admin.auth.Auth} Cliente de autenticação
 * @throws {Error} Se Firebase Admin falhou ao inicializar
 * 
 * @example
 * try {
 *   const auth = getAdminAuth();
 *   const user = await auth.createUser({ email: "test@example.com", password: "..." });
 * } catch (err) {
 *   console.error("Auth indisponível:", err.message);
 *   return res.status(503).json({ error: "Auth unavailable" });
 * }
 */
export function getAdminAuth() {
  ensureFirebaseAdminInitialized();
  if (firebaseAdminInitError) throw firebaseAdminInitError;
  return admin.auth();
}

/**
 * Exporta a instância firebase-admin para uso direto se necessário.
 * 
 * Normalmente use getAdminDb() ou getAdminAuth() para acessar
 * serviços específicos. Esta exportação é para casos avançados que
 * precisam de funcionalidades adicionais (storage, messaging, etc).
 * 
 * @type {admin}
 * @example
 * import admin from "./firebaseAdmin.mjs";
 * // admin.firestore(), admin.auth(), admin.storage(), etc.
 */
export default admin;