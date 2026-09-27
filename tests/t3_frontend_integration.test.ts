import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';

describe('DOGFOOD T3 Frontend-Backend Integration & Regression Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-t3-integration.sqlite');
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore
      }
    }

    initDatabase({ customPath: testDbPath, seed: true });

    app = createApp();
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
        // ignore
      }
    }
  });

  const eventId = 'event_dogfood_2026';
  let roundId: string;
  let candidate1Id: string;
  let submission1Id: string;
  let voterCookie: string = '';

  // Setup: create voting round & auto-populate candidates
  test('0. Setup T3 voting round with candidates', async () => {
    // Organizer creates round
    const resCreate = await fetch(`${baseUrl}/events/${eventId}/voting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        title: 'Community Choice Award',
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-10-15T12:00:00.000Z'
      })
    });
    assert.equal(resCreate.status, 201);
    const dataCreate = await resCreate.json();
    roundId = dataCreate.votingRound.id;

    // Auto-populate candidates from submitted projects
    const resPop = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/candidates/auto-populate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });
    assert.equal(resPop.status, 200);
    const popData = await resPop.json();
    assert.ok(Array.isArray(popData.candidates));
    assert.ok(popData.candidates.length >= 2);
  });

  // 1. Gallery loads
  test('1. Gallery loads (GET /gallery)', async () => {
    const res = await fetch(`${baseUrl}/gallery?event=${eventId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.items));
    assert.ok(data.items.length > 0);
    assert.ok(typeof data.pagination.total === 'number');
    submission1Id = data.items[0].id;
  });

  // 2. Voting status loads
  test('2. Voting status loads (GET /events/:eventId/voting/:roundId/status)', async () => {
    const res = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'draft');
    assert.ok(data.candidateCount >= 2);
  });

  // 3. Ballot loads (after opening)
  test('3. Ballot loads when open (GET /events/:eventId/voting/:roundId/ballot)', async () => {
    // Open the round first
    const resOpen = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/open`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resOpen.status, 200);

    // Fetch ballot anonymously
    const resBallot = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/ballot`);
    assert.equal(resBallot.status, 200);
    const setCookie = resBallot.headers.get('set-cookie');
    assert.ok(setCookie);
    voterCookie = setCookie.split(';')[0];

    const data = await resBallot.json();
    assert.ok(data.ballot);
    assert.ok(Array.isArray(data.ballot.candidates));
    assert.ok(data.ballot.candidates.length >= 2);
    candidate1Id = data.ballot.candidates[0].candidateId;
  });

  // 4. Ballot order rendered without frontend reshuffling
  test('4. Ballot order is deterministic per voter session and backend authoritative', async () => {
    // Request again with the voter cookie
    const resBallot2 = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/ballot`, {
      headers: { Cookie: voterCookie }
    });
    assert.equal(resBallot2.status, 200);
    const data2 = await resBallot2.json();

    // Verify candidate order matches exactly across repeated requests
    assert.equal(data2.ballot.candidates[0].candidateId, candidate1Id);
    // Verify each candidate has an authoritative position assigned by backend (0-indexed)
    data2.ballot.candidates.forEach((cand: any, idx: number) => {
      assert.equal(cand.position, idx);
    });
  });

  // 5. Vote request succeeds (without sending voter_id, role, or judge_id)
  test('5. Vote request succeeds with candidateId only', async () => {
    const resVote = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: voterCookie
      },
      body: JSON.stringify({
        candidateId: candidate1Id
        // Notice: NO voter_id, NO role, NO timestamps, NO judge_id
      })
    });

    assert.equal(resVote.status, 201);
    const data = await resVote.json();
    assert.ok(data.vote);
    assert.ok(data.vote.id);
  });

  // 6. Duplicate vote is handled (409 Conflict)
  test('6. Duplicate vote for same candidate returns 409 Conflict', async () => {
    const resDup = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: voterCookie
      },
      body: JSON.stringify({
        candidateId: candidate1Id
      })
    });

    assert.equal(resDup.status, 409);
    const data = await resDup.json();
    assert.ok(data.error.message.includes('already voted'));
  });

  // 7. Rate-limit error is handled (429 Too Many Requests)
  test('7. Rate-limit handling returns 429 when threshold exceeded', async () => {
    const db = getDatabase();
    const rateLimitToken = 'voter_test_rate_limited_token';
    const tokenHash = crypto.createHash('sha256').update(rateLimitToken).digest('hex');
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / (10 * 60 * 1000)) * (10 * 60 * 1000)).toISOString();

    db.prepare(`
      INSERT INTO voting_rate_limits (id, voting_round_id, action, actor_key_hash, window_started_at, request_count, updated_at)
      VALUES ('vrl_test_flooder', ?, 'vote', ?, ?, 30, ?)
    `).run(roundId, tokenHash, windowStart, new Date().toISOString());

    const resCheck = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': rateLimitToken
      },
      body: JSON.stringify({ candidateId: candidate1Id })
    });

    assert.equal(resCheck.status, 429);
    const checkData = await resCheck.json();
    assert.equal(checkData.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(checkData.error.message.includes('Rate limit exceeded'));
  });

  // 8. Comments load
  test('8. Comments load (GET /events/:eventId/voting/:roundId/submissions/:subId/comments)', async () => {
    const res = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/submissions/${submission1Id}/comments`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.comments));
  });

  // 9. Comment submission works (1-1000 char boundary)
  test('9. Comment submission works within 1-1000 chars and rejects oversized', async () => {
    // Valid comment
    const resValid = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/submissions/${submission1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({
        body: 'Impressive architecture and seamless UX! High marks for design fidelity.'
      })
    });
    assert.equal(resValid.status, 201);
    const validData = await resValid.json();
    assert.ok(validData.comment);
    assert.equal(validData.comment.body, 'Impressive architecture and seamless UX! High marks for design fidelity.');

    // Oversized comment (>1000 characters)
    const longContent = 'A'.repeat(1005);
    const resOver = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/submissions/${submission1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({ body: longContent })
    });
    assert.equal(resOver.status, 400);
  });

  // 10. Unpublished results remain hidden (403 Forbidden)
  test('10. Unpublished results remain strictly hidden during voting_open', async () => {
    const res = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/results`);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.message.includes('hidden'));
  });

  // 11. Published results render
  test('11. Published results render aggregated community counts without judge leaks', async () => {
    // Close voting
    const resClose = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/close`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resClose.status, 200);

    // Results still hidden when closed
    const resHidden = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/results`);
    assert.equal(resHidden.status, 403);

    // Publish results
    const resPublish = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/publish`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resPublish.status, 200);

    // Now results are public
    const resResults = await fetch(`${baseUrl}/events/${eventId}/voting/${roundId}/results`);
    assert.equal(resResults.status, 200);
    const data = await resResults.json();
    assert.ok(Array.isArray(data.results));
    assert.ok(data.results.length >= 1);
    assert.ok(typeof data.results[0].voteCount === 'number');
    assert.ok(typeof data.results[0].rank === 'number');

    // Confirm strict public isolation: NO judge data or normalization data
    const rawText = JSON.stringify(data);
    assert.equal(rawText.includes('judge_scores'), false);
    assert.equal(rawText.includes('zScore'), false);
    assert.equal(rawText.includes('normalizedScore'), false);
    assert.equal(rawText.includes('dogfood_token'), false);
  });

  // 12. Public results never request organizer-only normalization results
  test('12. Normalization results endpoint rejects unauthenticated/public users', async () => {
    const resPublicNorm = await fetch(`${baseUrl}/events/${eventId}/judging/normalization/any-run-id/results`);
    assert.ok([401, 403].includes(resPublicNorm.status));

    // Participant also forbidden
    const resPartNorm = await fetch(`${baseUrl}/events/${eventId}/judging/normalization/any-run-id/results`, {
      headers: { Authorization: 'Bearer dogfood_token_participant' }
    });
    assert.equal(resPartNorm.status, 403);
  });

  // 13. Existing judge pages still work
  test('13. Judge routes and score isolation remain functional', async () => {
    // Judge A accesses assignments
    const resJudgeA = await fetch(`${baseUrl}/judge/assignments`, {
      headers: { Authorization: 'Bearer dogfood_token_judge_a' }
    });
    assert.equal(resJudgeA.status, 200);
    const dataJudgeA = await resJudgeA.json();
    assert.ok(Array.isArray(dataJudgeA.assignments));

    // Peer score access rejected
    const resPeer = await fetch(`${baseUrl}/judge/scores/peer`, {
      headers: { Authorization: 'Bearer dogfood_token_judge_a' }
    });
    assert.equal(resPeer.status, 403);

    // Judge cannot view normalization runs
    const resNorm = await fetch(`${baseUrl}/events/${eventId}/judging/normalization`, {
      headers: { Authorization: 'Bearer dogfood_token_judge_a' }
    });
    assert.equal(resNorm.status, 403);
  });

  // 14. Existing organizer pages still work
  test('14. Organizer pages and CSV export remain functional', async () => {
    // Judging progress
    const resProgress = await fetch(`${baseUrl}/events/${eventId}/judging/progress`, {
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resProgress.status, 200);

    // CSV export
    const resCsv = await fetch(`${baseUrl}/exports/scores.csv?eventId=${eventId}`, {
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resCsv.status, 200);
    const contentType = resCsv.headers.get('content-type');
    assert.ok(contentType?.includes('text/csv'));
    const csvText = await resCsv.text();
    assert.ok(csvText.includes('event,submission'));
  });
});
