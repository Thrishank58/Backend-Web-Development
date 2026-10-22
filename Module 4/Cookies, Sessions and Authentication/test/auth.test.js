const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const sessionStore = require('../src/session/sessionStore');
const prisma = require('../src/db/prisma');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

beforeEach(() => {
  sessionStore.clear();
});

describe('Session Authentication Tests', () => {
  test('POST /auth/login - validates input and rejects missing email/password with 400', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  test('POST /auth/login - returns generic 401 for unknown email', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'Password123!' }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid email or password');
  });

  test('POST /auth/login - returns generic 401 for incorrect password', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@example.com', password: 'WrongPassword!' }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid email or password');
  });

  test('POST /auth/login - successful login creates session, sets signed cookie with required options, and returns safe user fields', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@example.com', password: 'SessionDemo!48' }),
    });

    assert.equal(res.status, 200);
    const user = await res.json();

    // Verify safe user fields only
    assert.equal(typeof user.id, 'number');
    assert.equal(user.name, 'Sam');
    assert.equal(user.email, 'sam@example.com');
    assert.equal(user.passwordHash, undefined);

    // Verify Set-Cookie header
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Set-Cookie header should be present');
    assert.match(setCookie, /sid=s%3A/, 'Cookie should be named sid and be signed with s: prefix');
    assert.match(setCookie, /HttpOnly/i, 'Cookie should have HttpOnly flag');
    assert.match(setCookie, /SameSite=Lax/i, 'Cookie should have SameSite=Lax flag');
    assert.match(setCookie, /Max-Age=/i, 'Cookie should have Max-Age');
  });

  test('GET /auth/me - returns authenticated user identity with valid signed session cookie', async () => {
    // 1. Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@example.com', password: 'SessionDemo!48' }),
    });
    const cookie = loginRes.headers.get('set-cookie');

    // 2. Access /auth/me with cookie
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: cookie },
    });

    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.equal(me.email, 'sam@example.com');
    assert.equal(me.name, 'Sam');
    assert.equal(me.passwordHash, undefined);
  });

  test('GET /auth/me - returns 401 when cookie is omitted', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('GET /auth/me - returns 401 when cookie signature is tampered with', async () => {
    // Login to get a valid cookie
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@example.com', password: 'SessionDemo!48' }),
    });
    const validCookie = loginRes.headers.get('set-cookie');

    // Tamper with the cookie signature
    const tamperedCookie = validCookie.replace(/sid=s%3A([^;]+)/, 'sid=s%3A$1tampered');

    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: tamperedCookie },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('GET /auth/me - returns 401 when session has expired', async () => {
    // Create an expired session manually
    const expiredSessionId = 'expired-session-id-1234567890';
    sessionStore.create(expiredSessionId, {
      userId: 1,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    // Create a valid signed cookie string for expiredSessionId using cookie-signature
    const cookieSignature = require('cookie-signature');
    const signedValue = 's:' + cookieSignature.sign(expiredSessionId, process.env.COOKIE_SECRET);

    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `sid=${encodeURIComponent(signedValue)}` },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');

    // Verify expired session was evicted from store
    assert.equal(sessionStore.get(expiredSessionId), null);
  });

  test('GET /auth/me - returns 401 and evicts orphaned session when user does not exist in db', async () => {
    const orphanedSessionId = 'orphaned-session-id-999999999';
    sessionStore.create(orphanedSessionId, {
      userId: 999999, // Non-existent user id
      expiresAt: new Date(Date.now() + 60000),
    });

    const cookieSignature = require('cookie-signature');
    const signedValue = 's:' + cookieSignature.sign(orphanedSessionId, process.env.COOKIE_SECRET);

    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `sid=${encodeURIComponent(signedValue)}` },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');

    // Verify orphaned session was purged from store
    assert.equal(sessionStore.get(orphanedSessionId), null);
  });

  test('POST /auth/logout - destroys server session, clears cookie, and is idempotent', async () => {
    // 1. Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@example.com', password: 'SessionDemo!48' }),
    });
    const cookie = loginRes.headers.get('set-cookie');

    // 2. Logout
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    assert.equal(logoutRes.status, 204);

    // Verify clearing cookie header
    const clearCookie = logoutRes.headers.get('set-cookie');
    assert.ok(clearCookie, 'Set-Cookie header should be present to clear cookie');
    assert.match(clearCookie, /sid=/, 'Should target sid cookie');
    assert.match(clearCookie, /Expires=Thu, 01 Jan 1970/i, 'Should expire cookie immediately');
    assert.match(clearCookie, /HttpOnly/i, 'Clear cookie should match HttpOnly');
    assert.match(clearCookie, /SameSite=Lax/i, 'Clear cookie should match SameSite=Lax');

    // 3. Verify /auth/me now returns 401 with the old cookie
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(meRes.status, 401);

    // 4. Test idempotence: repeated logout returns 204
    const repeatLogoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    assert.equal(repeatLogoutRes.status, 204);
  });

  test('Secure flag respects COOKIE_SECURE environment variable', async () => {
    const originalSecure = process.env.COOKIE_SECURE;
    try {
      process.env.COOKIE_SECURE = 'true';

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sam@example.com', password: 'SessionDemo!48' }),
      });

      const setCookie = res.headers.get('set-cookie');
      assert.match(setCookie, /Secure/i, 'Cookie should have Secure flag when COOKIE_SECURE=true');
    } finally {
      process.env.COOKIE_SECURE = originalSecure;
    }
  });
});
