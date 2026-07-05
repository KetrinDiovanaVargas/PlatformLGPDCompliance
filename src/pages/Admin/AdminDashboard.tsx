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
  Legend,
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
  Share2,
  Flame,
  Target,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { FormCreationWizard } from "@/components/FormCreationWizard";
import { AssessmentSelectorModal } from "@/components/AssessmentSelectorModal";
import { AssessmentCard } from "@/components/AssessmentCard";

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
  const [audience, setAudience] = useState("");
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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [processingAdminId, setProcessingAdminId] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [loadingConsolidated, setLoadingConsolidated] = useState(false);
  const [consolidatedAnalysis, setConsolidatedAnalysis] =
    useState<ConsolidatedAnalysis | null>(null);
  const [showAssessmentSelector, setShowAssessmentSelector] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterType, setFilterType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toggleMessage = (id: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
    return assessment.audience?.trim() || "Não definido";
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterType]);

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

    try {
      setCreatingAssessment(true);

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

      toast.success("Avaliação criada com sucesso.");
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência.");

      setTitle("");
      setFormType("lgpd_diagnostico");
      setObjective("diagnostico_inicial");
      setAudience("");
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

  const handleGenerateConsolidatedAnalysis = async (assessmentId: string) => {
    try {
      setLoadingConsolidated(true);
      setConsolidatedAnalysis(null);
      setShowAssessmentSelector(false);

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error("Não autenticado. Por favor, faça login novamente.");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/admin/consolidated-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            assessmentId: assessmentId,
          }),
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        const errorMsg = data?.error || data?.message || "Erro ao gerar análise consolidada.";
        const details = data?.details ? ` (${data.details})` : "";
        throw new Error(errorMsg + details);
      }

      setConsolidatedAnalysis(data);
      setSelectedAssessmentId(assessmentId);

      if (data.mode === "groq") {
        toast.success("Análise consolidada gerada com IA.");
      } else if (data.mode === "fallback") {
        toast.success("Análise consolidada gerada em modo contingência.");
      } else if (data.mode === "empty") {
        toast.info("Nenhuma resposta completada para esta avaliação ainda.");
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

  const generateConsolidatedAnalysisPDF = () => {
    if (!consolidatedAnalysis) {
      toast.error("Nenhuma análise para exportar.");
      return;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;

    const drawPageBg = () => {
      pdf.setFillColor(4, 7, 29);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
    };

    drawPageBg();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(186, 230, 253);
    pdf.text("Análise Consolidada de Conformidade LGPD", margin, 20);

    let cursorY = 30;

    const assessment = assessments.find(a => a.id === selectedAssessmentId);
    if (assessment) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`Avaliação: ${assessment.title}`, margin, cursorY);
      cursorY += 8;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(130, 230, 180);
    pdf.text(`Score Médio: ${consolidatedAnalysis.scoreAverage}/100`, margin, cursorY);
    cursorY += 10;

    if (consolidatedAnalysis.notice) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(180, 180, 220);
      const noticeLines = pdf.splitTextToSize(consolidatedAnalysis.notice, pageWidth - margin * 2);
      pdf.text(noticeLines, margin, cursorY);
      cursorY += noticeLines.length * 4 + 5;
    }

    const addSection = (title: string, items: any[], labelKey: string = "label") => {
      if (cursorY > pageHeight - 40) {
        pdf.addPage();
        drawPageBg();
        cursorY = 20;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(180, 170, 255);
      pdf.text(title, margin, cursorY);
      cursorY += 6;

      items.slice(0, 5).forEach((item) => {
        if (cursorY > pageHeight - 15) {
          pdf.addPage();
          drawPageBg();
          cursorY = 20;
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(222, 228, 240);
        const text = `• ${item[labelKey]} (${item.count}x)`;
        pdf.text(text, margin + 3, cursorY);
        cursorY += 5;
      });

      cursorY += 3;
    };

    if (consolidatedAnalysis.topCriticalIssues?.length) {
      addSection("Riscos Críticos Detectados", consolidatedAnalysis.topCriticalIssues);
    }

    if (consolidatedAnalysis.topStrengths?.length) {
      addSection("Pontos de Força", consolidatedAnalysis.topStrengths);
    }

    if (consolidatedAnalysis.topAttentionPoints?.length) {
      addSection("Pontos de Atenção", consolidatedAnalysis.topAttentionPoints);
    }

    if (consolidatedAnalysis.recommendations?.length > 0) {
      if (cursorY > pageHeight - 50) {
        pdf.addPage();
        drawPageBg();
        cursorY = 20;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(255, 160, 220);
      pdf.text("Recomendações Prioritárias", margin, cursorY);
      cursorY += 6;

      consolidatedAnalysis.recommendations.slice(0, 5).forEach((rec) => {
        if (cursorY > pageHeight - 15) {
          pdf.addPage();
          drawPageBg();
          cursorY = 20;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        const priorityColor = rec.priority === "Alta" ? "#ef4444" : rec.priority === "Média" ? "#eab308" : "#22c55e";
        pdf.text(`• ${rec.title}`, margin + 3, cursorY);
        cursorY += 5;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(220, 220, 235);
        pdf.text(`  [${rec.priority}]`, margin + 5, cursorY);
        cursorY += 4;
      });
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 120);
    pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, pageHeight - 10);

    try {
      const fileName = `analise-consolidada-${selectedAssessmentId}-${new Date().toISOString().split('T')[0]}.pdf`;
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Wait before removing to ensure download completes
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      toast.success("PDF gerado e baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
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

  const filteredAssessments = useMemo(() => {
    let filtered = [...assessments];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          formatAssessmentTitle(a).toLowerCase().includes(term) ||
          (a.context && a.context.toLowerCase().includes(term)) ||
          (a.audience && a.audience.toLowerCase().includes(term))
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((a) =>
        filterStatus === "active" ? a.active !== false : a.active === false
      );
    }

    if (filterType) {
      filtered = filtered.filter((a) => a.formType === filterType);
    }

    return filtered;
  }, [assessments, searchTerm, filterStatus, filterType]);

  const totalPages = Math.ceil(filteredAssessments.length / itemsPerPage);
  const paginatedAssessments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredAssessments.slice(start, end);
  }, [filteredAssessments, currentPage, itemsPerPage]);

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

    // Calcular Taxa Global de Conformidade com dados REAIS
    const completedSessions = sessions.filter((s) => s.status === "completed");
    const realScores = completedSessions
      .map((s) => (s as any).finalReport?.metrics?.score)
      .filter((score): score is number => typeof score === "number");
    const globalConformanceRate = realScores.length > 0
      ? Math.round(realScores.reduce((sum, s) => sum + s, 0) / realScores.length)
      : 0;

    // Calcular Riscos Críticos com dados REAIS
    const criticalRisks = completedSessions
      .map((s) => {
        const risks = (s as any).finalReport?.analysis?.risks || [];
        return risks.filter((r: any) => r.severity === "critica" || r.level === "crítico" || r.priority === "Alta").length;
      })
      .reduce((sum, count) => sum + count, 0);

    return {
      totalAssessments,
      totalResponses,
      completedResponses,
      inProgressResponses,
      totalAdmins,
      totalMasters,
      globalConformanceRate,
      criticalRisks,
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
      const assessmentSessions = sessions.filter(s => s.assessmentId === a.id && s.status === 'completed');
      const scores = assessmentSessions
        .map(s => s.finalReport?.metrics?.score)
        .filter((score): score is number => typeof score === 'number');
      const scoreAverage = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : 0;

      const totalSessions = sessions.filter(s => s.assessmentId === a.id).length;
      const completedSessions = assessmentSessions.length;
      const inProgressSessions = sessions.filter(s => s.assessmentId === a.id && s.status === 'in_progress').length;

      return {
        id: a.id,
        fullName: formatAssessmentTitle(a),
        name: formatChartLabel(a),
        respostas: totalSessions,
        concluidas: completedSessions,
        andamento: inProgressSessions,
        scoreAverage,
        tipo: labelFromValue(FORM_TYPE_OPTIONS, a.formType),
        objetivo: labelFromValue(OBJECTIVE_OPTIONS, a.objective),
      };
    });
  }, [assessments, sessions]);

  const conformanceByType = useMemo(() => {
    const typeMap = new Map<string, { count: number; totalScore: number }>();

    barData.forEach((item) => {
      const type = item.tipo || "Sem categoria";
      if (!typeMap.has(type)) {
        typeMap.set(type, { count: 0, totalScore: 0 });
      }
      const current = typeMap.get(type)!;
      current.count += 1;
      current.totalScore += item.scoreAverage;
    });

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      compliance: Math.round(data.totalScore / data.count),
      responses: data.count,
    }));
  }, [barData]);

  const riskAnalysis = useMemo(() => {
    const axes = ["Compartilhamento", "Armazenamento", "Retenção", "Coleta", "Acesso"];
    const riskMap = new Map<string, { critico: number; alto: number; medio: number }>();

    axes.forEach((axis) => {
      riskMap.set(axis, { critico: 0, alto: 0, medio: 0 });
    });

    const completedSessions = sessions.filter((s) => s.status === "completed");
    completedSessions.forEach((s) => {
      const risks = (s as any).finalReport?.analysis?.risks || [];
      risks.forEach((risk: any) => {
        let axis = "Compartilhamento";
        if (risk.category?.includes("Armaz") || risk.fragilidade?.includes("Armaz")) {
          axis = "Armazenamento";
        } else if (risk.category?.includes("Reten") || risk.fragilidade?.includes("Reten")) {
          axis = "Retenção";
        } else if (risk.category?.includes("Coleta") || risk.fragilidade?.includes("Coleta")) {
          axis = "Coleta";
        } else if (risk.category?.includes("Acesso") || risk.fragilidade?.includes("Acesso")) {
          axis = "Acesso";
        }

        const current = riskMap.get(axis)!;
        if (risk.severity === "critica" || risk.level === "crítico") {
          current.critico += 1;
        } else if (risk.severity === "alta" || risk.level === "alto" || risk.priority === "Alta") {
          current.alto += 1;
        } else {
          current.medio += 1;
        }
      });
    });

    return axes.map((axis) => ({
      eixo: axis,
      ...riskMap.get(axis)!,
    }));
  }, [sessions]);

  const maturityDistribution = useMemo(() => {
    const ranges = {
      critico: 0,
      atencao: 0,
      conforme: 0,
      excelente: 0,
    };

    barData.forEach((item) => {
      const score = item.scoreAverage;
      if (score < 40) ranges.critico += 1;
      else if (score < 70) ranges.atencao += 1;
      else if (score < 85) ranges.conforme += 1;
      else ranges.excelente += 1;
    });

    return [
      { range: "Crítico (0-40)", count: ranges.critico || 0 },
      { range: "Atenção (40-70)", count: ranges.atencao || 0 },
      { range: "Conforme (70-85)", count: ranges.conforme || 0 },
      { range: "Excelente (85+)", count: ranges.excelente || 0 },
    ];
  }, [barData]);

  const conformancePieData = useMemo(() => {
    const ranges = {
      critico: 0,
      atencao: 0,
      conforme: 0,
      excelente: 0,
    };

    barData.forEach((item) => {
      const score = item.scoreAverage;
      if (score < 40) ranges.critico += 1;
      else if (score < 70) ranges.atencao += 1;
      else if (score < 85) ranges.conforme += 1;
      else ranges.excelente += 1;
    });

    return [
      { name: "Crítico", value: ranges.critico, fill: "#ef4444" },
      { name: "Atenção", value: ranges.atencao, fill: "#f59e0b" },
      { name: "Conforme", value: ranges.conforme, fill: "#84cc16" },
      { name: "Excelente", value: ranges.excelente, fill: "#10b981" },
    ].filter(item => item.value > 0);
  }, [barData]);

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

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 flex items-center gap-3">
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                  {role || "SEM PERFIL"}
                </span>
                <p className="text-sm font-medium text-slate-200">
                  {adminName ? `Olá, ${adminName}` : "Administrador"}
                </p>
              </div>

              <Button
                onClick={loadData}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 text-xs font-medium text-slate-300 transition"
                title="Atualizar dados"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>

              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 text-xs font-medium text-red-300 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                {loggingOut ? "Saindo..." : "Sair"}
              </Button>
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

        <section className="rounded-lg bg-slate-900/50 border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Análise Consolidada
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Gere insights agregados de uma avaliação selecionada.
              </p>
            </div>

            <Button
              onClick={() => setShowAssessmentSelector(true)}
              disabled={loadingConsolidated}
              className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium gap-2 inline-flex items-center px-4 py-2"
            >
              <Sparkles className="w-4 h-4" />
              {loadingConsolidated ? "Gerando..." : "Gerar"}
            </Button>
          </div>

          {consolidatedAnalysis?.mode === "empty" ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-200">
                Nenhum relatório encontrado para esta avaliação.
              </p>
            </div>
          ) : consolidatedAnalysis ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">
                  Consolidação dos relatórios de avaliação
                </h3>
                <button
                  onClick={() => setConsolidatedAnalysis(null)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                  title="Fechar análise"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>

              {consolidatedAnalysis.notice && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-200">
                    {consolidatedAnalysis.notice}
                  </p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-sky-300 mb-2">
                    Score Médio
                  </p>
                  <p className="text-3xl font-bold text-sky-100">
                    {consolidatedAnalysis.scoreAverage ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-sky-200/70">
                    {consolidatedAnalysis.reportsCount ?? 0} relatório(s)
                  </p>
                </div>

                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-red-300 mb-2">
                    Riscos Críticos
                  </p>
                  <p className="text-3xl font-bold text-red-100">
                    {consolidatedAnalysis.topCriticalIssues?.length ?? 0}
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-emerald-300 mb-2">
                    Pontos Fortes
                  </p>
                  <p className="text-3xl font-bold text-emerald-100">
                    {consolidatedAnalysis.topStrengths?.length ?? 0}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                  <h4 className="text-xs font-semibold text-red-200 mb-3 uppercase tracking-wider">
                    Riscos Detectados
                  </h4>
                  {consolidatedAnalysis.topCriticalIssues?.length ? (
                    <ul className="space-y-1 text-xs text-red-100">
                      {consolidatedAnalysis.topCriticalIssues.slice(0, 5).map((item, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{item.label}</span>
                          <span className="text-red-300 font-medium">{item.count}x</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-red-200/70">Nenhum risco detectado.</p>
                  )}
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <h4 className="text-xs font-semibold text-emerald-200 mb-3 uppercase tracking-wider">
                    Pontos de Força
                  </h4>
                  {consolidatedAnalysis.topStrengths?.length ? (
                    <ul className="space-y-1 text-xs text-emerald-100">
                      {consolidatedAnalysis.topStrengths.slice(0, 5).map((item, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{item.label}</span>
                          <span className="text-emerald-300 font-medium">{item.count}x</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-emerald-200/70">Nenhum ponto forte.</p>
                  )}
                </div>
              </div>

              {consolidatedAnalysis.recommendations?.length > 0 && (
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
                  <h4 className="text-xs font-semibold text-sky-200 mb-3 uppercase tracking-wider">
                    Recomendações-Chave
                  </h4>
                  <ul className="space-y-2 text-xs text-sky-100">
                    {consolidatedAnalysis.recommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="flex justify-between gap-2 items-start">
                        <span>{rec.title}</span>
                        <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded ${
                          rec.priority === "Alta" ? "bg-red-500/20 text-red-200" :
                          rec.priority === "Média" ? "bg-amber-500/20 text-amber-200" :
                          "bg-emerald-500/20 text-emerald-200"
                        }`}>
                          {rec.priority || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">
                    Distribuição de Conformidade
                  </h4>
                  <ResponsiveContainer width={100} height={80}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Conforme", value: Math.min(consolidatedAnalysis.scoreAverage, 100) },
                          { name: "Não Conforme", value: Math.max(0, 100 - consolidatedAnalysis.scoreAverage) }
                        ]}
                        innerRadius={20}
                        outerRadius={35}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell fill="#22c55e" />
                        <Cell fill="#ef4444" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-indigo-200/70 mb-4 leading-relaxed">
                  Este gráfico apresenta uma visão consolidada do nível de conformidade baseado na análise técnica completa realizada. O valor corresponde ao score médio de todas as avaliações analisadas, indicando o grau geral de compliance com LGPD e ISO/IEC 27001.
                </p>
                <button
                  onClick={generateConsolidatedAnalysisPDF}
                  className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-medium py-2 px-3 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Compartilhar Análise (PDF)
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {role !== "MASTER" && (
          <section className="rounded-lg bg-slate-900/50 border border-slate-800 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Criar nova avaliação
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Use o assistente para configurar uma nova avaliação de compliance LGPD.
                </p>
              </div>
              <Button
                onClick={() => setWizardOpen(true)}
                className="shrink-0 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium gap-2 inline-flex items-center"
              >
                <PlusCircle className="w-4 h-4" />
                Nova Avaliação
              </Button>
            </div>
          </section>
        )}

        {wizardOpen && (
          <FormCreationWizard
            adminUid={adminUid}
            adminName={adminName}
            onSuccess={loadData}
            onCancel={() => setWizardOpen(false)}
          />
        )}

        {showAssessmentSelector && (
          <AssessmentSelectorModal
            assessments={assessments
              .filter((a) => !a.deleted)
              .map((a) => {
                const barItem = barData.find(b => b.id === a.id);
                return {
                  id: a.id,
                  title: formatAssessmentTitle(a),
                  formType: a.formType || "N/A",
                  respostas: barItem?.respostas || 0,
                };
              })}
            onSelect={(assessmentId) => {
              setSelectedAssessmentId(assessmentId);
              handleGenerateConsolidatedAnalysis(assessmentId);
            }}
            onCancel={() => setShowAssessmentSelector(false)}
            loading={loadingConsolidated}
          />
        )}

        {role !== "MASTER" && assessments.length > 0 && (
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Minhas Avaliações
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Gerenciar, ativar/desativar e visualizar estatísticas de suas avaliações.
              </p>
            </div>
            <div className="grid gap-3">
              {assessments.map((assessment) => {
                const stats = getStatsByAssessment(assessment.id);
                const canDelete =
                  role === "MASTER" ||
                  (role === "ADMIN" && assessment.ownerId === adminUid);

                return (
                  <AssessmentCard
                    key={assessment.id}
                    assessment={assessment}
                    stats={stats}
                    canDelete={canDelete}
                    onToggle={toggleAssessment}
                    onDelete={deleteAssessment}
                  />
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-gradient-to-br from-emerald-500/10 via-slate-900/50 to-cyan-500/10 border border-emerald-500/30 p-8 space-y-6 shadow-[0_0_40px_rgba(16,185,129,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Target className="w-6 h-6 text-emerald-400" />
                Conformidade LGPD
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Dashboard de compliance e conformidade com a Lei Geral de Proteção de Dados
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5 space-y-2">
              <p className="text-xs font-semibold text-slate-400">Taxa de Conformidade</p>
              <p className="text-3xl font-bold text-emerald-400">
                {summary.globalConformanceRate}%
              </p>
              <p className="text-xs text-slate-500">
                {summary.completedResponses} avaliações
              </p>
            </div>

            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5 space-y-2">
              <p className="text-xs font-semibold text-slate-400">Riscos Críticos</p>
              <p className="text-3xl font-bold text-red-400">
                {summary.criticalRisks}
              </p>
              <p className="text-xs text-slate-500">
                Identificados
              </p>
            </div>

            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5 space-y-2">
              <p className="text-xs font-semibold text-slate-400">Em Andamento</p>
              <p className="text-3xl font-bold text-amber-400">
                {summary.inProgressResponses}
              </p>
              <p className="text-xs text-slate-500">
                {summary.totalResponses > 0 ? Math.round((summary.inProgressResponses / summary.totalResponses) * 100) : 0}% do total
              </p>
            </div>

            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5 space-y-2">
              <p className="text-xs font-semibold text-slate-400">Taxa de Conclusão</p>
              <p className="text-3xl font-bold text-blue-400">
                {summary.totalResponses > 0 ? Math.round((summary.completedResponses / summary.totalResponses) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-500">
                {summary.completedResponses} de {summary.totalResponses}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-gradient-to-br from-slate-900/40 to-slate-800/20 border border-slate-700/50 p-6 shadow-lg">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Índice de Conformidade
            </h2>
            <p className="text-xs text-slate-400">Score de compliance por avaliação</p>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-min">
              {barData.filter((a) => a.respostas > 0).map((assessment, idx) => {
                const isExcelente = assessment.scoreAverage >= 85;
                const isConforme = assessment.scoreAverage >= 70 && assessment.scoreAverage < 85;
                const isAtencao = assessment.scoreAverage >= 40 && assessment.scoreAverage < 70;
                const progressPercent = assessment.concluidas && assessment.respostas ? Math.round((assessment.concluidas / assessment.respostas) * 100) : 0;

                let statusColor = "text-red-400";
                let statusText = "Crítico";
                let borderColor = "border-red-500/20";
                let bgColor = "bg-red-500/5";
                let circleColor = "#ef4444";

                if (isExcelente) {
                  statusColor = "text-emerald-400";
                  statusText = "Excelente";
                  borderColor = "border-emerald-500/20";
                  bgColor = "bg-emerald-500/5";
                  circleColor = "#10b981";
                } else if (isConforme) {
                  statusColor = "text-emerald-400";
                  statusText = "Conforme";
                  borderColor = "border-emerald-500/20";
                  bgColor = "bg-emerald-500/5";
                  circleColor = "#10b981";
                } else if (isAtencao) {
                  statusColor = "text-amber-400";
                  statusText = "Atenção";
                  borderColor = "border-amber-500/20";
                  bgColor = "bg-amber-500/5";
                  circleColor = "#f59e0b";
                }

                return (
                  <div
                    key={assessment.id || idx}
                    className={`rounded-lg border ${borderColor} ${bgColor} p-3 space-y-3 backdrop-blur-sm flex-shrink-0 w-56`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-100 truncate">
                          {assessment.fullName}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {assessment.tipo || assessment.objetivo || "Sem categoria"}
                        </p>
                      </div>
                      <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="8"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke={circleColor}
                            strokeWidth="8"
                            strokeDasharray={`${assessment.scoreAverage * 2.83} 283`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute text-xs font-bold text-white">
                          {assessment.scoreAverage}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-black/30 border border-slate-700/50">
                      <span className="text-emerald-400 text-xs">✓</span>
                      <span className="text-xs font-medium text-slate-100">{statusText}</span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Concluídas:</span>
                        <span className="font-semibold">{assessment.concluidas}/{assessment.respostas}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Andamento:</span>
                        <span className="font-semibold">{assessment.andamento}</span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900/40 to-slate-800/20 border border-slate-700/50 p-6 shadow-lg">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-100 mb-1 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Distribuição de Respostas
              </h2>
              <p className="text-xs text-slate-400">Status das avaliações</p>
            </div>

            <div className="space-y-2">
              {pieData.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/30 border border-slate-700/30 hover:border-slate-600/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full shadow-sm"
                      style={{
                        backgroundColor: STATUS_COLORS[i],
                        boxShadow: `0 0 8px ${STATUS_COLORS[i]}80`
                      }}
                    />
                    <span className="text-sm font-medium text-slate-200">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold text-base"
                      style={{ color: STATUS_COLORS[i] }}
                    >
                      {item.value}
                    </span>
                    <span className="text-xs text-slate-400">
                      {summary.totalResponses > 0 ? Math.round((item.value / summary.totalResponses) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-slate-900/40 to-slate-800/20 border border-slate-700/50 p-6 md:col-span-2 h-[420px] shadow-lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-100">
                {role === "MASTER"
                  ? "Respostas por Avaliação"
                  : "Minhas Respostas por Avaliação"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">Número de respostas coletadas por avaliação</p>
            </div>

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

        <section className="grid gap-5 md:grid-cols-1">
          <div className="rounded-2xl bg-gradient-to-br from-red-900/15 to-slate-800/20 border border-red-700/30 p-6 h-[420px] shadow-lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-red-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Análise de Risco
              </h2>
              <p className="text-xs text-slate-400">Identificação de fragilidades críticas por eixo</p>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={riskAnalysis.length > 0 ? riskAnalysis : [
                    { eixo: "Sem dados", critico: 0, alto: 0, medio: 0 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="eixo" tick={{ fill: "#cbd5f5", fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fill: "#cbd5f5", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="critico" stackId="a" radius={[8, 8, 0, 0]} fill="#ef4444" />
                  <Bar dataKey="alto" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="medio" stackId="a" fill="#eab308" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>


        <div className="mt-10">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-5" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 px-4 py-1.5 text-xs font-semibold text-white shadow">
              <ShieldCheck className="h-3.5 w-3.5" />
              {role === "MASTER" ? "Governança Global" : "Governança Ativa"}
            </div>
            <p className="text-[11px] text-slate-600">
              © {new Date().getFullYear()} Plataforma LGPD — Painel Administrativo
            </p>
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