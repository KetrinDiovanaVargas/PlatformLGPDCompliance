#!/usr/bin/env node

/**
 * Script de limpeza: Remove coleções de teste do Firestore
 * 
 * Deleta: assessment_sessions, assessments
 * Mantém: personas, personas_profiles, users
 * 
 * Requer confirmação manual antes de prosseguir.
 * Uso: node scripts/cleanup-db.mjs
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getAdminDb } from "../server/firebaseAdmin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../server/.env"),
});

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const COLLECTIONS_TO_DELETE = [
  "assessment_sessions",
  "assessments",
];

const SAFE_COLLECTIONS = [
  "personas",
  "personas_profiles",
  "users",
];

/**
 * Lista todas as coleções do Firestore.
 */
async function getCollections(db) {
  const collections = [];
  const collectionRefs = await db.listCollections();

  for (const collectionRef of collectionRefs) {
    collections.push(collectionRef.id);
  }

  return collections;
}

/**
 * Deleta coleção inteira em batches.
 */
async function deleteCollection(db, collectionName, batchSize = 100) {
  console.log(`  Deletando coleção: ${collectionName}`);

  const collectionRef = db.collection(collectionName);
  let deleted = 0;

  let query = collectionRef.limit(batchSize);

  while (true) {
    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(` Coleção ${collectionName} completamente deletada (${deleted} docs)`);
      break;
    }

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

/**
 * Executa limpeza com confirmação do usuário.
 */
async function cleanupDatabase() {
  try {
    const db = getAdminDb();

    console.log(" Conectando ao Firestore...");

    const allCollections = await getCollections(db);
    console.log(`\n Coleções encontradas: ${allCollections.length}`);
    allCollections.forEach(c => console.log(`   • ${c}`));

    const toDelete = allCollections.filter(c => COLLECTIONS_TO_DELETE.includes(c));
    const safe = allCollections.filter(c => SAFE_COLLECTIONS.includes(c));

    if (toDelete.length === 0) {
      console.log("\n Nenhuma coleção para deletar (banco já limpo)");
      return;
    }

    console.log(`\n  AÇÃO DE LIMPEZA:`);
    console.log(`     Será deletado: ${toDelete.join(", ")}`);
    if (safe.length > 0) {
      console.log(`    Será mantido: ${safe.join(", ")}`);
    }

    console.log(`\n AVISO: Esta ação é IRREVERSÍVEL`);
    console.log(`   Digite 'confirmar' para prosseguir (sem aspas):`);

    const answer = await new Promise(resolve => {
      process.stdin.once('data', data => {
        resolve(data.toString().trim());
      });
    });

    if (answer !== "confirmar") {
      console.log("\n Limpeza cancelada.");
      process.exit(0);
    }

    console.log(`\n Iniciando limpeza do banco de dados...\n`);

    let totalDeleted = 0;
    for (const collectionName of toDelete) {
      const deleted = await deleteCollection(db, collectionName);
      totalDeleted += deleted;
    }

    console.log(`\n LIMPEZA CONCLUÍDA`);
    console.log(`   Total de documentos deletados: ${totalDeleted}`);
    console.log(`   Coleções mantidas: ${safe.length > 0 ? safe.join(", ") : "nenhuma"}`);
    console.log(`\n Banco pronto para testes reais!`);

    process.exit(0);

  } catch (error) {
    console.error(" Erro durante limpeza:", error.message);
    process.exit(1);
  }
}

cleanupDatabase();