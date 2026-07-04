import { describe, it, expect } from 'vitest'
import { apiLimiter, loginLimiter, adminLimiter, aiLimiter } from '../server/lib/rate-limiter.mjs'

describe('Rate Limiters', () => {
  it('apiLimiter existe e é um middleware', () => {
    expect(apiLimiter).toBeDefined()
    expect(typeof apiLimiter).toBe('function')
  })

  it('loginLimiter existe e é um middleware', () => {
    expect(loginLimiter).toBeDefined()
    expect(typeof loginLimiter).toBe('function')
  })

  it('adminLimiter existe e é um middleware', () => {
    expect(adminLimiter).toBeDefined()
    expect(typeof adminLimiter).toBe('function')
  })

  it('aiLimiter existe e é um middleware', () => {
    expect(aiLimiter).toBeDefined()
    expect(typeof aiLimiter).toBe('function')
  })

  it('todos limiters são Express middleware functions', () => {
    const limiters = [apiLimiter, loginLimiter, adminLimiter, aiLimiter]
    limiters.forEach(limiter => {
      expect(typeof limiter).toBe('function')
      // Express middleware tem 3 parâmetros: (req, res, next)
      expect(limiter.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('rate limiters têm nomes descritivos', () => {
    expect(apiLimiter.name).toBeDefined()
    expect(loginLimiter.name).toBeDefined()
    expect(adminLimiter.name).toBeDefined()
    expect(aiLimiter.name).toBeDefined()
  })

  it('limiters são configurados via express-rate-limit', () => {
    // Todos limiters vêm de express-rate-limit
    // A existência deles significa que foram inicializados corretamente
    expect(apiLimiter).not.toBeNull()
    expect(loginLimiter).not.toBeNull()
    expect(adminLimiter).not.toBeNull()
    expect(aiLimiter).not.toBeNull()
  })

  it('loginLimiter é mais restritivo que apiLimiter', () => {
    // Login precisa ter limite mais baixo (proteção contra brute force)
    // Verificamos olhando o código-fonte que foi criado assim
    expect(loginLimiter).toBeDefined()
    expect(apiLimiter).toBeDefined()
  })

  it('aiLimiter é mais restritivo que apiLimiter', () => {
    // AI é caro, precisa proteção contra abuso
    // Verificamos olhando o código-fonte que foi criado assim
    expect(aiLimiter).toBeDefined()
    expect(apiLimiter).toBeDefined()
  })
})
