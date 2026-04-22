import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ======================================================
// PATH CONFIG (ESM)
// ======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================================================
// LOAD ENV (CORRIGIDO)
// ======================================================
// Load backend env (server/.env) and optionally root env.
dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// ======================================================
// CREDENTIAL RESOLUTION
// - Prefer env vars (FIREBASE_*)
// - Fallback to serviceAccountKey.json (local dev)
// ======================================================
function firstEnv(...names) {
  for (const name of names) {
    const v = process.env[name];
    if (v && String(v).trim().length > 0) return v;
  }
  return undefined;
}

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

function parseJsonEnv(value) {
  if (!value) return null;
  try {
    return JSON.parse(String(value));
  } catch (err) {
    return { __error: "INVALID_JSON", message: err?.message };
  }
}

function parseBase64JsonEnv(value) {
  if (!value) return null;

  try {
    const decoded = Buffer.from(String(value), "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch (err) {
    return { __error: "INVALID_BASE64_JSON", message: err?.message };
  }
}

function getFirebaseAdminCredential() {
  // 0) Full service account JSON via env (useful for CI / containers)
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

  // 1) Env-based credentials
  if (projectId && clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  // 2) File-based credentials (service account JSON)
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

  // 3) Application Default Credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS)
  if (firstEnv("GOOGLE_APPLICATION_CREDENTIALS") || firstEnv("FIREBASE_USE_ADC") === "true") {
    return admin.credential.applicationDefault();
  }

  // 3) Fail with actionable message
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

// ======================================================
// INIT FIREBASE ADMIN
// ======================================================
let firebaseAdminInitError = null;

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

// Try to initialize on import, but never crash the server.
ensureFirebaseAdminInitialized();

export function getFirebaseAdminInitError() {
  return firebaseAdminInitError;
}

export function getAdminDb() {
  ensureFirebaseAdminInitialized();
  if (firebaseAdminInitError) throw firebaseAdminInitError;
  return admin.firestore();
}

export function getAdminAuth() {
  ensureFirebaseAdminInitialized();
  if (firebaseAdminInitError) throw firebaseAdminInitError;
  return admin.auth();
}

export default admin;