'use strict';

const crypto = require('node:crypto');
const { handleEvent } = require('./eventHandlers');

const _processedIds = new Set();

/**
 * Verifies the `sha256=<hex>` HMAC-SHA256 signature against the raw Buffer body
 * using constant-time comparison.
 */
function verifySignature(rawBody, sigHeader, secret) {
  if (typeof sigHeader !== 'string' || !sigHeader.startsWith('sha256=')) {
    return false;
  }

  const receivedHex = sigHeader.slice('sha256='.length);
  if (!/^[0-9a-f]+$/i.test(receivedHex) || receivedHex.length % 2 !== 0) {
    return false;
  }

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const receivedBuf = Buffer.from(receivedHex, 'hex');

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Handles incoming POST /webhooks requests:
 * 1. Verifies HMAC-SHA256 signature over raw Buffer body.
 * 2. Parses JSON payload after verification.
 * 3. Checks event.id idempotency store and skips duplicates.
 * 4. Marks event.id as processed, returns 200 fast, and dispatches handleEvent via setImmediate.
 */
async function handleWebhook(req, res) {
  const sigHeader = req.headers['x-webhook-signature'];
  if (typeof sigHeader !== 'string' || !sigHeader.startsWith('sha256=')) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ error: 'Expected raw JSON payload' });
  }

  const secret = process.env.WEBHOOK_SECRET || 'testsecret';
  if (!verifySignature(req.body, sigHeader, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  if (!event || event.id === undefined || event.id === null || event.id === '') {
    return res.status(400).json({ error: 'Missing event id' });
  }

  if (_processedIds.has(event.id)) {
    return res.status(200).json({ status: 'already_processed' });
  }

  _processedIds.add(event.id);
  res.status(200).json({ status: 'received' });

  setImmediate(() => {
    Promise.resolve(handleEvent(event)).catch((err) => {
      console.error('[webhookHandler] Error processing event:', err);
    });
  });
}

module.exports = { handleWebhook, _processedIds };
