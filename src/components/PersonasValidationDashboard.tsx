import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfusionMatrix, type ConfusionMatrixData } from "@/components/ConfusionMatrix";
import { usePersonasValidation } from "@/hooks/usePersonasValidation";
import { AlertCircle, CheckCircle2, BarChart3, TrendingUp, Users, Loader2 } from "lucide-react";

type PersonasValidationDashboardProps = {
  assessmentId?: string;
  title?: string;
  onSeedData?: () => void;
  seedingPersonas?: boolean;
};

export function PersonasValidationDashboard({
  assessmentId,
  title = "Validação de Personas LGPD",
  onSeedData,
  seedingPersonas = false,
}: PersonasValidationDashboardProps) {
  const { data, loading, error, refetch } = usePersonasValidation(assessmentId);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  const selectedPersonaData = useMemo(() => {
    if (!data || !selectedPersona) return null;
    return data.personas.find((p) => p.id === selectedPersona);
  }, [data, selectedPersona]);

  // Auto-select first persona if available
  React.useEffect(() => {
    if (data && data.personas.length > 0 && !selectedPersona) {
      setSelectedPersona(data.personas[0].id);
    }
  }, [data, selectedPersona]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin">
            <BarChart3 className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-sm text-slate-400">Carregando validação de personas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-200">Erro ao carregar validação</p>
            <p className="text-xs text-red-300/70 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.totalPersonas === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/30 p-6 text-center">
        <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">
          Nenhuma validação de personas disponível
        </p>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Comece adicionando dados de validação para suas personas
        </p>
        {onSeedData && (
          <Button
            onClick={async () => {
              await onSeedData();
              setTimeout(() => refetch(), 500);
            }}
            disabled={seedingPersonas}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          >
            {seedingPersonas ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando dados...
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                Carregar Dados de Exemplo
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com métrica geral */}
      <div>
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-400" />
          {title}
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Comparação entre Esperado (Oráculo) e Detectado (Sistema) para cada persona LGPD
        </p>
      </div>

      {/* Métrica geral de acurácia */}
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-sky-300 mb-1">
              Acurácia Média de Detecção
            </p>
            <p className="text-3xl font-bold text-sky-100">
              {data.averageAccuracy.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-sky-300 mb-1">
              Total de Personas
            </p>
            <p className="text-3xl font-bold text-sky-100">
              {data.totalPersonas}
            </p>
          </div>
        </div>
      </div>

      {/* Selector de personas */}
      {data.personas.length > 1 && (
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 block">
            Selecione uma Persona para detalhar:
          </label>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {data.personas.map((persona) => {
              const total =
                persona.confusionMatrix.truePositives +
                persona.confusionMatrix.falsePositives +
                persona.confusionMatrix.falseNegatives +
                persona.confusionMatrix.trueNegatives;
              const accuracy =
                total > 0
                  ? (
                      ((persona.confusionMatrix.truePositives +
                        persona.confusionMatrix.trueNegatives) /
                        total) *
                      100
                    ).toFixed(1)
                  : "0";

              return (
                <button
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona.id)}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    selectedPersona === persona.id
                      ? "border-sky-500/60 bg-sky-500/20"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-100 mb-1">
                    {persona.personaName}
                  </p>
                  {persona.description && (
                    <p className="text-[11px] text-slate-400 mb-2">
                      {persona.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[11px]">
                    {parseFloat(accuracy) >= 75 ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                    )}
                    <span className="text-slate-300">{accuracy}% acurácia</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Confusion matrix para persona selecionada */}
      {selectedPersonaData && (
        <Card className="border-slate-700 bg-slate-800/40 p-4">
          <ConfusionMatrix
            data={selectedPersonaData.confusionMatrix}
            title={`Matriz de Confusão - ${selectedPersonaData.personaName}`}
            description={
              selectedPersonaData.description || "Validação de detecção de fragilidades LGPD"
            }
          />
          {selectedPersonaData.notes && (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/30 p-3">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Observações
              </p>
              <p className="text-xs text-slate-400">{selectedPersonaData.notes}</p>
            </div>
          )}
        </Card>
      )}

      {/* Resumo comparativo de todas as personas */}
      {data.personas.length > 1 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Comparativo de Personas
            </h4>
          </div>

          <div className="space-y-2">
            {data.personas.map((persona) => {
              const total =
                persona.confusionMatrix.truePositives +
                persona.confusionMatrix.falsePositives +
                persona.confusionMatrix.falseNegatives +
                persona.confusionMatrix.trueNegatives;
              const accuracy =
                total > 0
                  ? (
                      ((persona.confusionMatrix.truePositives +
                        persona.confusionMatrix.trueNegatives) /
                        total) *
                      100
                    ).toFixed(1)
                  : "0";

              return (
                <div key={persona.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-300 truncate">
                        {persona.personaName}
                      </p>
                      <span className="text-xs font-semibold text-slate-100">
                        {accuracy}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-900/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          parseFloat(accuracy) >= 75
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                            : parseFloat(accuracy) >= 50
                              ? "bg-gradient-to-r from-amber-500 to-amber-400"
                              : "bg-gradient-to-r from-red-500 to-red-400"
                        }`}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPersona(persona.id)}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors shrink-0"
                  >
                    Ver detalhes →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
