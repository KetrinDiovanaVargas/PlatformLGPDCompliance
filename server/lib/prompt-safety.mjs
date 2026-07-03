/**
 * Função para sanitizar texto de persona para evitar prompt injection
 * Remove ou escapa caracteres especiais que possam quebrar instruções
 */
export function sanitizePersonaMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // Limitar tamanho
  let text = markdown.substring(0, 5000);

  // Remover potenciais injection patterns
  text = text
    // Remover qualquer coisa que pareça ser uma instrução de prompt
    .replace(/ignore\s+(above|below|previous|this)/gi, '[REMOVED_INJECTION]')
    .replace(/you\s+(are|act as|pretend|role-play)/gi, '[REMOVED_INJECTION]')
    .replace(/forget\s+.*(instruction|rule|context)/gi, '[REMOVED_INJECTION]')
    .replace(/override\s+.*(instruction|system)/gi, '[REMOVED_INJECTION]')
    .replace(/disregard\s+.*(instruction|rule)/gi, '[REMOVED_INJECTION]')
    // Remover URLs suspeitas (podem conter instruções)
    .replace(/https?:\/\/[^\s]+/g, '[REMOVED_URL]')
    // Remover código suspeito
    .replace(/```[\s\S]*?```/g, '[REMOVED_CODE_BLOCK]')
    // Normalizar whitespace extremo
    .replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Wrapper para chamadas LLM que usa structured prompting
 * Evita colocar user input diretamente no system prompt
 */
export function buildSafePersonaPrompt(personaDescription) {
  const sanitized = sanitizePersonaMarkdown(personaDescription);

  // Usar XML tags estruturados em vez de interpolação direta
  return `Você é um participante de uma pesquisa sobre conformidade com a LGPD.

Sua persona é descrita nos tags <PERSONA> abaixo. Assuma completamente esta persona.
Responda TODAS as perguntas exclusivamente a partir da perspectiva e conhecimento desta persona.
Não quebre o personagem em nenhum momento.

Quando a pergunta for de múltipla escolha, escolha UMA das opções fornecidas e justifique brevemente.

<PERSONA>
${sanitized}
</PERSONA>

Regras de resposta:
1. Fale como esta persona faria
2. Use a primeira pessoa
3. Não mencione que é uma persona ou simulação
4. Mantenha coerência com a descrição da persona
5. Se não souber algo, responda como esta persona responderia (com sua limitação de conhecimento)`;
}

/**
 * Validar se texto contém potenciais sinais de resposta refusada
 */
export function isLikelyRefusal(text) {
  if (!text || typeof text !== 'string') return false;

  const refusalPatterns = [
    /não posso/i,
    /não devo/i,
    /não é apropriado/i,
    /viola.*política/i,
    /ethical|ethical/i,
    /responsibilidade|responsabilidade/i,
    /prejudicial/i,
    /não posso roleplay/i,
    /roleplay.*crime/i,
    /discriminação|discriminacao/i,
  ];

  return refusalPatterns.some(pattern => pattern.test(text));
}

/**
 * Sanitizar respostas do usuário antes de usar em prompts
 */
export function sanitizeUserInput(input, maxLength = 2000) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .substring(0, maxLength)
    .trim()
    // Escape quotes que possam quebrar strings
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

/**
 * Validar estrutura de persona markdown
 * Garante que persona tem seções obrigatórias
 */
export function validatePersonaStructure(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return { valid: false, errors: ['Persona vazia'] };
  }

  const errors = [];
  const sections = [
    '## 1. Identidade profissional',
    '## 2. Rotina de trabalho',
    '## 3. Dados pessoais',
    '## 4. Ferramentas e canais',
    '## 5. Estilo de resposta',
    '## 6. Comportamentos',
    '## 7. Limites',
    '## 8. Instruções',
  ];

  sections.forEach((section, index) => {
    if (!markdown.includes(section)) {
      errors.push(`Seção ${index + 1} não encontrada: ${section}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings: markdown.length > 5000 ? ['Persona muito longa (>5000 chars)'] : [],
  };
}
