'use strict';

const jwt = require('jsonwebtoken');
const { HttpError } = require('../utils/errors');

function signToken(user, config) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',
    issuer: 'shieldboard',
  });
}

function requireAuth(config) {
  return (req, _res, next) => {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'Authentication required.'));
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'shieldboard' });
      req.user = { id: payload.sub, email: payload.email, name: payload.name };
      return next();
    } catch {
      return next(new HttpError(401, 'Invalid or expired token.'));
    }
  };
}

module.exports = { signToken, requireAuth };
