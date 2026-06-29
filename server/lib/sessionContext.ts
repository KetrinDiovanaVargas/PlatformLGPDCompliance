interface SessionData {
  userId: string;
  sessionId: string;
  assessmentId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  metadata: Record<string, unknown>;
}

interface SessionSummary {
  sessionId: string;
  userId: string;
  durationMs: number;
  lastActivityAt: Date;
}

export class SessionContextManager {
  private sessions = new Map<string, SessionData>();
  private readonly ttlMs: number;

  constructor(ttlMinutes = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

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

  get(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) return null;

    if (this.isExpired(session)) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  touch(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || this.isExpired(session)) return false;

    session.lastActivityAt = new Date();
    return true;
  }

  setMeta(sessionId: string, key: string, value: unknown): boolean {
    const session = this.get(sessionId);
    if (!session) return false;

    session.metadata[key] = value;
    session.lastActivityAt = new Date();
    return true;
  }

  getMeta<T = unknown>(sessionId: string, key: string): T | null {
    const session = this.get(sessionId);
    if (!session) return null;
    return (session.metadata[key] as T) ?? null;
  }

  destroy(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

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

  private isExpired(session: SessionData): boolean {
    return Date.now() - session.lastActivityAt.getTime() > this.ttlMs;
  }
}

export const sessionContextManager = new SessionContextManager();
