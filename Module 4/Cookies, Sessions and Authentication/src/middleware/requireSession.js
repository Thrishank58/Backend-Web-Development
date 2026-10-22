const { COOKIE_NAME } = require('../config/cookie');
const sessionStore = require('../session/sessionStore');
const userRepository = require('../repositories/userRepository');
const { serializeUser } = require('../serializers/userSerializer');

/**
 * Middleware that authenticates requests using signed session cookies.
 *
 * Verifies that:
 * 1. The signed cookie `sid` exists and signature is intact.
 * 2. The session exists in the server-side session store and is not expired.
 * 3. The associated user exists in the database (detects orphaned sessions).
 *
 * Rejects missing, invalid, expired, or orphaned sessions with a generic 401 JSON response.
 */
module.exports = async function requireSession(req, res, next) {
  try {
    const sessionId = req.signedCookies ? req.signedCookies[COOKIE_NAME] : null;

    // Cookie missing or failed signature verification (cookie-parser sets unsigned value to false when tampering detected)
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Resolve server session (sessionStore.get evicts expired sessions automatically)
    const session = sessionStore.get(sessionId);
    if (!session) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Fetch user from repository
    const user = await userRepository.findById(session.userId);
    if (!user) {
      // Clean up orphaned session from store
      sessionStore.destroy(sessionId);
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Attach safe user identity to the request
    req.user = serializeUser(user);
    req.sessionId = sessionId;
    return next();
  } catch (error) {
    return next(error);
  }
};
