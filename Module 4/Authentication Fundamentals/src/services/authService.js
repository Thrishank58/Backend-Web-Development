const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const { serializeUser } = require('../serializers/userSerializer');

// Standard dummy hash used for timing attack mitigation when user is not found
const DUMMY_HASH = '$2a$12$e8I5Gy3Jj7tK6.0qG2q4O.0w0l0c/kR1e4W3v2u1t0s9r8q7p6o5n';

/**
 * Consistently normalize email address by trimming whitespace and converting to lowercase.
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Register a new user with bcrypt-hashed password.
 *
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ id: number, name: string, email: string }>}
 */
async function register({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    const error = new Error('Email already registered');
    error.status = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  const saltRounds = Number(process.env.BCRYPT_COST) || 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const newUser = await userRepository.createUser({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return serializeUser(newUser);
}

/**
 * Verify credentials and authenticate user.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ id: number, name: string, email: string }>}
 */
async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  const user = await userRepository.findByEmail(normalizedEmail);

  if (!user) {
    // Perform dummy compare to mitigate timing discrepancies
    await bcrypt.compare(password, DUMMY_HASH);
    const error = new Error('Invalid email or password');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  return serializeUser(user);
}

module.exports = {
  normalizeEmail,
  register,
  login,
};
