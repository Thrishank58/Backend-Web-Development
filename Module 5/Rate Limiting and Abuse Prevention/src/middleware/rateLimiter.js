'use strict';

const rateLimit = require('express-rate-limit');

/**
 * ============================================================================
 * RATE LIMITING & MULTI-INSTANCE DEPLOYMENT (REDIS STORE)
 * ============================================================================
 *
 * Why Auth Routes Need Stricter Rate Limiting than General Routes:
 * 1. Brute-Force & Credential Stuffing Prevention:
 *    Authentication endpoints (/login, /register, /refresh) are high-value targets.
 *    Without strict limits, attackers can run automated scripts to test millions
 *    of leaked credential pairs or dictionary passwords to compromise accounts.
 * 2. Resource Exhaustion & DoS Mitigation:
 *    Password hashing functions (bcrypt, argon2, scrypt) are deliberately designed
 *    to be computationally expensive and slow to prevent offline cracking.
 *    High volumes of concurrent login requests can quickly saturate server CPU/event
 *    loops, causing Denial of Service for legitimate traffic.
 * 3. Scoped Throttling:
 *    General routes (e.g., GET /products or GET /health) can handle much higher
 *    concurrency and may be cached via CDNs. Auth routes require tight rate limits
 *    (e.g., 5 failed attempts per 15 minutes) to protect identity and user data.
 *
 * Why In-Memory Store Fails Across Multiple Instances Behind a Load Balancer:
 * 1. Siloed Process Memory:
 *    The default `MemoryStore` stores hit counts inside the RAM of each individual
 *    Node.js process. When multiple application instances run behind a reverse proxy
 *    or load balancer (e.g., NGINX, AWS ALB, GCP Cloud Load Balancer, Kubernetes pods),
 *    incoming requests from the same IP are distributed across instances.
 * 2. Multiplied Quota:
 *    If there are N server instances, an attacker's requests will be distributed
 *    across them (e.g., round-robin), allowing up to (N * max) attempts (e.g. 5 instances
 *    * 5 limit = 25 attempts) before being blocked by any single instance.
 * 3. Ephemeral State:
 *    In cloud containerized environments, instances frequently scale up/down or restart
 *    during deployments. Process restarts immediately wipe in-memory counters, resetting
 *    the rate limit window and allowing attackers fresh attempts.
 *
 * How a Redis-Backed Store (rate-limit-redis) Replaces In-Memory Store:
 * 1. Shared Centralized State:
 *    Instead of storing counters in local process memory, `rate-limit-redis` uses
 *    a shared Redis server or cluster. Every Node.js instance connects to the same
 *    Redis instance.
 * 2. Atomic Operations & TTL:
 *    `rate-limit-redis` executes atomic Redis operations (via Lua scripts or INCR + EXPIRE)
 *    keyed by the client identifier (e.g., IP address). When instance A increments the
 *    counter for an IP, instance B immediately sees the updated count on subsequent requests.
 * 3. Implementation Example:
 *    ```javascript
 *    const { RedisStore } = require('rate-limit-redis');
 *    const { createClient } = require('redis');
 *
 *    const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
 *    redisClient.connect().catch(console.error);
 *
 *    const authLimiter = rateLimit({
 *      windowMs: 15 * 60 * 1000,
 *      max: 5,
 *      standardHeaders: true,
 *      legacyHeaders: false,
 *      skipSuccessfulRequests: true,
 *      store: new RedisStore({
 *        sendCommand: (...args) => redisClient.sendCommand(args),
 *      }),
 *      // handler / message configuration...
 *    });
 *    ```
 */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  standardHeaders: true, // Draft-6/Draft-7 RateLimit-* headers and Retry-After on 429
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skipSuccessfulRequests: true, // Only failed requests count against the limit
  handler: (req, res, _next, options) => {
    // Ensure Retry-After header is present and expressed in seconds until reset
    const retryAfterSeconds = req.rateLimit?.resetTime
      ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
      : Math.ceil(options.windowMs / 1000);

    res.setHeader('Retry-After', Math.max(retryAfterSeconds, 1).toString());
    res.status(options.statusCode || 429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later.',
      },
    });
  },
});

module.exports = authLimiter;
