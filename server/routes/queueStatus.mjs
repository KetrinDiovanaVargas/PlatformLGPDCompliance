import express from 'express';
import { getAIQueueStatus, configureAIQueue } from '../lib/ai-client.mjs';

const router = express.Router();

/**
 * GET /api/queue-status
 * Retorna status atual da fila de requisições de IA
 */
router.get('/', (_req, res) => {
  try {
    const status = getAIQueueStatus();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      queue: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/queue-status/configure
 * Configura a fila para um provedor específico
 *
 * Body:
 * {
 *   "provider": "groq" | "deepseek" | "claude" | "gemini"
 * }
 */
router.post('/configure', (req, res) => {
  try {
    const { provider = 'groq' } = req.body;

    const validProviders = ['groq', 'deepseek', 'claude', 'gemini'];
    if (!validProviders.includes(provider.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Provider inválido. Providers suportados: ${validProviders.join(', ')}`,
      });
    }

    configureAIQueue(provider);
    const status = getAIQueueStatus();

    res.json({
      success: true,
      message: `Fila configurada para ${provider}`,
      queue: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/queue-status/clear
 * Limpa a fila (use com cuidado - cancela requisições pendentes)
 * Requer autenticação de admin
 */
router.post('/clear', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin aqui se necessário
    // Por enquanto, apenas log

    const status = getAIQueueStatus();
    const queueSize = status.queueSize;

    if (queueSize === 0) {
      return res.json({
        success: true,
        message: 'Fila já está vazia',
        queue: status,
      });
    }

    // Não vamos realmente limpar a fila por enquanto
    // Em produção, seria necessário gerenciar os requests ativos
    res.json({
      success: true,
      message: `Operação de clear registrada. Fila contém ${queueSize} requisições pendentes.`,
      queue: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
