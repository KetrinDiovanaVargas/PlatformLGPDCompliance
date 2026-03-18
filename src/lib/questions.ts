export interface Question {
  id: string;
  type: "select" | "checkbox" | "textarea";
  question: string;
  description?: string;
  options?: string[];
  required?: boolean;
}

export interface Stage {
  id: number;
  title: string;
  description: string;
  questions: Question[];
}

/**
 * Estrutura base das etapas.
 * As perguntas serão SEMPRE carregadas do backend (GROQ).
 */
export const stages: Stage[] = [
  { id: 1, title: "", description: "", questions: [] },
  { id: 2, title: "", description: "", questions: [] },
  { id: 3, title: "", description: "", questions: [] },
  { id: 4, title: "", description: "", questions: [] },
  { id: 5, title: "Relatório Final", description: "", questions: [] }
];
