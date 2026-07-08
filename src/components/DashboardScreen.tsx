// -------------------------------------------------------------
// DashboardScreen.tsx – Versão Enterprise Corrigida
// -------------------------------------------------------------

import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import {
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  PlayCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Flame,
  Pin,
  AlertCircle,
  ClipboardList,
  FolderKanban,
  LogOut,
  Sparkles,
  GraduationCap,
  Target,
  Info,
} from "lucide-react";

import { motion } from "framer-motion";

// ======================================================
// TIPOS
// ======================================================

interface Recommendation {
  title: string;
  description?: string;
  priority: "Alta" | "Média" | "Baixa";
  category?: string;
  actions: string[];
  learning?: {
    book?: string;
    video?: string;
    references?: string;
    steps?: string[];
    isoRefs?: string;
    lgpdRefs?: string;
  };
}

type DashboardScreenProps = {
  report?: string;
  metrics?: any;
  responses?: Record<string, any> | any[];
  onRestart?: () => void;
  assessmentTitle?: string;
  assessmentFormType?: string;
  assessmentObjective?: string;
  reportMode?: "groq" | "fallback";
  reportNotice?: string;
};

type ReportSection = {
  title: string;
  bullets: string[];
  body: string;
};

// ======================================================
// CORES
// ======================================================

const RISK_COLORS = ["#22c55e", "#eab308", "#ef4444"];

// ======================================================
// SANITIZAÇÃO
// ======================================================

function sanitizeText(text: string): string {
  return String(text || "")
    .replace(/usuário demo/gi, "participante da avaliação")
    .replace(/usuário/gi, "participante")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeArray(arr: string[] | undefined) {
  return arr?.map((t) => sanitizeText(t)).filter(Boolean) ?? [];
}

// ======================================================
// EXTRAÇÃO DE INFORMAÇÕES DO RELATÓRIO
// ======================================================

function extractSectionItems(
  report: string | undefined,
  section: number,
  title: string
): string[] {
  if (!report) return [];

  const regex = new RegExp(
    `\\*?${section}\\.\\s*${title}:?([\\s\\S]*?)(?=\\d+\\.\\s|$)`,
    "i"
  );

  const match = report.match(regex);
  if (!match) return [];

  return match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => sanitizeText(l.replace("-", "").trim()))
    .filter(Boolean);
}

function formatReportSections(report?: string): ReportSection[] {
  if (!report) return [];

  let cleaned = sanitizeText(report).replace(/\*\*/g, "").trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}$/);
  if (jsonMatch?.index !== undefined) {
    cleaned = cleaned.slice(0, jsonMatch.index).trim();
  }

  const sections: ReportSection[] = [];
  const regex = /(\d+\.\s*[^:\n]+:)([\s\S]*?)(?=\d+\.\s*[^:\n]+:|$)/g;

  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const title = match[1].replace(/^\d+\.\s*/, "").replace(/:$/, "").trim();
    const lines = match[2].split("\n").map((l) => l.trim());

    const bullets = lines
      .filter((l) => l.startsWith("-"))
      .map((l) => sanitizeText(l.replace(/^-/, "").trim()))
      .filter(Boolean);

    const body = sanitizeText(
      lines.filter((l) => !l.startsWith("-")).join(" ").trim()
    );

    sections.push({ title, bullets, body });
  }

  return sections.length
    ? sections
    : [{ title: "Análise Técnica", bullets: [], body: cleaned }];
}

// ======================================================
// DETECÇÃO DE FRAGILIDADES LGPD (F1-F10)
// ======================================================

interface LGPDFragility {
  code: string;
  emoji: string;
  name: string;
  description: string;
  detected: boolean;
}

function detectLGPDFragilities(report?: string): LGPDFragility[] {
  const text = (report || "").toLowerCase();

  const fragilidades: LGPDFragility[] = [
    {
      code: "F1",
      emoji: "👶",
      name: "Dados de Menores",
      description: "Dados de menores de idade sem consentimento parental",
      detected: /menores?|criança|adolescente/.test(text) && /sem consentimento|ilegal/.test(text),
    },
    {
      code: "F2",
      emoji: "🔓",
      name: "Sem Criptografia",
      description: "Ausência de criptografia em repouso ou em trânsito",
      detected: /criptografia|encrypt|ssl|tls/.test(text) && (/ausência|falta|sem|não há/.test(text) || /não.*implement|não.*ativar/.test(text)),
    },
    {
      code: "F3",
      emoji: "⏰",
      name: "Retenção Excessiva",
      description: "Retenção de dados além do necessário",
      detected: /retenção|guardar|armazenar|mantém?/.test(text) && /excessiv|além|período|longo/.test(text),
    },
    {
      code: "F4",
      emoji: "👤",
      name: "Ausência de DPO",
      description: "Falta de Data Protection Officer ou responsável de dados",
      detected: /dpo|responsável.*dado|encarregado.*dado/.test(text) && /ausência|falta|sem|não/.test(text),
    },
    {
      code: "F5",
      emoji: "📋",
      name: "Falta de Política",
      description: "Ausência de política de privacidade clara",
      detected: /política.*privacidade|política.*dados/.test(text) && /ausência|falta|sem|não há/.test(text),
    },
    {
      code: "F6",
      emoji: "🤝",
      name: "Consentimento Inadequado",
      description: "Falta de consentimento explícito ou inadequado",
      detected: /consentimento/.test(text) && /falta|sem|ausência|inadequ|não.*obtém|não.*há/.test(text),
    },
    {
      code: "F7",
      emoji: "🚫",
      name: "Direitos Negados",
      description: "Não garantir direitos dos titulares (acesso, exclusão, portabilidade)",
      detected: /direito|acesso.*dado|exclusão|portabilidade|esquecimento/.test(text) && /não.*garantir|não.*permite|negado/.test(text),
    },
    {
      code: "F8",
      emoji: "🛡️",
      name: "Segurança Inadequada",
      description: "Ausência de medidas de segurança técnicas/administrativas",
      detected: /segurança|proteção|controle.*acesso/.test(text) && /inadequ|falta|ausência|sem|fraco/.test(text),
    },
    {
      code: "F9",
      emoji: "📝",
      name: "Sem Documentação",
      description: "Falta de registros e documentação de tratamento de dados",
      detected: /documenta|registro|audi|compli/.test(text) && /falta|ausência|sem|não.*há/.test(text),
    },
    {
      code: "F10",
      emoji: "⚖️",
      name: "Violação de Direitos",
      description: "Violação clara de direitos fundamentais ou LGPD",
      detected: /violação|crime|ilegal|inconstitucional|grave/.test(text),
    },
    {
      code: "F11",
      emoji: "👧",
      name: "Direito de Menores",
      description: "Proteção inadequada dos direitos de crianças e adolescentes",
      detected: /menor|criança|adolescente|criança de idade/.test(text) && /proteção|direito|segurança|adequad/.test(text),
    },
  ];

  return fragilidades;
}

// ======================================================
// NORMALIZAÇÃO DE MÉTRICAS
// ======================================================

function normalizeMetrics(raw: any, report?: string) {
  const safe = raw || {};
  const score = Number.isNaN(Number(safe.score)) ? 0 : Number(safe.score);

  const risks = safe.risks ?? raw?.risks ?? {};

  const riskDistribution = [
    { name: "Conforme", value: Number(risks.conforme) || 0 },
    { name: "Parcial", value: Number(risks.parcial) || 0 },
    { name: "Não Conforme", value: Number(risks.naoConforme) || 0 },
  ];

  const strengths =
    sanitizeArray(safe.strengths).length > 0
      ? sanitizeArray(safe.strengths)
      : extractSectionItems(report, 3, "Pontos Fortes");

  const attention =
    sanitizeArray(safe.attentionPoints).length > 0
      ? sanitizeArray(safe.attentionPoints)
      : extractSectionItems(report, 4, "Pontos de Atenção");

  const critical =
    sanitizeArray(safe.criticalIssues).length > 0
      ? sanitizeArray(safe.criticalIssues)
      : extractSectionItems(report, 5, "Riscos Críticos");

  const recommendations = Array.isArray(safe.recommendations)
    ? safe.recommendations
    : [];

  const lgpdFragilities = detectLGPDFragilities(report);

  return {
    score,
    riskDistribution,
    strengths,
    attention,
    critical,
    recommendations,
    lgpdFragilities,
  };
}

// ======================================================
// GERAR RECURSOS AUTOMÁTICOS
// ======================================================

function buildLearningResources(topic: string) {
  const txt = String(topic || "").toLowerCase();

  if (txt.includes("criptograf")) {
    return {
      book: "Implementing ISO/IEC 27001 – Edward Humphreys",
      video: "ISO 27001 Encryption Overview",
      references: "Guia de Criptografia",
      steps: [
        "Mapear dados sensíveis.",
        "Ativar criptografia em repouso.",
        "Ativar TLS atualizado.",
        "Documentar chaves criptográficas.",
      ],
      isoRefs: "ISO 27001 – Controle A.10",
      lgpdRefs: "LGPD – Art. 46",
    };
  }

  if (txt.includes("acesso")) {
    return {
      book: "ISO/IEC 27002 Controls Guide",
      video: "Access Control Essentials",
      references: "Boas práticas de controle de acesso",
      steps: [
        "Revisar perfis de acesso.",
        "Aplicar privilégio mínimo.",
        "Ativar revisão periódica.",
      ],
      isoRefs: "ISO 27001 – Controle A.9",
      lgpdRefs: "LGPD – Art. 46",
    };
  }

  return {
    book: "LGPD Comentada – Doutrina Brasileira",
    video: "Introdução à LGPD",
    references: "Artigos sobre boas práticas em proteção de dados",
    steps: [
      "Criar responsáveis internos.",
      "Implementar ações imediatas.",
      "Registrar evidências.",
    ],
    isoRefs: "ISO – Controles Gerais",
    lgpdRefs: "LGPD – Arts. 6, 46 e 49",
  };
}

// ======================================================
// UTIL
// ======================================================

function getRiskColor(score: number) {
  if (score < 40) return "#ef4444";
  if (score < 70) return "#eab308";
  return "#22c55e";
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

const DashboardScreen: React.FC<DashboardScreenProps> = ({
  report,
  metrics,
  onRestart,
  assessmentTitle,
  assessmentFormType,
  assessmentObjective,
  reportMode,
  reportNotice,
}) => {
  const cleanedReport = report ? sanitizeText(report) : undefined;
  const data = useMemo(
    () => normalizeMetrics(metrics, cleanedReport),
    [metrics, cleanedReport]
  );
  const reportSections = useMemo(
    () => formatReportSections(cleanedReport),
    [cleanedReport]
  );

  const score = data.score;
  const riskData = data.riskDistribution;
  const strengths = data.strengths;
  const attention = data.attention;
  const critical = data.critical;
  const lgpdFragilities = data.lgpdFragilities;

  const enrichedRecommendations: Recommendation[] = data.recommendations.map(
    (r: any) => ({
      title: sanitizeText(r.title || "Recomendação"),
      description: r.description ? sanitizeText(r.description) : undefined,
      priority: r.priority ?? "Média",
      category: r.category,
      actions: Array.isArray(r.actions)
        ? r.actions.map((a: string) => sanitizeText(a))
        : [],
      learning: r.learning || buildLearningResources(r.title || ""),
    })
  );

  const chartStatsData = [
    { label: "Pontos Fortes", value: strengths.length },
    { label: "Atenção", value: attention.length },
    { label: "Críticos", value: critical.length },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950 text-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-10 rounded-3xl border border-slate-800/80 bg-slate-950/95 p-8 shadow-[0_0_80px_rgba(56,189,248,0.25)]">
        <header className="space-y-4 border-b border-slate-800/60 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400">
              Resultado da Análise de Conformidade
            </h1>
            <p className="text-sm text-slate-400">
              Avaliação baseada na LGPD e ISO/IEC 27001.
            </p>
          </div>

          {(assessmentTitle || assessmentFormType || assessmentObjective) && (
            <div className="space-y-3">
              {assessmentTitle && (
                <h2 className="text-xl font-semibold text-white">
                  {assessmentTitle}
                </h2>
              )}

              <div className="flex flex-wrap gap-2">
                {assessmentFormType && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
                    <ClipboardList className="h-3.5 w-3.5" />
                    {assessmentFormType}
                  </span>
                )}

                {assessmentObjective && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-medium text-fuchsia-200">
                    <FolderKanban className="h-3.5 w-3.5" />
                    {assessmentObjective}
                  </span>
                )}
              </div>
            </div>
          )}
        </header>

        {reportMode === "fallback" && (
  <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 shadow-[0_0_30px_rgba(245,158,11,0.12)]">
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/15">
        <AlertTriangle className="h-6 w-6 text-amber-300" />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-amber-300 text-xs uppercase tracking-[0.2em]">
            Modo de contingência
          </p>

          <h2 className="text-2xl font-bold text-white mt-1">
            Sua análise foi exibida com sucesso
          </h2>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed">
          {reportNotice ||
            "O serviço de IA atingiu temporariamente o limite de uso. Para não interromper sua experiência, este relatório foi montado com métricas e recomendações automáticas simplificadas."}
        </p>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-white/80 leading-relaxed">
            Você pode continuar visualizando os resultados normalmente. Quando o
            serviço de IA estiver disponível novamente, uma nova análise poderá
            gerar um relatório ainda mais detalhado.
          </p>
        </div>
      </div>
    </div>
  </section>
)}

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col h-[480px]">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">
              Score de Conformidade
            </h2>

            <div className="flex flex-col items-center justify-center flex-1 gap-4">
              <div
                className="h-52 w-52 rounded-full flex items-center justify-center shadow-[0_0_35px_var(--risk-color)] border-[6px]"
                style={{
                  ["--risk-color" as any]: getRiskColor(score),
                  borderColor: getRiskColor(score),
                }}
              >
                <span className="text-5xl font-black">{score}</span>
              </div>

              <p className="text-xs text-slate-400">de 100 pontos</p>

              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: `${getRiskColor(score)}33`,
                  border: `1px solid ${getRiskColor(score)}`,
                  color: getRiskColor(score),
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {score < 40
                  ? "Risco Alto"
                  : score < 70
                    ? "Risco Moderado"
                    : "Conformidade Alta"}
              </span>
            </div>

            <div className="h-20" />
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between h-[480px]">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">
              Distribuição de Risco
            </h2>

            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {riskData.map((entry, i) => (
                      <Cell key={i} fill={RISK_COLORS[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-2">
              {riskData.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-slate-900/70 border shadow-sm"
                  style={{
                    borderColor: `${RISK_COLORS[i]}55`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: RISK_COLORS[i] }}
                    />
                    <span className="text-[12px]">{item.name}</span>
                  </div>

                  <span
                    className="font-semibold text-[12px]"
                    style={{ color: RISK_COLORS[i] }}
                  >
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between h-[480px]">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              Estatísticas
            </h2>

            <div className="flex-1 flex items-center justify-center min-h-[220px]">
              <ResponsiveContainer width="95%" height={200}>
                <BarChart data={chartStatsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#cbd5f5", fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: "#cbd5f5", fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#eab308" />
                    <Cell fill="#ef4444" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center px-4 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[13px] text-emerald-200">Pontos Fortes</span>
                </div>
                <span className="font-semibold text-[13px] text-emerald-300">
                  {strengths.length}
                </span>
              </div>

              <div className="flex justify-between items-center px-4 py-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="text-[13px] text-yellow-200">Atenção</span>
                </div>
                <span className="font-semibold text-[13px] text-yellow-300">
                  {attention.length}
                </span>
              </div>

              <div className="flex justify-between items-center px-4 py-2 rounded-xl border border-red-500/40 bg-red-500/10">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="text-[13px] text-red-200">Críticos</span>
                </div>
                <span className="font-semibold text-[13px] text-red-300">
                  {critical.length}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
          <h2 className="text-sm font-semibold mb-2">
            Fragilidades Detectadas
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Análise dos principais riscos de conformidade com a LGPD detectados na sua organização.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lgpdFragilities.map((frag, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 border-2 transition ${
                  frag.detected
                    ? "border-red-500/60 bg-red-500/10"
                    : "border-emerald-500/30 bg-emerald-500/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{frag.emoji}</span>
                  <span
                    className={`text-lg ${
                      frag.detected
                        ? "opacity-100 text-red-400"
                        : "opacity-50 text-emerald-400"
                    }`}
                  >
                    {frag.detected ? "✗" : "✓"}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-200 leading-tight">
                  {frag.name}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-emerald-900/20 border border-emerald-600/40 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-200 mb-3">
              <CheckCircle2 className="h-4 w-4" /> Pontos fortes
            </h3>

            {strengths.length === 0 ? (
              <p className="text-xs text-emerald-200/70">
                Nenhum ponto forte encontrado.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {strengths.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-2 bg-emerald-900/30 p-2 rounded-lg border border-emerald-700/40"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 mt-1" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-amber-900/20 border border-amber-600/40 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200 mb-3">
              <AlertTriangle className="h-4 w-4" /> Atenção necessária
            </h3>

            {attention.length === 0 ? (
              <p className="text-xs text-amber-200/70">
                Nenhuma área de atenção encontrada.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {attention.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-2 bg-amber-900/30 p-2 rounded-lg border border-amber-700/40"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300 mt-1" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-red-900/20 border border-red-600/40 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-200 mb-3">
            <AlertCircle className="h-4 w-4" /> Riscos críticos
          </h3>

          {critical.length === 0 ? (
            <p className="text-xs text-red-200/70">
              Nenhum risco crítico identificado.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {critical.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 bg-red-900/30 p-2 rounded-lg border border-red-700/40"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-300 mt-1" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl bg-slate-950/80 border border-slate-800 p-8 shadow-[0_0_80px_rgba(99,102,241,0.25)] space-y-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 tracking-tight">
            <Flame className="h-4 w-4 text-fuchsia-400" />
            Recomendações Personalizadas
          </h3>

          {enrichedRecommendations.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma recomendação disponível.</p>
          ) : (
            <div className="space-y-5">
              {enrichedRecommendations.map((rec: Recommendation, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className="rounded-xl bg-slate-900/90 border border-slate-700 px-6 py-5 space-y-4 shadow-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Pin className="h-4 w-4 text-sky-400 mt-[2px]" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100">
                          {rec.title}
                        </h4>
                        {rec.description && (
                          <p className="text-xs text-slate-400 mt-1">
                            {rec.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                        rec.priority === "Alta"
                          ? "bg-red-500/15 text-red-300 border-red-500/40"
                          : rec.priority === "Média"
                            ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
                            : "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                      }`}
                    >
                      Prioridade: {rec.priority}
                    </span>
                  </div>

                  {rec.category && (
                    <div className="flex flex-wrap text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-sky-300">
                        <AlertCircle className="h-3 w-3" />
                        Categoria: {rec.category}
                      </span>
                    </div>
                  )}

                  {Array.isArray(rec.actions) && rec.actions.length > 0 && (
                    <div>
                      <p className="text-[11px] text-slate-400 mb-1">
                        Ações recomendadas:
                      </p>
                      <ul className="space-y-1 text-[11px] text-slate-200">
                        {rec.actions.map((a, idx) => (
                          <li key={idx} className="flex gap-2">
                            <ArrowRight className="h-3 w-3 mt-[2px] text-sky-300" />
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rec.learning && (
                    <div className="pt-3 border-t border-slate-700/60 space-y-3 text-[11px] text-slate-300">
                      <div className="grid gap-3 md:grid-cols-3">
                        {rec.learning.book && (
                          <div className="flex items-start gap-2">
                            <BookOpen className="h-3 w-3 mt-[2px] text-emerald-300" />
                            <span>{rec.learning.book}</span>
                          </div>
                        )}

                        {rec.learning.video && (
                          <div className="flex items-start gap-2">
                            <PlayCircle className="h-3 w-3 mt-[2px] text-sky-300" />
                            <span>{rec.learning.video}</span>
                          </div>
                        )}

                        {rec.learning.references && (
                          <div className="flex items-start gap-2">
                            <ShieldCheck className="h-3 w-3 mt-[2px] text-violet-300" />
                            <span>{rec.learning.references}</span>
                          </div>
                        )}
                      </div>

                      {Array.isArray(rec.learning.steps) && rec.learning.steps.length > 0 && (
                        <div>
                          <p className="text-[11px] text-slate-400 mb-1">Passos sugeridos:</p>
                          <ul className="space-y-1">
                            {rec.learning.steps.map((step, stepIndex) => (
                              <li key={stepIndex} className="flex gap-2">
                                <ArrowRight className="h-3 w-3 mt-[2px] text-fuchsia-300" />
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(rec.learning.isoRefs || rec.learning.lgpdRefs) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {rec.learning.isoRefs && (
                            <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] text-cyan-200">
                              {rec.learning.isoRefs}
                            </span>
                          )}
                          {rec.learning.lgpdRefs && (
                            <span className="inline-flex items-center rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[10px] text-fuchsia-200">
                              {rec.learning.lgpdRefs}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        <div className="mx-auto max-w-6xl mt-10 flex justify-center">
          <p className="text-[11px] text-slate-500 text-center">
            © {new Date().getFullYear()} Plataforma LGPD — Relatórios de Conformidade.
          </p>
        </div>

        <div className="mx-auto max-w-6xl mt-6 flex justify-center">
            {onRestart && (
              <button
                onClick={onRestart}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
              >
                <RefreshCw className="h-4 w-4" />
                Nova Avaliação
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;