/**
 * question-cache.mjs
 *
 * Cache de perguntas geradas para reduzir chamadas de IA
 * Reduz ~40% das requisições ao reutilizar perguntas já geradas
 *
 * Estratégia:
 * - Cache por (stage, context_hash, audience)
 * - TTL: 24 horas (regenera perguntas diariamente)
 * - LRU: Remove itens menos usados quando cache fica cheio
 * - In-memory: Rápido, ~100MB para 10k perguntas
 */

class QuestionCache {
  constructor(options = {}) {
    // Configuração
    this.maxSize = options.maxSize || 1000; // Máximo de itens em cache
    this.ttlHours = options.ttlHours || 24; // Tempo de vida em horas
    this.ttlMs = this.ttlHours * 60 * 60 * 1000;

    // Estado
    this.cache = new Map();
    this.accessCount = new Map(); // Para LRU
    this.pendingRequests = new Map(); // FIX #2: Evita race condition
    this.hashRegistry = new Map(); // FIX #3: Detecta colisões de hash
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      refreshes: 0,
      collisions: 0,
    };

    // Inicia limpeza periódica (a cada 1 hora)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Normaliza contexto para garantir chaves consistentes
   * FIX #1: Remove null/undefined, ordena chaves, trimma strings
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
   * Gera chave de cache única
   * FIX #1: Normaliza context antes de hash
   * @param {number} stage - Número da etapa
   * @param {object} context - Contexto (será normalizado e hasheado)
   * @param {string} audience - Público-alvo
   * @returns {string} Chave de cache
   */
  generateKey(stage, context = {}, audience = 'default') {
    const normalizedContext = this.normalizeContext(context);
    const contextHash = this.simpleHash(normalizedContext);
    const key = `stage_${stage}_ctx_${contextHash}_aud_${this.sanitize(audience)}`;
    return key;
  }

  /**
   * Hash simples para context (não criptográfico, apenas para diferenciação)
   * FIX #3: Detecta colisões de hash
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(36).substring(0, 8);

    // Detecta colisão
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
   * Sanitiza string para uso em chave
   */
  sanitize(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 20);
  }

  /**
   * Busca perguntas no cache
   * @param {number} stage
   * @param {object} context
   * @param {string} audience
   * @returns {object|null} Perguntas em cache ou null se não encontrado
   */
  get(stage, context = {}, audience = 'default') {
    const key = this.generateKey(stage, context, audience);
    const cacheEntry = this.cache.get(key);

    if (!cacheEntry) {
      this.stats.misses++;
      return null;
    }

    // Verifica se expirou
    const now = Date.now();
    if (now - cacheEntry.timestamp > this.ttlMs) {
      // Expirou, remove
      this.cache.delete(key);
      this.stats.refreshes++;
      return null;
    }

    // Cache hit! Atualiza contadores de acesso (LRU)
    this.stats.hits++;
    const currentCount = this.accessCount.get(key) || 0;
    this.accessCount.set(key, currentCount + 1);

    return cacheEntry.data;
  }

  /**
   * Armazena perguntas no cache
   * @param {number} stage
   * @param {object} context
   * @param {string} audience
   * @param {object} questions - Dados das perguntas
   */
  set(stage, context = {}, audience = 'default', questions) {
    const key = this.generateKey(stage, context, audience);

    // Se cache está cheio, remove item menos usado (LRU)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // Armazena
    this.cache.set(key, {
      timestamp: Date.now(),
      data: questions,
    });

    // Inicializa contador de acesso
    this.accessCount.set(key, 0);
  }

  /**
   * Remove item menos usado (LRU - Least Recently Used)
   */
  evictLRU() {
    let lruKey = null;
    let minCount = Infinity;

    // Encontra chave com menor count de acesso
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
   * Limpa cache expirado
   * Chamado periodicamente (a cada 1 hora)
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
   * Retorna status do cache
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
        estimated_mb: (this.cache.size * 5).toFixed(2), // ~5KB por entrada
      },
    };
  }

  /**
   * Invalida cache (força regeneração)
   * @param {number} stage - Etapa específica (opcional, limpa tudo se não informado)
   */
  invalidate(stage = null) {
    if (stage === null) {
      // Limpa tudo
      this.cache.clear();
      this.accessCount.clear();
      console.log('🗑️  Cache completamente invalidado');
    } else {
      // Limpa apenas stage específico
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
   * Para limpeza periódica
   * Chamado no shutdown
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    this.accessCount.clear();
    this.pendingRequests.clear();
    this.hashRegistry.clear();
  }
}

// Singleton global
let globalCache = null;

/**
 * Cria ou retorna instância global do cache
 */
export function getQuestionCache(options = {}) {
  if (!globalCache) {
    globalCache = new QuestionCache(options);
  }
  return globalCache;
}

/**
 * Wrapper para usar cache transparentemente com chatCompletion
 * FIX #2: Evita race condition com lock de requisições pendentes
 *
 * Fluxo:
 * 1. Se em cache → retorna imediatamente
 * 2. Se sendo processado → aguarda resultado
 * 3. Se não processado → chama IA e marca como processando
 */
export async function cachedChatCompletion(messages, opts = {}) {
  const { stage, context, audience, useCache = true } = opts;

  const cache = getQuestionCache();

  // Se cache é desabilitado, vai direto para IA
  if (!useCache || stage === undefined) {
    const { queuedChatCompletion } = await import('./ai-client.mjs');
    return queuedChatCompletion(messages, opts);
  }

  const cacheKey = cache.generateKey(stage, context, audience);

  // PASSO 1: Tenta buscar do cache (mais rápido)
  const cached = cache.get(stage, context, audience);
  if (cached) {
    console.log(`✓ Pergunta recuperada do cache (stage ${stage})`);
    return cached;
  }

  // PASSO 2: Verifica se há requisição idêntica sendo processada
  if (cache.pendingRequests.has(cacheKey)) {
    console.log(`⏳ Aguardando resultado idêntico em processamento (stage ${stage})`);
    return cache.pendingRequests.get(cacheKey);
  }

  // PASSO 3: Inicia processamento e marca como pendente
  console.log(`💭 Gerando pergunta (stage ${stage}) - não estava em cache`);

  const processingPromise = (async () => {
    try {
      const { queuedChatCompletion } = await import('./ai-client.mjs');
      const result = await queuedChatCompletion(messages, opts);

      // Armazena no cache
      cache.set(stage, context, audience, result);

      return result;
    } catch (error) {
      console.error(`❌ Erro ao gerar pergunta (stage ${stage}):`, error.message);
      throw error;
    } finally {
      // Remove do mapa de pendentes
      cache.pendingRequests.delete(cacheKey);
    }
  })();

  // Registra como processando
  cache.pendingRequests.set(cacheKey, processingPromise);

  return processingPromise;
}

export default QuestionCache;
