import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TimelineComoFunciona from "@/components/TimelineComoFunciona";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  FileCheck,
  BarChart3,
  Lock,
  CheckCircle,
  AlertTriangle,
  Users,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

interface WelcomeScreenProps {
  onStart: () => void;
  title?: string;
  description?: string;
  target?: string;
}

export const getAllResponses = async () => {
  const querySnapshot = await getDocs(collection(db, "responses"));
  const data = querySnapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  console.log("📄 Dados:", data);
  return data;
};

export const getAllResponses2 = async () => {
  const querySnapshot = await getDocs(collection(db, "respostas"));

  const data = querySnapshot.docs
    .map((docItem) => ({
      id: docItem.id,
      answers: [],
      ...docItem.data(),
    }))
    .filter((item) => Array.isArray(item.answers) && item.answers.length > 0);

  console.log("📄 Respostas com answers não vazio:", data);
  return data;
};

export const WelcomeScreen = ({
  onStart,
  title,
  description,
  target,
}: WelcomeScreenProps) => {
  const navigate = useNavigate();

  const isInvitationMode = Boolean(title || description || target);

  const heroTitle = title || "Análise de Conformidade LGPD";

  const heroDescription =
    description ||
    "Avalie sua conformidade com a Lei Geral de Proteção de Dados e identifique riscos baseados na ISO/IEC 27001";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-[#000000] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="container relative z-10 px-4 py-12 mx-auto max-w-7xl">
        <div className="text-center mb-16 animate-fade-up">
          <div className="flex justify-center gap-3 mb-6 flex-wrap">
            <div
              className="inline-flex items-center gap-2 px-4 py-2
              bg-orange-400/10 rounded-full border border-orange-400/40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 64 64"
                className="w-4 h-4 stroke-orange-300"
                fill="none"
                strokeWidth="2"
              >
                <path d="M32 6c-12 0-22 10-22 22s10 22 22 22c2 0 4 0 6-1v9l8-4v-9c5-4 8-11 8-17 0-12-10-22-22-22z" />
                <circle cx="22" cy="24" r="2" className="fill-orange-300" />
                <path d="M22 26v6" />
                <circle cx="32" cy="20" r="2" className="fill-orange-300" />
                <path d="M32 22v10" />
                <circle cx="42" cy="28" r="2" className="fill-orange-300" />
                <path d="M42 30v4" />
              </svg>

              <span className="text-sm font-medium text-orange-300">PPGES</span>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                LGPD Compliance Platform
              </span>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-400/10 rounded-full border border-green-400/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
                className="h-4 w-4 fill-green-300"
              >
                <path d="M256 16c-30 0-56 18-67 44-8-3-17-4-25-4-39 0-71 32-71 71 0 6 1 12 2 18-28 10-48 37-48 68 0 40 32 72 72 72h12v112c0 22 18 40 40 40s40-18 40-40V288h64v112c0 22 18 40 40 40s40-18 40-40V288h12c40 0 72-32 72-72 0-31-20-58-48-68 1-6 2-12 2-18 0-39-32-71-71-71-8 0-17 1-25 4-11-26-37-44-67-44z" />
              </svg>

              <span className="text-sm font-medium text-green-300">
                UNIPAMPA
              </span>
            </div>

            {isInvitationMode && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-400/10 rounded-full border border-cyan-400/30">
                <FileCheck className="w-4 h-4 text-cyan-300" />
                <span className="text-sm font-medium text-cyan-300">
                  Você foi convidado(a) para responder este formulário
                </span>
              </div>
            )}
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-white">
            {heroTitle}
          </h1>

          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-8">
            {heroDescription}
          </p>

          {target && (
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 text-sm">
                <Users className="w-4 h-4" />
                Público-alvo: {target}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={onStart}
              size="lg"
              className="text-lg px-8 py-6 shadow-elegant hover:shadow-glow transition-all duration-300 hover:scale-105"
            >
              Iniciar Avaliação
              <FileCheck className="ml-2 w-5 h-5" />
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/admin/login")}
              size="lg"
              className="text-lg px-8 py-6 border-white/20 text-white hover:bg-white/10"
            >
              Área administrativa
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card
            className="p-6 bg-card/10 backdrop-blur-sm border-border/50 shadow-card hover:shadow-elegant hover:bg-card/10 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
              <FileCheck className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              Questionário Dinâmico
            </h3>
            <p className="text-white/80">
              Perguntas adaptativas baseadas no seu setor, contexto e perfil de resposta.
            </p>
          </Card>

          <Card
            className="p-6 bg-card/10 backdrop-blur-sm border-border/50 shadow-card hover:shadow-elegant hover:bg-card/10 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              Análise Inteligente
            </h3>
            <p className="text-white/80">
              Processamento avançado das respostas para diagnóstico mais preciso.
            </p>
          </Card>

          <Card
            className="p-6 bg-card/10 backdrop-blur-sm border-border/50 shadow-card hover:shadow-elegant hover:bg-card/10 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              Dashboard Completo
            </h3>
            <p className="text-white/80">
              Visualização detalhada com gráficos, score e recomendações personalizadas.
            </p>
          </Card>

          <Card
            className="p-6 bg-card/10 backdrop-blur-sm border-border/50 shadow-card hover:shadow-elegant hover:bg-card/10 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              ISO/IEC 27001
            </h3>
            <p className="text-white/80">
              Recomendações alinhadas com controles internacionais de segurança.
            </p>
          </Card>

          <Card
            className="p-6 bg-card/10 backdrop-blur-sm border-border/50 shadow-card hover:shadow-elegant hover:bg-card/10 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              Análise de Riscos
            </h3>
            <p className="text-white/80">
              Identificação e classificação de riscos por categoria e prioridade.
            </p>
          </Card>

          <Card
            className="p-6 bg-card/10 backdrop-blur-sm border-border/50 shadow-card hover:shadow-elegant hover:bg-card/10 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              Dados Seguros
            </h3>
            <p className="text-white/80">
              Suas respostas são armazenadas com segurança e tratamento adequado.
            </p>
          </Card>
        </div>

        <TimelineComoFunciona />
      </div>
    </div>
  );
};

export default WelcomeScreen;