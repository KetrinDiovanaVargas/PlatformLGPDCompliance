import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, PlusCircle } from "lucide-react";

type CreateAdminModalProps = {
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "MASTER";
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
};

export function CreateAdminModal({
  onSubmit,
  onCancel,
  loading = false,
}: CreateAdminModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MASTER">("ADMIN");

  const handleSubmit = async () => {
    if (name.trim() && email.trim() && password.trim()) {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        role,
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("ADMIN");
    }
  };

  const isFormValid = name.trim() && email.trim() && password.trim();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto p-4 pt-20">
      <Card className="w-full max-w-md bg-slate-950 border border-slate-800 shadow-2xl">
        <div className="space-y-6 p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">
                Criar Acesso
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Defina as credenciais para o novo administrador.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-200 transition-colors shrink-0 mt-1"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nome do administrador *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Senha temporária *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nível de acesso *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "ADMIN" | "MASTER")}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="ADMIN" className="bg-slate-950 text-white">
                  ADMIN
                </option>
                <option value="MASTER" className="bg-slate-950 text-white">
                  MASTER
                </option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button
              onClick={onCancel}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || loading}
              className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              {loading ? "Criando..." : "Criar Acesso"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
