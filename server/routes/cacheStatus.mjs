/**
 * @fileoverview Rotas de Gerenciamento de Cache de Perguntas - Express Router
 * 
 * Módulo que expõe endpoints HTTP para monitorar e gerenciar o cache
 * de perguntas do sistema de avaliação LGPD.
 * 
 * @module routes/cache-status
 * 
 * @requires ../lib/question-cache.mjs
 * 
 * Funcionalidades:
 * - Consultar status atual do cache
 * - Limpar cache completamente
 * - Invalidar cache por stage específico
 */

import express from 'express';
import { getQuestionCache } from '../lib/question-cache.mjs';

/**
 * Router Express para gerenciar rotas de cache de perguntas.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Retorna o status atual do cache de perguntas.
 * 
 * Fornece informações sobre quantos itens estão em cache,
 * tamanho em memória, e estatísticas de uso.
 * 
 * @async
 * @route {GET} /
 * 
 * @returns {Object} Status do cache contendo:
 * @returns {boolean} returns.success - Sempre true em caso de sucesso
 * @returns {string} returns.timestamp - ISO 8601 timestamp da consulta
 * @returns {Object} returns.cache - Objeto com status do cache
 * @returns {number} returns.cache.size - Número de itens em cache
 * @returns {number} [returns.cache.hitRate] - Taxa de acerto do cache (%)
 * @returns {number} [returns.cache.memoryUsage] - Uso de memória em bytes
 * 
 * @throws {500} Erro ao acessar cache
 * 
 * @example
 * // GET /
 * // Response 200:
 * {
 *   "success": true,
 *   "timestamp": "2026-08-09T14:30:00.000Z",
 *   "cache": {
 *     "size": 45,
 *     "hitRate": 87.5,
 *     "memoryUsage": 2048000
 *   }
 * }
 * 
 * @example
 * // Erro
 * // Response 500:
 * {
 *   "success": false,
 *   "error": "Falha ao conectar ao cache"
 * }
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
 * Limpa todo o cache de perguntas.
 * 
 * Remove todos os itens armazenados em cache, liberando memória
 * e forçando recarga das perguntas na próxima requisição.
 * 
 * **Ação Irreversível**: Após executar, todas as perguntas em cache
 * serão perdidas e precisarão ser recarregadas do banco de dados.
 * 
 * @async
 * @route {POST} /clear
 * 
 * @returns {Object} Resultado da limpeza:
 * @returns {boolean} returns.success - Sempre true se bem-sucedido
 * @returns {string} returns.message - Mensagem com quantidade de itens removidos
 * 
 * @throws {500} Erro ao limpar cache
 * 
 * @example
 * // POST /clear
 * // Response 200:
 * {
 *   "success": true,
 *   "message": "Cache limpo: 45 itens removidos"
 * }
 * 
 * @example
 * // Erro
 * // Response 500:
 * {
 *   "success": false,
 *   "error": "Permissão negada para limpar cache"
 * }
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
 * Invalida cache de um stage específico ou completamente.
 * 
 * Remove itens em cache relacionados a um stage de avaliação específico.
 * Se nenhum stage for informado, invalida todo o cache.
 * Útil para atualizar perguntas de um stage específico sem afetar os demais.
 * 
 * @async
 * @route {POST} /invalidate
 * 
 * @param {number} [req.query.stage] - ID do stage a invalidar
 *                                     Se omitido, invalida cache completo
 * 
 * @returns {Object} Resultado da invalidação:
 * @returns {boolean} returns.success - Sempre true se bem-sucedido
 * @returns {string} returns.message - Mensagem descrevendo o que foi invalidado
 * 
 * @throws {400} Stage inválido (não é número)
 * @throws {500} Erro ao invalidar cache
 * 
 * @example
 * // POST /invalidate?stage=2
 * // Response 200:
 * {
 *   "success": true,
 *   "message": "Cache invalidado para stage 2"
 * }
 * 
 * @example
 * // POST /invalidate (sem query)
 * // Response 200:
 * {
 *   "success": true,
 *   "message": "Cache completamente invalidado"
 * }
 * 
 * @example
 * // Erro
 * // Response 500:
 * {
 *   "success": false,
 *   "error": "Stage 999 não encontrado"
 * }
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