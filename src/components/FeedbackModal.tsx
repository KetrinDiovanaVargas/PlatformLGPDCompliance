import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Heart } from "lucide-react";

type FeedbackAnswer = {
  questionId: number;
  answer: 1 | 2 | 3 | 4;
};

type FeedbackModalProps = {
  assessmentId: string;
  assessmentTitle: string;
  onSubmit: (feedback: FeedbackAnswer[]) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
};

const FEEDBACK_QUESTIONS = [
  {
    id: 1,
    category: "Utilidade percebida",
    text: "A ferramenta me ajudou a refletir melhor sobre a maturidade da organização em proteção de dados.",
  },
  {
    id: 2,
    category: "Utilidade percebida",
    text: "As perguntas geradas pela ferramenta foram relevantes para identificar práticas, riscos ou lacunas de conformidade.",
  },
  {
    id: 3,
    category: "Utilidade percebida",
    text: "O uso da ferramenta pode contribuir para melhorar processos relacionados à LGPD, privacidade ou proteção de dados.",
  },
  {
    id: 4,
    category: "Utilidade percebida",
    text: "O diagnóstico ou resultado final apresentado pela ferramenta foi útil para compreender o nível de maturidade da organização.",
  },
  {
    id: 5,
    category: "Facilidade de uso percebida",
    text: "Foi fácil entender como responder ao questionário na plataforma.",
  },
  {
    id: 6,
    category: "Facilidade de uso percebida",
    text: "A sequência das perguntas foi clara e coerente com as respostas fornecidas anteriormente.",
  },
  {
    id: 7,
    category: "Facilidade de uso percebida",
    text: "A interação com a ferramenta exigiu pouco esforço para ser realizada.",
  },
  {
    id: 8,
    category: "Facilidade de uso percebida",
    text: "A linguagem utilizada nas perguntas foi compreensível para o meu perfil ou função na organização.",
  },
  {
    id: 9,
    category: "Atitude em relação ao uso",
    text: "Minha experiência geral com a ferramenta foi positiva.",
  },
  {
    id: 10,
    category: "Intenção de uso",
    text: "Eu utilizaria novamente a ferramenta para apoiar avaliações de maturidade ou conformidade em proteção de dados.",
  },
];

const SCALE_OPTIONS = [
  { value: 1, label: "Discordo completamente", color: "bg-red-500/20 hover:bg-red-500/30" },
  { value: 2, label: "Discordo parcialmente", color: "bg-orange-500/20 hover:bg-orange-500/30" },
  { value: 3, label: "Concordo parcialmente", color: "bg-yellow-500/20 hover:bg-yellow-500/30" },
  { value: 4, label: "Concordo plenamente", color: "bg-green-500/20 hover:bg-green-500/30" },
];

export function FeedbackModal({
  assessmentId,
  assessmentTitle,
  onSubmit,
  onCancel,
  loading = false,
}: FeedbackModalProps) {
  const [answers, setAnswers] = useState<Record<number, 1 | 2 | 3 | 4>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = Object.keys(answers).length;
  const totalQuestions = FEEDBACK_QUESTIONS.length;
  const isComplete = answered === totalQuestions;

  const handleAnswer = (questionId: number, value: 1 | 2 | 3 | 4) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      setError("Por favor, responda todas as perguntas antes de enviar.");
      return;
    }

    setSubmitting(true);
    try {
      const feedbackData = Object.entries(answers).map(([questionId, answer]) => ({
        questionId: parseInt(questionId),
        answer: answer as 1 | 2 | 3 | 4,
      }));

      await onSubmit(feedbackData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const groupedQuestions = FEEDBACK_QUESTIONS.reduce(
    (acc, question) => {
      const existing = acc.find((g) => g.category === question.category);
      if (existing) {
        existing.questions.push(question);
      } else {
        acc.push({ category: question.category, questions: [question] });
      }
      return acc;
    },
    [] as Array<{ category: string; questions: typeof FEEDBACK_QUESTIONS }>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto p-4 pt-6 sm:pt-10">
      <Card className="w-full max-w-2xl bg-slate-950 border border-slate-800 shadow-2xl">
        <div className="space-y-6 p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-5 h-5 text-red-400" />
                <h2 className="text-2xl font-bold text-slate-100">
                  Feedback sobre sua experiência
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Sua opinião é muito importante para melhorarmos continuamente a plataforma
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={submitting}
              className="text-slate-400 hover:text-slate-200 transition-colors shrink-0 mt-1 disabled:opacity-50"
              title="Fechar"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-slate-400">Progresso</span>
              <span className="text-sky-400 font-semibold">
                {answered} de {totalQuestions}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-500 to-cyan-400 h-full transition-all duration-300"
                style={{ width: `${(answered / totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Questions */}
          <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2">
            {groupedQuestions.map((group, groupIndex) => (
              <div key={groupIndex}>
                <div className="sticky top-0 bg-slate-950 py-2 z-10">
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                    {group.category}
                  </p>
                </div>
                <div className="space-y-6 mt-3">
                  {group.questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <div className="flex gap-2">
                        <span className="text-xs font-semibold text-sky-400 shrink-0 w-5 h-5 flex items-center justify-center bg-sky-500/20 rounded-full">
                          {question.id}
                        </span>
                        <p className="text-sm text-slate-200 leading-relaxed flex-1">
                          {question.text}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-7">
                        {SCALE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() =>
                              handleAnswer(
                                question.id,
                                option.value as 1 | 2 | 3 | 4
                              )
                            }
                            disabled={submitting}
                            className={`rounded-lg border-2 p-2 sm:p-3 text-left transition-all text-xs sm:text-sm disabled:opacity-50 ${
                              answers[question.id] === option.value
                                ? "border-sky-500 bg-sky-500/20"
                                : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                            } ${option.color}`}
                          >
                            <div className="font-semibold text-slate-100">
                              {option.value}
                            </div>
                            <div className="text-slate-400 text-xs mt-1">
                              {option.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-slate-700">
            <Button
              onClick={onCancel}
              disabled={submitting}
              variant="outline"
              className="text-slate-300 border-slate-700 hover:bg-slate-900"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isComplete || submitting}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Enviando...
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 mr-2" />
                  Enviar Feedback
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default FeedbackModal;
