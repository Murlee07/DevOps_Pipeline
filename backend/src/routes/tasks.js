'use strict';

const express = require('express');
const { HttpError, asyncHandler } = require('../utils/errors');
const { validateTask, STATUSES } = require('../utils/validate');
const { requireAuth } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toPublic = ({ userId: _userId, ...task }) => task;

function tasksRouter({ store, config }) {
  const router = express.Router();
  router.use(requireAuth(config));

  router.param('id', (_req, _res, next, id) => {
    if (!UUID_RE.test(id)) return next(new HttpError(404, 'Task not found.'));
    return next();
  });

  router.get(
    '/stats',
    asyncHandler(async (req, res) => {
      res.json(await store.taskStats(req.user.id));
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { status } = req.query;
      const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
      if (status !== undefined && !STATUSES.includes(status)) {
        throw new HttpError(400, `Status filter must be one of: ${STATUSES.join(', ')}.`);
      }
      const tasks = await store.listTasks(req.user.id, { status, search: search || undefined });
      res.json({ tasks: tasks.map(toPublic) });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { errors, value } = validateTask(req.body);
      if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed.', errors);
      const task = await store.createTask(req.user.id, value);
      res.status(201).json({ task: toPublic(task) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const task = await store.getTask(req.user.id, req.params.id);
      if (!task) throw new HttpError(404, 'Task not found.');
      res.json({ task: toPublic(task) });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const { errors, value } = validateTask(req.body, { partial: true });
      if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed.', errors);
      const task = await store.updateTask(req.user.id, req.params.id, value);
      if (!task) throw new HttpError(404, 'Task not found.');
      res.json({ task: toPublic(task) });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const deleted = await store.deleteTask(req.user.id, req.params.id);
      if (!deleted) throw new HttpError(404, 'Task not found.');
      res.status(204).end();
    }),
  );

  return router;
}

module.exports = { tasksRouter };
