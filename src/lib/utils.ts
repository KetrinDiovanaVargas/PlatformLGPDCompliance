/**
 * @module utils/cn
 * @description Utilitários para manipulação de classes CSS e cálculo de scores
 * de conformidade. Combina `clsx` e `tailwind-merge` para gerenciamento robusto
 * de classes Tailwind CSS com suporte a sobrescrita dinâmica.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina múltiplas classes CSS com suporte a Tailwind merge inteligente.
 *
 * Função utilitária que resolve classes CSS condicionais usando `clsx` e depois
 * aplica `twMerge` para resolver conflitos de classes Tailwind (ex: `bg-red-500`
 * sobrescrevendo `bg-blue-500`). Útil em componentes React com variações de estilo
 * dinâmico.
 *
 * @function cn
 * @param {...ClassValue[]} inputs - Classes CSS individuais, arrays, objetos condicionais
 *   ou undefined. Formato compatível com `clsx`:
 *   - string: "bg-red-500 text-white"
 *   - array: ["px-4", "py-2"]
 *   - objeto: { "font-bold": isActive, "opacity-50": isDisabled }
 *   - undefined/null: ignorado
 * @returns {string} String de classes CSS única com conflitos Tailwind resolvidos
 *
 * @example
 * // Componentes com variações de estilo
 * const buttonClass = cn(
 *   "px-4 py-2 rounded text-sm font-medium",
 *   isActive && "bg-blue-500 text-white",
 *   !isActive && "bg-gray-200 text-gray-800",
 *   isDisabled && "opacity-50 cursor-not-allowed"
 * );
 * // Resultado: "px-4 py-2 rounded text-sm font-medium bg-blue-500 text-white"
 * // (conflitos resolvidos: bg-gray-200 é removido quando bg-blue-500 é ativo)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calcula score de conformidade LGPD a partir de respostas de avaliação.
 *
 * Implementa cálculo simplista de maturidade baseado em proporção de respostas
 * positivas ("Sim" ou true) em relação ao total de perguntas respondidas.
 *
 * Score = (Respostas Positivas / Total de Respostas) * 100
 *
 * Útil como indicador rápido ou score preliminar. Para análise mais robusta,
 * considerar matriz de confusão (TP, FP, FN, TN) ou modelo LLM ponderado.
 *
 * @function calculateComplianceScore
 * @param {Record<string, any>} responses - Objeto mapeando questões para respostas.
 *   Formato esperado: `{ q0: "Sim", q1: true, q2: "Parcial", ... }`
 *   Valores considerados "positivos": "Sim" (string exata) ou true (booleano)
 * @returns {number} Score percentual de conformidade (0-100), arredondado para inteiro.
 *   Retorna 0 se `responses` é undefined, null, ou vazio.
 *
 * @example
 * // Calcular score de conformidade a partir de respostas
 * const userResponses = {
 *   consentimento: "Sim",
 *   direitos_titular: true,
 *   seguranca_dados: "Parcial",
 *   anonimizacao: "Não",
 *   politica_retencao: true
 * };
 *
 * const score = calculateComplianceScore(userResponses);
 * // Respostas positivas: 3 (Sim + true + true)
 * // Total: 5
 * // Score: (3 / 5) * 100 = 60
 * // Resultado: 60
 *
 * @see {@link ../services/assessmentService.ts} Para cálculo avançado com métricas
 *   de matriz de confusão (precision, recall, f1-score)
 * @todo Considerar ponderação por categoria ou importância das questões
 * @todo Validar contra modelo LLM para análise mais precisa
 */
export function calculateComplianceScore(responses: Record<string, any>) {
  if (!responses) return 0;

  const totalQuestions = Object.keys(responses).length;
  const positiveAnswers = Object.values(responses).filter(
    (r) => r === "Sim" || r === true
  ).length;

  const score = (positiveAnswers / totalQuestions) * 100;
  return Math.round(score);
}