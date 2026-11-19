'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { HttpError, ConflictError, asyncHandler } = require('../utils/errors');
const { validateRegister, validateLogin } = require('../utils/validate');
const { signToken, requireAuth } = require('../middleware/auth');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

// Pre-computed hash so login timing is similar whether or not the user exists.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-mitigation', 10);

function authRouter({ store, config }) {
  const router = express.Router();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later.' },
  });

  router.post(
    '/register',
    limiter,
    asyncHandler(async (req, res) => {
      const errors = validateRegister(req.body);
      if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed.', errors);
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      try {
        const user = await store.createUser({
          name: req.body.name.trim(),
          email: req.body.email.trim(),
          passwordHash,
        });
        res.status(201).json({ token: signToken(user, config), user: publicUser(user) });
      } catch (err) {
        if (err instanceof ConflictError) throw new HttpError(409, err.message);
        throw err;
      }
    }),
  );

  router.post(
    '/login',
    limiter,
    asyncHandler(async (req, res) => {
      const errors = validateLogin(req.body);
      if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed.', errors);
      const user = await store.findUserByEmail(req.body.email.trim());
      const ok = await bcrypt.compare(req.body.password, user ? user.passwordHash : DUMMY_HASH);
      if (!user || !ok) throw new HttpError(401, 'Invalid email or password.');
      res.json({ token: signToken(user, config), user: publicUser(user) });
    }),
  );

  router.get(
    '/me',
    requireAuth(config),
    asyncHandler(async (req, res) => {
      const user = await store.findUserById(req.user.id);
      if (!user) throw new HttpError(401, 'User no longer exists.');
      res.json({ user: publicUser(user) });
    }),
  );

  return router;
}

module.exports = { authRouter };
