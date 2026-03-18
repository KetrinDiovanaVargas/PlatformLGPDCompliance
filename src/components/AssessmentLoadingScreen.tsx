import { ShieldCheck, Loader2 } from "lucide-react";

type Props = {
  title?: string;
  subtitle?: string;
};

export default function AssessmentLoadingScreen({
  title = "Preparando seu formulário",
  subtitle = "Estamos carregando as informações da avaliação para você.",
}: Props) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-[#08122f] to-indigo-950 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-3xl border border-cyan-500/20 bg-slate-950/80 backdrop-blur-xl shadow-[0_0_80px_rgba(56,189,248,0.18)] p-8 md:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
            <ShieldCheck className="h-8 w-8 text-cyan-300" />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400">
            {title}
          </h1>

          <p className="mt-3 max-w-xl text-sm md:text-base text-slate-300 leading-relaxed">
            {subtitle}
          </p>

          <div className="mt-8 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            <span className="text-sm font-medium">Carregando conteúdo...</span>
          </div>

          <div className="mt-8 w-full max-w-lg space-y-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400" />
            </div>

            <div className="grid gap-3">
              <div className="h-4 w-3/4 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-full rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-5/6 rounded-full bg-white/10 animate-pulse" />
            </div>
          </div>

          <p className="mt-8 text-xs text-slate-500">
            Isso pode levar alguns segundos.
          </p>
        </div>
      </div>
    </div>
  );
}