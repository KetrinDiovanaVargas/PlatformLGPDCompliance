#!/usr/bin/env node

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getAdminDb } from "../server/firebaseAdmin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({
  path: path.resolve(__dirname, "../server/.env"),
});

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// Collections to delete (keep only personas-related)
const COLLECTIONS_TO_DELETE = [
  "assessment_sessions",  // Sessões de usuários
  "assessments",          // Respostas dos assessments
];

const SAFE_COLLECTIONS = [
  "personas",
  "personas_profiles",
  "users",  // Manter usuários é seguro
];

async function getCollections(db) {
  const collections = [];
  const collectionRefs = await db.listCollections();

  for (const collectionRef of collectionRefs) {
    collections.push(collectionRef.id);
  }

  return collections;
}

async function deleteCollection(db, collectionName, batchSize = 100) {
  console.log(`🗑️  Deletando coleção: ${collectionName}`);

  const collectionRef = db.collection(collectionName);
  let deleted = 0;

  // Pega documentos em batches
  let query = collectionRef.limit(batchSize);

  while (true) {
    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`✅ Coleção ${collectionName} completamente deletada (${deleted} docs)`);
      break;
    }

    // Deleta batch
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deleted += snapshot.docs.length;

    console.log(`  → Deletados ${deleted} documentos...`);
  }

  return deleted;
}

async function cleanupDatabase() {
  try {
    const db = getAdminDb();

    console.log("🔍 Conectando ao Firestore...");

    // Lista todas as coleções
    const allCollections = await getCollections(db);
    console.log(`\n📊 Coleções encontradas: ${allCollections.length}`);
    allCollections.forEach(c => console.log(`   • ${c}`));

    // Identifica qual deletar
    const toDelete = allCollections.filter(c => COLLECTIONS_TO_DELETE.includes(c));
    const safe = allCollections.filter(c => SAFE_COLLECTIONS.includes(c));

    if (toDelete.length === 0) {
      console.log("\n✅ Nenhuma coleção para deletar (banco já limpo)");
      return;
    }

    console.log(`\n⚠️  AÇÃO DE LIMPEZA:`);
    console.log(`   🗑️  Será deletado: ${toDelete.join(", ")}`);
    if (safe.length > 0) {
      console.log(`   ✅ Será mantido: ${safe.join(", ")}`);
    }

    // Pede confirmação
    console.log(`\n⚠️  AVISO: Esta ação é IRREVERSÍVEL`);
    console.log(`   Digite 'confirmar' para prosseguir (sem aspas):`);

    // Lê input do usuário (stdin)
    const answer = await new Promise(resolve => {
      process.stdin.once('data', data => {
        resolve(data.toString().trim());
      });
    });

    if (answer !== "confirmar") {
      console.log("\n❌ Limpeza cancelada.");
      process.exit(0);
    }

    // Procede com limpeza
    console.log(`\n🔄 Iniciando limpeza do banco de dados...\n`);

    let totalDeleted = 0;
    for (const collectionName of toDelete) {
      const deleted = await deleteCollection(db, collectionName);
      totalDeleted += deleted;
    }

    console.log(`\n✅ LIMPEZA CONCLUÍDA`);
    console.log(`   Total de documentos deletados: ${totalDeleted}`);
    console.log(`   Coleções mantidas: ${safe.length > 0 ? safe.join(", ") : "nenhuma"}`);
    console.log(`\n✅ Banco pronto para testes reais!`);

    process.exit(0);

  } catch (error) {
    console.error("❌ Erro durante limpeza:", error.message);
    process.exit(1);
  }
}

// Run
cleanupDatabase();
