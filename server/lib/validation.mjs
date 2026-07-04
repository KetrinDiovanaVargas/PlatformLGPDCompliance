import { z } from 'zod';

// ========================================================================
// VALIDATION SCHEMAS
// ========================================================================

export const generateStageSchema = z.object({
  stage: z.number()
    .min(1, 'Stage deve ser entre 1 e 4')
    .max(4, 'Stage deve ser entre 1 e 4'),

  assessmentId: z.string()
    .min(1, 'Assessment ID é obrigatório')
    .max(256, 'Assessment ID muito longo'),

  context: z.record(z.unknown())
    .optional()
    .default({}),

  respondentContext: z.string()
    .max(2000, 'Contexto do respondente muito longo')
    .optional()
    .default(''),
});

export const saveResponsesSchema = z.object({
  stage: z.number()
    .min(0, 'Stage deve ser >= 0')
    .max(4, 'Stage deve ser <= 4'),

  sessionId: z.string()
    .min(1, 'Session ID é obrigatório')
    .uuid('Session ID deve ser UUID válido'),

  userId: z.string()
    .min(1, 'User ID é obrigatório')
    .max(256, 'User ID muito longo'),

  assessmentId: z.string()
    .min(1, 'Assessment ID é obrigatório')
    .max(256, 'Assessment ID muito longo')
    .nullable()
    .optional(),

  answers: z.record(z.unknown())
    .refine(obj => Object.keys(obj).length > 0, 'Deve haver pelo menos uma resposta'),
});

export const analyzeSchema = z.object({
  userId: z.string()
    .min(1, 'User ID é obrigatório'),

  sessionId: z.string()
    .min(1, 'Session ID é obrigatório')
    .uuid('Session ID deve ser UUID válido'),

  assessmentId: z.string()
    .min(1, 'Assessment ID é obrigatório')
    .nullable()
    .optional(),

  responses: z.array(z.unknown())
    .min(1, 'Deve haver pelo menos uma resposta'),
});

export const createAssessmentSchema = z.object({
  title: z.string()
    .min(3, 'Título deve ter pelo menos 3 caracteres')
    .max(200, 'Título muito longo'),

  description: z.string()
    .max(1000, 'Descrição muito longa')
    .optional()
    .default(''),

  context: z.string()
    .max(2000, 'Contexto muito longo')
    .optional()
    .default(''),

  formType: z.string()
    .max(100, 'Form type muito longo')
    .optional()
    .default('lgpd_diagnostico'),

  objective: z.string()
    .max(100, 'Objetivo muito longo')
    .optional()
    .default('diagnostico_inicial'),

  audience: z.string()
    .max(100, 'Audience muito longo')
    .optional()
    .default(''),

  introText: z.string()
    .max(1000, 'Intro text muito longo')
    .optional()
    .default(''),

  active: z.boolean()
    .optional()
    .default(true),
});

export const createAdminSchema = z.object({
  email: z.string()
    .email('Email inválido'),

  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter número'),

  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),

  role: z.enum(['ADMIN', 'MASTER'])
    .default('ADMIN'),
});

// ========================================================================
// VALIDATION MIDDLEWARE
// ========================================================================

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
