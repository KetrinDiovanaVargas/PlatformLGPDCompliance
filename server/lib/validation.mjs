/**
 * Schemas de validação com Zod para API de avaliação LGPD.
 * 
 * Define validações para geração de perguntas, respostas, análise e gerenciamento
 * de avaliações e administradores.
 * @module lib/validation-schemas
 */

import { z } from 'zod';

// ========================================================================
// VALIDATION SCHEMAS
// ========================================================================

/**
 * Schema para geração de perguntas de um estágio.
 * @type {z.ZodObject}
 */
export const generateStageSchema = z.object({
  /**
   * Número do estágio (1-4)
   * @type {z.ZodNumber}
   */
  stage: z.number()
    .min(1, 'Stage deve ser entre 1 e 4')
    .max(4, 'Stage deve ser entre 1 e 4'),

  /**
   * ID único da avaliação
   * @type {z.ZodString}
   */
  assessmentId: z.string()
    .min(1, 'Assessment ID é obrigatório')
    .max(256, 'Assessment ID muito longo'),

  /**
   * Contexto adicional para geração de perguntas
   * @type {z.ZodRecord}
   */
  context: z.record(z.unknown())
    .optional()
    .default({}),

  /**
   * Contexto textual do respondente (máx 2000 chars)
   * @type {z.ZodString}
   */
  respondentContext: z.string()
    .max(2000, 'Contexto do respondente muito longo')
    .optional()
    .default(''),
});

/**
 * Schema para salvamento de respostas de um estágio.
 * @type {z.ZodObject}
 */
export const saveResponsesSchema = z.object({
  /**
   * Número do estágio (0-4)
   * @type {z.ZodNumber}
   */
  stage: z.number()
    .min(0, 'Stage deve ser >= 0')
    .max(4, 'Stage deve ser <= 4'),

  /**
   * UUID da sessão
   * @type {z.ZodString}
   */
  sessionId: z.string()
    .min(1, 'Session ID é obrigatório')
    .uuid('Session ID deve ser UUID válido'),

  /**
   * ID do usuário respondente
   * @type {z.ZodString}
   */
  userId: z.string()
    .min(1, 'User ID é obrigatório')
    .max(256, 'User ID muito longo'),

  /**
   * ID da avaliação (opcional)
   * @type {z.ZodString}
   */
  assessmentId: z.string()
    .min(1, 'Assessment ID é obrigatório')
    .max(256, 'Assessment ID muito longo')
    .nullable()
    .optional(),

  /**
   * Objeto com respostas (mínimo 1 resposta obrigatória)
   * @type {z.ZodRecord}
   */
  answers: z.record(z.unknown())
    .refine(obj => Object.keys(obj).length > 0, 'Deve haver pelo menos uma resposta'),
});

/**
 * Schema para análise/geração de relatório consolidado.
 * @type {z.ZodObject}
 */
export const analyzeSchema = z.object({
  /**
   * ID do usuário
   * @type {z.ZodString}
   */
  userId: z.string()
    .min(1, 'User ID é obrigatório'),

  /**
   * UUID da sessão
   * @type {z.ZodString}
   */
  sessionId: z.string()
    .min(1, 'Session ID é obrigatório')
    .uuid('Session ID deve ser UUID válido'),

  /**
   * ID da avaliação (opcional)
   * @type {z.ZodString}
   */
  assessmentId: z.string()
    .min(1, 'Assessment ID é obrigatório')
    .nullable()
    .optional(),

  /**
   * Array de respostas dos estágios (mínimo 1)
   * @type {z.ZodArray}
   */
  responses: z.array(z.unknown())
    .min(1, 'Deve haver pelo menos uma resposta'),
});

/**
 * Schema para criação de nova avaliação/questionário.
 * @type {z.ZodObject}
 */
export const createAssessmentSchema = z.object({
  /**
   * Título da avaliação (3-200 caracteres)
   * @type {z.ZodString}
   */
  title: z.string()
    .min(3, 'Título deve ter pelo menos 3 caracteres')
    .max(200, 'Título muito longo'),

  /**
   * Descrição da avaliação (máx 1000 chars)
   * @type {z.ZodString}
   */
  description: z.string()
    .max(1000, 'Descrição muito longa')
    .optional()
    .default(''),

  /**
   * Contexto organizacional da avaliação (máx 2000 chars)
   * @type {z.ZodString}
   */
  context: z.string()
    .max(2000, 'Contexto muito longo')
    .optional()
    .default(''),

  /**
   * Tipo de formulário (padrão: 'lgpd_diagnostico')
   * @type {z.ZodString}
   */
  formType: z.string()
    .max(100, 'Form type muito longo')
    .optional()
    .default('lgpd_diagnostico'),

  /**
   * Objetivo da avaliação (padrão: 'diagnostico_inicial')
   * @type {z.ZodString}
   */
  objective: z.string()
    .max(100, 'Objetivo muito longo')
    .optional()
    .default('diagnostico_inicial'),

  /**
   * Público-alvo (ex: 'PME', 'Fintech')
   * @type {z.ZodString}
   */
  audience: z.string()
    .max(100, 'Audience muito longo')
    .optional()
    .default(''),

  /**
   * Texto de introdução (máx 1000 chars)
   * @type {z.ZodString}
   */
  introText: z.string()
    .max(1000, 'Intro text muito longo')
    .optional()
    .default(''),

  /**
   * Ativa/desativa a avaliação (padrão: true)
   * @type {z.ZodBoolean}
   */
  active: z.boolean()
    .optional()
    .default(true),
});

/**
 * Schema para criação de novo administrador.
 * @type {z.ZodObject}
 */
export const createAdminSchema = z.object({
  /**
   * Email do administrador (deve ser válido)
   * @type {z.ZodString}
   */
  email: z.string()
    .email('Email inválido'),

  /**
   * Senha do administrador (mín 8 chars, 1 maiúscula, 1 número)
   * @type {z.ZodString}
   */
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter número'),

  /**
   * Nome do administrador (2-100 caracteres)
   * @type {z.ZodString}
   */
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),

  /**
   * Papel do administrador (ADMIN ou MASTER, padrão: ADMIN)
   * @type {z.ZodEnum}
   */
  role: z.enum(['ADMIN', 'MASTER'])
    .default('ADMIN'),
});

// ========================================================================
// VALIDATION MIDDLEWARE
// ========================================================================

/**
 * Middleware de validação de requisições HTTP.
 * 
 * Valida req.body contra schema Zod e anexa resultado validado em req.validated.
 * Retorna erro 400 com detalhes dos campos inválidos em caso de falha.
 * 
 * @param {z.ZodSchema} schema - Schema Zod para validação
 * @returns {Function} Middleware Express (req, res, next)
 * 
 * @example
 * app.post('/api/assessment', 
 *   validateRequest(createAssessmentSchema),
 *   (req, res) => {
 *     const validated = req.validated; // dados validados e tipados
 *   }
 * );
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validação falhou',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      res.status(400).json({
        error: 'Erro na validação da requisição',
      });
    }
  };
}