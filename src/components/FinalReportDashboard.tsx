import React, { useState } from "react";
import { ChevronDown, CheckCircle2, AlertTriangle, AlertOctagon, Clock } from "lucide-react";

type Severity = "critical" | "high" | "medium";

interface Fragility {
  id: string;
  name: string;
  description: string;
  risk: string;
  actions: string[];
  daysToResolve: number;
  severity: Severity;
}

interface FinalReportDashboardProps {
  fragilites: Fragility[];
  scoreAverage: number;
}

const SEVERITY_CONFIG = {
  critical: {
    color: "from-red-600 to-red-700",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    textColor: "text-red-400",
    icon: AlertOctagon,
    label: "CRÍTICO",
    description: "Resolver nos próximos 30 dias",
  },
  high: {
    color: "from-amber-600 to-amber-700",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-400",
    icon: AlertTriangle,
    label: "ALTO",
    description: "Resolver nos próximos 45 dias",
  },
  medium: {
    color: "from-emerald-600 to-emerald-700",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    textColor: "text-emerald-400",
    icon: CheckCircle2,
    label: "MÉDIO",
    description: "Resolver nos próximos 60 dias",
  },
};

export function FinalReportDashboard({ fragilites, scoreAverage }: FinalReportDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const grouped = {
    critical: fragilites.filter((f) => f.severity === "critical"),
    high: fragilites.filter((f) => f.severity === "high"),
    medium: fragilites.filter((f) => f.severity === "medium"),
  };

  const renderSection = (severity: Severity, items: Fragility[]) => {
    if (items.length === 0) return null;

    const config = SEVERITY_CONFIG[severity];
    const Icon = config.icon;

    return (
      <div key={severity} className="mb-8">
        {/* Section Header */}
        <div className={`flex items-center gap-3 mb-4 pb-3 border-b border-slate-700/50`}>
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-5 h-5 ${config.textColor}`} />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${config.textColor}`}>
              {config.label}
            </h3>
            <p className="text-xs text-slate-400">{config.description}</p>
          </div>
          <div className="ml-auto">
            <span className="text-2xl font-bold text-slate-300">{items.length}</span>
            <p className="text-xs text-slate-500">item{items.length !== 1 ? "ns" : ""}</p>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all duration-300 ${config.borderColor} ${config.bgColor}`}
              >
                {/* Card Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full p-4 flex items-start justify-between hover:opacity-80 transition-opacity"
                >
                  <div className="text-left flex-1">
                    <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                      <span className={`text-sm font-mono ${config.textColor}`}>{item.id}</span>
                      {item.name}
                    </h4>
                    <p className="text-sm text-slate-400 mt-1">{item.description}</p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 mt-1 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Card Content (Expandable) */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50 px-4 py-4 space-y-4">
                    {/* Risk */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                        ⚠️ Risco
                      </p>
                      <p className="text-sm text-slate-300">{item.risk}</p>
                    </div>

                    {/* Prazo */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300">
                        <span className="font-semibold">{item.daysToResolve} dias</span> para resolver
                      </span>
                    </div>

                    {/* Actions Checklist */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                        ✅ Seu Checklist
                      </p>
                      <div className="space-y-2">
                        {item.actions.map((action, idx) => (
                          <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-600 bg-slate-900 cursor-pointer accent-sky-500"
                            />
                            <span className="text-sm text-slate-300 group-hover:text-slate-200 transition">
                              {action}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
                        Ver Template
                      </button>
                      <button className="flex-1 px-3 py-2 text-sm rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 transition">
                        Mais Detalhes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-100 mb-2">
            Fragilidades LGPD Detectadas
          </h2>
          <p className="text-slate-400">Clique em cada item para ver as ações recomendadas</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-2xl font-bold text-red-400">{grouped.critical.length}</p>
            <p className="text-xs text-red-300/80">Críticas</p>
          </div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
            <p className="text-2xl font-bold text-amber-400">{grouped.high.length}</p>
            <p className="text-xs text-amber-300/80">Altas</p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
            <p className="text-2xl font-bold text-emerald-400">{grouped.medium.length}</p>
            <p className="text-xs text-emerald-300/80">Médias</p>
          </div>
          <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 p-4">
            <p className="text-2xl font-bold text-sky-400">{scoreAverage}%</p>
            <p className="text-xs text-sky-300/80">Score Atual</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div>
        {renderSection("critical", grouped.critical)}
        {renderSection("high", grouped.high)}
        {renderSection("medium", grouped.medium)}
      </div>

      {/* Footer CTA */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-500/10 to-cyan-500/10 border border-sky-500/20 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-2">
          Próximos Passos
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          Comece pelas fragilidades críticas e trabalhe sistematicamente para melhorar sua conformidade LGPD.
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition">
            Baixar Plano de Ação
          </button>
          <button className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">
            Agendar Consultoria
          </button>
        </div>
      </div>
    </div>
  );
}
