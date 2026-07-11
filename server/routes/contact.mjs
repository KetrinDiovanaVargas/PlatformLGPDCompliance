import express from "express";
import nodemailer from "nodemailer";
import { getAdminDb } from "../firebaseAdmin.mjs";

const router = express.Router();

// E-mail que recebe os contatos (configurável; padrão: a dona da plataforma)
const RECIPIENT = process.env.CONTACT_RECIPIENT || "ketrin.diovana.vargas@gmail.com";

const TIPO_LABEL = {
  demonstracao: "Quero uma demonstração",
  contato: "Quero entrar em contato",
};

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Cria o transporte do Gmail (null se as credenciais não estiverem configuradas)
function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

/**
 * POST /api/contact
 * Recebe o formulário de contato, salva no Firestore (backup) e envia
 * um e-mail para o RECIPIENT via Gmail.
 */
router.post("/", async (req, res) => {
  const nome = safeString(req.body?.nome);
  const email = safeString(req.body?.email).toLowerCase();
  const tipoRaw = safeString(req.body?.tipo, "contato");
  const tipo = TIPO_LABEL[tipoRaw] ? tipoRaw : "contato";
  const mensagem = safeString(req.body?.mensagem);

  if (!nome || !email || !mensagem) {
    return res.status(400).json({ error: "Preencha nome, e-mail e mensagem." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "E-mail inválido." });
  }

  const tipoLabel = TIPO_LABEL[tipo];

  // 1) Salva no Firestore (backup — nunca perde a mensagem)
  let saved = false;
  try {
    const db = getAdminDb();
    await db.collection("contacts").add({
      nome,
      email,
      tipo,
      mensagem,
      status: "novo",
      createdAt: new Date(),
    });
    saved = true;
  } catch (err) {
    console.error("⚠️  Falha ao salvar contato no Firestore:", err?.message);
  }

  // 2) Envia o e-mail
  let emailed = false;
  const transport = getTransport();
  if (transport) {
    try {
      await transport.sendMail({
        from: `"LGPD Compliance" <${process.env.GMAIL_USER}>`,
        to: RECIPIENT,
        replyTo: email,
        subject: `[Contato] ${tipoLabel} — ${nome}`,
        text:
          `Novo contato pela plataforma LGPD Compliance\n\n` +
          `Tipo: ${tipoLabel}\n` +
          `Nome: ${nome}\n` +
          `E-mail: ${email}\n\n` +
          `Mensagem:\n${mensagem}\n`,
        html:
          `<h2>Novo contato pela plataforma LGPD Compliance</h2>` +
          `<p><strong>Tipo:</strong> ${tipoLabel}</p>` +
          `<p><strong>Nome:</strong> ${nome}</p>` +
          `<p><strong>E-mail:</strong> <a href="mailto:${email}">${email}</a></p>` +
          `<p><strong>Mensagem:</strong></p>` +
          `<p style="white-space:pre-wrap">${mensagem}</p>`,
      });
      emailed = true;
      console.log(`✉️  Contato enviado por e-mail para ${RECIPIENT}`);
    } catch (err) {
      console.error("❌ Falha ao enviar e-mail de contato:", err?.message);
    }
  } else {
    console.warn("⚠️  GMAIL_USER/GMAIL_APP_PASSWORD não configurados — e-mail não enviado.");
  }

  // Sucesso se pelo menos uma via funcionou (não perdemos a mensagem)
  if (!saved && !emailed) {
    return res.status(500).json({
      error: "Não foi possível registrar seu contato agora. Tente novamente.",
    });
  }

  return res.json({ ok: true, saved, emailed });
});

export default router;
