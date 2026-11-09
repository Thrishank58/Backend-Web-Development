require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

// Central error-handling middleware
app.use((error, req, res, next) => {
  // Handle malformed JSON requests
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Malformed JSON payload' },
    });
  }

  const status = error.status || error.statusCode || 500;
  if (status >= 400 && status < 500) {
    return res.status(status).json({
      error: {
        code: error.code || 'BAD_REQUEST',
        message: error.message,
      },
    });
  }

  // Controlled 500 output without exposing raw Prisma or bcrypt details
  console.error('Unhandled error:', error.message);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});

const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`API listening on ${port}`));
}

module.exports = app;
