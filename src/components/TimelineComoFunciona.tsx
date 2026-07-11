import React from "react";

/* ============================================================
   Ilustrações (mockups em SVG das telas reais da ferramenta)
   — explicam visualmente cada etapa, sem imagens externas.
   ============================================================ */

// Etapa 1 — Questionário adaptativo
function IlustracaoQuestionario() {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      className="w-full h-auto"
      role="img"
      aria-label="Tela do questionário adaptativo"
    >
      <defs>
        <linearGradient id="cf-card1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="cf-opt1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="18" y="14" width="204" height="132" rx="14" fill="url(#cf-card1)" stroke="#334155" />
      {/* header */}
      <circle cx="36" cy="32" r="3.5" fill="#64748b" />
      <circle cx="48" cy="32" r="3.5" fill="#475569" />
      <rect x="160" y="27" width="44" height="9" rx="4.5" fill="#1e40af" opacity="0.6" />
      {/* pergunta */}
      <rect x="36" y="52" width="150" height="9" rx="4.5" fill="#cbd5e1" />
      <rect x="36" y="67" width="104" height="9" rx="4.5" fill="#64748b" />
      {/* opção selecionada */}
      <rect x="36" y="90" width="168" height="18" rx="9" fill="url(#cf-opt1)" />
      <circle cx="49" cy="99" r="4.5" fill="#ffffff" />
      {/* opção não selecionada */}
      <rect x="36" y="114" width="168" height="18" rx="9" fill="#1e293b" stroke="#334155" />
      <circle cx="49" cy="123" r="4.5" fill="none" stroke="#475569" strokeWidth="1.5" />
    </svg>
  );
}

// Etapa 2 — Análise por IA
function IlustracaoIA() {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      className="w-full h-auto"
      role="img"
      aria-label="Análise das respostas por inteligência artificial"
    >
      <defs>
        <linearGradient id="cf-ia" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* moldura de tela — igual às etapas 1 e 3 (enquadramento consistente) */}
      <rect x="18" y="14" width="204" height="132" rx="14" fill="#0f172a" stroke="#334155" />
      {/* documento (linhas de texto) à esquerda */}
      <rect x="40" y="46" width="56" height="7" rx="3.5" fill="#475569" />
      <rect x="40" y="60" width="64" height="7" rx="3.5" fill="#334155" />
      <rect x="40" y="74" width="48" height="7" rx="3.5" fill="#334155" />
      <rect x="40" y="88" width="60" height="7" rx="3.5" fill="#334155" />
      <rect x="40" y="102" width="40" height="7" rx="3.5" fill="#334155" />
      {/* núcleo de IA à direita */}
      <circle cx="168" cy="80" r="34" fill="url(#cf-ia)" opacity="0.15" />
      <circle cx="168" cy="80" r="23" fill="url(#cf-ia)" opacity="0.28" className="animate-pulse" />
      <g transform="translate(168 80)">
        {/* estrela / sparkle central */}
        <path
          d="M0 -15 L3.6 -3.6 L15 0 L3.6 3.6 L0 15 L-3.6 3.6 L-15 0 L-3.6 -3.6 Z"
          fill="url(#cf-ia)"
        />
        <path d="M12 -12 l1.3 3.6 l3.6 1.3 l-3.6 1.3 l-1.3 3.6 l-1.3 -3.6 l-3.6 -1.3 l3.6 -1.3 Z" fill="#22d3ee" />
      </g>
      {/* fluxo documento -> IA */}
      <circle cx="118" cy="80" r="2.4" fill="#38bdf8" />
      <circle cx="129" cy="80" r="2.4" fill="#38bdf8" opacity="0.7" />
      <circle cx="140" cy="80" r="2.4" fill="#38bdf8" opacity="0.4" />
    </svg>
  );
}

// Etapa 3 — Dashboard / diagnóstico
function IlustracaoDashboard() {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      className="w-full h-auto"
      role="img"
      aria-label="Dashboard com score, gráficos e recomendações"
    >
      <defs>
        <linearGradient id="cf-gauge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="18" y="14" width="204" height="132" rx="14" fill="#0f172a" stroke="#334155" />
      {/* medidor de score */}
      <path d="M42 96 A34 34 0 0 1 110 96" stroke="#1e293b" strokeWidth="9" strokeLinecap="round" />
      <path
        d="M42 96 A34 34 0 0 1 96 69"
        stroke="url(#cf-gauge)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <text x="76" y="92" textAnchor="middle" fontSize="22" fontWeight="700" fill="#e2e8f0">
        82
      </text>
      <rect x="58" y="104" width="36" height="6" rx="3" fill="#334155" />
      {/* mini gráfico de barras */}
      <rect x="132" y="86" width="14" height="42" rx="3" fill="#ef4444" />
      <rect x="152" y="66" width="14" height="62" rx="3" fill="#f59e0b" />
      <rect x="172" y="98" width="14" height="30" rx="3" fill="#22c55e" />
      <rect x="192" y="76" width="14" height="52" rx="3" fill="#38bdf8" />
      <line x1="128" y1="128" x2="210" y2="128" stroke="#334155" strokeWidth="1.5" />
      {/* rótulo topo */}
      <rect x="132" y="40" width="70" height="8" rx="4" fill="#334155" />
    </svg>
  );
}

const STEPS = [
  {
    number: "1",
    title: "Responda o questionário",
    desc: "Perguntas adaptativas se ajustam ao seu setor, contexto e perfil — em linguagem do dia a dia.",
    ring: "ring-blue-500/40",
    badge: "from-blue-500 to-blue-600",
    Ilustracao: IlustracaoQuestionario,
  },
  {
    number: "2",
    title: "A IA analisa as respostas",
    desc: "O Claude interpreta cada resposta e mapeia riscos, fragilidades e boas práticas de proteção de dados.",
    ring: "ring-indigo-500/40",
    badge: "from-indigo-500 to-purple-600",
    Ilustracao: IlustracaoIA,
  },
  {
    number: "3",
    title: "Receba o diagnóstico",
    desc: "Um dashboard completo com score de conformidade, gráficos de risco e recomendações práticas.",
    ring: "ring-cyan-500/40",
    badge: "from-cyan-500 to-blue-600",
    Ilustracao: IlustracaoDashboard,
  },
];

export default function TimelineComoFunciona() {
  return (
    <section className="w-full px-4 sm:px-6 md:px-10 pt-8 pb-10 md:pt-10 md:pb-14 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md shadow-lg">
      <div className="text-center mb-10 md:mb-14">
        <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80 mb-3">
          Passo a passo
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-balance">
          Como funciona?
        </h2>
        <p className="mt-3 text-sm sm:text-base text-white/70 max-w-2xl mx-auto">
          Em três etapas simples, você sai das respostas para um diagnóstico completo de
          maturidade em proteção de dados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5">
        {STEPS.map(({ number, title, desc, ring, badge, Ilustracao }, index) => (
          <div key={number} className="relative flex flex-col">
            <div
              className={`group flex h-full flex-col rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-5 ring-1 ${ring} transition-all duration-300 hover:-translate-y-1 hover:bg-slate-950/60`}
            >
              {/* Ilustração (mockup da tela) */}
              <div className="rounded-xl bg-slate-900/60 border border-white/5 p-3 mb-5">
                <Ilustracao />
              </div>

              {/* Número + título */}
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`h-9 w-9 shrink-0 rounded-full bg-gradient-to-br ${badge} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                >
                  {number}
                </div>
                <h3 className="text-white font-semibold text-base sm:text-lg leading-tight">
                  {title}
                </h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">{desc}</p>
            </div>

            {/* Seta conectora (apenas desktop, entre os cards) */}
            {index < STEPS.length - 1 && (
              <div className="hidden md:flex absolute top-1/2 -right-3.5 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-full bg-slate-800 border border-white/10 text-cyan-300">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
