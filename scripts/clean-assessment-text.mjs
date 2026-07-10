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

async function cleanAssessments() {
  try {
    console.log("🔍 Procurando por assessments com 'UNIPAMPA'...\n");

    const db = getAdminDb();
    const assessmentsRef = db.collection("assessments");

    // Busca todos os documentos
    const snapshot = await assessmentsRef.get();

    if (snapshot.empty) {
      console.log("❌ Nenhum assessment encontrado");
      process.exit(0);
    }

    let updated = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      let modified = false;
      const updates = {};

      // Funções de limpeza
      const removeUnipampa = (text) => {
        if (!text) return text;
        return String(text)
          .replace(/UNIPAMPA\s*[\(\),]*/g, "")
          .replace(/da\s+comunidade/g, "da comunidade")
          .replace(/—\s*alunos/g, "— alunos")
          .replace(/\s+/g, " ")
          .trim();
      };

      // Limpa introText
      if (data.introText && data.introText.includes("UNIPAMPA")) {
        updates.introText = removeUnipampa(data.introText);
        modified = true;
      }

      // Limpa context
      if (data.context && data.context.includes("UNIPAMPA")) {
        updates.context = removeUnipampa(data.context);
        modified = true;
      }

      // Limpa title
      if (data.title && data.title.includes("UNIPAMPA")) {
        updates.title = removeUnipampa(data.title);
        modified = true;
      }

      if (modified) {
        updates.updatedAt = new Date();
        await assessmentsRef.doc(doc.id).update(updates);
        updated++;

        console.log(`✅ Atualizado: ${data.title || "Assessment"}`);
        if (updates.introText) console.log(`   • introText limpo`);
        if (updates.context) console.log(`   • context limpo`);
        if (updates.title) console.log(`   • title limpo`);
      }
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`✅ LIMPEZA CONCLUÍDA`);
    console.log(`${"═".repeat(60)}`);
    console.log(`Total de assessments atualizados: ${updated}`);
    console.log(`\n✅ Palavra 'UNIPAMPA' removida com sucesso!\n`);

    process.exit(0);

  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

// Run
cleanAssessments();
