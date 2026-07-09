import express from 'express';
import { getQuestionCache } from '../lib/question-cache.mjs';

const router = express.Router();

/**
 * GET /api/cache-status
 * Retorna status do cache de perguntas
 */
router.get('/', (_req, res) => {
  try {
    const cache = getQuestionCache();
    const status = cache.getStatus();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/cache-status/clear
 * Limpa todo o cache
 */
router.post('/clear', (_req, res) => {
  try {
    const cache = getQuestionCache();
    const sizeBefore = cache.cache.size;
    cache.invalidate();

    res.json({
      success: true,
      message: `Cache limpo: ${sizeBefore} itens removidos`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/cache-status/invalidate?stage=1
 * Invalida cache de um stage específico
 */
router.post('/invalidate', (req, res) => {
  try {
    const stage = req.query.stage ? parseInt(req.query.stage) : null;
    const cache = getQuestionCache();

    cache.invalidate(stage);

    res.json({
      success: true,
      message: stage
        ? `Cache invalidado para stage ${stage}`
        : 'Cache completamente invalidado',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
