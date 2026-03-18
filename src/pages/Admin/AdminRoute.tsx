import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AdminRole = "ADMIN" | "MASTER";

function isValidAdminRole(role: string): role is AdminRole {
  return role === "ADMIN" || role === "MASTER";
}

function clearAdminSession() {
  localStorage.removeItem("adminUid");
  localStorage.removeItem("adminRole");
  localStorage.removeItem("adminName");
  localStorage.removeItem("adminEmail");
  localStorage.removeItem("adminAuthenticated");
  localStorage.removeItem("adminAuthenticatedAt");
}

export default function AdminRoute() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const adminUid = localStorage.getItem("adminUid") || "";
        const adminRole = (localStorage.getItem("adminRole") || "").toUpperCase();
        const adminAuthenticated =
          localStorage.getItem("adminAuthenticated") === "true";

        const validLocalSession =
          adminAuthenticated &&
          !!adminUid &&
          isValidAdminRole(adminRole);

        if (!user || !validLocalSession) {
          clearAdminSession();
          setAllowed(false);
          setChecking(false);
          return;
        }

        if (user.uid !== adminUid) {
          try {
            await signOut(auth);
          } catch (error) {
            console.error("Erro ao encerrar sessão inconsistente:", error);
          }

          clearAdminSession();
          setAllowed(false);
          setChecking(false);
          return;
        }

        const adminRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
          try {
            await signOut(auth);
          } catch (error) {
            console.error("Erro ao sair após admin não encontrado:", error);
          }

          clearAdminSession();
          setAllowed(false);
          setChecking(false);
          return;
        }

        const adminData = adminSnap.data();
        const firestoreRole = String(adminData?.role || "").toUpperCase();
        const firestoreActive = adminData?.active === true;

        if (!firestoreActive || !isValidAdminRole(firestoreRole)) {
          try {
            await signOut(auth);
          } catch (error) {
            console.error("Erro ao sair após admin inválido/inativo:", error);
          }

          clearAdminSession();
          setAllowed(false);
          setChecking(false);
          return;
        }

        localStorage.setItem("adminUid", user.uid);
        localStorage.setItem("adminRole", firestoreRole);
        localStorage.setItem("adminName", adminData?.name || user.displayName || "");
        localStorage.setItem(
          "adminEmail",
          adminData?.email || user.email || ""
        );
        localStorage.setItem("adminAuthenticated", "true");

        setAllowed(true);
        setChecking(false);
      } catch (error) {
        console.error("Erro ao validar rota administrativa:", error);

        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error("Erro ao encerrar sessão após falha no guard:", signOutError);
        }

        clearAdminSession();
        setAllowed(false);
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-sm text-slate-300">Validando acesso...</div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}