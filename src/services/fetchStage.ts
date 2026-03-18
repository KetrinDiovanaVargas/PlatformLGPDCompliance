const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

export async function fetchStage(stage: number, context: any) {
  console.log("📡 Buscando etapa no backend:", stage);

  const response = await fetch(`${API_URL}/api/generate-stage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stage,
      context,
    }),
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar etapa do backend");
  }

  return response.json();
}
