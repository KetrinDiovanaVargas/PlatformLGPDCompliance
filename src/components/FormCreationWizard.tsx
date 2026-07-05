import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Step = 1 | 2 | 3 | 4;

const FORM_TYPE_OPTIONS = [
  { value: "lgpd_diagnostico", label: "Diagnóstico" },
  { value: "lgpd_maturidade", label: "Maturidade" },
  { value: "privacidade_operacional", label: "Privacidade Operacional" },
  { value: "riscos_e_controles", label: "Riscos e Controles" },
];

const OBJECTIVE_OPTIONS = [
  { value: "diagnostico_inicial", label: "Diagnóstico inicial" },
  { value: "mapeamento_maturidade", label: "Mapeamento de maturidade" },
  { value: "levantamento_percepcao", label: "Levantamento de percepção" },
  { value: "auditoria_interna", label: "Auditoria interna" },
  {
    value: "treinamento_conscientizacao",
    label: "Treinamento e conscientização",
  },
  { value: "identificacao_riscos", label: "Identificação de riscos" },
];

type WizardProps = {
  adminUid: string;
  adminName: string;
  onSuccess: () => Promise<void>;
  onCancel: () => void;
};

export function FormCreationWizard({
  adminUid,
  adminName,
  onSuccess,
  onCancel,
}: WizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [formType, setFormType] = useState("lgpd_diagnostico");
  const [objective, setObjective] = useState("diagnostico_inicial");
  const [audience, setAudience] = useState("");
  const [introText, setIntroText] = useState("");
  const [context, setContext] = useState("");

  const canProceed = () => {
    switch (step) {
      case 1:
        return title.trim() && formType;
      case 2:
        return audience.trim();
      case 3:
        return introText.trim() && context.trim();
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && step < 4) {
      setStep((step + 1) as Step);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleCreate = async () => {
    if (!canProceed()) return;

    try {
      setLoading(true);

      const docRef = await addDoc(collection(db, "assessments"), {
        title: title.trim(),
        formType,
        objective,
        audience: audience.trim(),
        introText: introText.trim(),
        context: context.trim(),
        active: true,
        deleted: false,
        ownerId: adminUid,
        ownerName: adminName || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const link = `${window.location.origin}/assessment/${docRef.id}`;
      await navigator.clipboard.writeText(link);

      toast.success("Avaliação criada com sucesso!");
      toast.success("Link copiado para a área de transferência.");

      await onSuccess();
      onCancel();
    } catch (err) {
      console.error("Erro ao criar avaliação:", err);
      toast.error("Erro ao criar avaliação.");
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    "Identifique a Avaliação",
    "Defina o Público-Alvo",
    "Descreva o Contexto",
    "Revise e Crie",
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-slate-950 border border-slate-800 shadow-2xl">
        <div className="space-y-6 p-6 md:p-8">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">
              Nova Avaliação
            </h2>
            <p className="text-sm text-slate-400">
              Etapa {step} de 4: {stepTitles[step - 1]}
            </p>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-sky-500" : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Assessment Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome da Avaliação *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Diagnóstico LGPD - Q1 2024"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tipo de Formulário *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  {FORM_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <p className="text-xs text-amber-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Esses dados definem como a avaliação aparecerá para os
                  respondentes.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Audience */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Público-Alvo *
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ex: Alunos, Colaboradores CLT, Clientes, etc"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Objetivo *
                </label>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  {OBJECTIVE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Intro & Context */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Texto de Introdução *
                </label>
                <textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  placeholder="Mensagem de boas-vindas que os respondentes verão ao iniciar a avaliação."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Contexto da Avaliação *
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Descreva o contexto, escopo e importância dessa avaliação."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-900 border border-slate-700 p-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                    Nome
                  </p>
                  <p className="text-sm font-medium text-slate-100">{title}</p>
                </div>

                <div className="h-px bg-slate-700" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                      Tipo
                    </p>
                    <p className="text-sm text-slate-300">
                      {FORM_TYPE_OPTIONS.find((o) => o.value === formType)
                        ?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                      Objetivo
                    </p>
                    <p className="text-sm text-slate-300">
                      {OBJECTIVE_OPTIONS.find((o) => o.value === objective)
                        ?.label}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                      Público-Alvo
                    </p>
                    <p className="text-sm text-slate-300">
                      {audience}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                      Criador
                    </p>
                    <p className="text-sm text-slate-300">{adminName}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <p className="text-xs text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  Tudo pronto? Clique em "Criar Avaliação" para finalizar.
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between gap-3 pt-4 border-t border-slate-700">
            <div className="flex gap-2">
              <Button
                onClick={onCancel}
                className="rounded-lg bg-sky-500 hover:bg-sky-600 text-white"
              >
                Cancelar
              </Button>
              {step > 1 && (
                <Button
                  onClick={handlePrev}
                  className="rounded-lg bg-sky-500 hover:bg-sky-600 text-white gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-sky-400 text-white gap-1"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={loading || !canProceed()}
                  className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-sky-400 text-white gap-1"
                >
                  {loading ? "Criando..." : <>
                    <Plus className="w-4 h-4" />
                    Criar Avaliação
                  </>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
