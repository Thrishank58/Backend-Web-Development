const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Singleton: reuse the same client across the application process.
// Using global ensures the singleton survives hot-reloads in development.
const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = prisma;
