const API_URL = import.meta.env.VITE_API_URL;

/* ========================================================
   TIPOS
======================================================== */

export interface SaveResponsesPayload {
  userId: string;
  sessionId: string;
  stageId: number;
  answers: any;
  assessmentId?: string;
}

export interface SaveFinalReportPayload {
  userId: string;
  sessionId: string;
  responses: any;
  assessmentId?: string;
}

/* ========================================================
   SALVA RESPOSTAS DE CADA ETAPA
======================================================== */

export async function saveResponses({
  userId,
  sessionId,
  stageId,
  answers,
  assessmentId,
}: SaveResponsesPayload) {
  try {
    const response = await fetch(`${API_URL}/api/save-responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        sessionId,
        stage: stageId,
        answers,
        assessmentId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Erro ao salvar respostas da etapa");
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao salvar respostas:", error);
    throw error;
  }
}

/* ========================================================
   ENVIA DADOS FINAIS PARA ANÁLISE
======================================================== */

export async function saveFinalReport({
  userId,
  sessionId,
  responses,
  assessmentId,
}: SaveFinalReportPayload) {
  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        sessionId,
        responses,
        assessmentId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Erro ao gerar relatório final");
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    throw error;
  }
}