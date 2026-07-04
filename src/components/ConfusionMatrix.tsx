import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp } from "lucide-react";

export type ConfusionMatrixData = {
  truePositives: number;   // Esperado: SIM, Detectado: SIM (Correto)
  falsePositives: number;  // Esperado: NÃO, Detectado: SIM (Falso Alarme)
  falseNegatives: number;  // Esperado: SIM, Detectado: NÃO (Perdido)
  trueNegatives: number;   // Esperado: NÃO, Detectado: NÃO (Correto)
};

type ConfusionMatrixProps = {
  data: ConfusionMatrixData;
  title?: string;
  description?: string;
};

export function ConfusionMatrix({
  data,
  title = "Matriz de Confusão - Validação de Personas",
  description = "Comparação entre Esperado (Oráculo) e Detectado (Sistema)",
}: ConfusionMatrixProps) {
  const metrics = useMemo(() => {
    const { truePositives: tp, falsePositives: fp, falseNegatives: fn, trueNegatives: tn } = data;
    const total = tp + fp + fn + tn;

    // Evita divisão por zero
    const accuracy = total > 0 ? ((tp + tn) / total * 100) : 0;
    const precision = (tp + fp) > 0 ? (tp / (tp + fp) * 100) : 0;
    const recall = (tp + fn) > 0 ? (tp / (tp + fn) * 100) : 0;
    const f1Score = (precision + recall) > 0 ? (2 * (precision * recall) / (precision + recall)) : 0;
    const specificity = (tn + fp) > 0 ? (tn / (tn + fp) * 100) : 0;

    return {
      accuracy: Math.round(accuracy * 10) / 10,
      precision: Math.round(precision * 10) / 10,
      recall: Math.round(recall * 10) / 10,
      f1Score: Math.round(f1Score * 10) / 10,
      specificity: Math.round(specificity * 10) / 10,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Título e Descrição */}
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>

      {/* Matriz 2x2 Principal */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* True Positives - Esperado: SIM, Detectado: SIM */}
        <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
              Verdadeiros Positivos
            </p>
          </div>
          <p className="text-2xl font-bold text-emerald-100 mb-2">{data.truePositives}</p>
          <p className="text-[11px] text-emerald-200/70">
            Esperado: ✓ Sim | Detectado: ✓ Sim
          </p>
        </div>

        {/* False Positives - Esperado: NÃO, Detectado: SIM */}
        <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
              Falsos Positivos
            </p>
          </div>
          <p className="text-2xl font-bold text-amber-100 mb-2">{data.falsePositives}</p>
          <p className="text-[11px] text-amber-200/70">
            Esperado: ✗ Não | Detectado: ✓ Sim
          </p>
        </div>

        {/* False Negatives - Esperado: SIM, Detectado: NÃO */}
        <div className="rounded-lg border-2 border-red-500/40 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">
              Falsos Negativos
            </p>
          </div>
          <p className="text-2xl font-bold text-red-100 mb-2">{data.falseNegatives}</p>
          <p className="text-[11px] text-red-200/70">
            Esperado: ✓ Sim | Detectado: ✗ Não
          </p>
        </div>

        {/* True Negatives - Esperado: NÃO, Detectado: NÃO */}
        <div className="rounded-lg border-2 border-slate-500/40 bg-slate-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Verdadeiros Negativos
            </p>
          </div>
          <p className="text-2xl font-bold text-slate-100 mb-2">{data.trueNegatives}</p>
          <p className="text-[11px] text-slate-200/70">
            Esperado: ✗ Não | Detectado: ✗ Não
          </p>
        </div>
      </div>

      {/* Métricas Calculadas */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-sky-400" />
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Métricas de Validação
          </h4>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {/* Acurácia */}
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
            <p className="text-[11px] font-medium text-sky-300 uppercase tracking-wider mb-1">
              Acurácia
            </p>
            <p className="text-2xl font-bold text-sky-100">{metrics.accuracy.toFixed(1)}%</p>
            <p className="text-[10px] text-sky-200/60 mt-1">
              (TP + TN) / Total
            </p>
          </div>

          {/* Precisão */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[11px] font-medium text-emerald-300 uppercase tracking-wider mb-1">
              Precisão
            </p>
            <p className="text-2xl font-bold text-emerald-100">{metrics.precision.toFixed(1)}%</p>
            <p className="text-[10px] text-emerald-200/60 mt-1">
              TP / (TP + FP)
            </p>
          </div>

          {/* Recall (Sensibilidade) */}
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
            <p className="text-[11px] font-medium text-orange-300 uppercase tracking-wider mb-1">
              Recall
            </p>
            <p className="text-2xl font-bold text-orange-100">{metrics.recall.toFixed(1)}%</p>
            <p className="text-[10px] text-orange-200/60 mt-1">
              TP / (TP + FN)
            </p>
          </div>

          {/* F1-Score */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <p className="text-[11px] font-medium text-purple-300 uppercase tracking-wider mb-1">
              F1-Score
            </p>
            <p className="text-2xl font-bold text-purple-100">{metrics.f1Score.toFixed(1)}%</p>
            <p className="text-[10px] text-purple-200/60 mt-1">
              2 × (P × R) / (P + R)
            </p>
          </div>

          {/* Especificidade */}
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
            <p className="text-[11px] font-medium text-cyan-300 uppercase tracking-wider mb-1">
              Especificidade
            </p>
            <p className="text-2xl font-bold text-cyan-100">{metrics.specificity.toFixed(1)}%</p>
            <p className="text-[10px] text-cyan-200/60 mt-1">
              TN / (TN + FP)
            </p>
          </div>
        </div>
      </div>

      {/* Legenda Interpretativa */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/20 p-3 text-xs text-slate-300 space-y-1">
        <p className="font-semibold text-slate-200">Interpretação:</p>
        <ul className="space-y-1 text-slate-400">
          <li>• <strong>Acurácia:</strong> Proporção total de previsões corretas</li>
          <li>• <strong>Precisão:</strong> De todas as detecções feitas, quantas estavam corretas</li>
          <li>• <strong>Recall:</strong> De todos os casos esperados, quantos foram detectados</li>
          <li>• <strong>F1-Score:</strong> Balanço entre Precisão e Recall (média harmônica)</li>
          <li>• <strong>Especificidade:</strong> Capacidade de identificar corretamente casos negativos</li>
        </ul>
      </div>
    </div>
  );
}
