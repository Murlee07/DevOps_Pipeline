'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { authRouter } = require('./routes/auth');
const { tasksRouter } = require('./routes/tasks');
const { createMetrics } = require('./middleware/metrics');
const { HttpError } = require('./utils/errors');

function createApp({ store, config, logger = console }) {
  const app = express();
  const metrics = createMetrics();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '100kb' }));
  app.use(metrics.middleware);

  if (config.nodeEnv !== 'test') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        logger.log(
          JSON.stringify({
            level: 'info',
            time: new Date().toISOString(),
            method: req.method,
            path: req.originalUrl.split('?')[0],
            status: res.statusCode,
            durationMs: Date.now() - start,
          }),
        );
      });
      next();
    });
  }

  // ---- Operational endpoints (used by Docker / Kubernetes probes) ----
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/ready', async (_req, res) => {
    try {
      await store.ping();
      res.json({ status: 'ready', database: store.kind });
    } catch {
      res.status(503).json({ status: 'not-ready', database: store.kind });
    }
  });

  app.get('/metrics', (_req, res) => {
    res.type('text/plain; version=0.0.4').send(metrics.render());
  });

  // ---- Public API ----
  app.get('/api/info', async (_req, res) => {
    let database = 'up';
    try {
      await store.ping();
    } catch {
      database = 'down';
    }
    res.json({
      ...config.build,
      database: { kind: store.kind, status: database },
      uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
      node: process.version,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter({ store, config }));
  app.use('/api/tasks', tasksRouter({ store, config }));

  // ---- 404 + error handling ----
  app.use((_req, _res, next) => next(new HttpError(404, 'Route not found.')));

  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large.' });
    }
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) logger.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack }));
    const body = { error: status >= 500 ? 'Internal server error.' : err.message };
    if (err.details) body.details = err.details;
    return res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp };
