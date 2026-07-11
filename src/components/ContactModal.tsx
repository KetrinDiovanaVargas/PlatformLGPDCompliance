import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, X, Send, CheckCircle, Sparkles, MessageSquare } from "lucide-react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

type ContactType = "demonstracao" | "contato";

type ContactModalProps = {
  open: boolean;
  onClose: () => void;
};

const TYPE_OPTIONS: {
  value: ContactType;
  label: string;
  desc: string;
  Icon: typeof Sparkles;
}[] = [
  {
    value: "demonstracao",
    label: "Quero uma demonstração",
    desc: "Conhecer a ferramenta na prática",
    Icon: Sparkles,
  },
  {
    value: "contato",
    label: "Quero entrar em contato",
    desc: "Tirar dúvidas ou falar com a equipe",
    Icon: MessageSquare,
  },
];

export default function ContactModal({ open, onClose }: ContactModalProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState<ContactType>("demonstracao");
  const [mensagem, setMensagem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setNome("");
    setEmail("");
    setTipo("demonstracao");
    setMensagem("");
    setSent(false);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);

    if (!nome.trim() || !email.trim() || !mensagem.trim()) {
      setError("Por favor, preencha nome, e-mail e mensagem.");
      return;
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      setError("Informe um e-mail válido.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "contacts"), {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        tipo,
        mensagem: mensagem.trim(),
        status: "novo",
        createdAt: serverTimestamp(),
      });
      setSent(true);
    } catch (err) {
      console.error("Erro ao enviar contato:", err);
      setError("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pt-10 sm:pt-16">
      <Card className="w-full max-w-lg border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="p-5 sm:p-7">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-500/10 ring-1 ring-cyan-400/30">
                <Mail className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Entre em contato</h2>
                <p className="text-xs text-slate-400">Retornaremos o mais breve possível</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="mt-1 shrink-0 text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-50"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {sent ? (
            /* Estado de sucesso */
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 ring-1 ring-green-400/40">
                <CheckCircle className="h-7 w-7 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Mensagem enviada!</h3>
              <p className="mt-1 max-w-xs text-sm text-slate-400">
                Recebemos seu contato e responderemos em breve no e-mail informado.
              </p>
              <Button
                onClick={handleClose}
                className="mt-6 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
              >
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Tipo */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Como podemos ajudar?
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {TYPE_OPTIONS.map(({ value, label, desc, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTipo(value)}
                      className={`flex items-start gap-2 rounded-xl border-2 p-3 text-left transition-all ${
                        tipo === value
                          ? "border-cyan-500 bg-cyan-500/10"
                          : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                      }`}
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          tipo === value ? "text-cyan-300" : "text-slate-400"
                        }`}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-100">
                          {label}
                        </span>
                        <span className="block text-xs text-slate-400">{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* E-mail */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Mensagem */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  O que você deseja?
                </label>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={4}
                  placeholder="Escreva aqui sua mensagem..."
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <Button
                  onClick={handleClose}
                  disabled={submitting}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-900"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:brightness-110"
                >
                  {submitting ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar mensagem
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
