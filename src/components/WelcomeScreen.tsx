import { Button } from "@/components/ui/button";
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
  LogIn,
  ArrowDown,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// Recursos da plataforma (cada card tem seu acento de cor)
const HOME_FEATURES = [
  {
    Icon: FileCheck,
    title: "Questionário Dinâmico",
    desc: "Perguntas adaptativas baseadas no seu setor, contexto e perfil de resposta.",
    tile: "from-blue-500/25 to-blue-500/5",
    ring: "ring-blue-400/30",
    icon: "text-blue-300",
    glow: "bg-blue-500/25",
  },
  {
    Icon: BarChart3,
    title: "Análise Inteligente",
    desc: "Processamento avançado das respostas com IA para um diagnóstico mais preciso.",
    tile: "from-cyan-500/25 to-cyan-500/5",
    ring: "ring-cyan-400/30",
    icon: "text-cyan-300",
    glow: "bg-cyan-500/25",
  },
  {
    Icon: Lock,
    title: "Dashboard Completo",
    desc: "Visualização detalhada com gráficos, score e recomendações personalizadas.",
    tile: "from-violet-500/25 to-violet-500/5",
    ring: "ring-violet-400/30",
    icon: "text-violet-300",
    glow: "bg-violet-500/25",
  },
  {
    Icon: CheckCircle,
    title: "ISO/IEC 27001",
    desc: "Recomendações alinhadas com controles internacionais de segurança.",
    tile: "from-emerald-500/25 to-emerald-500/5",
    ring: "ring-emerald-400/30",
    icon: "text-emerald-300",
    glow: "bg-emerald-500/25",
  },
  {
    Icon: AlertTriangle,
    title: "Análise de Riscos",
    desc: "Identificação e classificação de riscos por categoria e prioridade.",
    tile: "from-amber-500/25 to-amber-500/5",
    ring: "ring-amber-400/30",
    icon: "text-amber-300",
    glow: "bg-amber-500/25",
  },
  {
    Icon: Shield,
    title: "Dados Seguros",
    desc: "Suas respostas são armazenadas com segurança e tratamento adequado.",
    tile: "from-fuchsia-500/25 to-fuchsia-500/5",
    ring: "ring-fuchsia-400/30",
    icon: "text-fuchsia-300",
    glow: "bg-fuchsia-500/25",
  },
];

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

      {/* Botão de login (canto superior direito) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <Button
          onClick={() => navigate("/admin/login")}
          variant="outline"
          size="sm"
          className="gap-2 border-white/20 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10"
        >
          <LogIn className="w-4 h-4" />
          Login
        </Button>
      </div>

      <div className="container relative z-10 px-4 mx-auto max-w-7xl">
        {/* PARTE 1 — Hero em tela cheia (título + botão) */}
        <section className="min-h-[100svh] flex flex-col items-center justify-center text-center animate-fade-up py-20">
          <div className="flex justify-center gap-2 sm:gap-3 mb-6 flex-wrap">
            <div
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2
              bg-orange-400/10 rounded-full border border-orange-400/40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 64 64"
                className="w-3 sm:w-4 h-3 sm:h-4 stroke-orange-300"
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

              <span className="text-xs sm:text-sm font-medium text-orange-300">PPGES</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 rounded-full border border-primary/20">
              <Shield className="w-3 sm:w-4 h-3 sm:h-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium text-primary">
                LGPD Compliance Platform
              </span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-400/10 rounded-full border border-green-400/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
                className="h-3 sm:h-4 w-3 sm:w-4 fill-green-300"
              >
                <path d="M256 16c-30 0-56 18-67 44-8-3-17-4-25-4-39 0-71 32-71 71 0 6 1 12 2 18-28 10-48 37-48 68 0 40 32 72 72 72h12v112c0 22 18 40 40 40s40-18 40-40V288h64v112c0 22 18 40 40 40s40-18 40-40V288h12c40 0 72-32 72-72 0-31-20-58-48-68 1-6 2-12 2-18 0-39-32-71-71-71-8 0-17 1-25 4-11-26-37-44-67-44z" />
              </svg>

              <span className="text-xs sm:text-sm font-medium text-green-300">
                UNIPAMPA
              </span>
            </div>

            {isInvitationMode && (
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-cyan-400/10 rounded-full border border-cyan-400/30">
                <FileCheck className="w-3 sm:w-4 h-3 sm:h-4 text-cyan-300" />
                <span className="text-xs sm:text-sm font-medium text-cyan-300">
                  Você foi convidado(a) para responder este formulário
                </span>
              </div>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 text-white">
            {heroTitle}
          </h1>

          <p className="text-base sm:text-lg md:text-2xl text-white/90 max-w-3xl mx-auto mb-8">
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

          <div className="flex justify-center">
            <Button
              onClick={() =>
                document
                  .getElementById("recursos")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              size="lg"
              className="group rounded-full px-8 py-6 text-base sm:text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white ring-1 ring-white/20 shadow-lg shadow-blue-900/40 hover:brightness-110 hover:shadow-xl transition-all duration-300"
            >
              Conheça mais
              <ArrowDown className="ml-2 w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
            </Button>
          </div>
        </section>

        {/* PARTE 2 — Recursos */}
        <section id="recursos" className="scroll-mt-24 py-16 md:py-24">
          {/* Cabeçalho da seção */}
          <div className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80 mb-3">
              Recursos
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-balance">
              Tudo para avaliar sua conformidade com a LGPD
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/60 max-w-xl mx-auto">
              Do questionário adaptativo ao diagnóstico com recomendações práticas — em
              uma plataforma só.
            </p>
          </div>

          {/* Cards de recursos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {HOME_FEATURES.map(({ Icon, title, desc, tile, ring, icon, glow }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 transition-all duration-300 hover:border-white/25 hover:-translate-y-1 hover:bg-white/[0.05]"
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -top-14 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full ${glow} opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100`}
                />
                <div className="relative">
                  <div
                    className={`mb-4 sm:mb-5 inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tile} ring-1 ${ring}`}
                  >
                    <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${icon}`} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-relaxed text-white/60">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PARTE 3 — Como funciona */}
        <section className="pb-16 md:pb-24">
          <TimelineComoFunciona />
        </section>
      </div>
    </div>
  );
};

export default WelcomeScreen;