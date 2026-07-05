import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, CheckCircle2 } from "lucide-react";

type Assessment = {
  id: string;
  title: string;
  formType: string;
  respostas: number;
};

type AssessmentSelectorModalProps = {
  assessments: Assessment[];
  onSelect: (assessmentId: string) => void;
  onCancel: () => void;
  loading?: boolean;
};

export function AssessmentSelectorModal({
  assessments,
  onSelect,
  onCancel,
  loading = false,
}: AssessmentSelectorModalProps) {
  const [selectedId, setSelectedId] = useState<string>("");

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  const selectedAssessment = assessments.find((a) => a.id === selectedId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto p-4 pt-20">
      <Card className="w-full max-w-2xl bg-slate-950 border border-slate-800 shadow-2xl">
        <div className="space-y-6 p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">
                Selecione uma Avaliação
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Escolha qual avaliação deseja analisar para gerar insights consolidados.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-200 transition-colors shrink-0 mt-1"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Assessment List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {assessments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/30 p-6 text-center">
                <p className="text-sm text-slate-400">
                  Nenhuma avaliação disponível
                </p>
              </div>
            ) : (
              assessments.map((assessment) => (
                <button
                  key={assessment.id}
                  onClick={() => setSelectedId(assessment.id)}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                    selectedId === assessment.id
                      ? "border-sky-500/60 bg-sky-500/20"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {assessment.title}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                        <span>
                          Tipo: <span className="text-slate-300">{assessment.formType}</span>
                        </span>
                        <span>
                          Respostas: <span className="text-slate-300">{assessment.respostas}</span>
                        </span>
                      </div>
                    </div>
                    {selectedId === assessment.id && (
                      <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Selected Assessment Info */}
          {selectedAssessment && (
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-sky-300 mb-1">
                Avaliação selecionada
              </p>
              <p className="text-sm font-medium text-sky-100">
                {selectedAssessment.title}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button
              onClick={onCancel}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedId || loading}
              className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white gap-2"
            >
              {loading ? "Gerando..." : "Analisar"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
