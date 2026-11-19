'use strict';

const crypto = require('node:crypto');
const { ConflictError } = require('../utils/errors');

/**
 * In-memory store used for unit tests and quick local runs without PostgreSQL.
 * Implements the same async interface as the PostgreSQL store.
 */
function createMemoryStore() {
  const users = new Map();
  let tasks = [];

  const now = () => new Date().toISOString();
  const clone = (o) => (o ? structuredClone(o) : null);

  return {
    kind: 'memory',

    async migrate() {},
    async ping() {
      return true;
    },
    async close() {},

    async createUser({ name, email, passwordHash }) {
      const normalized = email.toLowerCase();
      for (const u of users.values()) {
        if (u.email === normalized) throw new ConflictError('Email is already registered.');
      }
      const user = { id: crypto.randomUUID(), name, email: normalized, passwordHash, createdAt: now() };
      users.set(user.id, user);
      return clone(user);
    },

    async findUserByEmail(email) {
      const normalized = String(email).toLowerCase();
      for (const u of users.values()) if (u.email === normalized) return clone(u);
      return null;
    },

    async findUserById(id) {
      return clone(users.get(id));
    },

    async listTasks(userId, { status, search } = {}) {
      const q = search ? search.toLowerCase() : null;
      return tasks
        .filter((t) => t.userId === userId)
        .filter((t) => !status || t.status === status)
        .filter((t) => !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone);
    },

    async getTask(userId, id) {
      return clone(tasks.find((t) => t.id === id && t.userId === userId));
    },

    async createTask(userId, data) {
      const ts = now();
      const task = {
        id: crypto.randomUUID(),
        userId,
        title: data.title,
        description: data.description || '',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        dueDate: data.dueDate || null,
        createdAt: ts,
        updatedAt: ts,
      };
      tasks.push(task);
      return clone(task);
    },

    async updateTask(userId, id, data) {
      const task = tasks.find((t) => t.id === id && t.userId === userId);
      if (!task) return null;
      Object.assign(task, data, { updatedAt: now() });
      return clone(task);
    },

    async deleteTask(userId, id) {
      const before = tasks.length;
      tasks = tasks.filter((t) => !(t.id === id && t.userId === userId));
      return tasks.length < before;
    },

    async taskStats(userId) {
      const mine = tasks.filter((t) => t.userId === userId);
      const today = new Date().toISOString().slice(0, 10);
      return {
        total: mine.length,
        todo: mine.filter((t) => t.status === 'todo').length,
        inProgress: mine.filter((t) => t.status === 'in_progress').length,
        done: mine.filter((t) => t.status === 'done').length,
        highPriority: mine.filter((t) => t.priority === 'high' && t.status !== 'done').length,
        overdue: mine.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'done').length,
      };
    },
  };
}

module.exports = { createMemoryStore };
