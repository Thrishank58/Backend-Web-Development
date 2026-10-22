const express = require('express');
const bcrypt = require('bcryptjs');
const { COOKIE_NAME, getSessionCookieOptions, getClearCookieOptions } = require('../config/cookie');
const sessionStore = require('../session/sessionStore');
const userRepository = require('../repositories/userRepository');
const { serializeUser } = require('../serializers/userSerializer');
const requireSession = require('../middleware/requireSession');

const router = express.Router();

// Constant dummy hash for constant-time comparison when email is not found (mitigates timing enumeration)
const DUMMY_HASH = '$2a$10$e8I5Gy3Jj7tK6.0qG2q4O.0w0l0c/kR1e4W3v2u1t0s9r8q7p6o5n';

/**
 * Helper to validate non-empty string.
 * @param {unknown} val
 * @returns {boolean}
 */
function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * POST /auth/login
 * Validates credentials, creates a server session, sets signed `sid` cookie,
 * and returns safe user fields.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Email and password are required and must be non-empty strings',
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      // Run dummy compare to mitigate user enumeration through timing differences
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Invalidate previous session if one exists in signed cookie
    const oldSessionId = req.signedCookies ? req.signedCookies[COOKIE_NAME] : null;
    if (oldSessionId && typeof oldSessionId === 'string') {
      sessionStore.destroy(oldSessionId);
    }

    // Create new unpredictable opaque session in store
    const ttlMs = Number(process.env.SESSION_TTL_MS) || 3600000;
    const session = sessionStore.create(user.id, ttlMs);

    // Set signed cookie with centralized options
    res.cookie(COOKIE_NAME, session.sessionId, getSessionCookieOptions());

    // Return safe user fields only
    return res.status(200).json(serializeUser(user));
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /auth/me
 * Protected endpoint returning safe user identity resolved from the signed session.
 */
router.get('/me', requireSession, async (req, res) => {
  return res.status(200).json(req.user);
});

/**
 * POST /auth/logout
 * Destroys server-side session and clears client cookie.
 * Idempotent: returns 204 even if no active session existed.
 */
router.post('/logout', (req, res, next) => {
  try {
    const sessionId = req.signedCookies ? req.signedCookies[COOKIE_NAME] : null;

    if (sessionId && typeof sessionId === 'string') {
      sessionStore.destroy(sessionId);
    }

    res.clearCookie(COOKIE_NAME, getClearCookieOptions());
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
