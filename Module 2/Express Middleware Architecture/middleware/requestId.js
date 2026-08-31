/**
 * requestId middleware  [mount GLOBALLY in app.js]
 *
 * Generates a unique request ID for every request,
 * attaches it to req.id, and sends it in the response header.
 */

const { randomUUID } = require('crypto');

module.exports = function requestId(req, res, next) {
  const id = randomUUID();

  req.id = id;

  res.setHeader('X-Request-Id', id);

  next();
};