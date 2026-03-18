import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import QuestionnaireScreen from "@/components/QuestionnaireScreen";
import DashboardScreen from "@/components/DashboardScreen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  FolderKanban,
  Loader2,
  ShieldCheck,
  Users,
  Sparkles,
  ArrowRight,
} from "lucide-react";

type Assessment = {
  id: string;
  title?: string;
  formType?: string;
  category?: string;
  objective?: string;
  audience?: string;
  introText?: string;
  context: string;
  active?: boolean;
  deleted?: boolean;
  ownerName?: string;
  createdAt?: any;
};

const FORM_TYPE_LABELS: Record<string, string> = {
  lgpd_diagnostico: "Diagnóstico LGPD",
  lgpd_maturidade: "Maturidade LGPD",
  privacidade_operacional: "Privacidade Operacional",
  riscos_e_controles: "Riscos e Controles",
  customizado: "Customizado",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  diagnostico_inicial: "Diagnóstico inicial",
  mapeamento_maturidade: "Mapeamento de maturidade",
  levantamento_percepcao: "Levantamento de percepção",
  auditoria_interna: "Auditoria interna",
  treinamento_conscientizacao: "Treinamento e conscientização",
  identificacao_riscos: "Identificação de riscos",

  // compatibilidade com valores antigos
  compliance: "Compliance",
  juridico: "Jurídico",
  rh: "RH",
  ti: "TI",
  seguranca: "Segurança",
  operacoes: "Operações",
  outro: "Outro",
};

const AUDIENCE_LABELS: Record<string, string> = {
  alunos: "Alunos",
  colaboradores_clt: "Colaboradores CLT",
  desempregados: "Desempregados",
  clientes: "Clientes",
  fornecedores: "Fornecedores",
  cooperados: "Cooperados",
  comunidade: "Comunidade em geral",
  outro: "Outro",
};

export default function UserQuestionnaire() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedData, setCompletedData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const loadAssessment = async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const ref = doc(db, "assessments", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setAssessment(null);
          setNotFound(true);
          return;
        }

        const data = snap.data();

        setAssessment({
          id: snap.id,
          title: String(data.title ?? ""),
          formType: String(data.formType ?? ""),
          category: String(data.category ?? ""),
          objective: String(data.objective ?? data.category ?? ""),
          audience: String(data.audience ?? ""),
          introText: String(data.introText ?? ""),
          context: String(data.context ?? ""),
          active: data.active ?? true,
          deleted: data.deleted ?? false,
          ownerName: String(data.ownerName ?? ""),
          createdAt: data.createdAt,
        });

        setNotFound(false);
      } catch (error) {
        console.error("Erro ao carregar avaliação:", error);
        setAssessment(null);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadAssessment();
  }, [id]);

  const assessmentTitle = useMemo(() => {
    if (!assessment) return "";

    if (assessment.title?.trim()) return assessment.title.trim();

    if (assessment.formType?.trim() && assessment.objective?.trim()) {
      const formTypeLabel =
        FORM_TYPE_LABELS[assessment.formType] || assessment.formType;
      const objectiveLabel =
        OBJECTIVE_LABELS[assessment.objective] || assessment.objective;

      return `${formTypeLabel} • ${objectiveLabel}`;
    }

    if (assessment.formType?.trim()) {
      return FORM_TYPE_LABELS[assessment.formType] || assessment.formType;
    }

    if (assessment.context?.trim()) {
      return assessment.context.trim().slice(0, 60);
    }

    return `Formulário ${assessment.id.slice(0, 6)}`;
  }, [assessment]);

  const formTypeLabel = useMemo(() => {
    if (!assessment?.formType) return "";
    return FORM_TYPE_LABELS[assessment.formType] || assessment.formType;
  }, [assessment]);

  const objectiveLabel = useMemo(() => {
    if (!assessment?.objective) return "";
    return OBJECTIVE_LABELS[assessment.objective] || assessment.objective;
  }, [assessment]);

  const audienceLabel = useMemo(() => {
    if (!assessment?.audience?.trim()) return "";
    return AUDIENCE_LABELS[assessment.audience] || assessment.audience;
  }, [assessment]);

  const introDescription = useMemo(() => {
    if (assessment?.introText?.trim()) return assessment.introText.trim();

    return "Você foi convidado(a) para preencher este formulário. Suas respostas são importantes e ajudarão na análise das informações deste processo.";
  }, [assessment]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0b1226] to-[#020308] flex items-center justify-center px-4">
        <Card className="w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-500/20 bg-white/5 backdrop-blur-xl shadow-[0_0_80px_rgba(34,211,238,0.12)]">
          <div className="relative p-8 md:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_35%)]" />

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
                <ShieldCheck className="h-8 w-8 text-cyan-300" />
              </div>

              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-cyan-300">
                LGPD Compliance Platform
              </p>

              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Preparando sua avaliação
              </h1>

              <p className="mt-3 max-w-xl text-sm md:text-base text-white/70 leading-relaxed">
                Estamos carregando as informações do formulário para que sua experiência
                seja rápida, segura e organizada.
              </p>

              <div className="mt-8 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/90">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                <span className="text-sm font-medium">Carregando conteúdo...</span>
              </div>

              <div className="mt-8 w-full max-w-lg space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400" />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="h-4 w-3/4 mx-auto rounded-full bg-white/10 animate-pulse" />
                  <div className="h-4 w-full rounded-full bg-white/10 animate-pulse" />
                  <div className="h-4 w-5/6 mx-auto rounded-full bg-white/10 animate-pulse" />
                </div>
              </div>

              <p className="mt-8 text-xs text-white/40">
                Isso pode levar alguns segundos.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (notFound || !assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-black flex items-center justify-center px-4">
        <Card className="w-full max-w-xl p-8 bg-white/5 backdrop-blur-md border-white/10 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-red-300" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Avaliação não encontrada
          </h1>

          <p className="text-white/70 mb-6">
            Esse link pode estar inválido, incompleto ou a avaliação não existe mais.
          </p>

          <Button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-lg"
          >
            Voltar ao início
          </Button>
        </Card>
      </div>
    );
  }

  if (assessment.deleted === true) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-black flex items-center justify-center px-4">
        <Card className="w-full max-w-xl p-8 bg-white/5 backdrop-blur-md border-white/10 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-red-300" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Avaliação indisponível
          </h1>

          <p className="text-white/70 mb-6">
            Este formulário não está mais disponível.
          </p>

          <Button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-lg"
          >
            Voltar ao início
          </Button>
        </Card>
      </div>
    );
  }

  if (assessment.active === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-black flex items-center justify-center px-4">
        <Card className="w-full max-w-xl p-8 bg-white/5 backdrop-blur-md border-white/10 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-amber-300" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Avaliação indisponível
          </h1>

          <p className="text-white/70 mb-6">
            Este formulário foi desativado pelo administrador e não está aceitando novas respostas.
          </p>

          <Button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-lg"
          >
            Voltar ao início
          </Button>
        </Card>
      </div>
    );
  }

  if (completedData) {
    return (
      <DashboardScreen
  report={completedData.report}
  metrics={completedData.metrics}
  responses={completedData.responses}
  onRestart={() => window.location.reload()}
  assessmentTitle={assessmentTitle}
  assessmentFormType={formTypeLabel}
  assessmentObjective={objectiveLabel}
  reportMode={completedData.reportMode}
  reportNotice={completedData.reportNotice}
/>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-black py-8 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
          <Card className="overflow-hidden bg-white/5 backdrop-blur-md border-white/10">
            <div className="relative p-8 md:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_35%)]" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.15)]">
                    <Sparkles className="w-7 h-7 text-cyan-300" />
                  </div>

                  <div>
                    <p className="text-cyan-300 text-xs uppercase tracking-[0.25em] mb-1">
                      Você foi convidado(a)
                    </p>
                    <h1 className="text-2xl md:text-4xl font-bold text-white leading-tight">
                      {assessmentTitle}
                    </h1>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {formTypeLabel && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
                      <ClipboardList className="h-3.5 w-3.5" />
                      {formTypeLabel}
                    </span>
                  )}

                  {objectiveLabel && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-medium text-fuchsia-200">
                      <FolderKanban className="h-3.5 w-3.5" />
                      {objectiveLabel}
                    </span>
                  )}

                  {audienceLabel && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                      <Users className="h-3.5 w-3.5" />
                      Público-alvo: {audienceLabel}
                    </span>
                  )}

                  {assessment.ownerName && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80">
                      Responsável: {assessment.ownerName}
                    </span>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 md:p-6 mb-6">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Antes de começar
                  </h2>

                  <p className="text-white/80 leading-relaxed text-sm md:text-base whitespace-pre-line">
                    {introDescription}
                  </p>

                  {assessment.context?.trim() && (
                    <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <p className="text-cyan-200 text-xs uppercase tracking-[0.18em] mb-2">
                        Contexto do formulário
                      </p>
                      <p className="text-white/75 text-sm leading-relaxed">
                        {assessment.context}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <p className="text-sm text-white/60">
                    Leia com atenção e responda de acordo com a sua realidade.
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate("/")}
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      Voltar
                    </Button>

                    <Button
                      onClick={() => setStarted(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
                    >
                      Começar formulário
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-black py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <QuestionnaireScreen
          onBack={() => navigate("/")}
          onComplete={(data) => setCompletedData(data)}
          assessmentId={assessment.id}
          assessmentContext={assessment.context}
          assessmentTitle={assessmentTitle}
          assessmentFormType={formTypeLabel}
          assessmentObjective={objectiveLabel}
        />
      </div>
    </div>
  );
}