import express from "express";
import { adminAuth, adminDb } from "../firebaseAdmin.mjs";

const router = express.Router();

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeEmail(email) {
  return safeString(email).toLowerCase();
}

function normalizeRole(role) {
  const normalized = safeString(role).toUpperCase();
  return normalized === "MASTER" ? "MASTER" : "ADMIN";
}

async function getAdminDoc(uid) {
  const ref = adminDb.collection("admins").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) return null;

  return {
    ref,
    snap,
    data: snap.data(),
  };
}

async function validateMasterRequester(requesterUid) {
  const requester = await getAdminDoc(requesterUid);

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

async function countActiveMasters() {
  const mastersSnap = await adminDb
    .collection("admins")
    .where("role", "==", "MASTER")
    .where("active", "==", true)
    .get();

  return mastersSnap.size;
}

router.post("/create-admin", async (req, res) => {
  try {
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

    const requesterValidation = await validateMasterRequester(requesterUid);

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

router.patch("/toggle-admin-status", async (req, res) => {
  try {
    const { requesterUid, targetUid, active } = req.body;

    if (!requesterUid || !targetUid || typeof active !== "boolean") {
      return res.status(400).json({
        error: "Campos obrigatórios: requesterUid, targetUid, active",
      });
    }

    const requesterValidation = await validateMasterRequester(requesterUid);

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

    const targetAdmin = await getAdminDoc(targetUid);

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

router.delete("/delete-admin", async (req, res) => {
  try {
    const { requesterUid, targetUid } = req.body;

    if (!requesterUid || !targetUid) {
      return res.status(400).json({
        error: "Campos obrigatórios: requesterUid, targetUid",
      });
    }

    const requesterValidation = await validateMasterRequester(requesterUid);

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

    const targetAdmin = await getAdminDoc(targetUid);

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