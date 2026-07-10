#!/usr/bin/env node

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getAdminAuth, getAdminDb } from "../server/firebaseAdmin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({
  path: path.resolve(__dirname, "../server/.env"),
});

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// Admin accounts to create
const ADMINS_TO_CREATE = [
  {
    email: "platformlgpdcompliance@gmail.com",
    password: "Lgpd2026PL@TFORM",
    role: "MASTER",
    displayName: "Master Administrator",
  },
  {
    email: "admin@gmail.com",
    password: "Lgpd2026PL@TFORM",
    role: "ADMIN",
    displayName: "Administrator",
  },
];

async function createAdmin(auth, db, adminData) {
  try {
    console.log(`📝 Criando conta: ${adminData.email} (${adminData.role})`);

    // Cria usuário no Firebase Auth
    let user;
    try {
      user = await auth.createUser({
        email: adminData.email,
        password: adminData.password,
        displayName: adminData.displayName,
      });
      console.log(`   ✅ Conta criada no Firebase Auth (UID: ${user.uid})`);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        console.log(`   ⚠️  Email já existe, buscando usuário...`);
        const existingUser = await auth.getUserByEmail(adminData.email);
        user = existingUser;
        // Atualiza senha
        await auth.updateUser(user.uid, { password: adminData.password });
        console.log(`   ✅ Senha atualizada`);
      } else {
        throw err;
      }
    }

    // Cria/atualiza documento no Firestore
    const adminRef = db.collection("admins").doc(user.uid);

    const adminDoc = {
      uid: user.uid,
      email: adminData.email.toLowerCase(),
      role: adminData.role.toUpperCase(),
      displayName: adminData.displayName,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await adminRef.set(adminDoc, { merge: true });
    console.log(`   ✅ Documento criado no Firestore`);

    return {
      success: true,
      uid: user.uid,
      email: adminData.email,
      role: adminData.role,
    };

  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}`);
    return {
      success: false,
      email: adminData.email,
      error: error.message,
    };
  }
}

async function setupAdmins() {
  try {
    console.log(`🔐 Configurando contas de administrador\n`);

    const auth = getAdminAuth();
    const db = getAdminDb();

    const results = [];

    for (const adminData of ADMINS_TO_CREATE) {
      const result = await createAdmin(auth, db, adminData);
      results.push(result);
    }

    // Resumo
    console.log(`\n${"═".repeat(60)}`);
    console.log(`✅ SETUP COMPLETO`);
    console.log(`${"═".repeat(60)}\n`);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
      console.log(`✅ Contas criadas com sucesso: ${successful.length}`);
      successful.forEach(r => {
        console.log(`   • ${r.email} (${r.role})`);
      });
    }

    if (failed.length > 0) {
      console.log(`\n❌ Contas com erro: ${failed.length}`);
      failed.forEach(r => {
        console.log(`   • ${r.email}: ${r.error}`);
      });
    }

    console.log(`\n🎯 Próximas etapas:`);
    console.log(`   1. Acesse: https://platformlgpdcompliance.vercel.app/admin`);
    console.log(`   2. Faça login com:`);
    console.log(`      Email: platformlgpdcompliance@gmail.com`);
    console.log(`      Senha: Lgpd2026PL@TFORM`);
    console.log(`\n✅ Sistema pronto para testes reais!\n`);

    process.exit(successful.length > 0 ? 0 : 1);

  } catch (error) {
    console.error("❌ Erro fatal:", error.message);
    process.exit(1);
  }
}

// Run
setupAdmins();
