import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiter para rotas públicas (generate-stage, save-responses, analyze)
 * Limite: 100 requests por 15 minutos por IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: {
    error: 'Too many requests',
    message: 'Você atingiu o limite de requisições. Tente novamente em 15 minutos.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip certain IPs if needed (e.g., localhost for testing)
  skip: (req) => process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1',
});

/**
 * Rate limiter estrito para admin login
 * Limite: 5 tentativas por 15 minutos por IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por IP
  message: {
    error: 'Too many login attempts',
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para admin routes
 * Limite: 50 requests por 15 minutos (por usuário autenticado)
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
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req), // Usar UID se autenticado, senão IP
});

/**
 * Rate limiter para AI calls (mais restritivo)
 * Limite: 20 requisições por 1 minuto (por IP)
 * Evita abuso de geração de conteúdo
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // 20 requests por minuto
  message: {
    error: 'AI rate limit exceeded',
    message: 'Limite de requisições AI atingido. Tente novamente em 1 minuto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
