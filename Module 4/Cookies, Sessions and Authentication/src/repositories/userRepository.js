const prisma = require('../db/prisma');

/**
 * Find a user by their unique email address.
 * Keeps Prisma database queries contained behind repository functions.
 *
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
 * Keeps Prisma database queries contained behind repository functions.
 *
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
  });
}

module.exports = {
  findByEmail,
  findById,
};
