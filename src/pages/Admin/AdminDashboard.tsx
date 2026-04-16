import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  BarChart3,
  ClipboardList,
  CheckCircle2,
  Clock3,
  Copy,
  Link2,
  PlusCircle,
  ShieldCheck,
  Activity,
  Users,
  UserCog,
  LayoutList,
  FolderKanban,
  Trash2,
  UserX,
  Power,
  LogOut,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Flame,
  Target,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

type AdminRole = "MASTER" | "ADMIN" | "";

type Assessment = {
  id: string;
  title?: string;
  formType?: string;
  objective?: string;
  audience?: string;
  introText?: string;
  context: string;
  active?: boolean;
  deleted?: boolean;
  deletedAt?: any;
  deletedBy?: string;
  createdAt?: any;
  updatedAt?: any;
  ownerId?: string;
  ownerName?: string;
};

type SessionItem = {
  sessionId?: string;
  assessmentId?: string | null;
  status?: string;
  currentStage?: number;
  userId?: string;
  completedAt?: any;
  updatedAt?: any;
  ownerId?: string;
};

type AdminItem = {
  id: string;
  name: string;
  email: string;
  role: "MASTER" | "ADMIN";
  active: boolean;
};

type ConsolidatedRecommendation = {
  title: string;
  priority?: "Alta" | "Média" | "Baixa" | string;
};

type ConsolidatedItem = {
  label: string;
  count: number;
};

type ConsolidatedAnalysis = {
  scoreAverage?: number;
  topCriticalIssues?: ConsolidatedItem[];
  topStrengths?: ConsolidatedItem[];
  topAttentionPoints?: ConsolidatedItem[];
  recommendations?: ConsolidatedRecommendation[];
  mode?: "groq" | "fallback" | "empty" | string;
  message?: string;
  notice?: string;
  reportsCount?: number;
};

const STATUS_COLORS = ["#22c55e", "#eab308", "#ef4444"];

const FORM_TYPE_OPTIONS = [
  { value: "lgpd_diagnostico", label: "Diagnóstico LGPD" },
  { value: "lgpd_maturidade", label: "Maturidade LGPD" },
  { value: "privacidade_operacional", label: "Privacidade Operacional" },
  { value: "riscos_e_controles", label: "Riscos e Controles" },
  { value: "customizado", label: "Customizado" },
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

const AUDIENCE_OPTIONS = [
  { value: "alunos", label: "Alunos" },
  { value: "colaboradores_clt", label: "Colaboradores CLT" },
  { value: "desempregados", label: "Desempregados" },
  { value: "clientes", label: "Clientes" },
  { value: "fornecedores", label: "Fornecedores" },
  { value: "cooperados", label: "Cooperados" },
  { value: "comunidade", label: "Comunidade em geral" },
  { value: "outro", label: "Outro" },
];

// Em dev, o Vite já faz proxy de /api -> http://localhost:8787 (vite.config.ts).
// Se VITE_API_BASE_URL não estiver definido, usamos "" para manter URLs relativas.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getApiErrorMessage(data: any, fallback: string) {
  const msg = data?.error;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [role, setRole] = useState<AdminRole>("");
  const [adminUid, setAdminUid] = useState("");
  const [adminName, setAdminName] = useState("");

  const [title, setTitle] = useState("");
  const [formType, setFormType] = useState("lgpd_diagnostico");
  const [objective, setObjective] = useState("diagnostico_inicial");
  const [audience, setAudience] = useState("alunos");
  const [audienceOther, setAudienceOther] = useState("");
  const [introText, setIntroText] = useState("");
  const [context, setContext] = useState("");

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [adminNameInput, setAdminNameInput] = useState("");
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminRoleInput, setAdminRoleInput] = useState<"ADMIN" | "MASTER">(
    "ADMIN"
  );

  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [creatingAssessment, setCreatingAssessment] = useState(false);
  const [deletingAssessmentId, setDeletingAssessmentId] = useState("");
  const [processingAdminId, setProcessingAdminId] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [loadingConsolidated, setLoadingConsolidated] = useState(false);
  const [consolidatedAnalysis, setConsolidatedAnalysis] =
    useState<ConsolidatedAnalysis | null>(null);

  useEffect(() => {
    const storedRole = (
      (localStorage.getItem("adminRole") || "").toUpperCase() || ""
    ) as AdminRole;
    const storedUid = localStorage.getItem("adminUid") || "";
    const storedName = localStorage.getItem("adminName") || "";

    setRole(storedRole);
    setAdminUid(storedUid);
    setAdminName(storedName);
  }, []);

  const clearAdminSession = () => {
    localStorage.removeItem("adminUid");
    localStorage.removeItem("adminSessionId");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminName");
    localStorage.removeItem("adminEmail");
    localStorage.removeItem("adminAuthenticated");
    localStorage.removeItem("adminAuthenticatedAt");
  };

  const handleLogout = async () => {
    const confirmed = window.confirm(
      "Deseja realmente encerrar a sessão e sair do painel administrativo?"
    );

    if (!confirmed) return;

    try {
      setLoggingOut(true);

      const sessionId = localStorage.getItem("adminSessionId");

      if (sessionId) {
        await updateDoc(doc(db, "admin_sessions", sessionId), {
          status: "logged_out",
          revokedAt: serverTimestamp(),
          revokedReason: "manual_logout",
        });
      }

      await signOut(auth);
      toast.success("Sessão encerrada com sucesso.");
    } catch (error) {
      console.error("Erro ao sair:", error);
      toast.error("Não foi possível encerrar a sessão corretamente.");
    } finally {
      clearAdminSession();
      navigate("/admin/login");
      setLoggingOut(false);
    }
  };

  const labelFromValue = (
    options: Array<{ value: string; label: string }>,
    value?: string
  ) => {
    const found = options.find((item) => item.value === value);
    return found?.label || value || "Não definido";
  };

  const formatAudienceLabel = (assessment: Assessment) => {
    if (!assessment.audience?.trim()) return "Não definido";

    if (
      assessment.audience &&
      !AUDIENCE_OPTIONS.some((item) => item.value === assessment.audience)
    ) {
      return assessment.audience;
    }

    return labelFromValue(AUDIENCE_OPTIONS, assessment.audience);
  };

  const formatAssessmentTitle = (assessment: Assessment) => {
    if (assessment.title?.trim()) return assessment.title.trim();

    if (assessment.formType?.trim() && assessment.objective?.trim()) {
      return `${labelFromValue(
        FORM_TYPE_OPTIONS,
        assessment.formType
      )} • ${labelFromValue(OBJECTIVE_OPTIONS, assessment.objective)}`;
    }

    if (assessment.formType?.trim()) {
      return labelFromValue(FORM_TYPE_OPTIONS, assessment.formType);
    }

    if (assessment.context?.trim()) {
      return assessment.context.trim().slice(0, 48);
    }

    return `Formulário ${assessment.id.slice(0, 6)}`;
  };

  const formatChartLabel = (assessment: Assessment) => {
    const titleLabel = formatAssessmentTitle(assessment);
    return titleLabel.length > 24 ? `${titleLabel.slice(0, 24)}...` : titleLabel;
  };

  const buildInviteMessage = (assessment: Assessment) => {
    const link = `${window.location.origin}/assessment/${assessment.id}`;
    const title = formatAssessmentTitle(assessment);

    return `Olá! Você foi convidado(a) a responder o formulário "${title}".

Sua participação é muito importante e leva apenas alguns minutos.

Acesse pelo link:
${link}

Agradecemos pela sua colaboração.`;
  };

  const copyInviteMessage = async (assessment: Assessment) => {
    try {
      const message = buildInviteMessage(assessment);
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem de convite copiada!");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível copiar a mensagem.");
    }
  };

  const shareOnWhatsApp = (assessment: Assessment) => {
    const message = buildInviteMessage(assessment);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  const loadData = async () => {
    try {
      setLoading(true);

      if (!role || !adminUid) return;

      if (role === "MASTER") {
        const assessmentsSnap = await getDocs(collection(db, "assessments"));
        const sessionsSnap = await getDocs(collection(db, "assessment_sessions"));
        const adminsSnap = await getDocs(collection(db, "admins"));

        const assessmentsData: Assessment[] = assessmentsSnap.docs
          .map((docItem) => ({
            id: docItem.id,
            ...(docItem.data() as Omit<Assessment, "id">),
          }))
          .filter((item) => item.deleted !== true);

        const sessionsData: SessionItem[] = sessionsSnap.docs.map((docItem) => ({
          sessionId: docItem.id,
          ...(docItem.data() as Omit<SessionItem, "sessionId">),
        }));

        const adminsData: AdminItem[] = adminsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<AdminItem, "id">),
        }));

        setAssessments(assessmentsData);
        setSessions(sessionsData);
        setAdmins(adminsData);
      } else {
        const assessmentsQuery = query(
          collection(db, "assessments"),
          where("ownerId", "==", adminUid)
        );

        const assessmentsSnap = await getDocs(assessmentsQuery);

        const assessmentsData: Assessment[] = assessmentsSnap.docs
          .map((docItem) => ({
            id: docItem.id,
            ...(docItem.data() as Omit<Assessment, "id">),
          }))
          .filter((item) => item.deleted !== true);

        const assessmentIds = assessmentsData.map((a) => a.id);

        const sessionsSnap = await getDocs(collection(db, "assessment_sessions"));

        const sessionsData: SessionItem[] = sessionsSnap.docs
          .map((docItem) => ({
            sessionId: docItem.id,
            ...(docItem.data() as Omit<SessionItem, "sessionId">),
          }))
          .filter(
            (session) =>
              session.assessmentId && assessmentIds.includes(session.assessmentId)
          );

        setAssessments(assessmentsData);
        setSessions(sessionsData);
        setAdmins([]);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      toast.error("Erro ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role && adminUid) {
      loadData();
    }
  }, [role, adminUid]);

  useEffect(() => {
    if (!selectedAssessmentId && assessments.length > 0) {
      setSelectedAssessmentId(assessments[0].id);
    }
  }, [assessments, selectedAssessmentId]);

  const handleCreateAssessment = async () => {
    if (role === "MASTER") {
      toast.error("Administrador MASTER não pode criar formulários.");
      return;
    }

    if (!title.trim()) {
      toast.error("Preencha o nome da avaliação.");
      return;
    }

    if (!context.trim()) {
      toast.error("Preencha o contexto da avaliação.");
      return;
    }

    if (!introText.trim()) {
      toast.error("Preencha o texto de introdução.");
      return;
    }

    if (audience === "outro" && !audienceOther.trim()) {
      toast.error('Informe o público-alvo quando selecionar "Outro".');
      return;
    }

    const finalAudience = audience === "outro" ? audienceOther.trim() : audience;

    try {
      setCreatingAssessment(true);

      const docRef = await addDoc(collection(db, "assessments"), {
        title: title.trim(),
        formType,
        objective,
        audience: finalAudience,
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

      toast.success("Avaliação criada com sucesso.");
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência.");

      setTitle("");
      setFormType("lgpd_diagnostico");
      setObjective("diagnostico_inicial");
      setAudience("alunos");
      setAudienceOther("");
      setIntroText("");
      setContext("");

      await loadData();
    } catch (err) {
      console.error("Erro ao criar avaliação:", err);
      toast.error("Erro ao criar avaliação.");
    } finally {
      setCreatingAssessment(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (role !== "MASTER") {
      toast.error("Apenas o administrador MASTER pode criar acessos.");
      return;
    }

    if (
      !adminNameInput.trim() ||
      !adminEmailInput.trim() ||
      !adminPasswordInput.trim()
    ) {
      toast.error("Preencha nome, email e senha do administrador.");
      return;
    }

    try {
      setCreatingAdmin(true);

      const requesterUid = localStorage.getItem("adminUid");

      const response = await fetch(`${API_BASE_URL}/api/admin/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requesterUid,
          name: adminNameInput.trim(),
          email: adminEmailInput.trim().toLowerCase(),
          password: adminPasswordInput.trim(),
          role: adminRoleInput,
        }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(data, "Erro ao criar administrador."));
      }

      toast.success("Administrador criado com sucesso.");

      setAdminNameInput("");
      setAdminEmailInput("");
      setAdminPasswordInput("");
      setAdminRoleInput("ADMIN");

      await loadData();
    } catch (error: any) {
      console.error("Erro ao criar admin:", error);
      toast.error(error.message || "Erro ao criar administrador.");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleToggleAdminStatus = async (targetAdmin: AdminItem) => {
    if (role !== "MASTER") {
      toast.error("Apenas o MASTER pode alterar o status de usuários.");
      return;
    }

    if (targetAdmin.id === adminUid) {
      toast.error("Você não pode alterar o seu próprio status.");
      return;
    }

    try {
      setProcessingAdminId(targetAdmin.id);

      const requesterUid = localStorage.getItem("adminUid");

      const response = await fetch(
        `${API_BASE_URL}/api/admin/toggle-admin-status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requesterUid,
            targetUid: targetAdmin.id,
            active: !targetAdmin.active,
          }),
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(data, "Erro ao atualizar status do usuário.")
        );
      }

      toast.success(
        !targetAdmin.active
          ? "Usuário ativado com sucesso."
          : "Usuário inativado com sucesso."
      );

      await loadData();
    } catch (error: any) {
      console.error("Erro ao alterar status do admin:", error);
      toast.error(error.message || "Erro ao alterar status do usuário.");
    } finally {
      setProcessingAdminId("");
    }
  };

  const handleDeleteAdmin = async (targetAdmin: AdminItem) => {
    if (role !== "MASTER") {
      toast.error("Apenas o MASTER pode excluir usuários.");
      return;
    }

    if (targetAdmin.id === adminUid) {
      toast.error("Você não pode excluir a si mesma.");
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o usuário "${targetAdmin.name}"?\n\nEssa ação removerá o acesso desse usuário ao painel.`
    );

    if (!confirmed) return;

    try {
      setProcessingAdminId(targetAdmin.id);

      const requesterUid = localStorage.getItem("adminUid");

      const response = await fetch(`${API_BASE_URL}/api/admin/delete-admin`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requesterUid,
          targetUid: targetAdmin.id,
        }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(data, "Erro ao excluir usuário."));
      }

      toast.success("Usuário excluído com sucesso.");
      await loadData();
    } catch (error: any) {
      console.error("Erro ao excluir admin:", error);
      toast.error(error.message || "Erro ao excluir usuário.");
    } finally {
      setProcessingAdminId("");
    }
  };

  const toggleAssessment = async (
    assessmentId: string,
    currentStatus?: boolean
  ) => {
    try {
      const newStatus = currentStatus !== false ? false : true;

      await updateDoc(doc(db, "assessments", assessmentId), {
        active: newStatus,
        updatedAt: serverTimestamp(),
      });

      toast.success(newStatus ? "Avaliação ativada!" : "Avaliação desativada!");
      await loadData();
    } catch (error) {
      console.error("Erro ao atualizar avaliação:", error);
      toast.error("Erro ao atualizar status da avaliação.");
    }
  };

  const deleteAssessment = async (assessment: Assessment) => {
    const canDelete =
      role === "MASTER" || (role === "ADMIN" && assessment.ownerId === adminUid);

    if (!canDelete) {
      toast.error("Você não tem permissão para excluir esta avaliação.");
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a avaliação "${formatAssessmentTitle(
        assessment
      )}"?\n\nEla será removida do painel e ficará indisponível para novos acessos.`
    );

    if (!confirmed) return;

    try {
      setDeletingAssessmentId(assessment.id);

      await updateDoc(doc(db, "assessments", assessment.id), {
        deleted: true,
        active: false,
        deletedBy: adminUid,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Avaliação excluída com sucesso.");
      await loadData();
    } catch (error) {
      console.error("Erro ao excluir avaliação:", error);
      toast.error("Erro ao excluir avaliação.");
    } finally {
      setDeletingAssessmentId("");
    }
  };

  const handleGenerateConsolidatedAnalysis = async () => {
    if (!selectedAssessmentId) {
      toast.error("Selecione uma avaliação.");
      return;
    }

    try {
      setLoadingConsolidated(true);
      setConsolidatedAnalysis(null);

      const response = await fetch(
        `${API_BASE_URL}/api/admin/consolidated-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assessmentId: selectedAssessmentId,
          }),
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(data, "Erro ao gerar análise consolidada.")
        );
      }

      setConsolidatedAnalysis(data);

      if (data.mode === "groq") {
        toast.success("Análise consolidada gerada com IA.");
      } else if (data.mode === "fallback") {
        toast.success("Análise consolidada gerada em modo contingência.");
      } else {
        toast.success("Análise consolidada carregada.");
      }
    } catch (error: any) {
      console.error("Erro ao gerar análise consolidada:", error);
      toast.error(error.message || "Erro ao gerar análise consolidada.");
    } finally {
      setLoadingConsolidated(false);
    }
  };

  const getStatsByAssessment = (assessmentId: string) => {
    const related = sessions.filter((s) => s.assessmentId === assessmentId);

    const completed = related.filter((s) => s.status === "completed").length;
    const inProgress = related.filter((s) => s.status === "in_progress").length;
    const others = Math.max(0, related.length - completed - inProgress);

    return {
      total: related.length,
      completed,
      inProgress,
      others,
    };
  };

  const summary = useMemo(() => {
    const totalAssessments = assessments.length;
    const totalResponses = sessions.length;
    const completedResponses = sessions.filter(
      (s) => s.status === "completed"
    ).length;
    const inProgressResponses = sessions.filter(
      (s) => s.status === "in_progress"
    ).length;
    const totalAdmins = admins.filter((a) => a.role === "ADMIN").length;
    const totalMasters = admins.filter((a) => a.role === "MASTER").length;

    return {
      totalAssessments,
      totalResponses,
      completedResponses,
      inProgressResponses,
      totalAdmins,
      totalMasters,
    };
  }, [assessments, sessions, admins]);

  const pieData = useMemo(() => {
    const completed = sessions.filter((s) => s.status === "completed").length;
    const inProgress = sessions.filter((s) => s.status === "in_progress").length;
    const pending = Math.max(0, sessions.length - completed - inProgress);

    return [
      { name: "Concluídas", value: completed },
      { name: "Em andamento", value: inProgress },
      { name: "Outras", value: pending },
    ];
  }, [sessions]);

  const barData = useMemo(() => {
    return assessments.map((a) => {
      const stats = getStatsByAssessment(a.id);
      return {
        id: a.id,
        fullName: formatAssessmentTitle(a),
        name: formatChartLabel(a),
        respostas: stats.total,
        concluidas: stats.completed,
        andamento: stats.inProgress,
        tipo: labelFromValue(FORM_TYPE_OPTIONS, a.formType),
        objetivo: labelFromValue(OBJECTIVE_OPTIONS, a.objective),
      };
    });
  }, [assessments, sessions]);

  const topAssessments = useMemo(() => {
    return assessments
      .map((a) => ({
        ...a,
        displayTitle: formatAssessmentTitle(a),
        stats: getStatsByAssessment(a.id),
      }))
      .sort((a, b) => b.stats.total - a.stats.total);
  }, [assessments, sessions]);

  const selectedAssessment = useMemo(() => {
    return assessments.find((a) => a.id === selectedAssessmentId) || null;
  }, [assessments, selectedAssessmentId]);

  const copyLink = async (assessmentId: string) => {
    try {
      const link = `${window.location.origin}/assessment/${assessmentId}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível copiar o link.");
    }
  };

  const consolidatedModeBadge =
    consolidatedAnalysis?.mode === "groq"
      ? {
          label: "IA completa",
          className:
            "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
        }
      : consolidatedAnalysis?.mode === "fallback"
      ? {
          label: "Contingência",
          className: "bg-amber-500/15 text-amber-200 border-amber-500/40",
        }
      : {
          label: "Resumo",
          className: "bg-slate-500/15 text-slate-200 border-slate-500/40",
        };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950 text-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-10 rounded-[32px] border border-slate-800/80 bg-slate-950/95 p-6 md:p-8 shadow-[0_0_90px_rgba(56,189,248,0.16)] backdrop-blur-xl">
        <header className="relative overflow-hidden rounded-3xl border border-slate-800/70 bg-white/[0.03] px-6 py-6 shadow-[0_0_60px_rgba(56,189,248,0.10)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.12),transparent_30%)]" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administração LGPD
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400">
                  Painel Administrativo
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {role === "MASTER"
                    ? "Visão global da plataforma, métricas e gestão de acessos."
                    : "Sua área operacional com avaliações e acompanhamento dos seus resultados."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-end">
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200">
                {role || "SEM PERFIL"}
              </span>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Sessão ativa
                </p>
                <p className="text-sm font-medium text-slate-200">
                  {adminName ? `Olá, ${adminName}` : "Administrador"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {role === "MASTER" ? (
          <section className="grid gap-5 md:grid-cols-5">
            <KpiCard
              icon={<Users className="h-4 w-4 text-fuchsia-300" />}
              label="Admins"
              value={summary.totalAdmins}
            />
            <KpiCard
              icon={<ShieldCheck className="h-4 w-4 text-cyan-300" />}
              label="Masters"
              value={summary.totalMasters}
            />
            <KpiCard
              icon={<ClipboardList className="h-4 w-4 text-cyan-300" />}
              label="Avaliações"
              value={summary.totalAssessments}
            />
            <KpiCard
              icon={<BarChart3 className="h-4 w-4 text-indigo-300" />}
              label="Respostas"
              value={summary.totalResponses}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
              label="Concluídas"
              value={summary.completedResponses}
            />
          </section>
        ) : (
          <section className="grid gap-5 md:grid-cols-4">
            <KpiCard
              icon={<ClipboardList className="h-4 w-4 text-cyan-300" />}
              label="Minhas avaliações"
              value={summary.totalAssessments}
            />
            <KpiCard
              icon={<BarChart3 className="h-4 w-4 text-indigo-300" />}
              label="Minhas respostas"
              value={summary.totalResponses}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
              label="Concluídas"
              value={summary.completedResponses}
            />
            <KpiCard
              icon={<Clock3 className="h-4 w-4 text-amber-300" />}
              label="Em andamento"
              value={summary.inProgressResponses}
            />
          </section>
        )}

        <section className="rounded-3xl bg-white/[0.04] border border-slate-800/80 p-8 shadow-[0_0_60px_rgba(99,102,241,0.14)] space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-slate-200 tracking-tight">
                  Análise consolidada da avaliação
                </h3>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Gere uma visão executiva com média, riscos recorrentes, pontos
                fortes e prioridades.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedAssessmentId}
                onChange={(e) => setSelectedAssessmentId(e.target.value)}
                className="min-w-[280px] rounded-xl bg-black/40 border border-white/20 text-white px-4 py-3 outline-none"
              >
                <option value="" className="bg-slate-950 text-white">
                  Selecione uma avaliação
                </option>
                {assessments.map((assessment) => (
                  <option
                    key={assessment.id}
                    value={assessment.id}
                    className="bg-slate-950 text-white"
                  >
                    {formatAssessmentTitle(assessment)}
                  </option>
                ))}
              </select>

              <Button
                onClick={handleGenerateConsolidatedAnalysis}
                disabled={loadingConsolidated || !selectedAssessmentId}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
              >
                <Sparkles className="h-4 w-4" />
                {loadingConsolidated
                  ? "Gerando análise..."
                  : "Gerar análise consolidada"}
              </Button>
            </div>
          </div>

          {selectedAssessment && (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-1">
                Avaliação selecionada
              </p>
              <p className="text-sm font-semibold text-white">
                {formatAssessmentTitle(selectedAssessment)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {selectedAssessment.context}
              </p>
            </div>
          )}

          {consolidatedAnalysis?.mode === "empty" ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
              <p className="text-sm text-amber-200">
                Nenhum relatório individual foi encontrado para esta avaliação.
              </p>
            </div>
          ) : consolidatedAnalysis ? (
            <div className="space-y-5">
              {consolidatedAnalysis.notice && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-sm text-amber-200">
                    {consolidatedAnalysis.notice}
                  </p>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-4">
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                  <div className="flex items-center gap-2 text-cyan-200 mb-2">
                    <Target className="h-4 w-4" />
                    <span className="text-sm font-medium">Score médio</span>
                  </div>
                  <p className="text-4xl font-black text-white">
                    {consolidatedAnalysis.scoreAverage ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-cyan-100/70">
                    Baseado em {consolidatedAnalysis.reportsCount ?? 0} relatório(s)
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5">
                  <div className="flex items-center gap-2 text-rose-200 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Riscos recorrentes</span>
                  </div>
                  <p className="text-4xl font-black text-white">
                    {consolidatedAnalysis.topCriticalIssues?.length ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                  <div className="flex items-center gap-2 text-emerald-200 mb-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Pontos fortes</span>
                  </div>
                  <p className="text-4xl font-black text-white">
                    {consolidatedAnalysis.topStrengths?.length ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                  <div className="flex items-center gap-2 text-fuchsia-200 mb-2">
                    <Flame className="h-4 w-4" />
                    <span className="text-sm font-medium">Modo</span>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${consolidatedModeBadge.className}`}
                  >
                    {consolidatedModeBadge.label}
                  </span>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <Card className="rounded-2xl bg-slate-900/90 border border-slate-700 p-5 shadow-lg">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-200 mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    Top riscos críticos
                  </h4>

                  {consolidatedAnalysis.topCriticalIssues?.length ? (
                    <ul className="space-y-2">
                      {consolidatedAnalysis.topCriticalIssues.map((item, index) => (
                        <li
                          key={`${item.label}-${index}`}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-slate-200 flex items-center justify-between gap-3"
                        >
                          <span>{item.label}</span>
                          <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">
                            {item.count}x
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Nenhum risco crítico consolidado.
                    </p>
                  )}
                </Card>

                <Card className="rounded-2xl bg-slate-900/90 border border-slate-700 p-5 shadow-lg">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-200 mb-4">
                    <CheckCircle2 className="h-4 w-4" />
                    Top pontos fortes
                  </h4>

                  {consolidatedAnalysis.topStrengths?.length ? (
                    <ul className="space-y-2">
                      {consolidatedAnalysis.topStrengths.map((item, index) => (
                        <li
                          key={`${item.label}-${index}`}
                          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-slate-200 flex items-center justify-between gap-3"
                        >
                          <span>{item.label}</span>
                          <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">
                            {item.count}x
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Nenhum ponto forte consolidado.
                    </p>
                  )}
                </Card>

                <Card className="rounded-2xl bg-slate-900/90 border border-slate-700 p-5 shadow-lg">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-200 mb-4">
                    <Clock3 className="h-4 w-4" />
                    Top pontos de atenção
                  </h4>

                  {consolidatedAnalysis.topAttentionPoints?.length ? (
                    <ul className="space-y-2">
                      {consolidatedAnalysis.topAttentionPoints.map((item, index) => (
                        <li
                          key={`${item.label}-${index}`}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-slate-200 flex items-center justify-between gap-3"
                        >
                          <span>{item.label}</span>
                          <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">
                            {item.count}x
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Nenhum ponto de atenção consolidado.
                    </p>
                  )}
                </Card>
              </div>

              <Card className="rounded-2xl bg-slate-900/90 border border-slate-700 p-5 shadow-lg">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-cyan-200 mb-4">
                  <Sparkles className="h-4 w-4" />
                  Recomendações executivas
                </h4>

                {consolidatedAnalysis.recommendations?.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {consolidatedAnalysis.recommendations.map((rec, index) => (
                      <div
                        key={`${rec.title}-${index}`}
                        className="rounded-xl border border-slate-700 bg-black/20 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">
                            {rec.title}
                          </p>

                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                              rec.priority === "Alta"
                                ? "border-red-500/30 bg-red-500/10 text-red-200"
                                : rec.priority === "Média"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                            }`}
                          >
                            {rec.priority || "Média"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Nenhuma recomendação consolidada disponível.
                  </p>
                )}
              </Card>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-black/10 p-8 text-center">
              <p className="text-sm text-slate-400">
                Selecione uma avaliação e gere a análise consolidada para
                visualizar uma leitura executiva dos relatórios.
              </p>
            </div>
          )}
        </section>

        {role !== "MASTER" && (
          <section className="rounded-3xl bg-white/[0.04] border border-slate-800/80 p-8 shadow-[0_0_60px_rgba(99,102,241,0.14)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-cyan-300" />
                  <h3 className="text-sm font-semibold text-slate-200 tracking-tight">
                    Criar nova avaliação
                  </h3>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Defina o nome, tipo, objetivo, público, texto de introdução e
                  contexto do formulário para disponibilizar uma nova avaliação.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome da avaliação"
                className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
              />

              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
              >
                {FORM_TYPE_OPTIONS.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                    className="bg-slate-950 text-white"
                  >
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
              >
                {OBJECTIVE_OPTIONS.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                    className="bg-slate-950 text-white"
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
              >
                {AUDIENCE_OPTIONS.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                    className="bg-slate-950 text-white"
                  >
                    {item.label}
                  </option>
                ))}
              </select>

              {audience === "outro" && (
                <input
                  value={audienceOther}
                  onChange={(e) => setAudienceOther(e.target.value)}
                  placeholder="Informe o público-alvo"
                  className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
                />
              )}
            </div>

            <textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              placeholder="Texto de introdução que será exibido no início do formulário."
              className="w-full min-h-[120px] p-4 rounded-2xl bg-black/40 border border-white/20 text-white outline-none"
            />

            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Descreva o contexto da avaliação."
              className="w-full min-h-[120px] p-4 rounded-2xl bg-black/40 border border-white/20 text-white outline-none"
            />

            <div className="flex justify-end">
              <Button
                onClick={handleCreateAssessment}
                disabled={creatingAssessment}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
              >
                <PlusCircle className="h-4 w-4" />
                {creatingAssessment ? "Criando..." : "Criar Avaliação"}
              </Button>
            </div>
          </section>
        )}

        {role === "MASTER" && (
          <section className="rounded-3xl bg-white/[0.04] border border-slate-800/80 p-8 shadow-[0_0_60px_rgba(99,102,241,0.14)] space-y-5">
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-slate-200 tracking-tight">
                Gestão de administradores
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <input
                value={adminNameInput}
                onChange={(e) => setAdminNameInput(e.target.value)}
                placeholder="Nome do administrador"
                className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
              />

              <input
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="Email do administrador"
                className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
              />

              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Senha temporária"
                className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
              />

              <select
                value={adminRoleInput}
                onChange={(e) =>
                  setAdminRoleInput(e.target.value as "ADMIN" | "MASTER")
                }
                className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white outline-none"
              >
                <option value="ADMIN" className="bg-slate-950 text-white">
                  ADMIN
                </option>
                <option value="MASTER" className="bg-slate-950 text-white">
                  MASTER
                </option>
              </select>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleCreateAdmin}
                disabled={creatingAdmin}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
              >
                <PlusCircle className="h-4 w-4" />
                {creatingAdmin ? "Criando..." : "Criar Acesso"}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {admins.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum administrador cadastrado.
                </p>
              ) : (
                admins.map((admin) => {
                  const isSelf = admin.id === adminUid;
                  const isProcessing = processingAdminId === admin.id;

                  return (
                    <Card
                      key={admin.id}
                      className="rounded-xl bg-slate-900/90 border border-slate-700 px-6 py-5 space-y-4 shadow-lg"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100">
                            {admin.name}
                          </h4>
                          <p className="text-xs text-slate-400">{admin.email}</p>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                            admin.role === "MASTER"
                              ? "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40"
                              : "bg-cyan-500/15 text-cyan-200 border-cyan-500/40"
                          }`}
                        >
                          {admin.role}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          Status: {admin.active ? "Ativo" : "Inativo"}
                          {isSelf ? " • Você" : ""}
                        </p>

                        {!isSelf && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              onClick={() => handleToggleAdminStatus(admin)}
                              disabled={isProcessing}
                              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-lg transition ${
                                admin.active
                                  ? "bg-amber-500 hover:bg-amber-400"
                                  : "bg-emerald-500 hover:bg-emerald-400"
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {isProcessing
                                ? "Processando..."
                                : admin.active
                                ? "Inativar"
                                : "Ativar"}
                            </Button>

                            <Button
                              onClick={() => handleDeleteAdmin(admin)}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white shadow-lg transition border border-red-500/30"
                            >
                              <UserX className="h-3.5 w-3.5 text-red-300" />
                              Excluir
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </section>
        )}

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl bg-white/[0.04] border border-slate-800/80 p-6 flex flex-col justify-between h-[420px] shadow-[0_0_40px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">
              Distribuição de Respostas
            </h2>

            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-2">
              {pieData.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-slate-900/70 border shadow-sm"
                  style={{ borderColor: `${STATUS_COLORS[i]}55` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[i] }}
                    />
                    <span className="text-[12px]">{item.name}</span>
                  </div>

                  <span
                    className="font-semibold text-[12px]"
                    style={{ color: STATUS_COLORS[i] }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.04] border border-slate-800/80 p-6 md:col-span-2 h-[420px] shadow-[0_0_40px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              {role === "MASTER"
                ? "Respostas por Avaliação"
                : "Minhas Respostas por Avaliação"}
            </h2>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#cbd5f5", fontSize: 11 }}
                    interval={0}
                    angle={0}
                  />
                  <YAxis
                    tick={{ fill: "#cbd5f5", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    formatter={(value: any, name: string) => [value, name]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullName || ""
                    }
                  />
                  <Bar dataKey="respostas" radius={[8, 8, 0, 0]} fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white/[0.04] border border-slate-800/80 p-8 shadow-[0_0_60px_rgba(99,102,241,0.14)] space-y-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 tracking-tight">
            <Activity className="h-4 w-4 text-fuchsia-400" />
            {role === "MASTER"
              ? "Monitoramento das Avaliações"
              : "Minhas Avaliações"}
          </h3>

          {loading ? (
            <p className="text-xs text-slate-500">Carregando dados...</p>
          ) : topAssessments.length === 0 ? (
            <p className="text-xs text-slate-500">
              {role === "MASTER"
                ? "Nenhuma avaliação criada ainda."
                : "Você ainda não possui avaliações."}
            </p>
          ) : (
            <div className="space-y-5">
              {topAssessments.map((assessment) => {
                const link = `${window.location.origin}/assessment/${assessment.id}`;
                const stats = assessment.stats;
                const isDeleting = deletingAssessmentId === assessment.id;

                return (
                  <Card
                    key={assessment.id}
                    className="rounded-xl bg-slate-900/90 border border-slate-700 px-6 py-5 space-y-4 shadow-lg"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-100">
                          {assessment.displayTitle}
                        </h4>

                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
                            <LayoutList className="h-3.5 w-3.5" />
                            {labelFromValue(FORM_TYPE_OPTIONS, assessment.formType)}
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-medium text-fuchsia-200">
                            <FolderKanban className="h-3.5 w-3.5" />
                            {labelFromValue(
                              OBJECTIVE_OPTIONS,
                              assessment.objective
                            )}
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                            <Users className="h-3.5 w-3.5" />
                            {formatAudienceLabel(assessment)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                          {assessment.context}
                        </p>

                        {assessment.introText?.trim() && (
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                              Texto de introdução
                            </p>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {assessment.introText}
                            </p>
                          </div>
                        )}
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                          assessment.active !== false
                            ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                            : "bg-red-500/15 text-red-300 border-red-500/40"
                        }`}
                      >
                        {assessment.active !== false ? "Ativa" : "Inativa"}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
                        <p className="text-[11px] text-sky-200">
                          Total de respostas
                        </p>
                        <p className="text-lg font-bold text-white">{stats.total}</p>
                      </div>

                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                        <p className="text-[11px] text-emerald-200">Concluídas</p>
                        <p className="text-lg font-bold text-white">
                          {stats.completed}
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                        <p className="text-[11px] text-amber-200">Em andamento</p>
                        <p className="text-lg font-bold text-white">
                          {stats.inProgress}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 pt-2 border-t border-slate-700/60">
                      <div className="flex items-center gap-2 text-xs text-cyan-300 break-all">
                        <Link2 className="h-3.5 w-3.5" />
                        {link}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                          Mensagem para compartilhar
                        </p>
                        <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                          {buildInviteMessage(assessment)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => copyLink(assessment.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar Link
                        </Button>

                        <Button
                          onClick={() => copyInviteMessage(assessment)}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar Convite
                        </Button>

                        <Button
                          onClick={() => shareOnWhatsApp(assessment)}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Compartilhar no WhatsApp
                        </Button>

                        <Button
                          onClick={() =>
                            toggleAssessment(assessment.id, assessment.active)
                          }
                          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg transition ${
                            assessment.active !== false
                              ? "bg-red-500 hover:bg-red-400"
                              : "bg-emerald-500 hover:bg-emerald-400"
                          }`}
                        >
                          {assessment.active !== false ? "Desativar" : "Ativar"}
                        </Button>

                        <Button
                          onClick={() => deleteAssessment(assessment)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-800 hover:bg-slate-700 px-5 py-2 text-sm font-semibold text-white shadow-lg transition border border-red-500/30"
                        >
                          <Trash2 className="h-4 w-4 text-red-300" />
                          {isDeleting ? "Excluindo..." : "Excluir"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <div className="mx-auto max-w-6xl mt-12">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-6" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-center">
            <div className="flex justify-center md:justify-start">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg">
                <ShieldCheck className="h-4 w-4" />
                {role === "MASTER" ? "Governança Global" : "Governança Ativa"}
              </div>
            </div>

            <div className="flex justify-center">
              <p className="text-[11px] text-slate-500 text-center">
                © {new Date().getFullYear()} Plataforma LGPD — Painel Administrativo.
              </p>
            </div>

            <div className="flex justify-center md:justify-end gap-3">
              <Button
                onClick={loadData}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar Painel
              </Button>

              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? "Saindo..." : "Sair do painel"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-white/[0.03] p-6 shadow-[0_0_35px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-cyan-500/20 hover:shadow-[0_0_45px_rgba(34,211,238,0.12)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.10),transparent_35%)] opacity-80" />

      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
            {icon}
          </div>
          <span className="text-sm font-medium text-slate-300">{label}</span>
        </div>

        <div className="mt-auto">
          <span className="text-4xl font-black tracking-tight text-white">
            {value}
          </span>
        </div>
      </div>
    </div>
  );
}