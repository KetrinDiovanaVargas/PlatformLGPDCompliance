import { useEffect } from "react";
import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SESSION_TIMEOUT_MINUTES = 30;
const HEARTBEAT_INTERVAL = 60 * 1000; // 1 min

function getNextExpiry() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + SESSION_TIMEOUT_MINUTES);
  return Timestamp.fromDate(date);
}

export default function AdminActivityHeartbeat() {
  useEffect(() => {
    const sessionId = localStorage.getItem("adminSessionId");

    if (!sessionId) return;

    const sessionRef = doc(db, "admin_sessions", sessionId);

    const updateSession = async () => {
      try {
        await updateDoc(sessionRef, {
          lastActivityAt: Timestamp.now(),
          expiresAt: getNextExpiry(),
        });
      } catch (error) {
        console.error("Erro ao atualizar heartbeat:", error);
      }
    };

    // 🔁 Atualização periódica
    updateSession();
    const interval = setInterval(updateSession, HEARTBEAT_INTERVAL);

    // 🖱️ Eventos de atividade
    let throttled = false;

    const handleActivity = async () => {
      if (throttled) return;

      throttled = true;
      await updateSession();

      setTimeout(() => {
        throttled = false;
      }, 15000); // evita flood
    };

    const events = ["click", "keydown", "mousemove", "scroll"];

    events.forEach((event) =>
      window.addEventListener(event, handleActivity)
    );

    return () => {
      clearInterval(interval);

      events.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
    };
  }, []);

  return null;
}