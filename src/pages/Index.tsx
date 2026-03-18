import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import WelcomeScreen from "@/components/WelcomeScreen";
import QuestionnaireScreen from "@/components/QuestionnaireScreen";
import DashboardScreen from "@/components/DashboardScreen";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type Screen = "loading" | "welcome" | "questionnaire" | "dashboard";

interface Assessment {
  id: string;
  title?: string;
  description?: string;
  context?: string;
  formType?: string;
  objective?: string;
  target?: string;
  targetAudience?: string;
  active?: boolean;
  deleted?: boolean;
  [key: string]: unknown;
}

interface FinalResponseItem {
  questionId: number;
  question: string;
  answer: unknown;
}

interface CompletePayload {
  sessionId: string;
  assessmentId: string | null;
  responses: FinalResponseItem[];
  report: string;
  metrics: Record<string, unknown> | null;
  reportMode?: string;
  reportNotice?: string;
  risks?: unknown;
  score?: number;
  summary?: string;
  controls?: unknown[];
  strengths?: unknown[];
  attentionPoints?: unknown[];
  criticalIssues?: unknown[];
  controlsStatus?: unknown[];
  recommendations?: unknown[];
}

export const Index = () => {
  const { id } = useParams<{ id: string }>();

  const [screen, setScreen] = useState<Screen>("loading");
  const [assessment, setAssessment] = useState<Assessment | null>(null);

  const [finalResponses, setFinalResponses] = useState<FinalResponseItem[]>([]);
  const [finalReport, setFinalReport] = useState<string>("");
  const [finalMetrics, setFinalMetrics] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const loadAssessment = async () => {
      try {
        if (!id) {
          setScreen("welcome");
          return;
        }

        const ref = doc(db, "assessments", id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setAssessment({
            id: snap.id,
            ...(snap.data() as Omit<Assessment, "id">),
          });
        } else {
          setAssessment(null);
        }
      } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        setAssessment(null);
      } finally {
        setScreen("welcome");
      }
    };

    loadAssessment();
  }, [id]);

  const handleComplete = (payload: CompletePayload) => {
    setFinalResponses(payload.responses);
    setFinalReport(payload.report);
    setFinalMetrics(payload.metrics);
    setScreen("dashboard");
  };

  const handleRestart = () => {
    setFinalResponses([]);
    setFinalReport("");
    setFinalMetrics(null);
    setScreen("welcome");
  };

  if (screen === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-black flex items-center justify-center px-4">
        <div className="text-center text-white">
          <p className="text-lg font-semibold">Carregando formulário...</p>
          <p className="text-sm text-white/60 mt-2">
            Aguarde enquanto preparamos a avaliação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <WelcomeScreen
  title={assessment?.title}
  description={assessment?.description}
  target={assessment?.target ?? assessment?.targetAudience}
  onStart={() => setScreen("questionnaire")}
/>

      {screen === "questionnaire" && (
        <QuestionnaireScreen
          assessment={assessment}
          onComplete={handleComplete}
          onBack={() => setScreen("welcome")}
        />
      )}

      {screen === "dashboard" && (
        <DashboardScreen
          report={finalReport}
          metrics={finalMetrics}
          responses={finalResponses}
          onRestart={handleRestart}
        />
      )}
    </>
  );
};

export default Index;