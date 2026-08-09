/**
 * Configurações de rate limiting para rotas da API.
 * 
 * Define middlewares de rate limiting para diferentes categorias de rotas:
 * API pública, admin login, admin routes, e chamadas de IA.
 * @module middleware/rate-limiters
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter para rotas públicas (generate-stage, save-responses, analyze).
 * 
 * Limite: 100 requisições por 15 minutos por IP.
 * Desabilitado em desenvolvimento para localhost (127.0.0.1).
 * 
 * @type {Function} Middleware Express
 * 
 * @example
 * app.post('/api/generate-stage', apiLimiter, handler);
 * // 100 requisições máx por IP em 15 minutos
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests',
    message: 'Você atingiu o limite de requisições. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1',
});

/**
 * Rate limiter estrito para rotas de login de admin.
 * 
 * Limite: 5 tentativas por 15 minutos por IP.
 * Protege contra brute force em autenticação.
 * 
 * @type {Function} Middleware Express
 * 
 * @example
 * app.post('/api/admin/login', loginLimiter, handler);
 * // 5 tentativas máx por IP em 15 minutos
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many login attempts',
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para rotas administrativas.
 * 
 * Limite: 50 requisições por 15 minutos por IP.
 * Desabilitado em desenvolvimento.
 * 
 * @type {Function} Middleware Express
 * 
 * @example
 * app.get('/api/admin/users', adminMiddleware, adminLimiter, handler);
 * // 50 requisições máx por IP em 15 minutos
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: 'Admin rate limit exceeded',
    message: 'Limite de requisições para admin atingido.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

/**
 * Rate limiter restritivo para chamadas de IA (generate-stage, analyze).
 * 
 * Limite: 20 requisições por 1 minuto por IP.
 * Previne abuso de geração de conteúdo com modelos de IA.
 * 
 * @type {Function} Middleware Express
 * 
 * @example
 * app.post('/api/generate-stage', apiLimiter, aiLimiter, handler);
 * // 20 requisições máx por IP em 1 minuto
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'AI rate limit exceeded',
    message: 'Limite de requisições AI atingido. Tente novamente em 1 minuto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});