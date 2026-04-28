function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractAskedFromContext(ctx) {
  if (!ctx) return [];
  return String(ctx)
    .split("\n")
    .filter((line) => line.trim().startsWith("Q:"))
    .map((line) => {
      const clean = line.replace(/^Q:\s*/i, "").split("→ A:")[0];
      return normalize(clean.trim());
    })
    .filter(Boolean);
}

function extractAnswersFromContext(ctx) {
  if (!ctx) return [];
  return String(ctx)
    .split("\n")
    .filter((line) => line.includes("→ A:"))
    .map((line) => line.split("→ A:")[1]?.trim())
    .filter(Boolean);
}

function extractInitialUserContext(ctx) {
  if (!ctx) return "";

  const lines = String(ctx).split("\n");
  const firstAnsweredLine = lines.find(
    (line) =>
      line.includes("→ A:") &&
      normalize(line).includes(
        normalize(
          "Antes de começar, conte um pouco sobre você, sua realidade e sua relação com este tema."
        )
      )
  );

  if (firstAnsweredLine) {
    return firstAnsweredLine.split("→ A:")[1]?.trim() || "";
  }

  const fallbackFirstAnswer = lines.find((line) => line.includes("→ A:"));
  if (fallbackFirstAnswer) {
    return fallbackFirstAnswer.split("→ A:")[1]?.trim() || "";
  }

  return "";
}

function inferProfileFromInitialContext(initialContext) {
  const txt = normalize(initialContext || "");

  if (!txt) return "outro";

  if (
    txt.includes("estudante") ||
    txt.includes("universidade") ||
    txt.includes("faculdade") ||
    txt.includes("curso") ||
    txt.includes("graduacao") ||
    txt.includes("graduação") ||
    txt.includes("mestrado") ||
    txt.includes("pesquisa") ||
    txt.includes("academico") ||
    txt.includes("acadêmico")
  ) {
    return "estudante";
  }

  if (
    txt.includes("desempreg") ||
    txt.includes("sem trabalho") ||
    txt.includes("em busca de emprego") ||
    txt.includes("procurando emprego") ||
    txt.includes("buscando recolocacao") ||
    txt.includes("buscando recolocação")
  ) {
    return "desempregado";
  }

  if (
    txt.includes("autonomo") ||
    txt.includes("autônomo") ||
    txt.includes("freelancer") ||
    txt.includes("prestador de servico") ||
    txt.includes("prestador de serviço") ||
    txt.includes("microempreendedor") ||
    txt.includes("mei")
  ) {
    return "autonomo";
  }

  if (
    txt.includes("gestor") ||
    txt.includes("lider") ||
    txt.includes("líder") ||
    txt.includes("coordenador") ||
    txt.includes("gerente") ||
    txt.includes("supervisor")
  ) {
    return "empregado";
  }

  if (
    txt.includes("empregado") ||
    txt.includes("clt") ||
    txt.includes("empresa") ||
    txt.includes("trabalho") ||
    txt.includes("cargo") ||
    txt.includes("analista") ||
    txt.includes("colaborador") ||
    txt.includes("funcionario") ||
    txt.includes("funcionário") ||
    txt.includes("servidor publico") ||
    txt.includes("servidor público")
  ) {
    return "empregado";
  }

  return "outro";
}

function buildContextFromResponses(responsesObj = {}) {
  if (!responsesObj || typeof responsesObj !== "object") return "";

  const lines = Object.entries(responsesObj).map(([id, ans]) => {
    const v =
      ans && typeof ans === "object"
        ? JSON.stringify(ans)
        : Array.isArray(ans)
          ? ans.join(", ")
          : String(ans ?? "");
    return `Q: ${id} → A: ${v}`;
  });

  return lines.join("\n");
}

function normalizeObjective(objective) {
  const value = normalize(objective);

  if (!value) return "diagnostico_inicial";

  if (value.includes("maturidade")) return "mapeamento_maturidade";
  if (value.includes("percepcao") || value.includes("percepção")) {
    return "levantamento_percepcao";
  }
  if (value.includes("auditoria")) return "auditoria_interna";
  if (
    value.includes("treinamento") ||
    value.includes("conscientizacao") ||
    value.includes("conscientização")
  ) {
    return "treinamento_conscientizacao";
  }
  if (value.includes("risco")) return "identificacao_riscos";

  if (
    value === "diagnostico_inicial" ||
    value === "mapeamento_maturidade" ||
    value === "levantamento_percepcao" ||
    value === "auditoria_interna" ||
    value === "treinamento_conscientizacao" ||
    value === "identificacao_riscos"
  ) {
    return value;
  }

  return "diagnostico_inicial";
}

function buildObjectiveGuidance(objective) {
  const normalizedObjective = normalizeObjective(objective);

  if (normalizedObjective === "mapeamento_maturidade") {
    return `
OBJETIVO ESPECÍFICO: MAPEAMENTO DE MATURIDADE
- Investigue nível de estrutura, consistência, formalização e evolução das práticas.
- Faça perguntas que ajudem a entender se os processos são inexistentes, informais, parcialmente definidos ou bem estabelecidos.
- Explore grau de repetibilidade, monitoramento, documentação e melhoria contínua.
- Priorize progressão de maturidade em vez de simples percepção subjetiva.
`.trim();
  }

  if (normalizedObjective === "levantamento_percepcao") {
    return `
OBJETIVO ESPECÍFICO: LEVANTAMENTO DE PERCEPÇÃO
- Priorize como o respondente percebe, entende e vivencia o tema no dia a dia.
- Valorize clareza, entendimento, sensação de segurança, confiança e percepção de preparo.
- Evite transformar a conversa em auditoria rígida.
- Faça perguntas mais interpretativas, mas ainda úteis para diagnóstico.
`.trim();
  }

  if (normalizedObjective === "auditoria_interna") {
    return `
OBJETIVO ESPECÍFICO: AUDITORIA INTERNA
- Priorize perguntas mais objetivas, verificáveis e orientadas a evidências.
- Explore existência de regras, procedimentos, responsabilidades, registros e controles.
- Foque conformidade prática, consistência operacional e pontos verificáveis.
- Evite perguntas excessivamente abertas quando uma verificação objetiva for possível.
`.trim();
  }

  if (normalizedObjective === "treinamento_conscientizacao") {
    return `
OBJETIVO ESPECÍFICO: TREINAMENTO E CONSCIENTIZAÇÃO
- Priorize entendimento, comportamento, preparo e boas práticas do respondente.
- Explore conhecimento aplicado, percepção de riscos e capacidade de agir corretamente.
- Foque em educação, orientação e maturidade comportamental.
- Prefira linguagem acessível e didática.
`.trim();
  }

  if (normalizedObjective === "identificacao_riscos") {
    return `
OBJETIVO ESPECÍFICO: IDENTIFICAÇÃO DE RISCOS
- Priorize vulnerabilidades, fragilidades, exposições, falhas e pontos críticos.
- Explore situações de compartilhamento indevido, acesso inadequado, ausência de controle, desconhecimento e riscos operacionais.
- Faça perguntas que revelem onde estão os maiores riscos no processo.
- Mantenha foco em criticidade prática e impacto potencial.
`.trim();
  }

  return `
OBJETIVO ESPECÍFICO: DIAGNÓSTICO INICIAL
- Priorize visão geral, entendimento do cenário atual e identificação preliminar de práticas.
- Faça perguntas amplas o suficiente para mapear a realidade, mas sem perder coerência.
- Equilibre contexto, percepção, operação e primeiros indícios de maturidade.
`.trim();
}

function buildStageExplorationGuidance(stage) {
  if (stage === 1) {
    return `
DIMENSÃO DA ETAPA 1:
- Explore contexto, rotina, vivência e relação inicial com o tema.
- Entenda cenário, frequência de contato, situações de uso e percepção inicial.
- NÃO explorar ainda controles avançados, governança detalhada ou auditoria formal.
`.trim();
  }

  if (stage === 2) {
    return `
DIMENSÃO DA ETAPA 2:
- Explore coleta, uso, acesso, armazenamento, circulação e exposição de dados.
- Foque operação prática e contato com informações no contexto real.
- NÃO repetir perguntas de apresentação, rotina inicial ou percepção geral já exploradas.
`.trim();
  }

  if (stage === 3) {
    return `
DIMENSÃO DA ETAPA 3:
- Explore fluxo de processo, responsabilidades, compartilhamento, dependências e papéis.
- Foque como as atividades acontecem e quem participa ou influencia o processo.
- NÃO repetir perguntas sobre simples existência de contato com dados ou contexto introdutório.
`.trim();
  }

  if (stage === 4) {
    return `
DIMENSÃO DA ETAPA 4:
- Explore controles, proteção, políticas, prevenção, revisão, monitoramento e maturidade prática.
- Foque mecanismos de segurança, evidências, melhoria e sustentação do processo.
- NÃO repetir perguntas operacionais básicas já feitas nas etapas anteriores.
`.trim();
  }

  return `
DIMENSÃO DA ETAPA:
- Explore uma dimensão nova e complementar.
- Evite repetir qualquer foco já abordado antes.
`.trim();
}

export function generateStagePrompt(stage, ctxOrResponses = "", metadata = {}) {
  const etapa = Number(stage) || 1;

  let ctx = "";
  if (typeof ctxOrResponses === "string") {
    ctx = ctxOrResponses;
  } else if (ctxOrResponses && typeof ctxOrResponses === "object") {
    ctx = buildContextFromResponses(ctxOrResponses);
  }

  const historicoPerguntas = extractAskedFromContext(ctx);
  const historicoRespostas = extractAnswersFromContext(ctx);
  const initialUserContext = extractInitialUserContext(ctx);
  const perfilInferido = inferProfileFromInitialContext(initialUserContext);

  const LOW_KNOWLEDGE_MARKERS = [
    "nao sei",
    "não sei",
    "nao tenho certeza",
    "não tenho certeza",
    "desconheco",
    "desconheço",
    "nao entendo",
    "não entendo",
    "nao lembro",
    "não lembro",
    "nunca ouvi",
    "nao se aplica",
    "não se aplica",
    "sem certeza",
    "nao possuo",
    "não possuo",
  ];

  const lowKnowledgeExamples = historicoRespostas
    .filter((ans) => {
      const n = normalize(ans);
      return LOW_KNOWLEDGE_MARKERS.some((m) => n.includes(normalize(m)));
    })
    .slice(0, 6);

  const lowKnowledge = lowKnowledgeExamples.length > 0;

  const totalPerguntas = etapa === 1 ? 4 : 5;

  const assessmentTitle = String(metadata.assessmentTitle || "").trim();
  const assessmentFormType = String(metadata.assessmentFormType || "").trim();
  const assessmentObjective = String(
    metadata.assessmentObjective || metadata.assessmentCategory || ""
  ).trim();
  const assessmentContext = String(metadata.assessmentContext || "").trim();
  const audience = String(metadata.audience || "").trim();
  const introText = String(metadata.introText || "").trim();

  const objectiveGuidance = buildObjectiveGuidance(assessmentObjective);
  const stageExplorationGuidance = buildStageExplorationGuidance(etapa);

  return `
Você é uma IA especialista em LGPD + ISO/IEC 27001.
Sua função é gerar perguntas de diagnóstico de maturidade de forma progressiva, coerente e contextual.
Você deve seguir prioritariamente as definições do administrador do formulário.

ETAPA ATUAL: ${etapa}
PERFIL INFERIDO DO RESPONDENTE: ${perfilInferido.toUpperCase()}

==================== DEFINIÇÕES OFICIAIS DO ADMINISTRADOR ====================

TÍTULO DA AVALIAÇÃO:
${assessmentTitle || "Não informado"}

TIPO DA AVALIAÇÃO:
${assessmentFormType || "Não informado"}

OBJETIVO DA AVALIAÇÃO:
${assessmentObjective || "Não informado"}

PÚBLICO-ALVO DEFINIDO PELO ADMINISTRADOR:
${audience || "Não informado"}

TEXTO DE INTRODUÇÃO DEFINIDO PELO ADMINISTRADOR:
${introText || "Não informado"}

CONTEXTO OFICIAL DEFINIDO PELO ADMINISTRADOR:
${assessmentContext || "Não informado"}

==================== CONTEXTO INICIAL DO RESPONDENTE ====================

${initialUserContext || "Não informado"}

==================== MEMÓRIA CONTÍNUA ====================

HISTÓRICO DE PERGUNTAS JÁ FEITAS:
${historicoPerguntas.length ? historicoPerguntas.join("\n") : "Nenhuma."}

HISTÓRICO DE RESPOSTAS:
${historicoRespostas.length ? historicoRespostas.join("\n") : "Nenhuma."}

==================== SINAIS DE BAIXO CONHECIMENTO (CAMINHO TRISTE) ====================

BAIXO CONHECIMENTO DETECTADO: ${lowKnowledge ? "SIM" : "NÃO"}

Exemplos detectados (se houver):
${lowKnowledgeExamples.length ? lowKnowledgeExamples.map((x) => `- ${x}`).join("\n") : "Nenhum."}

==================== AUTORIDADE DO ADMINISTRADOR ====================

- As definições do administrador são obrigatórias e possuem prioridade máxima.
- O título, tipo, objetivo, público-alvo, texto de introdução e contexto da avaliação definem o escopo oficial do formulário.
- O contexto inicial do respondente deve ser usado apenas para personalizar a linguagem, os exemplos e a progressão das perguntas.
- O contexto do respondente NÃO pode alterar o objetivo principal definido pelo administrador.
- Nunca desvie do tema central da avaliação.
- Nunca substitua as regras do administrador por interpretações baseadas apenas nas respostas do usuário.
- Se houver conflito entre o que o administrador definiu e o que o respondente descreveu, prevalece o que foi definido pelo administrador.
- O público-alvo definido pelo administrador deve orientar o vocabulário, os exemplos e a complexidade das perguntas.
- O objetivo da avaliação deve orientar o foco das perguntas e a profundidade da investigação.
- Se o respondente parecer fora do público-alvo esperado, mantenha o foco no escopo definido pelo administrador e apenas adapte a redação quando necessário.

==================== HIERARQUIA DE PRIORIDADE ====================

Quando houver conflito, siga esta ordem de prioridade:
1. regras e contexto definidos pelo administrador
2. objetivo e público-alvo definidos pelo administrador
3. contexto inicial do respondente
4. histórico das respostas anteriores

==================== REGRA CRÍTICA DE NÃO REPETIÇÃO ====================

- NÃO repetir perguntas literalmente.
- NÃO repetir perguntas semanticamente equivalentes.
- NÃO reformular com palavras diferentes uma pergunta que já investigou a mesma intenção.
- NÃO repetir o mesmo contexto, o mesmo foco ou a mesma dimensão investigativa em etapas diferentes.
- Cada nova pergunta deve explorar uma dimensão NOVA e complementar.
- Se uma pergunta candidata for parecida com qualquer pergunta anterior, DESCARTE e gere outra.
- Se uma pergunta candidata investigar o mesmo assunto central já coberto, DESCARTE e gere outra.
- Não use sinônimos para mascarar repetição.
- O histórico de perguntas acima deve ser tratado como bloqueio real de conteúdo já explorado.

==================== ACESSIBILIDADE / SEM PONTAS SOLTAS (OBRIGATÓRIO) ====================

- Cada pergunta precisa ser respondível por alguém que NÃO domina LGPD.
- Evite jargões. Se um termo técnico for inevitável, explique em 1 frase no campo "description".
- Pergunte sobre ações observáveis (rotina, ferramentas, quem acessa, onde guarda, como compartilha, como decide).
- Para reduzir bloqueios do usuário:
  - Prefira "select" ou "checkbox" quando for possível guiar a resposta.
  - Em TODA pergunta do tipo "select": inclua SEMPRE as opções "Não sei informar" e "Não se aplica".
  - Em TODA pergunta do tipo "checkbox": inclua SEMPRE a opção "Não sei informar".
  - Use "Outro (especifique)" somente quando realmente fizer sentido.
  - Em TODA pergunta do tipo "textarea": inclua SEMPRE "description" dizendo explicitamente:
    "Se não souber responder, escreva: 'Não sei informar'."

- Se BAIXO CONHECIMENTO DETECTADO = SIM:
  - Faça perguntas ainda mais concretas, curtas e guiadas (menos abertas).
  - Não exija evidências formais; foque no que a pessoa consegue relatar do dia a dia.

==================== REGRAS GERAIS ====================

- Gere EXATAMENTE ${totalPerguntas} perguntas em "questions".
- Retorne SOMENTE JSON válido, sem markdown, sem comentários e sem texto fora do JSON.
- Campos permitidos: title, description, questions, id, type, question, description, options, required.
- NÃO repetir a pergunta inicial de contexto do respondente, pois ela já foi respondida.
- NÃO repetir perguntas já feitas anteriormente.
- NÃO gerar perguntas fora do escopo definido pelo administrador.
- As perguntas devem ser claras, naturais, objetivas e progressivas.
- Use linguagem compatível com o público-alvo definido pelo administrador.
- Considere simultaneamente:
  1. o contexto oficial definido pelo administrador,
  2. o objetivo definido pelo administrador,
  3. o público-alvo definido pelo administrador,
  4. o contexto inicial do respondente,
  5. o histórico de perguntas e respostas.
- O contexto do respondente serve para adaptar a abordagem, não para redefinir o tema do formulário.

==================== DIRETRIZ ESPECÍFICA POR OBJETIVO ====================

${objectiveGuidance}

==================== DIMENSÃO OBRIGATÓRIA DESTA ETAPA ====================

${stageExplorationGuidance}

==================== PERFIS E ADAPTAÇÃO ====================

Se o perfil inferido for ESTUDANTE:
- Foque em ambiente acadêmico, curso, pesquisa, projetos, plataformas acadêmicas,
  compartilhamento de arquivos, dados pessoais e dados acadêmicos.
- Evite linguagem corporativa pesada, auditorias empresariais e contratos de clientes,
  salvo se o contexto do administrador exigir explicitamente.

Se o perfil inferido for EMPREGADO:
- Foque em setor, função, rotina, responsabilidades,
  contato com dados pessoais, uso de sistemas e processos internos.

Se o perfil inferido for AUTONOMO:
- Foque em clientes, formulários, planilhas, WhatsApp, e-mail, Drive,
  armazenamento, consentimento e organização dos dados.

Se o perfil inferido for DESEMPREGADO:
- Foque em currículos, plataformas de vagas, cadastros,
  envio de documentos e exposição de dados pessoais.

Se o perfil inferido for OUTRO:
- Faça perguntas neutras, contextuais e progressivas,
  sempre respeitando o escopo definido pelo administrador.

==================== REGRAS POR ETAPA ====================

ETAPA 1 (4 perguntas):
- Complementa o contexto inicial do respondente sem fugir do escopo definido pelo administrador.
- Entende melhor realidade, rotina, experiência e relação com o tema.
- Não entrar ainda em controles técnicos avançados.
- Faça a abertura da investigação de acordo com o objetivo da avaliação.
- Evite perguntar qualquer coisa que já tenha sido respondida implicitamente no contexto inicial.

ETAPA 2 (5 perguntas):
- Explora uso, coleta, armazenamento, acesso e contato com dados pessoais.
- Traga exemplos coerentes com o contexto do formulário e com o público-alvo definido pelo administrador.
- Ajuste a profundidade conforme o objetivo da avaliação.
- Não repetir rotina, perfil, apresentação pessoal ou contexto introdutório.

ETAPA 3 (5 perguntas):
- Explora processos, fluxo de informações, compartilhamento, operação e responsabilidades.
- Mantenha coerência com o domínio definido pelo administrador.
- Direcione a investigação para o objetivo principal da avaliação.
- Não repetir perguntas sobre simples contato com dados, frequência ou contexto já explorado.

ETAPA 4 (5 perguntas):
- Explora controles, proteção, políticas, cuidados, segurança e maturidade prática.
- Mantenha o nível compatível com o público-alvo e com o contexto da avaliação.
- Feche a progressão considerando o objetivo definido pelo administrador.
- Não repetir processo, fluxo ou operação já explorados anteriormente.

==================== REGRAS DE QUALIDADE ====================

- Evite perguntas genéricas demais.
- Evite perguntas duplicadas ou semanticamente equivalentes.
- Evite jargões técnicos desnecessários para públicos não especialistas.
- As perguntas devem parecer parte de uma mesma entrevista progressiva.
- As opções de select/checkbox devem ser plausíveis para o contexto.
- Use textarea quando a resposta exigir explicação livre.
- Use select ou checkbox quando houver opções claras e comparáveis.
- Cada pergunta deve ajudar a aprofundar o diagnóstico de forma útil e coerente.
- Não faça perguntas que contradigam o contexto oficial da avaliação.
- Não transforme um formulário acadêmico em corporativo, nem um formulário corporativo em acadêmico, a menos que isso tenha sido definido pelo administrador.
- O objetivo da avaliação deve ser perceptível no conteúdo das perguntas.
- Sempre que houver opção "Outro", "Outra", "Outros", "Outras" ou "Especifique", inclua isso como opção clara e compatível com o contexto quando fizer sentido.
- Prefira variedade real de foco entre as perguntas da mesma etapa.

==================== VALIDAÇÃO INTERNA OBRIGATÓRIA ANTES DE RESPONDER ====================

Antes de gerar o JSON final, faça esta checagem mental:
1. Esta pergunta já foi feita antes?
2. Esta pergunta é parecida com alguma anterior, mesmo com palavras diferentes?
3. Esta pergunta investiga a mesma intenção de alguma anterior?
4. Esta pergunta repete o mesmo contexto ou dimensão já explorada?
5. Esta pergunta acrescenta informação realmente nova?

Se qualquer resposta acima for "sim", descarte a pergunta e gere outra.

==================== FORMATO FINAL ====================

Retorne APENAS um objeto JSON neste formato:

{
  "title": "string",
  "description": "string",
  "questions": [
    {
      "id": "q1",
      "type": "select" | "checkbox" | "textarea",
      "question": "string",
      "description": "string",
      "options": ["opção 1", "opção 2"],
      "required": true
    }
  ]
}

NÃO escreva nada antes ou depois do JSON.
`.trim();
}