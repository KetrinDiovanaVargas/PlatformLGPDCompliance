import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfusionMatrix, type ConfusionMatrixData } from "@/components/ConfusionMatrix";
import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";

/**
 * ValidationDemoPage
 *
 * Página de demonstração/teste para a Matriz de Confusão.
 * Compara Esperado (Oráculo) vs Detectado (Sistema) para validação de personas.
 *
 * Esta é uma página de teste/exemplo, não integrada ao sistema operacional.
 * Usado para validar que o sistema detecta corretamente as fragilidades esperadas das personas.
 */

// Exemplos de dados baseados nas personas geradas
const PERSONA_VALIDATION_EXAMPLES = [
  {
    id: "P01",
    name: "P01 - RH Recrutamento",
    description: "Compartilhamento informal de currículos via WhatsApp",
    data: {
      truePositives: 8,   // Detectou corretamente: F1, F3, F9
      falsePositives: 2,  // Detectou incorretamente: Cobrança (não deveria)
      falseNegatives: 1,  // Perdeu detectar: Um detalhe de F3
      trueNegatives: 14,  // Corretamente rejeitou: Birô de crédito, etc
    } as ConfusionMatrixData,
  },
  {
    id: "P03",
    name: "P03 - Saúde Ocupacional",
    description: "Retenção de dados médicos sem consentimento renovado",
    data: {
      truePositives: 7,
      falsePositives: 1,
      falseNegatives: 2,
      trueNegatives: 15,
    } as ConfusionMatrixData,
  },
  {
    id: "A01",
    name: "A01 - Consultor RH Malicioso",
    description: "Persona maliciosa com violações deliberadas de LGPD",
    data: {
      truePositives: 12,
      falsePositives: 0,
      falseNegatives: 0,
      trueNegatives: 13,
    } as ConfusionMatrixData,
  },
  {
    id: "P05",
    name: "P05 - Comercial Coordenador",
    description: "Acesso excessivo a dados de clientes para análise comercial",
    data: {
      truePositives: 6,
      falsePositives: 2,
      falseNegatives: 3,
      trueNegatives: 14,
    } as ConfusionMatrixData,
  },
];

export function ValidationDemoPage() {
  const [selectedPersona, setSelectedPersona] = useState(0);
  const example = PERSONA_VALIDATION_EXAMPLES[selectedPersona];

  const totalCases = example.data.truePositives + example.data.falsePositives + example.data.falseNegatives + example.data.trueNegatives;
  const accuracy = ((example.data.truePositives + example.data.trueNegatives) / totalCases * 100).toFixed(1);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950 text-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400">
              Validação de Personas LGPD
            </h1>
          </div>
          <p className="text-slate-400 max-w-2xl">
            Demonstração de matriz de confusão: comparação entre fragilidades
            <strong> esperadas (oráculo)</strong> e
            <strong> detectadas (sistema)</strong>.
          </p>
        </header>

        {/* Seletor de Personas */}
        <Card className="rounded-lg bg-slate-900/50 border border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            Selecione uma Persona para Validação
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {PERSONA_VALIDATION_EXAMPLES.map((ex, idx) => (
              <button
                key={ex.id}
                onClick={() => setSelectedPersona(idx)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  selectedPersona === idx
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-700 bg-slate-800/20 hover:border-slate-600"
                }`}
              >
                <p className="text-xs font-semibold text-slate-300">{ex.id}</p>
                <p className="text-[11px] text-slate-400 mt-1">{ex.name.split(" - ")[1]}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Resumo da Persona */}
        <Card className="rounded-lg bg-slate-900/50 border border-slate-800 p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-100">{example.name}</h2>
              <p className="text-sm text-slate-400 mt-2">{example.description}</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <div>
                <p className="text-xs text-sky-300 uppercase tracking-wider">Acurácia Geral</p>
                <p className="text-2xl font-bold text-sky-100">{accuracy}%</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Matriz de Confusão Principal */}
        <Card className="rounded-lg bg-slate-900/50 border border-slate-800 p-6">
          <ConfusionMatrix
            data={example.data}
            title={`Matriz de Confusão - ${example.id}`}
            description={`Total de casos analisados: ${totalCases} fragilidades esperadas avaliadas`}
          />
        </Card>

        {/* Informações Adicionais */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Recomendações baseadas na Acurácia */}
          <Card className="rounded-lg bg-slate-900/50 border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-100">Análise de Resultado</h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span><strong>VP ({example.data.truePositives}):</strong> Fragilidades corretamente identificadas</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-400">✗</span>
                <span><strong>FP ({example.data.falsePositives}):</strong> Falsas detecções (alarmes falsos)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400">⚠</span>
                <span><strong>FN ({example.data.falseNegatives}):</strong> Fragilidades perdidas (sensibilidade reduzida)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">—</span>
                <span><strong>VN ({example.data.trueNegatives}):</strong> Corretamente ausentes</span>
              </li>
            </ul>
          </Card>

          {/* Interpretação para LGPD */}
          <Card className="rounded-lg bg-slate-900/50 border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-slate-100">Critério de Aceição</h3>
            </div>
            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <p className="font-semibold text-slate-200 mb-1">Para produção:</p>
                <p className="text-slate-400">• Acurácia ≥ 90%</p>
                <p className="text-slate-400">• Recall (Sensibilidade) ≥ 85%</p>
                <p className="text-slate-400">• F1-Score ≥ 80%</p>
              </div>
              <div>
                <p className="font-semibold text-slate-200 mb-1">Status atual:</p>
                <p className={accuracy >= "90" ? "text-emerald-300" : "text-amber-300"}>
                  {accuracy >= "90" ? "✓ Pronto para produção" : "⚠ Requer refinamento"}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Explicação Técnica */}
        <Card className="rounded-lg bg-slate-900/50 border border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-100 mb-4">Explicação Técnica</h3>
          <div className="space-y-3 text-xs text-slate-400">
            <p>
              Esta matriz compara as <strong>fragilidades esperadas</strong> (definidas no oráculo da persona)
              com as <strong>fragilidades detectadas</strong> pelo sistema de análise consolidada.
            </p>
            <p>
              Cada persona tem um <strong>vetor de fragilidade (F1-F10)</strong> esperado e um conjunto de
              <strong> comportamentos observáveis</strong> que deveriam ser detectados pelas perguntas do questionário.
            </p>
            <p>
              O sistema é validado respondendo as personas e comparando as respostas com as fragilidades esperadas.
              A matriz quantifica o desempenho de detecção.
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 py-4">
          <p>Página de Validação e Teste - Não integrada ao sistema operacional</p>
        </div>
      </div>
    </div>
  );
}
