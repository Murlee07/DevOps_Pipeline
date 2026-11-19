'use strict';

const { createMemoryStore } = require('./memory');

function createStore(config) {
  if (config.dbClient === 'postgres') {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is required when DB_CLIENT=postgres');
    // Lazy require so the memory store (tests) does not need the pg driver loaded.
    const { createPostgresStore } = require('./postgres');
    return createPostgresStore(config.databaseUrl);
  }
  return createMemoryStore();
}

module.exports = { createStore };
