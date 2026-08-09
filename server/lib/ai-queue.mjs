/**
 * Gerenciador de fila de requisições para APIs de IA.
 * 
 * Espaça requisições para respeitar rate limits de provedores (Groq, DeepSeek, Claude).
 * Implementa processamento sequencial com priorização e timeout por tarefa.
 * @module lib/ai-queue
 */

import { EventEmitter } from 'events';

/**
 * Fila de requisições com rate limiting e controle de concorrência.
 * 
 * Gerencia requisições para APIs de IA respeitando rate limits:
 * - Groq: 30 requisições/minuto (2s entre requisições)
 * - DeepSeek: 60 requisições/minuto (1s entre requisições)
 * - Claude: 100k tokens/minuto (sem limite de requisições)
 * 
 * @class AIQueue
 * @extends EventEmitter
 */
class AIQueue extends EventEmitter {
  /**
   * Inicializa a fila de requisições.
   * 
   * @param {Object} [options={}] - Configurações
   * @param {number} [options.maxConcurrent=1] - Máximo de requisições processadas simultaneamente
   * @param {number} [options.minDelayMs=2000] - Delay mínimo entre requisições (em ms)
   * @param {number} [options.maxQueueSize=1000] - Tamanho máximo da fila
   * @param {number} [options.requestTimeout=30000] - Timeout padrão por requisição (em ms)
   */
  constructor(options = {}) {
    super();

    // Configuração
    this.maxConcurrent = options.maxConcurrent || 1;
    this.minDelayMs = options.minDelayMs || 2000;
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.requestTimeout = options.requestTimeout || 30000;

    // Estado
    this.queue = [];
    this.processing = false;
    this.activeRequests = 0;
    this.lastRequestTime = 0;
    this.stats = {
      processed: 0,
      failed: 0,
      queued: 0,
      avgProcessTime: 0,
    };
  }

  /**
   * Adiciona requisição à fila com priorização automática.
   * 
   * @async
   * @param {Object} task - Definição da tarefa
   * @param {string} [task.id] - Identificador único (gerado automaticamente se omitido)
   * @param {"high"|"normal"|"low"} [task.priority="normal"] - Prioridade da tarefa
   * @param {Function} task.fn - Função assíncrona a executar
   * @param {number} [task.timeout=30000] - Timeout individual (ms)
   * 
   * @returns {Promise<*>} Resolve com resultado da função ou rejeita com erro
   * 
   * @throws {Error} Com code QUEUE_FULL se fila estiver no limite
   * @throws {Error} Com code TASK_TIMEOUT se tarefa exceder timeout
   * 
   * @example
   * const result = await queue.add({
   *   priority: 'high',
   *   fn: async () => await chatCompletion(messages),
   *   timeout: 60000
   * });
   */
  async add(task) {
    const { id, priority = 'normal', fn, timeout = this.requestTimeout } = task;

    if (this.queue.length >= this.maxQueueSize) {
      const error = new Error('Queue full');
      error.code = 'QUEUE_FULL';
      throw error;
    }

    return new Promise((resolve, reject) => {
      const queueItem = {
        id: id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        priority: priority === 'high' ? 0 : priority === 'low' ? 2 : 1,
        fn,
        timeout,
        resolve,
        reject,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
      };

      this.queue.push(queueItem);
      this.stats.queued++;

      this.queue.sort((a, b) => a.priority - b.priority);

      this.emit('queued', {
        taskId: queueItem.id,
        queueSize: this.queue.length,
        position: this.queue.findIndex(t => t.id === queueItem.id),
      });

      this.process();
    });
  }

  /**
   * Processa itens da fila com rate limiting e controle de concorrência.
   * Chamado automaticamente ao adicionar tarefas.
   * 
   * @private
   * @async
   */
  async process() {
    if (this.processing || this.queue.length === 0 || this.activeRequests >= this.maxConcurrent) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelayMs) {
        await new Promise(resolve => setTimeout(resolve, this.minDelayMs - timeSinceLastRequest));
      }

      const queueItem = this.queue.shift();
      this.activeRequests++;

      this.emit('processing', {
        taskId: queueItem.id,
        queueSize: this.queue.length,
        activeRequests: this.activeRequests,
      });

      this.executeTask(queueItem).then(() => {
        this.activeRequests--;
        this.lastRequestTime = Date.now();

        if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
          this.process();
        } else {
          this.processing = false;
        }
      });
    }

    this.processing = false;
  }

  /**
   * Executa tarefa individual com timeout e tratamento de erro.
   * 
   * @private
   * @async
   * @param {Object} queueItem - Item da fila a executar
   */
  async executeTask(queueItem) {
    const { id, fn, timeout, resolve, reject } = queueItem;
    const startTime = Date.now();
    queueItem.startedAt = startTime;

    try {
      const timeoutPromise = new Promise((_, rejectTimeout) =>
        setTimeout(() => {
          const error = new Error(`Task timeout after ${timeout}ms`);
          error.code = 'TASK_TIMEOUT';
          rejectTimeout(error);
        }, timeout)
      );

      const result = await Promise.race([fn(), timeoutPromise]);

      queueItem.completedAt = Date.now();
      const processingTime = queueItem.completedAt - startTime;

      this.stats.processed++;
      this.stats.avgProcessTime =
        (this.stats.avgProcessTime * (this.stats.processed - 1) + processingTime) /
        this.stats.processed;

      this.emit('completed', {
        taskId: id,
        processingTime,
        queueSize: this.queue.length,
      });

      resolve(result);
    } catch (error) {
      queueItem.completedAt = Date.now();
      this.stats.failed++;

      this.emit('failed', {
        taskId: id,
        error: error.message,
        code: error.code,
        queueSize: this.queue.length,
      });

      reject(error);
    }
  }

  /**
   * Retorna status geral da fila.
   * 
   * @returns {{queueSize: number, activeRequests: number, isProcessing: boolean, stats: Object, nextTaskIn: number, config: Object}}
   *   Objeto com tamanho da fila, requisições ativas, estatísticas e configuração
   * 
   * @example
   * const status = queue.getStatus();
   * console.log(`${status.queueSize} na fila, ${status.activeRequests} processando`);
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.processing,
      stats: { ...this.stats },
      nextTaskIn: this.lastRequestTime + this.minDelayMs - Date.now(),
      config: {
        maxConcurrent: this.maxConcurrent,
        minDelayMs: this.minDelayMs,
        maxQueueSize: this.maxQueueSize,
      },
    };
  }

  /**
   * Retorna status de tarefa específica.
   * 
   * @param {string} taskId - ID da tarefa
   * @returns {{id: string, priority: number, position: number, createdAt: number, startedAt: number|null, completedAt: number|null, status: "queued"|"processing"|"completed"}|null}
   *   Informações da tarefa ou null se não encontrada
   */
  getTaskStatus(taskId) {
    const task = this.queue.find(t => t.id === taskId);
    if (!task) {
      return null;
    }

    return {
      id: task.id,
      priority: task.priority,
      position: this.queue.indexOf(task),
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      status: task.completedAt ? 'completed' : task.startedAt ? 'processing' : 'queued',
    };
  }

  /**
   * Limpa a fila rejeitando todas as tarefas.
   * Útil para testes ou shutdown da aplicação.
   * 
   * @returns {number} Quantidade de tarefas removidas
   */
  clear() {
    const size = this.queue.length;
    this.queue.forEach(item => {
      const error = new Error('Queue cleared');
      error.code = 'QUEUE_CLEARED';
      item.reject(error);
    });
    this.queue = [];
    return size;
  }

  /**
   * Configura rate limiting e concorrência baseado no provider de IA.
   * 
   * Aplica presets otimizados para cada provedor:
   * - Groq: 1 concorrente, 2s delay (30 req/min)
   * - DeepSeek: 2 concorrentes, 1s delay (60 req/min)
   * - Claude: 5 concorrentes, 0s delay (100k tokens/min)
   * - Gemini: 1 concorrente, 1s delay (conservador)
   * 
   * @param {string} provider - Nome do provider ('groq', 'deepseek', 'claude', 'gemini')
   * 
   * @example
   * queue.configureForProvider('claude');
   * // Agora usa: 5 concorrentes, 0ms delay
   */
  configureForProvider(provider) {
    const configs = {
      groq: { minDelayMs: 2000, maxConcurrent: 1 },
      deepseek: { minDelayMs: 1000, maxConcurrent: 2 },
      claude: { minDelayMs: 0, maxConcurrent: 5 },
      gemini: { minDelayMs: 1000, maxConcurrent: 1 },
    };

    const config = configs[provider.toLowerCase()] || configs.groq;
    Object.assign(this, config);

    this.emit('providerConfigured', {
      provider,
      minDelayMs: this.minDelayMs,
      maxConcurrent: this.maxConcurrent,
    });
  }
}

let globalQueue = null;

/**
 * Retorna instância global singleton da fila de requisições.
 * 
 * @param {Object} [options={}] - Opções de inicialização (apenas primeira chamada)
 * @returns {AIQueue} Instância global da fila
 * 
 * @example
 * const queue = getQueue();
 * await queue.add({ fn: async () => await chatCompletion(messages) });
 */
export function getQueue(options = {}) {
  if (!globalQueue) {
    globalQueue = new AIQueue(options);
  }
  return globalQueue;
}

export default AIQueue;