'use strict';

const crypto = require('node:crypto');
const pkg = require('../package.json');

const nodeEnv = process.env.NODE_ENV || 'development';

function resolveJwtSecret() {
  if (process.env.JWT_SECRET) {
    if (nodeEnv === 'production' && process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    return process.env.JWT_SECRET;
  }
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  // Development / test only: a random per-process secret (tokens reset on restart).
  return crypto.randomBytes(32).toString('hex');
}

const config = {
  nodeEnv,
  port: Number.parseInt(process.env.PORT || '5000', 10),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  databaseUrl: process.env.DATABASE_URL || '',
  dbClient: process.env.DB_CLIENT || (process.env.DATABASE_URL ? 'postgres' : 'memory'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  authRateLimit: Number.parseInt(process.env.AUTH_RATE_LIMIT || '20', 10),
  build: {
    service: 'shieldboard-backend',
    version: process.env.APP_VERSION || pkg.version,
    buildNumber: process.env.BUILD_NUMBER || 'local',
    gitCommit: process.env.GIT_COMMIT || 'unknown',
    environment: process.env.DEPLOY_ENV || 'local',
  },
};

module.exports = config;
