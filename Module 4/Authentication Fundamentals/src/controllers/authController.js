const authService = require('../services/authService');

/**
 * Helper to ensure a field is a non-empty string.
 * @param {unknown} val
 * @returns {boolean}
 */
function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Handle user registration request.
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body || {};

    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Name, email, and password must be non-empty strings',
        },
      });
    }

    const user = await authService.register({ name, email, password });
    return res.status(201).json(user);
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({
        error: {
          code: error.code || 'EMAIL_ALREADY_EXISTS',
          message: error.message || 'Email already exists',
        },
      });
    }
    if (error.status === 400) {
      return res.status(400).json({
        error: {
          code: error.code || 'BAD_REQUEST',
          message: error.message,
        },
      });
    }
    next(error);
  }
}

/**
 * Handle user login request.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Email and password must be non-empty strings',
        },
      });
    }

    const user = await authService.login({ email, password });
    return res.status(200).json(user);
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }
    if (error.status === 400) {
      return res.status(400).json({
        error: {
          code: error.code || 'BAD_REQUEST',
          message: error.message,
        },
      });
    }
    next(error);
  }
}

module.exports = {
  register,
  login,
};
