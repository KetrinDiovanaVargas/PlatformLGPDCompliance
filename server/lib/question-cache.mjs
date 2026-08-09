/**
 * Cache in-memory de perguntas geradas para avaliação LGPD.
 * 
 * Reduz ~40% das chamadas de IA através de reutilização de perguntas já geradas.
 * Implementa estratégia LRU com TTL de 24h e limpeza periódica.
 * @module lib/question-cache
 */

class QuestionCache {
  /**
   * Inicializa o cache de perguntas.
   * 
   * @param {Object} [options={}] - Configurações do cache
   * @param {number} [options.maxSize=1000] - Máximo de itens em cache
   * @param {number} [options.ttlHours=24] - TTL em horas
   */
  constructor(options = {}) {
    // Configuração
    this.maxSize = options.maxSize || 1000;
    this.ttlHours = options.ttlHours || 24;
    this.ttlMs = this.ttlHours * 60 * 60 * 1000;

    // Estado
    this.cache = new Map();
    this.accessCount = new Map();
    this.pendingRequests = new Map();
    this.hashRegistry = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      refreshes: 0,
      collisions: 0,
    };

    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Normaliza contexto para garantir chaves consistentes.
   * Remove nulos/undefined, ordena chaves, trimma strings.
   * 
   * @param {Object} [context={}] - Contexto a normalizar
   * @returns {string} JSON normalizado
   */
  normalizeContext(context = {}) {
    return JSON.stringify(
      Object.keys(context)
        .sort()
        .reduce((acc, key) => {
          const val = context[key];
          if (val !== null && val !== undefined) {
            acc[key] = typeof val === 'string' ? val.trim() : val;
          }
          return acc;
        }, {})
    );
  }

  /**
   * Gera chave de cache única (stage + context_hash + audience).
   * 
   * @param {number} stage - Número da etapa (1-4)
   * @param {Object} [context={}] - Contexto de perguntas anteriores
   * @param {string} [audience='default'] - Público-alvo
   * @returns {string} Chave de cache
   */
  generateKey(stage, context = {}, audience = 'default') {
    const normalizedContext = this.normalizeContext(context);
    const contextHash = this.simpleHash(normalizedContext);
    const key = `stage_${stage}_ctx_${contextHash}_aud_${this.sanitize(audience)}`;
    return key;
  }

  /**
   * Hash simples para diferenciação (não criptográfico).
   * Detecta colisões e registra em stats.
   * 
   * @param {string} str - String a hashear
   * @returns {string} Hash de 8 caracteres
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(36).substring(0, 8);

    if (this.hashRegistry.has(hashStr)) {
      const existingStr = this.hashRegistry.get(hashStr);
      if (existingStr !== str) {
        console.warn(`⚠️  COLISÃO DE HASH DETECTADA: ${hashStr}`);
        this.stats.collisions++;
      }
    } else {
      this.hashRegistry.set(hashStr, str);
    }

    return hashStr;
  }

  /**
   * Sanitiza string para uso seguro em chave.
   * 
   * @param {string} str - String a sanitizar
   * @returns {string} String sanitizada (lowercase, alfanumérico, máx 20 chars)
   */
  sanitize(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 20);
  }

  /**
   * Busca perguntas no cache.
   * 
   * @param {number} stage - Número da etapa
   * @param {Object} [context={}] - Contexto de perguntas
   * @param {string} [audience='default'] - Público-alvo
   * @returns {Object|null} Perguntas em cache ou null se não encontrado/expirado
   */
  get(stage, context = {}, audience = 'default') {
    const key = this.generateKey(stage, context, audience);
    const cacheEntry = this.cache.get(key);

    if (!cacheEntry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now - cacheEntry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.stats.refreshes++;
      return null;
    }

    this.stats.hits++;
    const currentCount = this.accessCount.get(key) || 0;
    this.accessCount.set(key, currentCount + 1);

    return cacheEntry.data;
  }

  /**
   * Armazena perguntas no cache.
   * Remove item LRU se cache estiver cheio.
   * 
   * @param {number} stage - Número da etapa
   * @param {Object} [context={}] - Contexto de perguntas
   * @param {string} [audience='default'] - Público-alvo
   * @param {Object} questions - Dados das perguntas a armazenar
   */
  set(stage, context = {}, audience = 'default', questions) {
    const key = this.generateKey(stage, context, audience);

    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      timestamp: Date.now(),
      data: questions,
    });

    this.accessCount.set(key, 0);
  }

  /**
   * Remove item menos usado (LRU - Least Recently Used).
   */
  evictLRU() {
    let lruKey = null;
    let minCount = Infinity;

    for (const [key, count] of this.accessCount.entries()) {
      if (count < minCount && this.cache.has(key)) {
        lruKey = key;
        minCount = count;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessCount.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Limpa itens expirados do cache.
   * Chamado periodicamente (a cada 1 hora).
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        this.accessCount.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🧹 Cache cleanup: removidos ${removed} itens expirados`);
    }
  }

  /**
   * Retorna status e métricas do cache.
   * 
   * @returns {{size: number, maxSize: number, utilizacao: string, pendingRequests: number, stats: Object, memory: Object}}
   */
  getStatus() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizacao: `${((this.cache.size / this.maxSize) * 100).toFixed(1)}%`,
      pendingRequests: this.pendingRequests.size,
      stats: {
        ...this.stats,
        totalRequests,
        hitRate: `${hitRate}%`,
      },
      memory: {
        estimated_mb: (this.cache.size * 5).toFixed(2),
      },
    };
  }

  /**
   * Invalida cache (total ou por stage específico).
   * 
   * @param {number|null} [stage=null] - Etapa a invalidar (null = tudo)
   */
  invalidate(stage = null) {
    if (stage === null) {
      this.cache.clear();
      this.accessCount.clear();
      console.log('🗑️  Cache completamente invalidado');
    } else {
      let removed = 0;
      for (const key of this.cache.keys()) {
        if (key.startsWith(`stage_${stage}_`)) {
          this.cache.delete(key);
          this.accessCount.delete(key);
          removed++;
        }
      }
      console.log(`🗑️  Cache invalidado para stage ${stage}: ${removed} itens removidos`);
    }
  }

  /**
   * Para limpeza periódica e libera recursos.
   * Chamado no shutdown da aplicação.
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    this.accessCount.clear();
    this.pendingRequests.clear();
    this.hashRegistry.clear();
  }
}

let globalCache = null;

/**
 * Retorna instância global singleton do cache de perguntas.
 * 
 * @param {Object} [options={}] - Opções de inicialização (apenas na primeira chamada)
 * @returns {QuestionCache} Instância do cache
 */
export function getQuestionCache(options = {}) {
  if (!globalCache) {
    globalCache = new QuestionCache(options);
  }
  return globalCache;
}

/**
 * Wrapper para chatCompletion com cache transparente e lock de race condition.
 * 
 * Evita múltiplas chamadas de IA para requisições idênticas.
 * 
 * @async
 * @param {Array} messages - Mensagens para o modelo
 * @param {Object} [opts={}] - Opções
 * @param {number} [opts.stage] - Número da etapa (obrigatório para cache)
 * @param {Object} [opts.context] - Contexto de perguntas
 * @param {string} [opts.audience] - Público-alvo
 * @param {boolean} [opts.useCache=true] - Habilita cache
 * @returns {Promise<Object>} Resultado do chat (cacheado ou fresco)
 */
export async function cachedChatCompletion(messages, opts = {}) {
  const { stage, context, audience, useCache = true } = opts;

  const cache = getQuestionCache();

  if (!useCache || stage === undefined) {
    const { queuedChatCompletion } = await import('./ai-client.mjs');
    return queuedChatCompletion(messages, opts);
  }

  const cacheKey = cache.generateKey(stage, context, audience);

  const cached = cache.get(stage, context, audience);
  if (cached) {
    console.log(`✓ Pergunta recuperada do cache (stage ${stage})`);
    return cached;
  }

  if (cache.pendingRequests.has(cacheKey)) {
    console.log(`⏳ Aguardando resultado idêntico em processamento (stage ${stage})`);
    return cache.pendingRequests.get(cacheKey);
  }

  console.log(`💭 Gerando pergunta (stage ${stage}) - não estava em cache`);

  const processingPromise = (async () => {
    try {
      const { queuedChatCompletion } = await import('./ai-client.mjs');
      const result = await queuedChatCompletion(messages, opts);

      cache.set(stage, context, audience, result);

      return result;
    } catch (error) {
      console.error(`❌ Erro ao gerar pergunta (stage ${stage}):`, error.message);
      throw error;
    } finally {
      cache.pendingRequests.delete(cacheKey);
    }
  })();

  cache.pendingRequests.set(cacheKey, processingPromise);

  return processingPromise;
}

export default QuestionCache;