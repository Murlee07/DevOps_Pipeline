'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/db/memory');

const config = {
  nodeEnv: 'test',
  jwtSecret: 'test-secret-that-is-long-enough-for-hs256-signing',
  jwtExpiresIn: '1h',
  corsOrigin: '*',
  authRateLimit: 1000,
  build: { service: 'shieldboard-backend', version: '1.0.0-test', buildNumber: '42', gitCommit: 'abc1234', environment: 'test' },
};

const silentLogger = { log: () => {}, error: () => {} };

function makeApp() {
  const store = createMemoryStore();
  return { app: createApp({ store, config, logger: silentLogger }), store };
}

async function registerAndLogin(app, email = 'dev@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Dev User', email, password: 'Secur3Pass!' });
  return res.body.token;
}

describe('operational endpoints', () => {
  const { app } = makeApp();

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /ready reports database readiness', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('memory');
  });

  test('GET /ready returns 503 when database is down', async () => {
    const store = createMemoryStore();
    store.ping = async () => {
      throw new Error('down');
    };
    const res = await request(createApp({ store, config, logger: silentLogger })).get('/ready');
    expect(res.status).toBe(503);
  });

  test('GET /api/info exposes build metadata', async () => {
    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ version: '1.0.0-test', buildNumber: '42', gitCommit: 'abc1234' });
    expect(res.body.database.status).toBe('up');
  });

  test('GET /metrics returns prometheus text', async () => {
    await request(app).get('/health');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds_count');
  });

  test('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('unknown route returns 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('malformed JSON returns 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });
});

describe('authentication', () => {
  const { app } = makeApp();

  test('registers a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'Alice@Example.com', password: 'Passw0rd123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice 2', email: 'alice@example.com', password: 'Passw0rd123' });
    expect(res.status).toBe(409);
  });

  test('rejects weak password and invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'Passw0rd123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('rejects wrong password and unknown user identically', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'WrongPass1' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'WrongPass1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  test('login validation errors', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('GET /me requires a valid token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'Passw0rd123' });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.name).toBe('Alice');
  });
});

describe('tasks API', () => {
  const { app } = makeApp();
  let token;
  let otherToken;
  let taskId;

  beforeAll(async () => {
    token = await registerAndLogin(app, 'owner@example.com');
    otherToken = await registerAndLogin(app, 'intruder@example.com');
  });

  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  test('requires authentication', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
  });

  test('creates a task with defaults', async () => {
    const res = await request(app).post('/api/tasks').set(auth()).send({ title: '  Configure Trivy scan  ' });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({ title: 'Configure Trivy scan', status: 'todo', priority: 'medium' });
    expect(res.body.task.userId).toBeUndefined();
    taskId = res.body.task.id;
  });

  test('validates task input', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(auth())
      .send({ title: '', status: 'bogus', priority: 'urgent', dueDate: '19-11-2026', description: 5 });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details)).toEqual(
      expect.arrayContaining(['title', 'status', 'priority', 'dueDate', 'description']),
    );
  });

  test('lists, filters and searches tasks', async () => {
    await request(app)
      .post('/api/tasks')
      .set(auth())
      .send({ title: 'Write Terraform', description: 'EKS module', status: 'in_progress', priority: 'high', dueDate: '2000-01-01' });
    const all = await request(app).get('/api/tasks').set(auth());
    expect(all.body.tasks).toHaveLength(2);
    const filtered = await request(app).get('/api/tasks?status=in_progress').set(auth());
    expect(filtered.body.tasks).toHaveLength(1);
    const searched = await request(app).get('/api/tasks?search=eks').set(auth());
    expect(searched.body.tasks[0].title).toBe('Write Terraform');
    const bad = await request(app).get('/api/tasks?status=invalid').set(auth());
    expect(bad.status).toBe(400);
  });

  test('returns stats', async () => {
    const res = await request(app).get('/api/tasks/stats').set(auth());
    expect(res.body).toEqual({ total: 2, todo: 1, inProgress: 1, done: 0, highPriority: 1, overdue: 1 });
  });

  test('gets and updates a task', async () => {
    const got = await request(app).get(`/api/tasks/${taskId}`).set(auth());
    expect(got.status).toBe(200);
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth())
      .send({ status: 'done', dueDate: null, description: null });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('done');
    expect(res.body.task.dueDate).toBeNull();
  });

  test('rejects empty update', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}`).set(auth()).send({});
    expect(res.status).toBe(400);
  });

  test('isolates tasks between users', async () => {
    expect((await request(app).get(`/api/tasks/${taskId}`).set(auth(otherToken))).status).toBe(404);
    expect((await request(app).patch(`/api/tasks/${taskId}`).set(auth(otherToken)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${taskId}`).set(auth(otherToken))).status).toBe(404);
    const list = await request(app).get('/api/tasks').set(auth(otherToken));
    expect(list.body.tasks).toHaveLength(0);
  });

  test('invalid id returns 404', async () => {
    expect((await request(app).get('/api/tasks/not-a-uuid').set(auth())).status).toBe(404);
  });

  test('deletes a task', async () => {
    expect((await request(app).delete(`/api/tasks/${taskId}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/tasks/${taskId}`).set(auth())).status).toBe(404);
  });
});

describe('error handling', () => {
  test('unexpected errors return a generic 500', async () => {
    const store = createMemoryStore();
    store.taskStats = async () => {
      throw new Error('boom: secret detail');
    };
    const app = createApp({ store, config, logger: silentLogger });
    const reg = await request(app).post('/api/auth/register').send({ name: 'X', email: 'x@example.com', password: 'Passw0rd1' });
    const res = await request(app).get('/api/tasks/stats').set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error.');
  });
});
