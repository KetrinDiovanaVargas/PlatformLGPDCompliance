/**
 * @fileoverview Módulo de rota para verificação de status da API de IA.
 * Fornece um endpoint que retorna o status de disponibilidade da integração com IA.
 * @module routes/ai-status
 */

import express from 'express'
import { checkAIStatus } from '../lib/ai-client.mjs'

/**
 * Router Express para gerenciar rotas de status de IA.
 * @type {express.Router}
 */
const router = express.Router()

/**
 * Retorna o status atual de disponibilidade da API de IA.
 * 
 * @async
 * @route {GET} /
 * @returns {Object} Objeto contendo:
 * @returns {boolean} returns.available - Indica se a API de IA está disponível
 * @returns {string} returns.checkedAt - ISO 8601 timestamp do momento da verificação
 * @returns {*} returns... - Propriedades adicionais retornadas por checkAIStatus()
 * 
 * @example
 * // Requisição bem-sucedida
 * // GET /
 * // Response 200:
 * {
 *   "available": true,
 *   "checkedAt": "2026-08-09T14:30:00.000Z"
 * }
 * 
 * @example
 * // Erro na verificação
 * // GET /
 * // Response 500:
 * {
 *   "available": false,
 *   "error": "Connection timeout"
 * }
 */
router.get('/', async (_req, res) => {
  try {
    const status = await checkAIStatus()
    return res.json({
      ...status,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    return res.status(500).json({ available: false, error: err.message })
  }
})

export default router