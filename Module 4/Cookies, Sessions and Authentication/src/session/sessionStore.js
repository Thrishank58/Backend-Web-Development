const crypto = require('crypto');

/**
 * In-memory session store.
 *
 * NOTE FOR PRODUCTION:
 * The supplied in-memory store is suitable for learning and local execution only.
 * In production environments:
 * 1. An in-memory Map cannot scale across multiple load-balanced processes or containers.
 * 2. All active sessions are lost whenever the server process restarts or deploys.
 * 3. Memory leaks can occur without robust background eviction under high traffic.
 * Production requires a shared, expiring store such as Redis or Memcached with
 * native TTL expiration, persistence, and distributed state.
 */
class SessionStore {
  constructor() {
    /** @type {Map<string, { userId: number, expiresAt: Date }>} */
    this.sessions = new Map();
  }

  /**
   * Generates a cryptographically unpredictable, opaque session identifier.
   * Uses 256 bits of cryptographically secure random bytes.
   *
   * @returns {string}
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create and store a new session mapping session ID to { userId, expiresAt }.
   * Can be invoked with:
   * - create(sessionId, { userId, expiresAt })
   * - create(userId, ttlMs)
   *
   * @param {string|number} sessionIdOrUserId
   * @param {object|number} [dataOrTtl]
   * @returns {{ sessionId: string, userId: number, expiresAt: Date }}
   */
  create(sessionIdOrUserId, dataOrTtl) {
    let sessionId;
    let userId;
    let expiresAt;

    if (typeof sessionIdOrUserId === 'string' && typeof dataOrTtl === 'object' && dataOrTtl !== null) {
      sessionId = sessionIdOrUserId;
      userId = dataOrTtl.userId;
      expiresAt = dataOrTtl.expiresAt instanceof Date ? dataOrTtl.expiresAt : new Date(dataOrTtl.expiresAt);
    } else {
      userId = sessionIdOrUserId;
      const ttlMs = typeof dataOrTtl === 'number' ? dataOrTtl : Number(process.env.SESSION_TTL_MS) || 3600000;
      sessionId = this.generateSessionId();
      expiresAt = new Date(Date.now() + ttlMs);
    }

    this.sessions.set(sessionId, { userId, expiresAt });
    return { sessionId, userId, expiresAt };
  }

  /**
   * Resolve a session by its session ID.
   * Lazily checks expiration and removes expired sessions during reads.
   *
   * @param {string} sessionId
   * @returns {{ userId: number, expiresAt: Date } | null}
   */
  get(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Remove expired sessions during reads
    if (Date.now() > session.expiresAt.getTime()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Destroy a session from the store.
   *
   * @param {string} sessionId
   * @returns {boolean}
   */
  destroy(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }
    return this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions from the store (useful for testing).
   */
  clear() {
    this.sessions.clear();
  }
}

const sessionStore = new SessionStore();
sessionStore.SessionStore = SessionStore;

module.exports = sessionStore;
