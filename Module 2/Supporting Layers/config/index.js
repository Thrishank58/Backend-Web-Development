const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  maxArticles: Number(process.env.MAX_ARTICLES) || 50,
};

module.exports = config;