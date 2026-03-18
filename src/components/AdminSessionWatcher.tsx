import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Timestamp, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { toast } from "sonner";

type AdminRole = "ADMIN" | "MASTER";

function isValidAdminRole(role: string): role is AdminRole {
  return role === "ADMIN" || role === "MASTER";
}

function clearAdminSession() {
  localStorage.removeItem("adminUid");
  localStorage.removeItem("adminSessionId");
  localStorage.removeItem("adminRole");
  localStorage.removeItem("adminName");
  localStorage.removeItem("adminEmail");
  localStorage.removeItem("adminAuthenticated");
  localStorage.removeItem("adminAuthenticatedAt");
}

export default function AdminSessionWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const alreadyRedirectingRef = useRef(false);

  useEffect(() => {
    let unsubscribeAdminDoc: (() => void) | null = null;
    let unsubscribeSessionDoc: (() => void) | null = null;

    const forceLogout = async (message: string) => {
      if (alreadyRedirectingRef.current) return;

      alreadyRedirectingRef.current = true;

      toast.error(message);

      try {
        await signOut(auth);
      } catch (error) {
        console.error("Erro ao encerrar sessão:", error);
      } finally {
        clearAdminSession();

        if (location.pathname !== "/admin/login") {
          navigate("/admin/login", { replace: true });
        }

        setTimeout(() => {
          alreadyRedirectingRef.current = false;
        }, 1000);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeAdminDoc) {
        unsubscribeAdminDoc();
        unsubscribeAdminDoc = null;
      }

      if (unsubscribeSessionDoc) {
        unsubscribeSessionDoc();
        unsubscribeSessionDoc = null;
      }

      const adminUid = localStorage.getItem("adminUid") || "";
      const adminSessionId = localStorage.getItem("adminSessionId") || "";
      const adminRole = (localStorage.getItem("adminRole") || "").toUpperCase();
      const adminAuthenticated =
        localStorage.getItem("adminAuthenticated") === "true";

      const hasLocalAdminSession =
        !!adminUid &&
        !!adminSessionId &&
        adminAuthenticated &&
        isValidAdminRole(adminRole);

      if (!user || !hasLocalAdminSession || user.uid !== adminUid) {
        return;
      }

      const adminRef = doc(db, "admins", adminUid);

      unsubscribeAdminDoc = onSnapshot(
        adminRef,
        async (snapshot) => {
          if (alreadyRedirectingRef.current) return;

          if (!snapshot.exists()) {
            await forceLogout("Seu acesso administrativo foi removido.");
            return;
          }

          const adminData = snapshot.data();
          const active = adminData?.active === true;
          const role = String(adminData?.role || "").toUpperCase();
          const currentSessionId = String(adminData?.currentSessionId || "");

          if (!active || !isValidAdminRole(role)) {
            await forceLogout("Seu acesso administrativo foi desativado.");
            return;
          }

          if (!currentSessionId || currentSessionId !== adminSessionId) {
            await forceLogout(
              "Sua sessão foi encerrada porque houve um novo login."
            );
            return;
          }

          localStorage.setItem("adminRole", role);
          localStorage.setItem("adminName", adminData?.name || "");
          localStorage.setItem("adminEmail", adminData?.email || "");

          if (unsubscribeSessionDoc) {
            unsubscribeSessionDoc();
            unsubscribeSessionDoc = null;
          }

          const sessionRef = doc(db, "admin_sessions", currentSessionId);

          unsubscribeSessionDoc = onSnapshot(
            sessionRef,
            async (sessionSnapshot) => {
              if (alreadyRedirectingRef.current) return;

              if (!sessionSnapshot.exists()) {
                await forceLogout("Sua sessão administrativa não é mais válida.");
                return;
              }

              const sessionData = sessionSnapshot.data();
              const status = String(sessionData?.status || "").trim();
              const expiresAt = sessionData?.expiresAt;

              if (status !== "active") {
                await forceLogout("Sua sessão foi encerrada.");
                return;
              }

              if (
                expiresAt instanceof Timestamp &&
                expiresAt.toDate().getTime() < Date.now()
              ) {
                await forceLogout("Sua sessão expirou.");
                return;
              }
            },
            (error) => {
              console.error("Erro ao monitorar sessão ativa:", error);
            }
          );
        },
        (error) => {
          console.error("Erro ao monitorar documento do admin:", error);
        }
      );
    });

    return () => {
      unsubscribeAuth();

      if (unsubscribeAdminDoc) {
        unsubscribeAdminDoc();
      }

      if (unsubscribeSessionDoc) {
        unsubscribeSessionDoc();
      }
    };
  }, [navigate, location.pathname]);

  return null;
}