const API_URL = import.meta.env.VITE_API_BASE_URL;

console.log("🌐 VITE_API_BASE_URL =", API_URL);

export async function fetchStage(stage: number, context: any) {
  const url = `${API_URL}/api/generate-stage`;

  console.log("📡 Buscando etapa:", stage);
  console.log("🌐 URL FINAL:", url);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage,
        context,
      }),
    });

    console.log("📡 STATUS:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erro backend:", errorText);
      throw new Error(`Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ RESPOSTA BACKEND:", data);

    return data;
  } catch (err: any) {
    console.error("🚨 FETCH ERROR:", err.message);
    throw err;
  }
}