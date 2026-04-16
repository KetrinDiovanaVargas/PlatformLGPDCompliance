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
dotenv.config({
  path: path.resolve(__dirname, ".env"),
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

function getFirebaseAdminCredential() {
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
  if (fs.existsSync(serviceAccountPath)) {
    const raw = fs.readFileSync(serviceAccountPath, "utf8");
    const serviceAccount = JSON.parse(raw);
    return admin.credential.cert(serviceAccount);
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
      "",
      "Firebase Console → Project settings → Service accounts → Generate new private key.",
    ].join("\n")
  );
}

// ======================================================
// INIT FIREBASE ADMIN
// ======================================================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: getFirebaseAdminCredential(),
  });
}

// ======================================================
// EXPORTS
// ======================================================
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

// alias para evitar quebrar código antigo
export const db = adminDb;

export default admin;