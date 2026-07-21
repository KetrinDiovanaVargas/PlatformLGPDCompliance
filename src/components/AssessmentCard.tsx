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
  Send,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FEEDBACK_QUESTIONS } from "@/components/FeedbackModal";

const FEEDBACK_SCALE =
  "1 = Discordo completamente | 2 = Discordo parcialmente | 3 = Concordo parcialmente | 4 = Concordo plenamente";

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
  const [exporting, setExporting] = useState(false);

  const handleExportFeedback = async () => {
    setExporting(true);
    try {
      const snap = await getDocs(
        query(collection(db, "feedback"), where("assessmentId", "==", assessment.id))
      );

      if (snap.empty) {
        toast.error("Nenhum feedback para este formulário ainda.");
        return;
      }

      const rows = snap.docs.map((d) => d.data() as any);

      // Descobre os IDs de pergunta presentes
      const qids = new Set<number>();
      rows.forEach((r) =>
        (r.responses || []).forEach((resp: any) => qids.add(Number(resp.questionId)))
      );
      const sortedQids = Array.from(qids).sort((a, b) => a - b);

      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();

      // Planilha principal
      const ws = wb.addWorksheet("Feedbacks");
      ws.columns = [
        { header: "Sessão", key: "sessao", width: 26 },
        { header: "Data/Hora", key: "data", width: 20 },
        ...sortedQids.map((id) => ({ header: `P${id}`, key: `p${id}`, width: 7 })),
        { header: "Média", key: "media", width: 10 },
      ];

      rows.forEach((r) => {
        const answers: Record<string, number> = {};
        let sum = 0;
        let count = 0;
        (r.responses || []).forEach((resp: any) => {
          const v = Number(resp.answer);
          answers[`p${resp.questionId}`] = v;
          if (!Number.isNaN(v)) {
            sum += v;
            count++;
          }
        });
        const ts =
          r.timestamp?.toDate?.() ??
          r.createdAt?.toDate?.() ??
          (r.timestamp ? new Date(r.timestamp) : null);
        ws.addRow({
          sessao: r.sessionId || "—",
          data: ts ? new Date(ts).toLocaleString("pt-BR") : "—",
          ...answers,
          media: count ? Number((sum / count).toFixed(2)) : "—",
        });
      });
      ws.getRow(1).font = { bold: true };

      // Planilha de legenda (perguntas + escala)
      const legenda = wb.addWorksheet("Legenda");
      legenda.columns = [
        { header: "Código", key: "cod", width: 10 },
        { header: "Pergunta", key: "txt", width: 90 },
      ];
      legenda.getRow(1).font = { bold: true };
      FEEDBACK_QUESTIONS.forEach((q) => {
        legenda.addRow({ cod: `P${q.id}`, txt: q.text });
      });
      legenda.addRow({});
      legenda.addRow({ cod: "Escala", txt: FEEDBACK_SCALE });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const nome = (assessment.title || "formulario")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase();
      link.download = `feedbacks-${nome}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Excel gerado (${rows.length} feedback${rows.length !== 1 ? "s" : ""}).`);
    } catch (err) {
      console.error("Erro ao gerar Excel de feedbacks:", err);
      toast.error("Erro ao gerar o Excel.");
    } finally {
      setExporting(false);
      setMenuOpen(false);
    }
  };

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

  const handleInvite = () => {
    const link = `${window.location.origin}/assessment/${assessment.id}`;
    const inviteText = `Você está convidado para responder a avaliação de conformidade LGPD: "${assessment.title}"\n\nClique aqui para começar: ${link}`;
    navigator.clipboard.writeText(inviteText);
    toast.success("Convite copiado para compartilhar!");
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
            <div className="absolute right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-lg z-10 min-w-[200px]">
              <button
                onClick={handleInvite}
                className="w-full text-left px-4 py-2 text-sm text-sky-200 hover:bg-sky-950/30 flex items-center gap-2 border-b border-slate-800"
              >
                <Send className="w-4 h-4" />
                Convidar para responder
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 flex items-center gap-2 border-b border-slate-800"
              >
                <Copy className="w-4 h-4" />
                Copiar link
              </button>

              <button
                onClick={handleExportFeedback}
                disabled={exporting}
                className="w-full text-left px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/30 flex items-center gap-2 border-b border-slate-800 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exporting ? "Gerando Excel..." : "Gerar Excel dos feedbacks"}
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
