import { useState } from "react";
import WelcomeScreen from "@/components/WelcomeScreen";
import QuestionnaireScreen from "@/components/QuestionnaireScreen";
import DashboardScreen from "@/components/DashboardScreen";
import { stages } from "@/lib/questions";

type Screen = "welcome" | "questionnaire" | "dashboard";

export const Index = () => {
  const [screen, setScreen] = useState<Screen>("welcome");

  // Dados que virão do onComplete
  const [finalResponses, setFinalResponses] = useState<Record<string, any>>({});
  const [finalReport, setFinalReport] = useState<string>("");
  const [finalMetrics, setFinalMetrics] = useState<any>(null);

  // 🔥 Função que o QuestionnaireScreen chama ao terminar
  const handleComplete = (payload: {
    responses: Record<string, any>;
    report: string;
    metrics: any;
  }) => {
    setFinalResponses(payload.responses);
    setFinalReport(payload.report);
    setFinalMetrics(payload.metrics);

    setScreen("dashboard");
  };

  return (
    <>
      {screen === "welcome" && (
        <WelcomeScreen onStart={() => setScreen("questionnaire")} />
      )}

      {screen === "questionnaire" && (
        <QuestionnaireScreen
          stages={stages}
          onComplete={handleComplete}   // <-- agora funciona
          onBack={() => setScreen("welcome")}
        />
      )}

      {screen === "dashboard" && (
        <DashboardScreen
          report={finalReport}
          metrics={finalMetrics}
          responses={finalResponses}
          onRestart={() => setScreen("welcome")}
        />
      )}
    </>
  );
};

export default Index;
