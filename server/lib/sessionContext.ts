/**
 * Gerenciador de contexto de sessão para avaliações LGPD.
 * 
 * Rastreia e gerencia sessões ativas com suporte a TTL, metadata dinâmica
 * e limpeza automática de sessões expiradas.
 * @module lib/session-context-manager
 */

/**
 * Dados de uma sessão de avaliação.
 * @typedef {Object} SessionData
 * @property {string} userId - ID do usuário/respondente
 * @property {string} sessionId - Identificador único da sessão
 * @property {string} [assessmentId] - ID do questionário (opcional)
 * @property {Date} startedAt - Timestamp de início da sessão
 * @property {Date} lastActivityAt - Timestamp da última atividade
 * @property {Record<string, unknown>} metadata - Dados customizados da sessão
 */
interface SessionData {
  userId: string;
  sessionId: string;
  assessmentId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Resumo de uma sessão de avaliação.
 * @typedef {Object} SessionSummary
 * @property {string} sessionId - Identificador da sessão
 * @property {string} userId - ID do respondente
 * @property {number} durationMs - Duração da sessão em milissegundos
 * @property {Date} lastActivityAt - Timestamp da última atividade
 */
interface SessionSummary {
  sessionId: string;
  userId: string;
  durationMs: number;
  lastActivityAt: Date;
}

/**
 * Gerenciador de contexto e ciclo de vida de sessões.
 * 
 * Mantém sessões ativas em memória com suporte a TTL automático,
 * metadata dinâmica e queries por usuário.
 */
export class SessionContextManager {
  /**
   * Store de sessões ativas.
   * @private
   * @type {Map<string, SessionData>}
   */
  private sessions = new Map<string, SessionData>();

  /**
   * TTL em milissegundos.
   * @private
   * @type {number}
   */
  private readonly ttlMs: number;

  /**
   * Inicializa o gerenciador de sessões.
   * 
   * @param {number} [ttlMinutes=60] - Tempo de vida das sessões em minutos
   */
  constructor(ttlMinutes = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Cria nova sessão.
   * 
   * @param {string} userId - ID do usuário
   * @param {string} sessionId - ID da sessão
   * @param {string} [assessmentId] - ID do questionário (opcional)
   * @returns {SessionData} Dados da sessão criada
   * 
   * @example
   * const session = manager.create('user_123', 'sess_456');
   */
  create(userId: string, sessionId: string, assessmentId?: string): SessionData {
    const now = new Date();
    const session: SessionData = {
      userId,
      sessionId,
      assessmentId,
      startedAt: now,
      lastActivityAt: now,
      metadata: {},
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Recupera sessão ativa por ID.
   * 
   * @param {string} sessionId - ID da sessão
   * @returns {SessionData|null} Dados da sessão ou null se expirada/não encontrada
   */
  get(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) return null;

    if (this.isExpired(session)) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Atualiza timestamp de última atividade (renova TTL).
   * 
   * @param {string} sessionId - ID da sessão
   * @returns {boolean} true se renovado com sucesso, false se sessão não existe/expirou
   */
  touch(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || this.isExpired(session)) return false;

    session.lastActivityAt = new Date();
    return true;
  }

  /**
   * Define valor de metadata da sessão.
   * 
   * @param {string} sessionId - ID da sessão
   * @param {string} key - Chave de metadata
   * @param {unknown} value - Valor a armazenar
   * @returns {boolean} true se definido com sucesso, false se sessão não existe/expirou
   */
  setMeta(sessionId: string, key: string, value: unknown): boolean {
    const session = this.get(sessionId);
    if (!session) return false;

    session.metadata[key] = value;
    session.lastActivityAt = new Date();
    return true;
  }

  /**
   * Recupera valor de metadata da sessão com type casting.
   * 
   * @template T - Tipo esperado do valor
   * @param {string} sessionId - ID da sessão
   * @param {string} key - Chave de metadata
   * @returns {T|null} Valor tipado ou null se não encontrado
   * 
   * @example
   * const score = manager.getMeta<number>(sessionId, 'score');
   */
  getMeta<T = unknown>(sessionId: string, key: string): T | null {
    const session = this.get(sessionId);
    if (!session) return null;
    return (session.metadata[key] as T) ?? null;
  }

  /**
   * Destrói sessão (remove do store).
   * 
   * @param {string} sessionId - ID da sessão
   * @returns {boolean} true se removido, false se não encontrado
   */
  destroy(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Lista sessões ativas de um usuário.
   * 
   * @param {string} userId - ID do usuário
   * @returns {SessionSummary[]} Array de resumos das sessões ativas
   */
  listByUser(userId: string): SessionSummary[] {
    const now = Date.now();
    const result: SessionSummary[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId !== userId) continue;
      if (this.isExpired(session)) continue;

      result.push({
        sessionId: session.sessionId,
        userId: session.userId,
        durationMs: now - session.startedAt.getTime(),
        lastActivityAt: session.lastActivityAt,
      });
    }

    return result;
  }

  /**
   * Remove todas as sessões expiradas.
   * 
   * @returns {number} Quantidade de sessões removidas
   */
  purgeExpired(): number {
    let removed = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Verifica se sessão expirou pelo TTL.
   * @private
   * @param {SessionData} session - Sessão a verificar
   * @returns {boolean} true se expirada
   */
  private isExpired(session: SessionData): boolean {
    return Date.now() - session.lastActivityAt.getTime() > this.ttlMs;
  }
}

/**
 * Instância singleton do gerenciador de sessões.
 * @type {SessionContextManager}
 */
export const sessionContextManager = new SessionContextManager();