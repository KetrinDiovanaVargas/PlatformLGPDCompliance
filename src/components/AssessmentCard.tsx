import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Copy,
  Power,
  Trash2,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";

type Assessment = {
  id: string;
  title?: string;
  formType?: string;
  objective?: string;
  audience?: string;
  context: string;
  active?: boolean;
  createdAt?: any;
  ownerId?: string;
};

type SessionStats = {
  total: number;
  completed: number;
  inProgress: number;
};

type AssessmentCardProps = {
  assessment: Assessment;
  stats: SessionStats;
  canDelete: boolean;
  onToggle: (id: string, currentStatus?: boolean) => Promise<void>;
  onDelete: (assessment: Assessment) => Promise<void>;
};

export function AssessmentCard({
  assessment,
  stats,
  canDelete,
  onToggle,
  onDelete,
}: AssessmentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(assessment.id, assessment.active);
    } finally {
      setToggling(false);
      setMenuOpen(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(assessment);
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/assessment/${assessment.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
    setMenuOpen(false);
  };

  const statusBadge = assessment.active
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
    : "bg-slate-500/15 text-slate-300 border-slate-500/30";

  return (
    <Card className="rounded-lg bg-slate-900/50 border border-slate-800 p-4 hover:border-slate-700 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-100 truncate">
              {assessment.title}
            </h3>
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusBadge}`}
            >
              {assessment.active ? "Ativo" : "Inativo"}
            </span>
          </div>

          <p className="text-xs text-slate-400 line-clamp-2 mb-3">
            {assessment.context}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="px-2 py-1 rounded bg-slate-800/50">
              Tipo: {assessment.formType || "—"}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {stats.completed} concluída{stats.completed !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock3 className="w-3.5 h-3.5 text-amber-500" />
              {stats.inProgress} em andamento
            </span>
          </div>
        </div>

        {/* Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            title="Menu de ações"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-lg z-10 min-w-[180px]">
              <button
                onClick={handleCopyLink}
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 flex items-center gap-2 border-b border-slate-800"
              >
                <Copy className="w-4 h-4" />
                Copiar link
              </button>

              <button
                onClick={handleToggle}
                disabled={toggling}
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 flex items-center gap-2 border-b border-slate-800 disabled:opacity-50"
              >
                <Power className="w-4 h-4" />
                {assessment.active ? "Desativar" : "Ativar"}
              </button>

              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-red-950/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
