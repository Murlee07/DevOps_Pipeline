'use strict';

const { Pool } = require('pg');
const { ConflictError } = require('../utils/errors');

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(120) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  status      VARCHAR(20)  NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'done')),
  priority    VARCHAR(10)  NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high')),
  due_date    DATE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);
`;

const TASK_COLUMNS = `id, user_id, title, description, status, priority,
  to_char(due_date, 'YYYY-MM-DD') AS due_date, created_at, updated_at`;

const mapUser = (r) =>
  r && { id: r.id, name: r.name, email: r.email, passwordHash: r.password_hash, createdAt: r.created_at };

const mapTask = (r) =>
  r && {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

// Whitelisted mapping from API field -> column. Only these can ever appear in SQL.
const UPDATABLE = { title: 'title', description: 'description', status: 'status', priority: 'priority', dueDate: 'due_date' };

function createPostgresStore(connectionString) {
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000 });

  return {
    kind: 'postgres',

    async migrate() {
      await pool.query(SCHEMA);
    },

    async ping() {
      await pool.query('SELECT 1');
      return true;
    },

    async close() {
      await pool.end();
    },

    async createUser({ name, email, passwordHash }) {
      try {
        const { rows } = await pool.query(
          'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
          [name, email.toLowerCase(), passwordHash],
        );
        return mapUser(rows[0]);
      } catch (err) {
        if (err.code === '23505') throw new ConflictError('Email is already registered.');
        throw err;
      }
    },

    async findUserByEmail(email) {
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()]);
      return mapUser(rows[0]) || null;
    },

    async findUserById(id) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return mapUser(rows[0]) || null;
    },

    async listTasks(userId, { status, search } = {}) {
      const params = [userId];
      let sql = `SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = $1`;
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`;
      }
      sql += ' ORDER BY created_at DESC LIMIT 500';
      const { rows } = await pool.query(sql, params);
      return rows.map(mapTask);
    },

    async getTask(userId, id) {
      const { rows } = await pool.query(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2`, [id, userId]);
      return mapTask(rows[0]) || null;
    },

    async createTask(userId, data) {
      const { rows } = await pool.query(
        `INSERT INTO tasks (user_id, title, description, status, priority, due_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${TASK_COLUMNS}`,
        [userId, data.title, data.description || '', data.status || 'todo', data.priority || 'medium', data.dueDate || null],
      );
      return mapTask(rows[0]);
    },

    async updateTask(userId, id, data) {
      const sets = [];
      const params = [];
      for (const [field, column] of Object.entries(UPDATABLE)) {
        if (data[field] !== undefined) {
          params.push(data[field]);
          sets.push(`${column} = $${params.length}`);
        }
      }
      if (sets.length === 0) return this.getTask(userId, id);
      params.push(id, userId);
      const { rows } = await pool.query(
        `UPDATE tasks SET ${sets.join(', ')}, updated_at = now()
         WHERE id = $${params.length - 1} AND user_id = $${params.length}
         RETURNING ${TASK_COLUMNS}`,
        params,
      );
      return mapTask(rows[0]) || null;
    },

    async deleteTask(userId, id) {
      const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
      return rowCount > 0;
    },

    async taskStats(userId) {
      const { rows } = await pool.query(
        `SELECT
           count(*)::int                                                         AS total,
           count(*) FILTER (WHERE status = 'todo')::int                          AS todo,
           count(*) FILTER (WHERE status = 'in_progress')::int                   AS in_progress,
           count(*) FILTER (WHERE status = 'done')::int                          AS done,
           count(*) FILTER (WHERE priority = 'high' AND status <> 'done')::int   AS high_priority,
           count(*) FILTER (WHERE due_date < CURRENT_DATE AND status <> 'done')::int AS overdue
         FROM tasks WHERE user_id = $1`,
        [userId],
      );
      const r = rows[0];
      return {
        total: r.total,
        todo: r.todo,
        inProgress: r.in_progress,
        done: r.done,
        highPriority: r.high_priority,
        overdue: r.overdue,
      };
    },
  };
}

module.exports = { createPostgresStore };
