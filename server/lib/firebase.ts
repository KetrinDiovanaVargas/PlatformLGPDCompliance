/**
 * Inicialização centralizada do Firebase Admin SDK.
 * 
 * Configura autenticação e Firestore usando credenciais de variáveis de ambiente.
 * @module lib/firebase-admin
 */

import admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    admin.initializeApp();
  }
}

/**
 * Instância do Firebase Authentication.
 * @type {admin.auth.Auth}
 */
export const auth = admin.auth();

/**
 * Instância do Firestore Database.
 * @type {admin.firestore.Firestore}
 */
export const db = admin.firestore();

/**
 * Instância do Firebase Admin SDK.
 * @type {admin.app.App}
 */
export default admin;