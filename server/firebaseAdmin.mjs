import admin from "firebase-admin";
import dotenv from "dotenv";
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
// VALIDATION (evita erro silencioso)
// ======================================================
if (!process.env.FIREBASE_PROJECT_ID) {
  throw new Error("❌ FIREBASE_PROJECT_ID não definido no .env");
}

if (!process.env.FIREBASE_CLIENT_EMAIL) {
  throw new Error("❌ FIREBASE_CLIENT_EMAIL não definido no .env");
}

if (!process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error("❌ FIREBASE_PRIVATE_KEY não definido no .env");
}

// ======================================================
// PRIVATE KEY FIX (\n)
// ======================================================
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

// ======================================================
// INIT FIREBASE ADMIN
// ======================================================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

  console.log("🔥 Firebase Admin inicializado com sucesso");
}

// ======================================================
// EXPORTS
// ======================================================
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

// alias para evitar quebrar código antigo
export const db = adminDb;

export default admin;