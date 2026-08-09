/**
 * Inicialização centralizada do Firebase Admin SDK.
 * 
 * Configura autenticação com credenciais de serviço e fornece acesso
 * aos módulos admin e Firestore.
 * @module lib/firebase-admin
 */

import admin from "firebase-admin";
import serviceAccount from "../serviceAccountKey.json" assert { type: "json" };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Instância do Firestore Database do Firebase.
 * @type {admin.firestore.Firestore}
 */
const db = admin.firestore();

/**
 * Instância do Firebase Admin SDK.
 * @type {admin.app.App}
 */
export { admin, db };