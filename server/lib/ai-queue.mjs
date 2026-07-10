import { EventEmitter } from 'events';

/**
 * AIQueue - Gerencia fila de requisições para APIs de IA
 *
 * Espaça requisições para respeitar rate limits de provedores
 * - Groq: 30 requisições/minuto (2 segundos entre requisições)
 * - DeepSeek: 60 requisições/minuto (1 segundo entre requisições)
 * - Claude: 100k tokens/minuto (sem limite de requisições)
 *
 * Usa fila com processamento sequencial controlado
 */

class AIQueue extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuração
    this.maxConcurrent = options.maxConcurrent || 1; // Processa 1 de cada vez
    this.minDelayMs = options.minDelayMs || 2000; // 2s entre requisições (Groq: 30/min)
    this.maxQueueSize = options.maxQueueSize || 1000; // Máximo na fila
    this.requestTimeout = options.requestTimeout || 30000; // Timeout por requisição

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
   * Adiciona requisição à fila
   * @param {Object} task - { id, priority, fn, timeout }
   * @returns {Promise} Resolve com resultado ou rejeita com erro
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

      // Ordena por prioridade (0 = alta, 2 = baixa)
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
   * Processa itens da fila com controle de rate limiting
   */
  async process() {
    if (this.processing || this.queue.length === 0 || this.activeRequests >= this.maxConcurrent) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      // Respeita delay mínimo entre requisições
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

        // Continua processando se houver itens
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
   * Executa task individual com timeout
   */
  async executeTask(queueItem) {
    const { id, fn, timeout, resolve, reject } = queueItem;
    const startTime = Date.now();
    queueItem.startedAt = startTime;

    try {
      // Cria timeout para a tarefa
      const timeoutPromise = new Promise((_, rejectTimeout) =>
        setTimeout(() => {
          const error = new Error(`Task timeout after ${timeout}ms`);
          error.code = 'TASK_TIMEOUT';
          rejectTimeout(error);
        }, timeout)
      );

      // Executa task com timeout
      const result = await Promise.race([fn(), timeoutPromise]);

      queueItem.completedAt = Date.now();
      const processingTime = queueItem.completedAt - startTime;

      // Atualiza estatísticas
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
   * Retorna status atual da fila
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
   * Retorna informações de task específica
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
   * Limpa a fila (útil para testes ou shutdown)
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
   * Configura estatísticas de rate limit baseado no provider
   */
  configureForProvider(provider) {
    // maxConcurrent = quantas requisições processam em paralelo.
    // Claude tem alta capacidade (100k tokens/min) → pode processar várias
    // em paralelo sem delay. Groq tem rate limit baixo → 1 por vez com espaço.
    const configs = {
      groq: { minDelayMs: 2000, maxConcurrent: 1 }, // 30 req/min = 2s entre requests
      deepseek: { minDelayMs: 1000, maxConcurrent: 2 }, // 60 req/min
      claude: { minDelayMs: 0, maxConcurrent: 5 }, // sem delay, paralelo
      gemini: { minDelayMs: 1000, maxConcurrent: 1 }, // conservador
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

// Singleton global
let globalQueue = null;

/**
 * Cria ou retorna instância global da fila
 */
export function getQueue(options = {}) {
  if (!globalQueue) {
    globalQueue = new AIQueue(options);
  }
  return globalQueue;
}

export default AIQueue;
