import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth, db } from "@/lib/firebase";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type AdminRole = "MASTER" | "ADMIN";

interface AdminDoc {
  name?: string;
  email?: string;
  role?: AdminRole | string;
  active?: boolean;
  currentSessionId?: string;
  lastLoginAt?: any;
}

const SESSION_TIMEOUT_MINUTES = 30;

function getSessionExpiryTimestamp() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + SESSION_TIMEOUT_MINUTES);
  return Timestamp.fromDate(date);
}

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const normalizeRole = (value?: string): AdminRole | "" => {
    const normalized = String(value || "").trim().toUpperCase();
    if (normalized === "MASTER") return "MASTER";
    if (normalized === "ADMIN") return "ADMIN";
    return "";
  };

  const persistAdminSession = (
    uid: string,
    sessionId: string,
    adminData: {
      name?: string;
      email?: string;
      role?: AdminRole;
    }
  ) => {
    localStorage.setItem("adminUid", uid);
    localStorage.setItem("adminSessionId", sessionId);
    localStorage.setItem("adminRole", adminData.role || "");
    localStorage.setItem("adminName", adminData.name || "");
    localStorage.setItem("adminEmail", adminData.email || "");
    localStorage.setItem("adminAuthenticated", "true");
    localStorage.setItem("adminAuthenticatedAt", new Date().toISOString());
  };

  const clearAdminSession = () => {
    localStorage.removeItem("adminUid");
    localStorage.removeItem("adminSessionId");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminName");
    localStorage.removeItem("adminEmail");
    localStorage.removeItem("adminAuthenticated");
    localStorage.removeItem("adminAuthenticatedAt");
  };

  const writeAuditLog = async ({
    uid,
    action,
    sessionId = null,
    meta = {},
  }: {
    uid: string;
    action: string;
    sessionId?: string | null;
    meta?: Record<string, any>;
  }) => {
    try {
      await addDoc(collection(db, "admin_audit_logs"), {
        uid,
        action,
        sessionId,
        meta,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao gravar log de auditoria:", error);
    }
  };

  const handleLogin = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password.trim()) {
      toast.error("Preencha email e senha.");
      return;
    }

    try {
      setLoading(true);
      clearAdminSession();

      const userCredential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      const user = userCredential.user;

      const adminRef = doc(db, "admins", user.uid);
      const adminSnap = await getDoc(adminRef);

      if (!adminSnap.exists()) {
        await writeAuditLog({
          uid: user.uid,
          action: "login_denied_not_admin",
          meta: {
            email: normalizedEmail,
            userAgent: navigator.userAgent,
          },
        });

        clearAdminSession();
        await signOut(auth);
        toast.error("Usuário sem permissão de administrador.");
        return;
      }

      const adminData = adminSnap.data() as AdminDoc;
      const normalizedRole = normalizeRole(adminData.role);

      if (!adminData.active) {
        await writeAuditLog({
          uid: user.uid,
          action: "login_denied_inactive",
          meta: {
            email: normalizedEmail,
            userAgent: navigator.userAgent,
          },
        });

        clearAdminSession();
        await signOut(auth);
        toast.error("Administrador inativo.");
        return;
      }

      if (!normalizedRole) {
        await writeAuditLog({
          uid: user.uid,
          action: "login_denied_invalid_role",
          meta: {
            email: normalizedEmail,
            rawRole: adminData.role || "",
            userAgent: navigator.userAgent,
          },
        });

        clearAdminSession();
        await signOut(auth);
        toast.error("Perfil de acesso inválido.");
        return;
      }

      const finalName =
        String(adminData.name || user.displayName || "").trim() || "Administrador";

      const finalEmail = normalizeEmail(
        adminData.email || user.email || normalizedEmail
      );

      const previousSessionId =
        String(adminData.currentSessionId || "").trim() || null;

      const sessionRef = await addDoc(collection(db, "admin_sessions"), {
        uid: user.uid,
        email: finalEmail,
        role: normalizedRole,
        status: "active",
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        expiresAt: getSessionExpiryTimestamp(),
        userAgent: navigator.userAgent,
        revokedAt: null,
        revokedReason: null,
      });

      await setDoc(
        adminRef,
        {
          name: finalName,
          email: finalEmail,
          role: normalizedRole,
          active: true,
          currentSessionId: sessionRef.id,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      persistAdminSession(user.uid, sessionRef.id, {
        name: finalName,
        email: finalEmail,
        role: normalizedRole,
      });

      await writeAuditLog({
        uid: user.uid,
        action: "login_success",
        sessionId: sessionRef.id,
        meta: {
          role: normalizedRole,
          email: finalEmail,
          previousSessionId,
          userAgent: navigator.userAgent,
        },
      });

      toast.success(
        normalizedRole === "MASTER"
          ? "Login master realizado com sucesso."
          : "Login administrativo realizado com sucesso."
      );

      navigate("/admin/dashboard");
    } catch (error: any) {
      console.error("Erro no login:", error);
      clearAdminSession();

      const errorCode = error?.code || "";

      try {
        await signOut(auth);
      } catch {
        // evita quebrar fluxo caso não haja sessão válida
      }

      if (
        errorCode === "auth/invalid-credential" ||
        errorCode === "auth/wrong-password" ||
        errorCode === "auth/user-not-found" ||
        errorCode === "auth/invalid-email"
      ) {
        toast.error("Email ou senha inválidos.");
        return;
      }

      if (errorCode === "auth/user-disabled") {
        toast.error("Usuário desativado.");
        return;
      }

      if (errorCode === "auth/too-many-requests") {
        toast.error("Muitas tentativas. Tente novamente em instantes.");
        return;
      }

      toast.error("Não foi possível entrar no painel.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-[#000000] px-4">
      <Card className="w-full max-w-md p-8 bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Acesso Administrador
        </h2>

        <p className="text-white/60 text-sm text-center mb-6">
          Entre com sua conta autorizada para acessar o painel.
        </p>

        <div className="space-y-4">
          <input
            id="admin-email"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            className="w-full p-3 rounded-lg bg-black/40 border border-white/20 text-white outline-none focus:border-primary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <input
            id="admin-password"
            name="password"
            type="password"
            placeholder="Senha"
            autoComplete="current-password"
            className="w-full p-3 rounded-lg bg-black/40 border border-white/20 text-white outline-none focus:border-primary"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <Button
            onClick={handleLogin}
            className="w-full py-3 text-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}