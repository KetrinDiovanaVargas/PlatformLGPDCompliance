/**
 * @fileoverview Rotas de Contato - Express Router
 * 
 * Módulo que expõe endpoint HTTP para recebimento de formulário de contato.
 * Processa requisições de contato/demonstração, valida dados, persiste em Firestore
 * e envia notificação por e-mail via Gmail.
 * 
 * @module routes/contact
 * 
 * @requires express
 * @requires nodemailer
 * @requires ../firebaseAdmin.mjs
 * 
 * Configuração necessária (variáveis de ambiente):
 * - CONTACT_RECIPIENT: E-mail que recebe as mensagens (padrão: ketrin.diovana.vargas@gmail.com)
 * - GMAIL_USER: Conta Gmail para enviar e-mails
 * - GMAIL_APP_PASSWORD: Senha de aplicativo do Gmail
 * 
 * Funcionalidades:
 * - Validação de campos obrigatórios
 * - Validação de formato de e-mail
 * - Persistência em Firestore (backup)
 * - Envio de notificação por e-mail
 * - Fallback gracioso se uma via falhar
 */

import express from "express";
import nodemailer from "nodemailer";
import { getAdminDb } from "../firebaseAdmin.mjs";

/**
 * Router Express para gerenciar rotas de contato.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * E-mail que recebe os contatos da plataforma.
 * 
 * Configurável via variável de ambiente CONTACT_RECIPIENT.
 * Padrão é o e-mail da administradora da plataforma.
 * 
 * @type {string}
 * @default "ketrin.diovana.vargas@gmail.com"
 */
const RECIPIENT = process.env.CONTACT_RECIPIENT || "ketrin.diovana.vargas@gmail.com";

/**
 * Mapeamento de tipos de contato para labels legíveis.
 * 
 * Define os tipos de contato aceitos e suas representações
 * em português para exibição nos e-mails e relatórios.
 * 
 * @type {Object.<string, string>}
 * @property {string} demonstracao - Requisição de demonstração da plataforma
 * @property {string} contato - Contato geral/suporte
 * 
 * @example
 * TIPO_LABEL.demonstracao // → "Quero uma demonstração"
 * TIPO_LABEL.contato // → "Quero entrar em contato"
 */
const TIPO_LABEL = {
  demonstracao: "Quero uma demonstração",
  contato: "Quero entrar em contato",
};

/**
 * Converte valor para string segura e trimada.
 * 
 * Garante que valores undefined/null sejam convertidos para fallback
 * e remove espaços em branco desnecessários.
 * 
 * @param {*} value - Valor a converter para string
 * @param {string} [fallback=""] - Valor padrão se value for falsy
 * @returns {string} String segura, trimada e nunca null
 * 
 * @example
 * safeString(null) // → ""
 * @example
 * safeString("  contato  ") // → "contato"
 * @example
 * safeString(undefined, "padrão") // → "padrão"
 */
function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

/**
 * Valida formato de endereço de e-mail.
 * 
 * Implementa validação básica via regex para detectar erros
 * óbvios (caracteres inválidos, falta de @, domínio inválido).
 * 
 * ⚠️ **Nota**: Esta é uma validação básica. Para garantir que o
 * e-mail é válido e funcional, implementar verificação de bounce
 * ou envio de confirmação é recomendado.
 * 
 * @param {string} email - E-mail a validar
 * @returns {boolean} True se o formato é válido, false caso contrário
 * 
 * @example
 * isValidEmail("usuario@example.com") // → true
 * @example
 * isValidEmail("usuario@invalid") // → false
 * @example
 * isValidEmail("usuario") // → false
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Cria e retorna transporte Nodemailer para Gmail.
 * 
 * Configura o transporte SMTP do Gmail utilizando credenciais
 * das variáveis de ambiente GMAIL_USER e GMAIL_APP_PASSWORD.
 * 
 * Retorna null se as credenciais não estiverem configuradas,
 * permitindo que a aplicação funcione em modo degradado
 * (apenas persistindo em Firestore).
 * 
 * ℹ️ **Configuração do Gmail**: Usar senha de aplicativo ("App Password")
 * e não a senha da conta pessoal. Ativar autenticação 2-fatores na conta Gmail.
 * 
 * @returns {Object|null} Transporte Nodemailer configurado ou null
 * 
 * @example
 * const transport = getTransport();
 * if (transport) {
 *   await transport.sendMail({ to: "...", subject: "..." });
 * }
 */
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
 * Recebe, valida e processa formulário de contato.
 * 
 * Fluxo:
 * 1. Valida campos obrigatórios (nome, e-mail, mensagem)
 * 2. Valida formato de e-mail
 * 3. Persiste contato em Firestore (backup permanente)
 * 4. Envia notificação por e-mail ao RECIPIENT
 * 5. Retorna status de ambas operações
 * 
 * ✅ **Garantia de Persistência**: Se pelo menos uma via (Firestore ou e-mail)
 * funcionar, a mensagem é considerada recebida com sucesso. Nunca perderemos
 * contatos se o e-mail falhar enquanto Firestore funcionar.
 * 
 * @async
 * @route {POST} /
 * 
 * @param {Object} req.body - Corpo da requisição
 * @param {string} req.body.nome - Nome do remetente (obrigatório)
 * @param {string} req.body.email - E-mail do remetente (obrigatório, validado)
 * @param {string} [req.body.tipo="contato"] - Tipo de contato: "demonstracao" ou "contato"
 * @param {string} req.body.mensagem - Corpo da mensagem (obrigatório)
 * 
 * @returns {Object} Resultado do processamento contendo:
 * @returns {boolean} returns.ok - True se processado com sucesso
 * @returns {boolean} returns.saved - True se salvo em Firestore
 * @returns {boolean} returns.emailed - True se e-mail foi enviado
 * 
 * @throws {400} Campos obrigatórios faltando (nome, e-mail ou mensagem)
 * @throws {400} Formato de e-mail inválido
 * @throws {500} Falha ao processar (ambas as vias falharam)
 * 
 * @example
 * // POST /
 * // Content-Type: application/json
 * {
 *   "nome": "João Silva",
 *   "email": "joao@example.com",
 *   "tipo": "demonstracao",
 *   "mensagem": "Gostaria de conhecer a plataforma."
 * }
 * 
 * @example
 * // Response 200 (sucesso)
 * {
 *   "ok": true,
 *   "saved": true,
 *   "emailed": true
 * }
 * 
 * @example
 * // Response 200 (fallback: apenas Firestore funcionou)
 * {
 *   "ok": true,
 *   "saved": true,
 *   "emailed": false
 * }
 * 
 * @example
 * // Response 400 (campos faltando)
 * {
 *   "error": "Preencha nome, e-mail e mensagem."
 * }
 * 
 * @example
 * // Response 400 (e-mail inválido)
 * {
 *   "error": "E-mail inválido."
 * }
 * 
 * @example
 * // Response 500 (ambas vias falharam)
 * {
 *   "error": "Não foi possível registrar seu contato agora. Tente novamente."
 * }
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