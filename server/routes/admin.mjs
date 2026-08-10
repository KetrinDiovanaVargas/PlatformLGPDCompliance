/**
 * Rotas administrativas de gerenciamento de administradores da plataforma.
 *
 * Expõe criação, ativação/inativação e exclusão de administradores. Todas as
 * operações exigem que o solicitante (`requesterUid`) seja um administrador
 * ativo com papel MASTER, e o sistema nunca permite ficar sem ao menos um
 * MASTER ativo.
 *
 * Montado em `/api/admin` atrás de `adminLimiter`, `authMiddleware` e
 * `adminMiddleware` (ver server.mjs).
 * @module routes/admin
 */

import express from "express";
import { getAdminAuth, getAdminDb } from "../firebaseAdmin.mjs";

const router = express.Router();

/**
 * Converte um valor qualquer em string sem espaços nas pontas.
 * @param {unknown} value Valor a ser normalizado.
 * @param {string} [fallback=""] Valor usado quando `value` é `null`/`undefined`.
 * @returns {string} String normalizada.
 */
function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

/**
 * Normaliza um e-mail para minúsculas e sem espaços nas pontas.
 * @param {unknown} email E-mail informado na requisição.
 * @returns {string} E-mail normalizado.
 */
function normalizeEmail(email) {
  return safeString(email).toLowerCase();
}

/**
 * Normaliza o papel do administrador, restringindo aos valores suportados.
 * Qualquer valor diferente de "MASTER" é tratado como "ADMIN".
 * @param {unknown} role Papel informado na requisição.
 * @returns {"MASTER"|"ADMIN"} Papel normalizado.
 */
function normalizeRole(role) {
  const normalized = safeString(role).toUpperCase();
  return normalized === "MASTER" ? "MASTER" : "ADMIN";
}

/**
 * Documento de administrador carregado do Firestore.
 * @typedef {object} AdminDoc
 * @property {FirebaseFirestore.DocumentReference} ref Referência do documento.
 * @property {FirebaseFirestore.DocumentSnapshot} snap Snapshot lido.
 * @property {Record<string, any>} data Dados do administrador.
 */

/**
 * Busca um administrador na coleção `admins` pelo UID.
 * @param {FirebaseFirestore.Firestore} adminDb Instância do Firestore Admin.
 * @param {string} uid UID do administrador (mesmo UID do Firebase Auth).
 * @returns {Promise<AdminDoc|null>} Documento encontrado ou `null` se não existir.
 */
async function getAdminDoc(adminDb, uid) {
  const ref = adminDb.collection("admins").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) return null;

  return {
    ref,
    snap,
    data: snap.data(),
  };
}

/**
 * Resultado da validação do solicitante.
 * @typedef {object} MasterValidation
 * @property {boolean} ok `true` quando o solicitante é um MASTER ativo.
 * @property {number} [status] Status HTTP a devolver quando `ok` é `false`.
 * @property {string} [error] Mensagem de erro quando `ok` é `false`.
 * @property {AdminDoc} [requester] Documento do solicitante quando `ok` é `true`.
 */

/**
 * Verifica se o solicitante existe, está ativo e possui papel MASTER.
 * @param {FirebaseFirestore.Firestore} adminDb Instância do Firestore Admin.
 * @param {string} requesterUid UID de quem está executando a ação.
 * @returns {Promise<MasterValidation>} Resultado da validação, com status/erro em caso de falha.
 */
async function validateMasterRequester(adminDb, requesterUid) {
  const requester = await getAdminDoc(adminDb, requesterUid);

  if (!requester) {
    return {
      ok: false,
      status: 403,
      error: "Solicitante não encontrado como administrador",
    };
  }

  if (!requester.data?.active) {
    return {
      ok: false,
      status: 403,
      error: "Administrador solicitante está inativo",
    };
  }

  if (safeString(requester.data?.role).toUpperCase() !== "MASTER") {
    return {
      ok: false,
      status: 403,
      error: "Apenas MASTER pode executar esta ação",
    };
  }

  return {
    ok: true,
    requester,
  };
}

/**
 * Conta quantos administradores MASTER estão ativos no sistema.
 * Usado para impedir que o último MASTER ativo seja inativado ou excluído.
 * @returns {Promise<number>} Quantidade de MASTERs ativos.
 */
async function countActiveMasters() {
  const adminDb = getAdminDb();
  const mastersSnap = await adminDb
    .collection("admins")
    .where("role", "==", "MASTER")
    .where("active", "==", true)
    .get();

  return mastersSnap.size;
}

/**
 * POST /api/admin/create-admin
 *
 * Cria um administrador no Firebase Auth e o documento correspondente na
 * coleção `admins`. Somente um MASTER ativo pode executar a ação.
 *
 * Body: `{ requesterUid, name, email, password, role? }` — `password` precisa
 * ter no mínimo 6 caracteres e `role` aceita "MASTER" (qualquer outro valor
 * vira "ADMIN").
 *
 * Respostas: 201 com o admin criado; 400 (campos/senha inválidos);
 * 403 (solicitante não é MASTER ativo); 409 (e-mail já cadastrado);
 * 503 (Firebase Admin não configurado); 500 (erro interno).
 * @param {express.Request} req Requisição Express.
 * @param {express.Response} res Resposta Express.
 * @returns {Promise<express.Response>} Resposta JSON.
 */
router.post("/create-admin", async (req, res) => {
  try {
    let adminDb;
    let adminAuth;

    try {
      adminDb = getAdminDb();
      adminAuth = getAdminAuth();
    } catch (err) {
      return res.status(503).json({
        error: "Firebase Admin não configurado no backend.",
        details: err?.message || String(err),
      });
    }

    const { requesterUid, name, email, password, role } = req.body;

    if (!requesterUid || !name || !email || !password) {
      return res.status(400).json({
        error: "Campos obrigatórios: requesterUid, name, email, password",
      });
    }

    if (safeString(password).length < 6) {
      return res.status(400).json({
        error: "A senha deve ter pelo menos 6 caracteres",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = safeString(name);
    const normalizedRole = normalizeRole(role);

    const requesterValidation = await validateMasterRequester(
      adminDb,
      requesterUid
    );

    if (!requesterValidation.ok) {
      return res.status(requesterValidation.status).json({
        error: requesterValidation.error,
      });
    }

    const createdUser = await adminAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: normalizedName,
      disabled: false,
    });

    await adminDb.collection("admins").doc(createdUser.uid).set({
      name: normalizedName,
      email: normalizedEmail,
      role: normalizedRole,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: requesterUid,
    });

    return res.status(201).json({
      success: true,
      message:
        normalizedRole === "MASTER"
          ? "Acesso MASTER criado com sucesso"
          : "Administrador criado com sucesso",
      admin: {
        uid: createdUser.uid,
        name: normalizedName,
        email: normalizedEmail,
        role: normalizedRole,
        active: true,
      },
    });
  } catch (error) {
    console.error("Erro ao criar admin:", error);

    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({
        error: "Já existe um usuário com este e-mail",
      });
    }

    return res.status(500).json({
      error: "Erro interno ao criar administrador",
      details: error.message,
    });
  }
});

/**
 * PATCH /api/admin/toggle-admin-status
 *
 * Ativa ou inativa um administrador, atualizando o Firestore e o campo
 * `disabled` no Firebase Auth. Somente um MASTER ativo pode executar a ação,
 * não é possível alterar o próprio status nem inativar o último MASTER ativo.
 *
 * Body: `{ requesterUid, targetUid, active }` — `active` deve ser booleano.
 *
 * Respostas: 200 em sucesso; 400 (campos inválidos, auto-alteração ou último
 * MASTER); 403 (solicitante não é MASTER ativo); 404 (alvo inexistente);
 * 503 (Firebase Admin não configurado); 500 (erro interno — inclui o caso em
 * que o Firestore foi atualizado mas o Auth falhou).
 * @param {express.Request} req Requisição Express.
 * @param {express.Response} res Resposta Express.
 * @returns {Promise<express.Response>} Resposta JSON.
 */
router.patch("/toggle-admin-status", async (req, res) => {
  try {
    let adminDb;
    let adminAuth;

    try {
      adminDb = getAdminDb();
      adminAuth = getAdminAuth();
    } catch (err) {
      return res.status(503).json({
        error: "Firebase Admin não configurado no backend.",
        details: err?.message || String(err),
      });
    }

    const { requesterUid, targetUid, active } = req.body;

    if (!requesterUid || !targetUid || typeof active !== "boolean") {
      return res.status(400).json({
        error: "Campos obrigatórios: requesterUid, targetUid, active",
      });
    }

    const requesterValidation = await validateMasterRequester(
      adminDb,
      requesterUid
    );

    if (!requesterValidation.ok) {
      return res.status(requesterValidation.status).json({
        error: requesterValidation.error,
      });
    }

    if (requesterUid === targetUid) {
      return res.status(400).json({
        error: "Você não pode alterar o seu próprio status",
      });
    }

    const targetAdmin = await getAdminDoc(adminDb, targetUid);

    if (!targetAdmin) {
      return res.status(404).json({
        error: "Administrador alvo não encontrado",
      });
    }

    const targetRole = safeString(targetAdmin.data?.role).toUpperCase();

    if (targetRole === "MASTER" && active === false) {
      const activeMasters = await countActiveMasters();

      if (activeMasters <= 1 && targetAdmin.data?.active) {
        return res.status(400).json({
          error: "Não é permitido inativar o último MASTER ativo do sistema",
        });
      }
    }

    await targetAdmin.ref.update({
      active,
      updatedAt: new Date(),
      updatedBy: requesterUid,
    });

    try {
      await adminAuth.updateUser(targetUid, {
        disabled: !active,
      });
    } catch (authError) {
      console.error("Erro ao atualizar usuário no Firebase Auth:", authError);
      return res.status(500).json({
        error: "Status atualizado parcialmente no Firestore, mas falhou no Auth",
        details: authError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: active
        ? "Administrador ativado com sucesso"
        : "Administrador inativado com sucesso",
      admin: {
        uid: targetUid,
        active,
      },
    });
  } catch (error) {
    console.error("Erro ao alterar status do admin:", error);

    return res.status(500).json({
      error: "Erro interno ao alterar status do administrador",
      details: error.message,
    });
  }
});

/**
 * DELETE /api/admin/delete-admin
 *
 * Remove um administrador do Firestore e do Firebase Auth. Somente um MASTER
 * ativo pode executar a ação, não é possível excluir a si mesmo nem o último
 * MASTER ativo do sistema.
 *
 * Body: `{ requesterUid, targetUid }`.
 *
 * Respostas: 200 em sucesso; 400 (campos inválidos, auto-exclusão ou último
 * MASTER); 403 (solicitante não é MASTER ativo); 404 (alvo inexistente);
 * 503 (Firebase Admin não configurado); 500 (erro interno — inclui o caso em
 * que o documento foi removido mas a exclusão no Auth falhou).
 * @param {express.Request} req Requisição Express.
 * @param {express.Response} res Resposta Express.
 * @returns {Promise<express.Response>} Resposta JSON.
 */
router.delete("/delete-admin", async (req, res) => {
  try {
    let adminDb;
    let adminAuth;

    try {
      adminDb = getAdminDb();
      adminAuth = getAdminAuth();
    } catch (err) {
      return res.status(503).json({
        error: "Firebase Admin não configurado no backend.",
        details: err?.message || String(err),
      });
    }

    const { requesterUid, targetUid } = req.body;

    if (!requesterUid || !targetUid) {
      return res.status(400).json({
        error: "Campos obrigatórios: requesterUid, targetUid",
      });
    }

    const requesterValidation = await validateMasterRequester(
      adminDb,
      requesterUid
    );

    if (!requesterValidation.ok) {
      return res.status(requesterValidation.status).json({
        error: requesterValidation.error,
      });
    }

    if (requesterUid === targetUid) {
      return res.status(400).json({
        error: "Você não pode excluir a si mesmo",
      });
    }

    const targetAdmin = await getAdminDoc(adminDb, targetUid);

    if (!targetAdmin) {
      return res.status(404).json({
        error: "Administrador alvo não encontrado",
      });
    }

    const targetRole = safeString(targetAdmin.data?.role).toUpperCase();

    if (targetRole === "MASTER" && targetAdmin.data?.active) {
      const activeMasters = await countActiveMasters();

      if (activeMasters <= 1) {
        return res.status(400).json({
          error: "Não é permitido excluir o último MASTER ativo do sistema",
        });
      }
    }

    await targetAdmin.ref.delete();

    try {
      await adminAuth.deleteUser(targetUid);
    } catch (authError) {
      console.error("Erro ao excluir usuário no Firebase Auth:", authError);
      return res.status(500).json({
        error: "Usuário removido do Firestore, mas falhou ao excluir no Auth",
        details: authError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Administrador excluído com sucesso",
      deletedUid: targetUid,
    });
  } catch (error) {
    console.error("Erro ao excluir admin:", error);

    return res.status(500).json({
      error: "Erro interno ao excluir administrador",
      details: error.message,
    });
  }
});

export default router;