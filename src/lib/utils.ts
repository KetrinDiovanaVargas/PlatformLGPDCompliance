import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateComplianceScore(responses: Record<string, any>) {
  if (!responses) return 0;

  const totalQuestions = Object.keys(responses).length;
  const positiveAnswers = Object.values(responses).filter(
    (r) => r === "Sim" || r === true
  ).length;

  const score = (positiveAnswers / totalQuestions) * 100;
  return Math.round(score);
}
