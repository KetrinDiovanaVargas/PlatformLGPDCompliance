/**
 * @module types/stages
 * @description Definição de tipos e estrutura base para etapas de elicitação
 * adaptativa. Interfaces TypeScript para perguntas e etapas, com população dinâmica
 * de conteúdo via backend (GROQ API).
 *
 * @architecture Padrão de Carregamento:
 *   1. Frontend inicializa com `stages[]` vazio (skeleton)
 *   2. Em runtime, carrega perguntas do backend (GROQ)
 *   3. Popula `stages[i].questions` com dados do servidor
 *   4. Renderiza interface com conteúdo dinâmico
 *
 * Benefícios: A/B testing, atualizações sem deploy, adaptação por tenant/organização
 */

/**
 * Representa uma pergunta individual dentro de uma etapa de avaliação.
 *
 * Suporta múltiplos tipos de entrada (select único, checkbox múltiplo, textarea livre).
 * Estrutura genérica permite reutilização em diferentes contextos de avaliação LGPD.
 *
 * @typedef {Object} Question
 * @property {string} id - Identificador único da pergunta (ex: "q_001_coleta_dados").
 *   Usado para referenciar respostas e análise posterior.
 * @property {("select"|"checkbox"|"textarea")} type - Tipo de controle de entrada:
 *   - `"select"`: dropdown com uma seleção obrigatória (ex: sim/não/parcial)
 *   - `"checkbox"`: múltiplas seleções (ex: departamentos que acessam dados)
 *   - `"textarea"`: texto livre (ex: descrever processo de coleta)
 * @property {string} question - Enunciado principal da pergunta em português,
 *   contextualizando conformidade com LGPD (ex: "Como dados de clientes são coletados?")
 * @property {string} [description] - Texto auxiliar opcional com instruções ou contexto.
 *   Aparece abaixo da pergunta como dica ao respondente (ex: "Selecione TODOS os canais").
 * @property {string[]} [options] - Array de opções de resposta (obrigatório se type = "select" ou "checkbox").
 *   Exemplos:
 *     - Select: ["Sim", "Não", "Parcial", "Não sabe"]
 *     - Checkbox: ["Email", "WhatsApp", "Formulário web", "Vendedor presencial"]
 * @property {boolean} [required] - Flag indicando se resposta é obrigatória (padrão: true).
 *   Se false, pergunta pode ser pulada ou deixada em branco.
 *
 * @example
 * // Pergunta sobre consentimento com múltiplas opções
 * const consentQuestion: Question = {
 *   id: "q_001_consentimento",
 *   type: "select",
 *   question: "A organização obtém consentimento explícito antes de coletar dados pessoais?",
 *   description: "Conforme Art. 7, I da LGPD. Consentimento deve ser informado, livre, específico.",
 *   options: ["Sim, sempre", "Parcialmente", "Não", "Não sabe"],
 *   required: true
 * };
 */
export interface Question {
  id: string;
  type: "select" | "checkbox" | "textarea";
  question: string;
  description?: string;
  options?: string[];
  required?: boolean;
}

/**
 * Representa uma etapa (fase) da avaliação adaptativa de maturidade LGPD.
 *
 * Cada etapa agrupa um conjunto de perguntas relacionadas a um tema específico
 * (ex: coleta de dados, consentimento, direitos do titular, etc). A estrutura
 * permite fluxo sequencial com possibilidade de salvar progresso entre etapas.
 *
 * @typedef {Object} Stage
 * @property {number} id - Identificador numérico da etapa (1-5 típico).
 *   Usado para rastreamento de progresso e ordenação. Deve ser único e sequencial.
 * @property {string} title - Título descritivo da etapa em português.
 *   Aparece em UI como cabeçalho de seção (ex: "Coleta e Armazenamento de Dados").
 * @property {string} description - Descrição narrativa de contexto e objetivos da etapa.
 *   Prepara o usuário sobre o que será avaliado (ex: "Nesta etapa avaliaremos...").
 * @property {Question[]} questions - Array de perguntas que compõem a etapa.
 *   Inicialmente vazio `[]` e populado dinamicamente pelo backend via GROQ API.
 *   Ordem preservada conforme retornada pelo servidor.
 */
export interface Stage {
  id: number;
  title: string;
  description: string;
  questions: Question[];
}

/**
 * E
 *
 * Array inicializado com 5 etapas (típico para avaliação LGPD completa). Cada
 * etapa começa vazia e será populada em runtime pelo backend via API GROQ.
 *
 * Fluxo de Carregamento:
 * 1. Frontend renderiza UI skeleton com 5 tabs/seções vazias
 * 2. Em `useEffect`, faz requisição ao backend `/api/stages`
 * 3. Backend consulta GROQ LLM para gerar perguntas contextualizadas
 * 4. Resposta popula array `stages[i].questions` com conteúdo dinâmico
 * 5. UI re-renderiza com perguntas carregadas
 *
 *
 * Etapa 5 Especial: "Relatório Final" não contém perguntas interativas.
 * Em vez disso, renderiza resumo das respostas anteriores e análise LLM.
 *
 * @type {Stage[]}
 * @const
 * @property {number} stages[0].id - Etapa 1 (ex: Contextualização, Governança)
 * @property {number} stages[1].id - Etapa 2 (ex: Coleta e Armazenamento)
 * @property {number} stages[2].id - Etapa 3 (ex: Segurança e Direitos)
 * @property {number} stages[3].id - Etapa 4 (ex: Conformidade Operacional)
 * @property {number} stages[4].id - Etapa 5 (Relatório Final - readonly)
 *
 * @example
 * // Em componente React, após carregar do backend
 * const [stageData, setStageData] = useState(stages);
 *
 * useEffect(() => {
 *   const loadStages = async () => {
 *     const response = await fetch("/api/stages");
 *     const data = await response.json();
 *     setStageData(data); // substitui array vazio com conteúdo
 *   };
 *   loadStages();
 * }, []);
 *
 * @see {@link ../services/apiService.ts} Para requisição de carregamento de conteúdo
 * @todo Implementar carregamento automático em useEffect no componente raiz
 * @todo Adicionar error handling e retry logic para falha de carregamento
 */
export const stages: Stage[] = [
  { id: 1, title: "", description: "", questions: [] },
  { id: 2, title: "", description: "", questions: [] },
  { id: 3, title: "", description: "", questions: [] },
  { id: 4, title: "", description: "", questions: [] },
  { id: 5, title: "Relatório Final", description: "", questions: [] },
];