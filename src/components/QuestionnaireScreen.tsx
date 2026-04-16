import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { saveResponsesStage } from "@/services/saveResponsesStage";

// Em dev, o Vite já faz proxy de /api -> http://localhost:8787 (vite.config.ts).
// Se VITE_API_BASE_URL não estiver definido, usamos "" para manter URLs relativas.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

/* ======================================================
   TIPOS
====================================================== */
interface Question {
  id: string;
  type: "select" | "checkbox" | "textarea";
  question: string;
  description?: string;
  options?: string[];
  required?: boolean;
}

interface Stage {
  id: number;
  title: string;
  description: string;
  questions: Question[];
}

interface Assessment {
  id: string;
  title?: string;
  description?: string;
  context?: string;
  formType?: string;
  objective?: string;
  targetAudience?: string;
  active?: boolean;
  deleted?: boolean;
  [key: string]: unknown;
}

interface QuestionnaireCompletePayload {
  sessionId: string;
  assessmentId: string | null;
  responses: Array<{
    questionId: number;
    question: string;
    answer: unknown;
  }>;
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

interface QuestionnaireScreenProps {
  onComplete: (data: QuestionnaireCompletePayload) => void;
  onBack: () => void;
  assessment?: Assessment | null;
}

/* ======================================================
   STAGE 0 — CONTEXTO INICIAL DO USUÁRIO
====================================================== */
const FIXED_INITIAL_CONTEXT_STAGE: Stage = {
  id: 0,
  title: "Contexto Inicial",
  description: "Conte um pouco sobre você e seu contexto antes de iniciar a avaliação.",
  questions: [
    {
      id: "respondent_context",
      type: "textarea",
      question:
        "Antes de começar, conte um pouco sobre você, sua realidade e sua relação com este tema.",
      description:
        "Exemplo: seu perfil, sua situação atual, sua experiência, sua função ou qualquer informação que ajude a contextualizar melhor suas respostas.",
      required: true,
    },
  ],
};

const TOTAL_STAGES = 5;
const DEMO_USER_ID = "usuario_demo";

type ResponseEntry = {
  question: string;
  answer: unknown;
};

/* ======================================================
   HELPERS
====================================================== */
const normalizeText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const isOtherLikeOption = (label?: string) => {
  const normalized = normalizeText(label || "");
  return (
    normalized.includes("outro") ||
    normalized.includes("outra") ||
    normalized.includes("outros") ||
    normalized.includes("outras") ||
    normalized.includes("especifique") ||
    normalized.includes("especificar")
  );
};

const expectedQuestionsForStage = (stageIndex: number) => {
  if (stageIndex === 0) return 1;
  if (stageIndex === 1) return 4;
  return 5;
};

const totalExpectedQuestions = () => {
  let total = 0;
  for (let s = 0; s < TOTAL_STAGES; s++) total += expectedQuestionsForStage(s);
  return total;
};

const startGlobalIndexOfStage = (stageIndex: number) => {
  let sum = 0;
  for (let s = 0; s < stageIndex; s++) sum += expectedQuestionsForStage(s);
  return sum;
};

const globalIndexOf = (stageIndex: number, questionIndex: number) => {
  return startGlobalIndexOfStage(stageIndex) + questionIndex;
};

const hasOtherOption = (q?: Question) => {
  if (!q?.options?.length) return false;
  return q.options.some((o) => isOtherLikeOption(o));
};

const isOtherSelected = (q: Question | undefined, answer: unknown) => {
  if (!q || !hasOtherOption(q)) return false;

  if (q.type === "select") {
    if (answer && typeof answer === "object" && "selected" in answer) {
      return isOtherLikeOption(String((answer as { selected?: string }).selected ?? ""));
    }
    return isOtherLikeOption(String(answer ?? ""));
  }

  if (q.type === "checkbox") {
    const selected =
      answer &&
      typeof answer === "object" &&
      "selected" in answer &&
      Array.isArray((answer as { selected?: string[] }).selected)
        ? (answer as { selected: string[] }).selected
        : Array.isArray(answer)
          ? answer
          : [];

    return selected.some((x: string) => isOtherLikeOption(String(x)));
  }

  return false;
};

const generateSessionId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

function AssessmentInlineLoading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0b1226] to-[#020308] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="overflow-hidden rounded-3xl border border-cyan-500/20 bg-white/5 backdrop-blur-xl shadow-[0_0_80px_rgba(34,211,238,0.12)]">
          <div className="relative p-8 md:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_35%)]" />

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
                <Sparkles className="h-8 w-8 text-cyan-300" />
              </div>

              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-cyan-300">
                Processando avaliação
              </p>

              <h2 className="text-2xl md:text-3xl font-bold text-white">
                {title}
              </h2>

              <p className="mt-3 max-w-xl text-sm md:text-base text-white/70 leading-relaxed">
                {subtitle}
              </p>

              <div className="mt-8 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/90">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                <span className="text-sm font-medium">Aguarde um instante...</span>
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
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ======================================================
   COMPONENTE
====================================================== */
export const QuestionnaireScreen = ({
  onComplete,
  onBack,
  assessment,
}: QuestionnaireScreenProps) => {
  const assessmentId = assessment?.id ?? null;
  const assessmentContext = String(assessment?.context ?? "");
  const assessmentTitle = String(assessment?.title ?? "");
  const assessmentFormType = String(assessment?.formType ?? "");
  const assessmentObjective = String(assessment?.objective ?? "");

  const [stages, setStages] = useState<Stage[]>([]);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [responses, setResponses] = useState<Record<number, ResponseEntry>>({});
  const [otherText, setOtherText] = useState<Record<number, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingNext, setIsProcessingNext] = useState(false);
  const [isLoadingStage, setIsLoadingStage] = useState(false);

  const [checkingAssessment, setCheckingAssessment] = useState(true);
  const [assessmentBlocked, setAssessmentBlocked] = useState(false);
  const [assessmentBlockedMessage, setAssessmentBlockedMessage] = useState(
    "Este formulário não está mais disponível."
  );

  useEffect(() => {
    setStages([FIXED_INITIAL_CONTEXT_STAGE]);
    setSessionId(generateSessionId());
  }, []);

  useEffect(() => {
    const checkAssessmentStatus = async () => {
      try {
        if (!assessmentId) {
          setCheckingAssessment(false);
          return;
        }

        const assessmentRef = doc(db, "assessments", assessmentId);
        const assessmentSnap = await getDoc(assessmentRef);

        if (!assessmentSnap.exists()) {
          setAssessmentBlocked(true);
          setAssessmentBlockedMessage("Este formulário não foi encontrado.");
          return;
        }

        const assessmentData = assessmentSnap.data();

        if (assessmentData.deleted === true) {
          setAssessmentBlocked(true);
          setAssessmentBlockedMessage(
            "Este formulário não está mais disponível."
          );
          return;
        }

        if (assessmentData.active === false) {
          setAssessmentBlocked(true);
          setAssessmentBlockedMessage(
            "Este formulário foi desativado pelo administrador e não está aceitando novas respostas."
          );
          return;
        }

        setAssessmentBlocked(false);
      } catch (error) {
        console.error("Erro ao verificar status da avaliação:", error);
        setAssessmentBlocked(true);
        setAssessmentBlockedMessage(
          "Não foi possível verificar a disponibilidade deste formulário."
        );
      } finally {
        setCheckingAssessment(false);
      }
    };

    checkAssessmentStatus();
  }, [assessmentId]);

  const stage = stages[currentStage];
  const question = stage?.questions?.[currentQuestion];

  const globalIndex = useMemo(() => {
    return globalIndexOf(currentStage, currentQuestion);
  }, [currentStage, currentQuestion]);

  const progress = useMemo(() => {
    const total = totalExpectedQuestions();
    return total > 0 ? ((globalIndex + 1) / total) * 100 : 0;
  }, [globalIndex]);

  const displayStageNumber = useMemo(() => {
    if (currentStage <= 1) return 1;
    return currentStage;
  }, [currentStage]);

  const buildContextObjectForStage = (stageIndex: number) => {
    const ctx: Record<string, unknown> = {};
    const startIdx = startGlobalIndexOfStage(stageIndex);

    Object.keys(responses)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((idx) => {
        if (idx >= startIdx) return;
        const entry = responses[idx];
        if (!entry) return;
        ctx[`Q${idx}:${entry.question}`] = entry.answer;
      });

    return ctx;
  };

  const normalizeStageFromBackend = (data: unknown, stageIndex: number): Stage => {
    const expected = expectedQuestionsForStage(stageIndex);
    const raw = (data ?? {}) as Partial<Stage>;

    const base: Stage = {
      id: stageIndex,
      title: raw.title ?? `Etapa ${stageIndex}`,
      description: raw.description ?? "Perguntas adaptativas",
      questions: Array.isArray(raw.questions) ? raw.questions : [],
    };

    if (stageIndex > 0 && base.questions.length > expected) {
      base.questions = base.questions.slice(0, expected);
    }

    if (stageIndex > 0 && base.questions.length < expected) {
      const missing = expected - base.questions.length;
      const fillers: Question[] = Array.from({ length: missing }).map((_, i) => ({
        id: `fallback_${stageIndex}_${i + 1}`,
        type: "textarea",
        question: "Descreva sua experiência ou entendimento sobre este tema.",
        required: true,
      }));

      base.questions = [...base.questions, ...fillers];
      base.description = base.description?.includes("Fallback")
        ? base.description
        : "Fallback seguro";
    }

    return base;
  };

  const getResponsesForStage = (
    stageIndex: number
  ): Record<number, ResponseEntry> => {
    const startIdx = startGlobalIndexOfStage(stageIndex);
    const expected = expectedQuestionsForStage(stageIndex);

    const entries: Record<number, ResponseEntry> = {};

    for (let i = 0; i < expected; i++) {
      const globalIdx = startIdx + i;
      if (responses[globalIdx]) {
        entries[i] = responses[globalIdx];
      }
    }

    return entries;
  };

  useEffect(() => {
    if (currentStage === 0) return;
    if (stages[currentStage]) return;
    if (!sessionId) return;
    if (assessmentBlocked) return;

    const loadStage = async () => {
      try {
        setIsLoadingStage(true);

        const initialContextAnswer = responses[0]?.answer;
        const respondentContext =
          typeof initialContextAnswer === "string"
            ? initialContextAnswer
            : initialContextAnswer &&
                typeof initialContextAnswer === "object" &&
                "selected" in initialContextAnswer
              ? String(
                  (initialContextAnswer as { selected?: string }).selected ??
                    "Contexto não informado"
                )
              : initialContextAnswer &&
                  typeof initialContextAnswer === "object" &&
                  "answer" in initialContextAnswer
                ? String(
                    (initialContextAnswer as { answer?: string }).answer ??
                      "Contexto não informado"
                  )
                : "Contexto não informado";

        const response = await fetch(
          `${API_BASE_URL}/api/generate-stage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stage: currentStage,
              userId: DEMO_USER_ID,
              sessionId,
              assessmentId,
              assessmentContext,
              assessmentTitle,
              assessmentFormType,
              assessmentObjective,
              profile: respondentContext,
              respondentContext,
              context: buildContextObjectForStage(currentStage),
            }),
          }
        );

        if (!response.ok) {
          const t = await response.text();
          console.error("❌ /api/generate-stage:", t);
          throw new Error("Falha ao carregar etapa");
        }

        const raw = await response.json();
        const normalized = normalizeStageFromBackend(raw, currentStage);

        setStages((prev) => {
          const next = [...prev];
          next[currentStage] = normalized;
          return next;
        });

        setCurrentQuestion(0);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar perguntas.");
      } finally {
        setIsLoadingStage(false);
      }
    };

    loadStage();
  }, [
    currentStage,
    sessionId,
    stages,
    responses,
    assessmentId,
    assessmentContext,
    assessmentTitle,
    assessmentFormType,
    assessmentObjective,
    assessmentBlocked,
  ]);

  const pruneAfter = (changedStage: number, changedQuestionIndex: number) => {
    const changedGlobalIndex = globalIndexOf(changedStage, changedQuestionIndex);

    setResponses((prev) => {
      const next: Record<number, ResponseEntry> = {};
      Object.keys(prev)
        .map(Number)
        .forEach((k) => {
          if (k <= changedGlobalIndex) next[k] = prev[k];
        });
      return next;
    });

    setStages((prev) => prev.slice(0, changedStage + 1));
  };

  const setAnswerAtCurrent = (finalAnswer: unknown) => {
    if (!question) return;

    setResponses((prev) => ({
      ...prev,
      [globalIndex]: { question: question.question, answer: finalAnswer },
    }));
  };

  const handleResponse = (value: unknown) => {
    if (!question) return;

    const prevAnswer = responses[globalIndex]?.answer;
    let finalAnswer: unknown = value;

    if (question.type === "select" && hasOtherOption(question)) {
      const isOther = isOtherLikeOption(String(value));
      if (isOther) {
        finalAnswer = {
          selected: value,
          description: otherText[globalIndex] || "",
        };
      }
    }

    if (question.type === "checkbox" && hasOtherOption(question)) {
      const arr: string[] = Array.isArray(value) ? value : [];
      const hasOther = arr.some((x) => isOtherLikeOption(String(x)));

      if (hasOther) {
        finalAnswer = {
          selected: arr,
          description: otherText[globalIndex] || "",
        };
      } else {
        finalAnswer = arr;
      }
    }

    const changed = JSON.stringify(prevAnswer) !== JSON.stringify(finalAnswer);

    setAnswerAtCurrent(finalAnswer);

    if (changed) {
      pruneAfter(currentStage, currentQuestion);
    }
  };

  const syncOtherDescriptionOnly = (text: string) => {
    if (!question) return;

    const currentAnswer = responses[globalIndex]?.answer;
    if (!isOtherSelected(question, currentAnswer)) return;

    if (question.type === "select") {
      const selected =
        currentAnswer && typeof currentAnswer === "object" && "selected" in currentAnswer
          ? (currentAnswer as { selected?: string }).selected
          : "Outro";

      setAnswerAtCurrent({ selected, description: text });
      return;
    }

    if (question.type === "checkbox") {
      const selected =
        currentAnswer &&
        typeof currentAnswer === "object" &&
        "selected" in currentAnswer &&
        Array.isArray((currentAnswer as { selected?: string[] }).selected)
          ? (currentAnswer as { selected: string[] }).selected
          : Array.isArray(currentAnswer)
            ? currentAnswer
            : ["Outro"];

      setAnswerAtCurrent({ selected, description: text });
    }
  };

  const validateAnswer = (currentQuestionItem: Question, answer: unknown) => {
    if (!currentQuestionItem.required) return true;

    if (currentQuestionItem.type === "textarea") {
      return String(answer ?? "").trim() !== "";
    }

    if (currentQuestionItem.type === "checkbox") {
      const arr =
        answer &&
        typeof answer === "object" &&
        "selected" in answer &&
        Array.isArray((answer as { selected?: string[] }).selected)
          ? (answer as { selected: string[] }).selected
          : Array.isArray(answer)
            ? answer
            : [];

      return arr.length > 0;
    }

    if (currentQuestionItem.type === "select") {
      if (answer && typeof answer === "object" && "selected" in answer) {
        return String((answer as { selected?: string }).selected ?? "").trim() !== "";
      }
      return String(answer ?? "").trim() !== "";
    }

    return !(answer === undefined || answer === null || answer === "");
  };

  const handleNext = async () => {
    if (!question) return;
    if (isProcessingNext) return;
    if (!sessionId) {
      toast.error("Sessão não iniciada.");
      return;
    }

    setIsProcessingNext(true);

    const answer = responses[globalIndex]?.answer;

    if (!validateAnswer(question, answer)) {
      toast.error("Campo obrigatório.");
      setIsProcessingNext(false);
      return;
    }

    const otherActive = isOtherSelected(question, answer);
    if (otherActive) {
      const txt = (otherText[globalIndex] || "").trim();
      if (!txt) {
        toast.error("Descreva a opção selecionada para continuar.");
        setIsProcessingNext(false);
        return;
      }
      syncOtherDescriptionOnly(txt);
    }

    const isLastQuestionOfStage =
      currentQuestion >= (stage?.questions?.length || 0) - 1;

    if (isLastQuestionOfStage && currentStage > 0) {
      try {
        const currentStageResponses = getResponsesForStage(currentStage);

        await saveResponsesStage(
          DEMO_USER_ID,
          sessionId,
          assessmentId,
          currentStageResponses,
          currentStage
        );
      } catch (e) {
        console.error(e);
        toast.error("Erro ao salvar etapa.");
        setIsProcessingNext(false);
        return;
      }
    }

    if (!isLastQuestionOfStage) {
      setCurrentQuestion((p) => p + 1);
      setIsProcessingNext(false);
      return;
    }

    if (currentStage < TOTAL_STAGES - 1) {
      setCurrentStage((p) => p + 1);
      setCurrentQuestion(0);
      setIsProcessingNext(false);
      return;
    }

    await handleSubmit();
    setIsProcessingNext(false);
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((p) => p - 1);
      return;
    }

    if (currentStage > 0) {
      const prevStage = currentStage - 1;
      setCurrentStage(prevStage);
      const lastQ = (stages[prevStage]?.questions?.length || 1) - 1;
      setCurrentQuestion(lastQ < 0 ? 0 : lastQ);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId) {
      toast.error("Sessão não iniciada.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payloadResponses = Object.entries(responses)
        .map(([idx, data]) => ({
          questionId: Number(idx),
          question: data.question,
          answer: data.answer,
        }))
        .sort((a, b) => a.questionId - b.questionId);

      const resp = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          sessionId,
          assessmentId,
          responses: payloadResponses,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        console.error("❌ /api/analyze:", t);
        toast.error("Erro ao gerar relatório.");
        return;
      }

      const result = await resp.json();

      onComplete({
        sessionId,
        assessmentId,
        responses: payloadResponses,
        report: result.report,
        metrics: result.metrics,
        reportMode: result.reportMode,
        reportNotice: result.reportNotice,
        risks: result.risks ?? result.metrics?.risks ?? {},
        score: result.score ?? result.metrics?.score ?? 0,
        summary: result.summary ?? "",
        controls: result.controls ?? [],
        strengths: result.strengths ?? result.metrics?.strengths ?? [],
        attentionPoints:
          result.attentionPoints ?? result.metrics?.attentionPoints ?? [],
        criticalIssues:
          result.criticalIssues ?? result.metrics?.criticalIssues ?? [],
        controlsStatus:
          result.controlsStatus ?? result.metrics?.controlsStatus ?? [],
        recommendations:
          result.recommendations ?? result.metrics?.recommendations ?? [],
      });

      toast.success("Análise gerada com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao finalizar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingAssessment) {
    return (
      <AssessmentInlineLoading
        title="Verificando disponibilidade"
        subtitle="Estamos confirmando se o formulário está ativo e pronto para receber suas respostas."
      />
    );
  }

  if (assessmentBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-black flex items-center justify-center px-4">
        <Card className="w-full max-w-xl p-8 bg-white/5 backdrop-blur-md border-white/10 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-red-300" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Avaliação indisponível
          </h2>
          <p className="text-white/70">{assessmentBlockedMessage}</p>
        </Card>
      </div>
    );
  }

  if (!question || isLoadingStage) {
    return (
      <AssessmentInlineLoading
        title="Preparando perguntas"
        subtitle="Estamos organizando a próxima etapa da avaliação para que você tenha uma experiência mais clara e fluida."
      />
    );
  }

  const renderQuestionInput = () => {
    const value = responses[globalIndex]?.answer;

    if (question.type === "select") {
      const selectedValue =
        value && typeof value === "object" && "selected" in value
          ? String((value as { selected?: string }).selected ?? "")
          : String(value ?? "");

      const showOther = isOtherSelected(question, value);

      return (
        <div className="space-y-4">
          <Select value={selectedValue} onValueChange={handleResponse}>
            <SelectTrigger className="w-full bg-black/20 border-white/20 text-white">
              <SelectValue placeholder="Selecione uma opção..." />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1526]">
              {question.options?.map((o) => (
                <SelectItem key={o} value={o} className="text-white">
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showOther && (
            <input
              className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white"
              placeholder="Descreva a opção selecionada..."
              value={otherText[globalIndex] || ""}
              onChange={(e) => {
                const txt = e.target.value;
                setOtherText((prev) => ({ ...prev, [globalIndex]: txt }));
                syncOtherDescriptionOnly(txt);
              }}
            />
          )}
        </div>
      );
    }

    if (question.type === "checkbox") {
      const arr: string[] =
        value &&
        typeof value === "object" &&
        "selected" in value &&
        Array.isArray((value as { selected?: string[] }).selected)
          ? (value as { selected: string[] }).selected
          : Array.isArray(value)
            ? value
            : [];

      return (
        <div className="space-y-3">
          {question.options?.map((o) => {
            const checked = arr.includes(o);
            const isOther = isOtherLikeOption(o);

            return (
              <div key={o} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const next = c ? [...arr, o] : arr.filter((v) => v !== o);
                      handleResponse(next);
                    }}
                  />
                  <Label className="text-white">{o}</Label>
                </div>

                {isOther && checked && (
                  <input
                    className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white"
                    placeholder="Descreva a opção selecionada..."
                    value={otherText[globalIndex] || ""}
                    onChange={(e) => {
                      const txt = e.target.value;
                      setOtherText((prev) => ({
                        ...prev,
                        [globalIndex]: txt,
                      }));
                      syncOtherDescriptionOnly(txt);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    const textValue =
      typeof value === "string"
        ? value
        : value && typeof value === "object" && "description" in value
          ? String((value as { description?: string }).description ?? "")
          : "";

    return (
      <Textarea
        className="min-h-[120px] bg-black/20 border-white/20 text-white"
        value={textValue}
        onChange={(e) => handleResponse(e.target.value)}
        placeholder="Digite sua resposta aqui..."
      />
    );
  };

  const isLastStep =
    currentStage === TOTAL_STAGES - 1 &&
    currentQuestion === (stage?.questions?.length || 1) - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0d1526] to-black py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center space-y-3">
          {assessmentTitle && (
            <div>
              <p className="text-cyan-300 text-xs uppercase tracking-[0.2em]">
                Avaliação
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                {assessmentTitle}
              </h1>
            </div>
          )}

          {(assessmentFormType || assessmentObjective) && (
            <div className="flex flex-wrap justify-center gap-2">
              {assessmentFormType && (
                <span className="px-3 py-1 rounded-full text-[11px] font-medium border border-sky-500/30 bg-sky-500/10 text-sky-200">
                  {assessmentFormType}
                </span>
              )}
              {assessmentObjective && (
                <span className="px-3 py-1 rounded-full text-[11px] font-medium border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200">
                  {assessmentObjective}
                </span>
              )}
            </div>
          )}

          <div>
            <p className="text-primary text-sm">{stage.title}</p>
            <p className="text-white/70 text-xs">{stage.description}</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-1 text-white/80 text-sm">
            <span>
              Questão {currentQuestion + 1} de {stage.questions.length} (Etapa{" "}
              {displayStageNumber})
            </span>
            <span className="text-primary font-medium">
              {Math.round(progress)}% completo
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="p-8 bg-white/5 backdrop-blur-md border-white/10 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-2">
            {question.question}
          </h2>

          {question.description && (
            <p className="text-white/70 mb-2">{question.description}</p>
          )}

          {question.required && (
            <p className="text-red-400 text-xs mb-4">* Campo obrigatório</p>
          )}

          {renderQuestionInput()}

          <div className="flex gap-4 mt-8">
            <Button
              variant="outline"
              onClick={
                currentStage === 0 && currentQuestion === 0 ? onBack : handlePrevious
              }
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {currentStage === 0 && currentQuestion === 0
                ? "Voltar ao Início"
                : "Anterior"}
            </Button>

            <Button
              onClick={handleNext}
              disabled={isSubmitting || isProcessingNext || !sessionId}
              className="flex-1"
            >
              {isSubmitting || isProcessingNext ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  {isLastStep ? "Finalizar" : "Próxima"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default QuestionnaireScreen;