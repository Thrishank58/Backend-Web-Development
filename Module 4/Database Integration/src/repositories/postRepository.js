const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a raw ID value into a positive integer, or return null when it is not
 * a valid record identifier. This prevents Prisma from throwing on obviously
 * invalid IDs and keeps the repository contract clean.
 */
function safeId(rawId) {
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Translate a Prisma error into a safe application-level error.
 * Database details (constraint names, table names, error codes) are not
 * propagated above the repository boundary.
 */
function translateDatabaseError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 – unique constraint violation (e.g. duplicate vote on same post)
    // P2003 – foreign-key constraint violation (e.g. authorId references no user)
    if (error.code === 'P2002') {
      const appError = new Error('A record with these values already exists');
      appError.statusCode = 409;
      return appError;
    }
    if (error.code === 'P2003') {
      const appError = new Error('Related record does not exist');
      appError.statusCode = 422;
      return appError;
    }
  }

  // Unknown database problem — surface as a generic server error
  const appError = new Error('Unable to complete the database operation');
  appError.statusCode = 500;
  return appError;
}

// ---------------------------------------------------------------------------
// Repository contract
// ---------------------------------------------------------------------------

/**
 * findAll – returns a promise of an array ([] when no rows match).
 */
async function findAll() {
  return prisma.post.findMany({ orderBy: { id: 'asc' } });
}

/**
 * findById – returns a promise of a record or null.
 */
async function findById(id) {
  const parsedId = safeId(id);
  if (parsedId === null) return null;

  return prisma.post.findUnique({ where: { id: parsedId } });
}

/**
 * create – returns a promise of the complete created record.
 * Wraps constraint violations so callers never see Prisma internals.
 */
async function create(fields) {
  try {
    return await prisma.post.create({
      data: {
        title: fields.title,
        body: fields.body ?? '',
        authorId: fields.authorId,
      },
    });
  } catch (error) {
    throw translateDatabaseError(error);
  }
}

/**
 * update – returns a promise of the updated record or null when the ID does
 * not exist.
 */
async function update(id, patch) {
  const parsedId = safeId(id);
  if (parsedId === null) return null;

  const data = {};
  if (patch && patch.title !== undefined) data.title = patch.title;
  if (patch && patch.body !== undefined) data.body = patch.body;

  try {
    return await prisma.post.update({ where: { id: parsedId }, data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      // Record not found — match the in-memory contract: return null.
      return null;
    }
    throw translateDatabaseError(error);
  }
}

/**
 * remove – returns a promise of true when a record is removed and false when
 * no record matches the given ID.
 */
async function remove(id) {
  const parsedId = safeId(id);
  if (parsedId === null) return false;

  try {
    await prisma.post.delete({ where: { id: parsedId } });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return false;
    }
    throw translateDatabaseError(error);
  }
}

module.exports = { findAll, findById, create, update, remove };
