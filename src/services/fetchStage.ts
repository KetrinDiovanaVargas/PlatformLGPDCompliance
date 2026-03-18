const API_URL = import.meta.env.VITE_API_BASE_URL;

export async function fetchStage(stage: number, context: any) {
  console.log("📡 Buscando etapa no backend:", stage);
  console.log("🌐 API_URL:", API_URL);

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
    const errorText = await response.text();
    console.error("❌ Erro backend:", errorText);
    throw new Error("Erro ao buscar etapa do backend");
  }

  return response.json();
}