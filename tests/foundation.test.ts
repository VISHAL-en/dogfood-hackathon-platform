import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';

describe('DOGFOOD Foundation Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-foundation.sqlite');

  after(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
        const walPath = `${testDbPath}-wal`;
        const shmPath = `${testDbPath}-shm`;
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      } catch {
        // ignore cleanup error
      }
    }
  });

  test('Database initializes with foreign_keys and WAL mode enabled', () => {
    const db = initDatabase(testDbPath);
    assert.ok(db, 'Database instance should exist');

    const fkPragma = db.pragma('foreign_keys', { simple: true });
    assert.equal(fkPragma, 1, 'foreign_keys should be enabled (1)');

    const journalMode = db.pragma('journal_mode', { simple: true });
    assert.equal(journalMode, 'wal', 'journal_mode should be WAL');

    const testQuery = db.prepare('SELECT 1 as alive').get() as { alive: number };
    assert.equal(testQuery.alive, 1, 'SELECT 1 should return alive: 1');
  });

  test('GET /health returns 200 and healthy JSON response', async () => {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as { port: number };

    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/health`);
      assert.equal(res.status, 200, 'Health endpoint should return 200');

      const body = await res.json();
      assert.equal(body.status, 'ok', 'Status should be ok');
      assert.equal(body.database.connected, true, 'Database should be connected');
      assert.ok(body.timestamp, 'Timestamp should be present');
      assert.ok(typeof body.uptimeSeconds === 'number', 'Uptime should be numeric');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('GET /api/unknown-route returns 404 with structured error', async () => {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as { port: number };

    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/api/unknown-route`);
      assert.equal(res.status, 404, 'Unknown API route should return 404');

      const body = await res.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
