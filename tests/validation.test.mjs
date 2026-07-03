import { describe, it, expect } from 'vitest'
import {
  generateStageSchema,
  saveResponsesSchema,
  analyzeSchema,
  createAssessmentSchema,
  createAdminSchema
} from '../server/lib/validation.mjs'
import { ZodError } from 'zod'

describe('Zod Validation Schemas', () => {
  describe('generateStageSchema', () => {
    it('aceita stage válido (1-4)', () => {
      const valid = { stage: 2, assessmentId: 'abc123' }
      expect(() => generateStageSchema.parse(valid)).not.toThrow()
    })

    it('rejeita stage fora do range', () => {
      const invalid = { stage: 5, assessmentId: 'abc123' }
      expect(() => generateStageSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita stage 0', () => {
      const invalid = { stage: 0, assessmentId: 'abc123' }
      expect(() => generateStageSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita assessmentId vazio', () => {
      const invalid = { stage: 1, assessmentId: '' }
      expect(() => generateStageSchema.parse(invalid)).toThrow(ZodError)
    })

    it('aceita context opcional', () => {
      const valid = {
        stage: 1,
        assessmentId: 'abc',
        context: { key: 'value' }
      }
      expect(() => generateStageSchema.parse(valid)).not.toThrow()
    })

    it('rejeita respondentContext > 2000 chars', () => {
      const invalid = {
        stage: 1,
        assessmentId: 'abc',
        respondentContext: 'x'.repeat(2001)
      }
      expect(() => generateStageSchema.parse(invalid)).toThrow(ZodError)
    })
  })

  describe('saveResponsesSchema', () => {
    it('aceita stage 0-4', () => {
      for (let stage = 0; stage <= 4; stage++) {
        const valid = {
          stage,
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'user123',
          answers: { q1: 'response' }
        }
        expect(() => saveResponsesSchema.parse(valid)).not.toThrow()
      }
    })

    it('rejeita stage 5', () => {
      const invalid = {
        stage: 5,
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user123',
        answers: { q1: 'response' }
      }
      expect(() => saveResponsesSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita sessionId inválido (não UUID)', () => {
      const invalid = {
        stage: 1,
        sessionId: 'not-a-uuid',
        userId: 'user123',
        answers: { q1: 'response' }
      }
      expect(() => saveResponsesSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita answers vazio', () => {
      const invalid = {
        stage: 1,
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user123',
        answers: {}
      }
      expect(() => saveResponsesSchema.parse(invalid)).toThrow(ZodError)
    })

    it('aceita assessmentId nullable', () => {
      const valid = {
        stage: 1,
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user123',
        assessmentId: null,
        answers: { q1: 'response' }
      }
      expect(() => saveResponsesSchema.parse(valid)).not.toThrow()
    })
  })

  describe('analyzeSchema', () => {
    it('aceita analyze válido', () => {
      const valid = {
        userId: 'user123',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        assessmentId: 'assess123',
        responses: [
          { stage: 0, answers: { q1: 'a' } },
          { stage: 1, answers: { q2: 'b' } }
        ]
      }
      expect(() => analyzeSchema.parse(valid)).not.toThrow()
    })

    it('rejeita responses array vazio', () => {
      const invalid = {
        userId: 'user123',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        assessmentId: 'assess123',
        responses: []
      }
      expect(() => analyzeSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita sessionId inválido', () => {
      const invalid = {
        userId: 'user123',
        sessionId: 'invalid',
        assessmentId: 'assess123',
        responses: [{ stage: 0, answers: { q1: 'a' } }]
      }
      expect(() => analyzeSchema.parse(invalid)).toThrow(ZodError)
    })
  })

  describe('createAssessmentSchema', () => {
    it('aceita assessment com title apenas', () => {
      const valid = {
        title: 'Avaliação LGPD'
      }
      expect(() => createAssessmentSchema.parse(valid)).not.toThrow()
    })

    it('rejeita title muito curto', () => {
      const invalid = {
        title: 'AB'
      }
      expect(() => createAssessmentSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita title vazio', () => {
      const invalid = { title: '' }
      expect(() => createAssessmentSchema.parse(invalid)).toThrow(ZodError)
    })

    it('aceita com objective (optional)', () => {
      const valid = {
        title: 'Avaliação LGPD',
        objective: 'diagnostico_inicial'
      }
      expect(() => createAssessmentSchema.parse(valid)).not.toThrow()
    })
  })

  describe('createAdminSchema', () => {
    it('aceita admin válido', () => {
      const valid = {
        email: 'admin@example.com',
        password: 'SecurePass123',
        name: 'Admin User',
        role: 'ADMIN'
      }
      expect(() => createAdminSchema.parse(valid)).not.toThrow()
    })

    it('rejeita email inválido', () => {
      const invalid = {
        email: 'not-an-email',
        password: 'SecurePass123',
        name: 'Admin User',
        role: 'ADMIN'
      }
      expect(() => createAdminSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita senha sem uppercase', () => {
      const invalid = {
        email: 'admin@example.com',
        password: 'securepass123',
        name: 'Admin User',
        role: 'ADMIN'
      }
      expect(() => createAdminSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita senha sem número', () => {
      const invalid = {
        email: 'admin@example.com',
        password: 'SecurePass',
        name: 'Admin User',
        role: 'ADMIN'
      }
      expect(() => createAdminSchema.parse(invalid)).toThrow(ZodError)
    })

    it('rejeita role inválido', () => {
      const invalid = {
        email: 'admin@example.com',
        password: 'SecurePass123',
        name: 'Admin User',
        role: 'INVALID'
      }
      expect(() => createAdminSchema.parse(invalid)).toThrow(ZodError)
    })

    it('aceita role MASTER', () => {
      const valid = {
        email: 'master@example.com',
        password: 'MasterPass123',
        name: 'Master User',
        role: 'MASTER'
      }
      expect(() => createAdminSchema.parse(valid)).not.toThrow()
    })
  })
})
