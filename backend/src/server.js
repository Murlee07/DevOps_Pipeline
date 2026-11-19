'use strict';

const config = require('./config');
const { createStore } = require('./db');
const { createApp } = require('./app');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectWithRetry(store, attempts = 30, delayMs = 2000) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await store.migrate();
      return;
    } catch (err) {
      console.warn(`[db] not ready (attempt ${i}/${attempts}): ${err.message}`);
      if (i === attempts) throw err;
      await sleep(delayMs);
    }
  }
}

async function main() {
  const store = createStore(config);
  await connectWithRetry(store);
  console.log(`[db] connected using "${store.kind}" store`);

  const app = createApp({ store, config });
  const server = app.listen(config.port, () => {
    console.log(
      `[api] ShieldBoard API v${config.build.version} (build ${config.build.buildNumber}) listening on :${config.port}`,
    );
  });

  const shutdown = (signal) => {
    console.log(`[api] ${signal} received, shutting down gracefully`);
    server.close(async () => {
      await store.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[api] fatal startup error:', err);
  process.exit(1);
});
