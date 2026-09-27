import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express, { Request, Response } from 'express';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';
import { AuthService } from '../src/backend/modules/auth/authService';
import { hashSessionToken } from '../src/backend/utils/crypto';
import { authenticate, requireAuth, requireRole, extractCookie } from '../src/backend/middleware/auth';
import { SEED_USERS } from '../src/backend/database/seed';

describe('DOGFOOD Authentication & Session Foundation Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-auth.sqlite');
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    // Clean any previous test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore
      }
    }

    // Initialize database and apply migrations + seed fixtures
    initDatabase({ customPath: testDbPath, seed: true });

    app = createApp((testApp) => {
      // Add dedicated test routes for role-guard verification
      testApp.get('/test/protected', requireAuth, (_req: Request, res: Response) => {
        res.status(200).json({ status: 'authenticated' });
      });

      testApp.get('/test/organizer-only', requireRole('organizer'), (req: Request, res: Response) => {
        res.status(200).json({ status: 'organizer-granted', user: req.user });
      });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
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

  // 1. User records can be seeded
  test('1. User records can be seeded', () => {
    const db = getDatabase();
    const count = db.prepare('SELECT count(*) as total FROM users').get() as { total: number };
    assert.equal(count.total >= 5, true, 'At least 5 seed users must be present');

    for (const seed of SEED_USERS) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(seed.id) as
        | { id: string; email: string; role: string; password_hash: string }
        | undefined;
      assert.ok(user, `User ${seed.id} should be seeded`);
      assert.equal(user.email, seed.email);
      assert.equal(user.role, seed.role);
      assert.ok(user.password_hash.includes(':'), 'Password hash must be salted format');
    }
  });

  // 2. Password authentication succeeds with correct credentials
  test('2. Password authentication succeeds with correct credentials', () => {
    const user = AuthService.authenticateCredentials('organizer@dogfood.local', 'OrganizerPassword123!');
    assert.ok(user, 'Authentication should succeed for valid credentials');
    assert.equal(user.email, 'organizer@dogfood.local');
    assert.equal(user.role, 'organizer');
    assert.equal(user.id, 'usr_organizer_001');
    assert.equal('password_hash' in user, false, 'AuthUser must never expose password hash');
  });

  // 3. Incorrect password is rejected
  test('3. Incorrect password is rejected', () => {
    const wrongPass = AuthService.authenticateCredentials('organizer@dogfood.local', 'WrongPassword999!');
    assert.equal(wrongPass, null, 'Authentication must fail with incorrect password');

    const unknownUser = AuthService.authenticateCredentials('nonexistent@dogfood.local', 'AnyPassword!');
    assert.equal(unknownUser, null, 'Authentication must fail for unknown email');
  });

  // 4. Login creates a server-side session
  let createdRawToken = '';
  test('4. Login creates a server-side session', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'organizer@dogfood.local',
        password: 'OrganizerPassword123!'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, 'organizer@dogfood.local');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Set-Cookie header must be returned');
    assert.ok(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert.ok(setCookie.includes('SameSite=Lax'), 'Cookie must have SameSite=Lax');

    const token = extractCookie(setCookie, 'session');
    assert.ok(token, 'Session token must be present in cookie');
    assert.equal(token.length >= 64, true, 'Raw token must have sufficient entropy');
    createdRawToken = token;

    // Verify session row exists in database
    const db = getDatabase();
    const tokenHash = hashSessionToken(token);
    const sessionRow = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash) as
      | { id: string; user_id: string; token_hash: string }
      | undefined;
    assert.ok(sessionRow, 'Session must exist in database matching the token hash');
    assert.equal(sessionRow.user_id, 'usr_organizer_001');
  });

  // 5. Raw session token is NOT stored in SQLite
  test('5. Raw session token is NOT stored in SQLite', () => {
    assert.ok(createdRawToken, 'Must have a created token from previous test');
    const db = getDatabase();

    // Query using the raw token directly
    const directMatch = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(createdRawToken);
    assert.equal(directMatch, undefined, 'Raw session token must NOT match any stored token_hash');

    // Query all stored token_hashes and verify none match rawToken
    const allSessions = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
    for (const sess of allSessions) {
      assert.notEqual(sess.token_hash, createdRawToken, 'Stored token_hash must never equal the raw token');
    }
  });

  // 6. Authenticated request resolves the correct user
  test('6. Authenticated request resolves the correct user', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Cookie: `session=${createdRawToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.id, 'usr_organizer_001');
    assert.equal(body.user.email, 'organizer@dogfood.local');
    assert.equal(body.user.role, 'organizer');
  });

  // 7. Expired session is rejected
  test('7. Expired session is rejected', async () => {
    const db = getDatabase();
    const expiredRawToken = 'test_expired_token_1234567890abcdef1234567890abcdef';
    const expiredHash = hashSessionToken(expiredRawToken);
    const pastDate = '2020-01-01T00:00:00.000Z';

    db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('sess_expired_test', 'usr_organizer_001', expiredHash, pastDate, pastDate);

    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Cookie: `session=${expiredRawToken}`
      }
    });

    assert.equal(res.status, 401, 'Expired session must return 401 Unauthorized');
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  // 8. Logout invalidates the session
  test('8. Logout invalidates the session', async () => {
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `session=${createdRawToken}`
      }
    });

    assert.equal(logoutRes.status, 200);
    const clearCookie = logoutRes.headers.get('set-cookie');
    assert.ok(clearCookie, 'Set-Cookie must be returned to clear the cookie');
    assert.ok(clearCookie.includes('Expires=Thu, 01 Jan 1970'), 'Cookie must be expired');

    // Subsequent request must fail with 401
    const verifyRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Cookie: `session=${createdRawToken}`
      }
    });
    assert.equal(verifyRes.status, 401, 'Invalidated session must return 401');

    // SQLite row must be deleted
    const db = getDatabase();
    const tokenHash = hashSessionToken(createdRawToken);
    const sessionRow = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
    assert.equal(sessionRow, undefined, 'Session row must be removed from SQLite');
  });

  // 9. requireAuth rejects unauthenticated access
  test('9. requireAuth rejects unauthenticated access', async () => {
    const res = await fetch(`${baseUrl}/test/protected`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  // 10. requireRole rejects the wrong role
  test('10. requireRole rejects the wrong role', async () => {
    // Authenticate as participant using deterministic seed token
    const res = await fetch(`${baseUrl}/test/organizer-only`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status, 403, 'Participant requesting organizer endpoint must receive 403 Forbidden');
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // 11. requireRole allows the correct role
  test('11. requireRole allows the correct role', async () => {
    // Authenticate as organizer using deterministic seed token
    const res = await fetch(`${baseUrl}/test/organizer-only`, {
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });

    assert.equal(res.status, 200, 'Organizer requesting organizer endpoint must receive 200 OK');
    const body = await res.json();
    assert.equal(body.status, 'organizer-granted');
    assert.equal(body.user.role, 'organizer');
  });

  // 12. Checker-style authentication works using the configured authentication mechanism
  test('12. Checker-style authentication works using the configured authentication mechanism', async () => {
    // Judge A
    const resJudgeA = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_a'
      }
    });
    assert.equal(resJudgeA.status, 200);
    const bodyJudgeA = await resJudgeA.json();
    assert.equal(bodyJudgeA.user.id, 'usr_judge_a_001');
    assert.equal(bodyJudgeA.user.role, 'judge');

    // Judge B
    const resJudgeB = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_b'
      }
    });
    assert.equal(resJudgeB.status, 200);
    const bodyJudgeB = await resJudgeB.json();
    assert.equal(bodyJudgeB.user.id, 'usr_judge_b_001');
    assert.equal(bodyJudgeB.user.role, 'judge');

    // Participant
    const resParticipant = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });
    assert.equal(resParticipant.status, 200);
    const bodyParticipant = await resParticipant.json();
    assert.equal(bodyParticipant.user.id, 'usr_participant_001');
    assert.equal(bodyParticipant.user.role, 'participant');

    // Organizer
    const resOrganizer = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });
    assert.equal(resOrganizer.status, 200);
    const bodyOrganizer = await resOrganizer.json();
    assert.equal(bodyOrganizer.user.id, 'usr_organizer_001');
    assert.equal(bodyOrganizer.user.role, 'organizer');
  });

  // 13. Public registration creates participant role
  test('13. Public registration creates participant role', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Participant',
        email: 'participant_reg@test.local',
        password: 'ValidPassword123!'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.user);
    assert.equal(body.user.role, 'participant');
    assert.equal(body.user.email, 'participant_reg@test.local');
    assert.ok(body.token);

    // Verify session works with returned cookie/token
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${body.token}` }
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.user.role, 'participant');
  });

  // 14. Public request attempting to specify organizer role cannot create organizer
  test('14. Public request attempting to specify organizer role cannot create organizer', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Organizer',
        email: 'exploit_org@test.local',
        password: 'ValidPassword123!',
        role: 'organizer' // Attempt privileged role injection
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'participant', 'Server must unconditionally assign participant role');
    assert.notEqual(body.user.role, 'organizer');

    // Confirm in database
    const db = getDatabase();
    const userInDb = db.prepare('SELECT role FROM users WHERE email = ?').get('exploit_org@test.local') as { role: string };
    assert.equal(userInDb.role, 'participant');
  });

  // 15. Public request attempting to specify judge role cannot create judge
  test('15. Public request attempting to specify judge role cannot create judge', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Judge',
        email: 'exploit_judge@test.local',
        password: 'ValidPassword123!',
        role: 'judge' // Attempt judge role injection
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'participant');
    assert.notEqual(body.user.role, 'judge');
  });

  // 16. Public request attempting to specify admin role cannot create admin
  test('16. Public request attempting to specify admin role cannot create admin', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Admin',
        email: 'exploit_admin@test.local',
        password: 'ValidPassword123!',
        role: 'admin' // Attempt admin role injection
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'participant');
    assert.notEqual(body.user.role, 'admin');
  });

  // 17. Existing authorized privileged users remain functional
  test('17. Existing authorized privileged users remain functional', async () => {
    // Organizer login
    const orgLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'organizer@dogfood.local',
        password: 'OrganizerPassword123!'
      })
    });
    assert.equal(orgLogin.status, 200);
    const orgBody = await orgLogin.json();
    assert.equal(orgBody.user.role, 'organizer');

    // Admin login
    const adminLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@dogfood.local',
        password: 'AdminPassword123!'
      })
    });
    assert.equal(adminLogin.status, 200);
    const adminBody = await adminLogin.json();
    assert.equal(adminBody.user.role, 'admin');

    // Judge Alice login
    const judgeLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'judge_a@dogfood.local',
        password: 'JudgeAPassword123!'
      })
    });
    assert.equal(judgeLogin.status, 200);
    const judgeBody = await judgeLogin.json();
    assert.equal(judgeBody.user.role, 'judge');
  });

  // 18. Duplicate registration with same email is rejected
  test('18. Duplicate registration with same email is rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Hacker',
        email: 'participant_reg@test.local',
        password: 'ValidPassword123!'
      })
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'CONFLICT');
  });

  // 19. Short password is rejected
  test('19. Short password is rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Pass User',
        email: 'shortpass@test.local',
        password: 'short'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });
});
