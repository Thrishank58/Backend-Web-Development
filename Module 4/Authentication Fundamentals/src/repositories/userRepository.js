const prisma = require('../db/prisma');

/**
 * Find a user by their unique email address.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
  });
}

/**
 * Find a user by their ID.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
  });
}

/**
 * Create a new user record.
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.email
 * @param {string} data.passwordHash
 * @returns {Promise<object>}
 */
async function createUser({ name, email, passwordHash }) {
  try {
    return await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const conflictError = new Error('Email already registered');
      conflictError.status = 409;
      conflictError.code = 'EMAIL_ALREADY_EXISTS';
      throw conflictError;
    }
    throw error;
  }
}

module.exports = {
  findByEmail,
  findById,
  createUser,
};
