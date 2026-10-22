const COOKIE_NAME = 'sid';

/**
 * Returns centralized session cookie options for login.
 *
 * Requirements:
 * - httpOnly: true so browser JavaScript cannot read the cookie.
 * - sameSite: 'lax' to reduce cross-site sending while preserving normal navigation.
 * - secure: true in production so the cookie travels only over HTTPS. Permit false for local HTTP testing.
 * - maxAge: deliberate expiration based on SESSION_TTL_MS.
 * - signed: true using COOKIE_SECRET.
 * - path: '/' to ensure cookie applies to all routes and clearing cannot drift.
 *
 * @returns {import('express').CookieOptions}
 */
function getSessionCookieOptions() {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const ttlMs = Number(process.env.SESSION_TTL_MS) || 3600000;

  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: ttlMs,
    signed: true,
    path: '/',
  };
}

/**
 * Returns centralized cookie clearing options for logout.
 * Keeps cookie configuration centralized so login and logout cannot drift.
 *
 * @returns {import('express').CookieOptions}
 */
function getClearCookieOptions() {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    signed: true,
    path: '/',
  };
}

module.exports = {
  COOKIE_NAME,
  getSessionCookieOptions,
  getClearCookieOptions,
};
