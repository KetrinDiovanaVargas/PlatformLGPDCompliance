/**
 * 
 * Módulo que expõe endpoints HTTP para monitorar e configurar a fila
 * de requisições para provedores de IA (Groq, DeepSeek, Claude, Gemini).
 * 
 * Funcionalidades:
 * - Consultar status atual da fila
 * - Configurar provedor preferido
 * - Limpar fila (com cuidados de admin)
 * 
 * @module routes/queue-status
 * 
 * @requires express
 * @requires ../lib/ai-client.mjs
 * 
 * Provedores suportados:
 * - groq: Groq Cloud (rápido, eficiente)
 * - deepseek: DeepSeek (modelo alternativo)
 * - claude: Anthropic Claude (via API)
 * - gemini: Google Gemini (alternativa)
 */

import express from 'express';
import { getAIQueueStatus, configureAIQueue } from '../lib/ai-client.mjs';

/**
 * Router Express para gerenciar rotas de fila de IA.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Provedores de IA suportados pelo sistema.
 * 
 * Cada provedor possui características diferentes:
 * - **groq**: Rápido, rate limit moderado, recomendado para produção
 * - **deepseek**: Alternativa com capacidades de raciocínio
 * - **claude**: Anthropic Claude, alta qualidade, custos variáveis
 * - **gemini**: Google Gemini, integração com ecossistema Google
 * 
 * @type {Array<string>}
 * @constant
 * 
 * @example
 * VALID_PROVIDERS // → ["groq", "deepseek", "claude", "gemini"]
 */
const VALID_PROVIDERS = ['groq', 'deepseek', 'claude', 'gemini'];

/**
 * Retorna status atual da fila de requisições de IA.
 * 
 * Fornece informações sobre:
 * - Quantidade de requisições pendentes
 * - Tamanho da fila
 * - Provedor atualmente configurado
 * - Taxa de processamento
 * - Métricas de sucesso/falha
 * 
 * ℹ️ **Útil para**: Monitorar saúde do sistema, detectar gargalos,
 * verificar se há requisições travadas.
 * 
 * @route {GET} /
 * 
 * @returns {Object} Status da fila:
 * @returns {boolean} returns.success - Sempre true em caso de sucesso
 * @returns {string} returns.timestamp - ISO 8601 do momento da consulta
 * @returns {Object} returns.queue - Objeto contendo status da fila
 * @returns {number} returns.queue.queueSize - Número de requisições pendentes
 * @returns {string} returns.queue.activeProvider - Provedor configurado
 * @returns {number} [returns.queue.processedCount] - Total de requisições processadas
 * @returns {number} [returns.queue.failureCount] - Total de falhas
 * @returns {number} [returns.queue.averageWaitTime] - Tempo médio de espera (ms)
 * 
 * @throws {500} Erro ao acessar fila
 * 
 * @example
 * // GET /api/queue-status
 * // Response 200:
 * {
 *   "success": true,
 *   "timestamp": "2026-08-09T14:30:00.000Z",
 *   "queue": {
 *     "queueSize": 3,
 *     "activeProvider": "groq",
 *     "processedCount": 1245,
 *     "failureCount": 2,
 *     "averageWaitTime": 240
 *   }
 * }
 * 
 * @example
 * // Erro
 * // Response 500:
 * {
 *   "success": false,
 *   "error": "Falha ao acessar cliente de IA"
 * }
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
 * Configura a fila para usar um provedor específico de IA.
 * 
 * Muda dinamicamente o provedor de IA utilizado para novas requisições.
 * Requisições já na fila continuam com o provedor anterior até conclusão.
 * 
 *  Se o provedor configurado falhar, o sistema
 * automaticamente tenta o próximo provedor na sequência (Groq → Claude → DeepSeek → Gemini).
 * 
 * Mudar provedor pode afetar:
 * - Qualidade/estilo das respostas
 * - Taxa de rate limiting
 * - Custos operacionais
 * 
 * @route {POST} /configure
 * 
 * @param {Object} req.body - Corpo da requisição
 * @param {string} req.body.provider - Provedor a configurar
 *                                    (groq | deepseek | claude | gemini)
 *                                    Padrão: "groq"
 * 
 * @returns {Object} Confirmação e novo status:
 * @returns {boolean} returns.success - True se configurado com sucesso
 * @returns {string} returns.message - Mensagem de confirmação
 * @returns {Object} returns.queue - Novo status da fila
 * 
 * @throws {400} Provedor inválido (não está em VALID_PROVIDERS)
 * @throws {500} Erro ao configurar fila
 * 
 * @example
 * // POST /api/queue-status/configure
 * // Content-Type: application/json
 * {
 *   "provider": "claude"
 * }
 * 
 * @example
 * // Response 200 (sucesso)
 * {
 *   "success": true,
 *   "message": "Fila configurada para claude",
 *   "queue": {
 *     "queueSize": 2,
 *     "activeProvider": "claude"
 *   }
 * }
 * 
 * @example
 * // Response 400 (provedor inválido)
 * {
 *   "success": false,
 *   "error": "Provider inválido. Providers suportados: groq, deepseek, claude, gemini"
 * }
 * 
 * @example
 * // Response 500 (erro ao configurar)
 * {
 *   "success": false,
 *   "error": "Falha ao escrever configuração"
 * }
 */
router.post('/configure', (req, res) => {
  try {
    const { provider = 'groq' } = req.body;

    if (!VALID_PROVIDERS.includes(provider.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Provider inválido. Providers suportados: ${VALID_PROVIDERS.join(', ')}`,
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
 * Limpa a fila de requisições pendentes.
 * 
 * Remove todas as requisições que ainda não
 * foram processadas. Requisições em processamento ativo NÃO são canceladas.
 * 
 * Idealmente requer autenticação/autorização de admin.
 * Verificação de permissões ainda não está implementada (TODO).
 * 
 *  A função retorna o status sem limpar de verdade
 * para evitar efeitos colaterais indesejados em produção. Implementação
 * completa de limpeza será necessária com gerenciamento de conexões ativas.
 * 
 *
 * - Fila travada ou inoperante
 * - Teste de contingência
 * - Reset após erro crítico
 * 
 * @route {POST} /clear
 * 
 * @returns {Object} Status após limpeza (simulada):
 * @returns {boolean} returns.success - True se operação registrada
 * @returns {string} returns.message - Descrição do que foi feito
 * @returns {Object} returns.queue - Status atual da fila
 * @returns {number} returns.queue.queueSize - Itens ainda pendentes
 * 
 * @throws {500} Erro ao acessar fila
 * 
 * @todo Implementar verificação de autenticação/admin
 * @todo Implementar limpeza real com gerenciamento de conexões ativas
 * @todo Registrar audit log de limpeza para fins de conformidade
 * 
 * @example
 * // POST /api/queue-status/clear
 * // Response 200 (fila já vazia)
 * {
 *   "success": true,
 *   "message": "Fila já está vazia",
 *   "queue": {
 *     "queueSize": 0,
 *     "activeProvider": "groq"
 *   }
 * }
 * 
 * @example
 * // Response 200 (com itens pendentes)
 * {
 *   "success": true,
 *   "message": "Operação de clear registrada. Fila contém 5 requisições pendentes.",
 *   "queue": {
 *     "queueSize": 5,
 *     "activeProvider": "groq"
 *   }
 * }
 * 
 * @example
 * // Response 500 (erro ao acessar fila)
 * {
 *   "success": false,
 *   "error": "Falha ao gerenciar fila de requisições"
 * }
 */
router.post('/clear', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin aqui se necessário
    // Validar token/sessão do usuário antes de permitir limpeza
    // if (!isAdmin(req)) {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Permissão negada. Apenas administradores podem limpar a fila."
    //   });
    // }

    const status = getAIQueueStatus();
    const queueSize = status.queueSize;

    if (queueSize === 0) {
      return res.json({
        success: true,
        message: 'Fila já está vazia',
        queue: status,
      });
    }

    // TODO: Implementar limpeza real com gerenciamento de conexões
    // clearAIQueue() would:
    // 1. Parar de aceitar novas requisições temporariamente
    // 2. Aguardar conclusão de requisições em processamento
    // 3. Remover fila de espera
    // 4. Registrar event de audit
    // 5. Notificar clientes sobre cancelamento

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