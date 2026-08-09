/**
 * Utilitários para sanitização e validação segura de personas e prompts.
 * 
 * Implementa defesas contra prompt injection, structured prompting e validação
 * de entrada para o sistema de personas da plataforma LGPD.
 * @module utils/persona-safety
 */

/**
 * Sanitiza texto de persona para evitar prompt injection.
 * Remove ou escapa caracteres especiais que possam quebrar instruções.
 * 
 * @param {string} markdown - Texto bruto da persona
 * @returns {string} Texto sanitizado (máx 5000 caracteres)
 * 
 * @example
 * const safe = sanitizePersonaMarkdown(userInput);
 * // Remove: padrões de injection, URLs, blocos de código, whitespace excessivo
 */
export function sanitizePersonaMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  let text = markdown.substring(0, 5000);

  text = text
    .replace(/ignore\s+(above|below|previous|this)/gi, '[REMOVED_INJECTION]')
    .replace(/you\s+(are|act as|pretend|role-play)/gi, '[REMOVED_INJECTION]')
    .replace(/forget\s+.*(instruction|rule|context)/gi, '[REMOVED_INJECTION]')
    .replace(/override\s+.*(instruction|system)/gi, '[REMOVED_INJECTION]')
    .replace(/disregard\s+.*(instruction|rule)/gi, '[REMOVED_INJECTION]')
    .replace(/https?:\/\/[^\s]+/g, '[REMOVED_URL]')
    .replace(/```[\s\S]*?```/g, '[REMOVED_CODE_BLOCK]')
    .replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Constrói prompt seguro para personas usando structured prompting.
 * Evita colocar user input diretamente no system prompt.
 * 
 * @param {string} personaDescription - Descrição da persona (será sanitizada)
 * @returns {string} Prompt estruturado com tags XML
 * 
 * @example
 * const prompt = buildSafePersonaPrompt(personaMarkdown);
 * await chatCompletion([{ role: 'user', content: prompt }]);
 */
export function buildSafePersonaPrompt(personaDescription) {
  const sanitized = sanitizePersonaMarkdown(personaDescription);

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
 * Valida se texto contém sinais de resposta refusada pelo modelo.
 * 
 * @param {string} text - Texto a validar
 * @returns {boolean} true se contém padrões de refusal
 * 
 * @example
 * if (isLikelyRefusal(response)) {
 *   // Tratar resposta refusada
 * }
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
 * Sanitiza entrada de usuário antes de usar em prompts.
 * 
 * @param {string} input - Texto do usuário
 * @param {number} [maxLength=2000] - Comprimento máximo permitido
 * @returns {string} Texto sanitizado e escapado
 * 
 * @example
 * const safe = sanitizeUserInput(userResponse, 1500);
 */
export function sanitizeUserInput(input, maxLength = 2000) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .substring(0, maxLength)
    .trim()
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

/**
 * Valida estrutura de persona markdown.
 * Garante que persona contém todas as seções obrigatórias.
 * 
 * @param {string} markdown - Texto da persona em markdown
 * @returns {{valid: boolean, errors: string[], warnings: string[]}} Resultado da validação
 * 
 * @example
 * const validation = validatePersonaStructure(personaText);
 * if (!validation.valid) {
 *   console.log(validation.errors);
 * }
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