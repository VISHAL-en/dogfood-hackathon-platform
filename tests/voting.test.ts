import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';

describe('DOGFOOD T3 Community Voting & Anti-Abuse Backend Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-voting.sqlite');
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore cleanup error
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
        // ignore cleanup error
      }
    }
  });

  let testRoundId: string;
  let candidate1Id: string;
  let candidate2Id: string;
  let submission1Id: string;
  let submission2Id: string;

  // ==========================================================================
  // 1. RBAC & VOTING ROUND CREATION
  // ==========================================================================

  test('1.1 Participant or Judge cannot create voting round (RBAC)', async () => {
    // Participant
    const resParticipant = await fetch(`${baseUrl}/events/event_dogfood_2026/voting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({})
    });
    assert.equal(resParticipant.status, 403);

    // Judge
    const resJudge = await fetch(`${baseUrl}/events/event_dogfood_2026/voting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_a'
      },
      body: JSON.stringify({})
    });
    assert.equal(resJudge.status, 403);

    // Anonymous
    const resAnon = await fetch(`${baseUrl}/events/event_dogfood_2026/voting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(resAnon.status, 401);
  });

  test('1.2 Organizer can create voting round in draft status', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-10-15T12:00:00.000Z'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.votingRound);
    assert.equal(data.votingRound.eventId, 'event_dogfood_2026');
    assert.equal(data.votingRound.status, 'draft');
    assert.equal(data.votingRound.candidateCount, 0);
    testRoundId = data.votingRound.id;
  });

  test('1.3 Only one active voting round allowed per event', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({})
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.message.includes('active voting round already exists'));
  });

  // ==========================================================================
  // 2. CANDIDATE INTEGRITY & CONFIGURATION
  // ==========================================================================

  test('2.1 Cannot add draft or nonexistent submission as voting candidate', async () => {
    const db = getDatabase();
    // Insert a draft submission to test rejection
    db.prepare(`
      INSERT INTO teams (id, event_id, name, slug, created_by, created_at, updated_at)
      VALUES ('team_draft_test', 'event_dogfood_2026', 'Draft Team', 'draft-team', 'usr_participant_001', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO submissions (
        id, event_id, team_id, title, slug, short_description, description, status, created_at, updated_at
      ) VALUES (
        'sub_draft_test', 'event_dogfood_2026', 'team_draft_test', 'Draft Project', 'draft-proj', 'Short', 'Desc', 'draft', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
      )
    `).run();

    // Draft submission rejected
    const resDraft = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({ submissionIds: ['sub_draft_test'] })
    });
    assert.equal(resDraft.status, 400);
    const dataDraft = await resDraft.json();
    assert.ok(dataDraft.error.message.includes('Only submitted projects'));

    // Nonexistent submission rejected
    const resNonexistent = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({ submissionIds: ['sub_does_not_exist'] })
    });
    assert.equal(resNonexistent.status, 404);
  });

  test('2.2 Candidate must belong to the voting round event', async () => {
    const db = getDatabase();
    // Insert a submitted project in a different event
    db.prepare(`
      INSERT INTO teams (id, event_id, name, slug, created_by, created_at, updated_at)
      VALUES ('team_other_event', 'event_closed_fixture', 'Other Team', 'other-team', 'usr_participant_001', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO submissions (
        id, event_id, team_id, title, slug, short_description, description, status, submitted_at, created_at, updated_at
      ) VALUES (
        'sub_other_event', 'event_closed_fixture', 'team_other_event', 'Other Event Proj', 'other-proj', 'Short', 'Desc', 'submitted', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
      )
    `).run();

    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({ submissionIds: ['sub_other_event'] })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.message.includes('does not belong to the event'));
  });

  test('2.3 Organizer can auto-populate candidates and duplicate candidates are rejected', async () => {
    const resAuto = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/candidates/auto-populate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });

    assert.equal(resAuto.status, 200);
    const dataAuto = await resAuto.json();
    assert.ok(dataAuto.candidates.length >= 2);
    candidate1Id = dataAuto.candidates[0].id;
    candidate2Id = dataAuto.candidates[1].id;
    submission1Id = dataAuto.candidates[0].submissionId;
    submission2Id = dataAuto.candidates[1].submissionId;

    // Trying to re-add an already added candidate returns 409 CONFLICT
    const resDup = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({ submissionIds: [submission1Id] })
    });
    assert.equal(resDup.status, 409);
  });

  // ==========================================================================
  // 3. VOTING LIFECYCLE & STRICT TRANSITIONS
  // ==========================================================================

  test('3.1 Invalid lifecycle transitions are rejected', async () => {
    // Cannot close voting while in draft
    const resClose = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/close`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resClose.status, 400);

    // Cannot publish results while in draft
    const resPublish = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/publish`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resPublish.status, 400);
  });

  test('3.2 Votes and ballots cannot be processed while round is in draft', async () => {
    // Ballot request returns 400
    const resBallot = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/ballot`, {
      headers: { 'X-Voter-Token': 'voter_token_draft_test' }
    });
    assert.equal(resBallot.status, 400);

    // Vote request returns 400
    const resVote = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': 'voter_token_draft_test'
      },
      body: JSON.stringify({ candidateId: candidate1Id })
    });
    assert.equal(resVote.status, 400);
  });

  test('3.3 Results are strictly hidden (HTTP 403) before publication', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/results`);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.message.includes('hidden until'));
  });

  test('3.4 Organizer opens voting round (draft -> voting_open)', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/open`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.votingRound.status, 'voting_open');

    // Public status reflects voting_open
    const resStatus = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/status`);
    assert.equal(resStatus.status, 200);
    const statusData = await resStatus.json();
    assert.equal(statusData.status, 'voting_open');
    assert.ok(statusData.candidateCount >= 2);
  });

  // ==========================================================================
  // 4. RANDOMIZED BALLOT & POSITION BIAS MITIGATION
  // ==========================================================================

  test('4.1 Ballot generation: unique positions, valid permutation, and stability', async () => {
    const voterToken1 = 'voter_token_user_alpha';

    // First fetch creates the ballot
    const res1 = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/ballot`, {
      headers: { 'X-Voter-Token': voterToken1 }
    });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.ok(data1.ballot);
    assert.ok(data1.ballot.candidates.length >= 2);

    const candidates = data1.ballot.candidates;
    const positions = candidates.map((c: any) => c.position);
    const candidateIds = candidates.map((c: any) => c.candidateId);

    // Assert unique positions: 0, 1, ..., N-1
    const positionSet = new Set(positions);
    assert.equal(positionSet.size, candidates.length);
    for (let i = 0; i < candidates.length; i++) {
      assert.ok(positionSet.has(i), `Position ${i} must exist`);
    }

    // Assert each candidate appears exactly once
    const idSet = new Set(candidateIds);
    assert.equal(idSet.size, candidates.length);

    // Second fetch by same voter returns identical stable order
    const res2 = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/ballot`, {
      headers: { 'X-Voter-Token': voterToken1 }
    });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    const candidateIds2 = data2.ballot.candidates.map((c: any) => c.candidateId);

    assert.deepEqual(candidateIds, candidateIds2, 'Ballot candidate order must persist stably for the same voter');
  });

  test('4.2 Anonymous voter receives automatic cookie token and ballot', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/ballot`);
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Server must set voter_token cookie for anonymous visitor');
    assert.ok(setCookie.includes('voter_token='), 'Cookie must contain voter_token');
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');

    const data = await res.json();
    assert.ok(data.voterToken, 'Response should provide generated token');
  });

  // ==========================================================================
  // 5. VOTE SUBMISSION & DUPLICATE PREVENTION
  // ==========================================================================

  test('5.1 Voter can cast a valid vote for a project', async () => {
    const voterToken = 'voter_token_alice_duplicate_test';
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': voterToken
      },
      body: JSON.stringify({ candidateId: candidate1Id })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.vote);
    assert.equal(data.vote.candidateId, candidate1Id);
    assert.equal(data.vote.votingRoundId, testRoundId);
  });

  test('5.2 Duplicate vote for the same project is rejected (409 Conflict) and audited', async () => {
    const voterToken = 'voter_token_alice_duplicate_test';
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': voterToken
      },
      body: JSON.stringify({ candidateId: candidate1Id })
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.error.code, 'CONFLICT');
    assert.ok(data.error.message.includes('already voted'));

    // Check that duplicate_vote_rejected was recorded in the audit log
    const db = getDatabase();
    const audit = db.prepare(`
      SELECT action, target_type, target_id FROM voting_audit_log
      WHERE voting_round_id = ? AND action = 'duplicate_vote_rejected'
    `).get(testRoundId) as any;
    assert.ok(audit);
    assert.equal(audit.action, 'duplicate_vote_rejected');
    assert.equal(audit.target_id, candidate1Id);
  });

  test('5.3 Voter can vote for a different project in the same round (multi-vote ballot)', async () => {
    const voterToken = 'voter_token_alice_duplicate_test';
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': voterToken
      },
      body: JSON.stringify({ candidateId: candidate2Id })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.vote);
    assert.equal(data.vote.candidateId, candidate2Id);
  });

  // ==========================================================================
  // 6. PERSISTENT RATE LIMITING (30 VOTES / 10 MIN, 10 COMMENTS / 10 MIN)
  // ==========================================================================

  test('6.1 Vote rate limiting triggers HTTP 429 when limit exceeded', async () => {
    const rateLimitToken = 'voter_token_flooder';
    const db = getDatabase();

    // Fast-forward rate limit counter for this voter to 30
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / (10 * 60 * 1000)) * (10 * 60 * 1000)).toISOString();
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(rateLimitToken).digest('hex');

    db.prepare(`
      INSERT INTO voting_rate_limits (id, voting_round_id, action, actor_key_hash, window_started_at, request_count, updated_at)
      VALUES ('vrl_test_flooder', ?, 'vote', ?, ?, 30, ?)
    `).run(testRoundId, tokenHash, windowStart, new Date().toISOString());

    // Next vote request must be rejected with 429
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': rateLimitToken
      },
      body: JSON.stringify({ candidateId: candidate1Id })
    });

    assert.equal(res.status, 429);
    const data = await res.json();
    assert.equal(data.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(data.error.message.includes('Rate limit exceeded'));

    // Check vote_rate_limited audit log
    const audit = db.prepare(`
      SELECT action FROM voting_audit_log
      WHERE voting_round_id = ? AND action = 'vote_rate_limited'
    `).get(testRoundId) as any;
    assert.ok(audit);
  });

  // ==========================================================================
  // 7. COMMUNITY COMMENTS & MODERATION
  // ==========================================================================

  let testCommentId: string;

  test('7.1 Community comment creation and public display', async () => {
    const voterToken = 'voter_token_commenter_01';
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/submissions/${submission1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': voterToken
      },
      body: JSON.stringify({
        authorDisplayName: 'Community Fan',
        body: 'Incredible demo! Great architecture.'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.comment);
    assert.equal(data.comment.status, 'visible');
    assert.equal(data.comment.body, 'Incredible demo! Great architecture.');
    testCommentId = data.comment.id;

    // Public comments endpoint returns this comment
    const resGet = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/submissions/${submission1Id}/comments`);
    assert.equal(resGet.status, 200);
    const getData = await resGet.json();
    assert.ok(getData.comments.some((c: any) => c.id === testCommentId));
  });

  test('7.2 Oversized comments (>1000 chars) are rejected', async () => {
    const voterToken = 'voter_token_commenter_02';
    const oversizedBody = 'x'.repeat(1001);

    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/submissions/${submission1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': voterToken
      },
      body: JSON.stringify({
        authorDisplayName: 'Verbose Voter',
        body: oversizedBody
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.message.includes('cannot exceed 1000 characters'));
  });

  test('7.3 Comment rate limit (10 per 10m) triggers HTTP 429', async () => {
    const rateLimitToken = 'voter_token_comment_flooder';
    const db = getDatabase();
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / (10 * 60 * 1000)) * (10 * 60 * 1000)).toISOString();
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(rateLimitToken).digest('hex');

    db.prepare(`
      INSERT INTO voting_rate_limits (id, voting_round_id, action, actor_key_hash, window_started_at, request_count, updated_at)
      VALUES ('vrl_test_comment_flooder', ?, 'comment', ?, ?, 10, ?)
    `).run(testRoundId, tokenHash, windowStart, new Date().toISOString());

    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/submissions/${submission1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': rateLimitToken
      },
      body: JSON.stringify({
        body: 'Spam comment'
      })
    });

    assert.equal(res.status, 429);
    const data = await res.json();
    assert.equal(data.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  test('7.4 Comment moderation: participant cannot hide comment, organizer can hide', async () => {
    // Participant attempt rejected
    const resParticipant = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/comments/${testCommentId}/hide`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_participant' }
    });
    assert.equal(resParticipant.status, 403);

    // Organizer attempt succeeds
    const resOrganizer = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/comments/${testCommentId}/hide`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resOrganizer.status, 200);
    const data = await resOrganizer.json();
    assert.equal(data.comment.status, 'hidden');

    // Hidden comment no longer appears in public comments query
    const resGet = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/submissions/${submission1Id}/comments`);
    assert.equal(resGet.status, 200);
    const getData = await resGet.json();
    assert.ok(!getData.comments.some((c: any) => c.id === testCommentId));
  });

  test('7.5 Deleted comments are excluded from public results', async () => {
    // Create new comment as authenticated user
    const resCreate = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/submissions/${submission1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant',
        'X-Voter-Token': 'voter_token_part_author'
      },
      body: JSON.stringify({ body: 'I want to delete this later' })
    });
    assert.equal(resCreate.status, 201);
    const newComment = (await resCreate.json()).comment;

    // Participant author deletes their own comment
    const resDelete = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/comments/${newComment.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer dogfood_token_participant' }
    });
    assert.equal(resDelete.status, 200);

    // Verify comment is not in public listing
    const resGet = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/submissions/${submission1Id}/comments`);
    const getData = await resGet.json();
    assert.ok(!getData.comments.some((c: any) => c.id === newComment.id));
  });

  // ==========================================================================
  // 8. RESULTS ISOLATION & PUBLICATION
  // ==========================================================================

  test('8.1 Results remain hidden after voting is closed', async () => {
    // Close voting
    const resClose = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/close`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resClose.status, 200);
    assert.equal((await resClose.json()).votingRound.status, 'voting_closed');

    // New votes are rejected now that voting is closed
    const resVoteAfterClose = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voter-Token': 'voter_token_late'
      },
      body: JSON.stringify({ candidateId: candidate1Id })
    });
    assert.equal(resVoteAfterClose.status, 400);

    // Results are STILL hidden (HTTP 403) while voting_closed
    const resResults = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/results`);
    assert.equal(resResults.status, 403);
  });

  test('8.2 Publishing results makes aggregated community results public with ZERO judge leaks', async () => {
    // Publish results
    const resPublish = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/publish`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resPublish.status, 200);
    assert.equal((await resPublish.json()).votingRound.status, 'results_published');

    // Results are now public
    const resResults = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/results`);
    assert.equal(resResults.status, 200);
    const data = await resResults.json();

    assert.equal(data.votingRoundId, testRoundId);
    assert.equal(data.eventId, 'event_dogfood_2026');
    assert.ok(data.resultsPublishedAt);
    assert.ok(Array.isArray(data.results));
    assert.ok(data.results.length >= 2);
    assert.ok(data.totalVotes >= 2);

    // Verify community aggregate result shape
    const topResult = data.results[0];
    assert.ok(topResult.submissionId);
    assert.ok(topResult.title);
    assert.ok(topResult.teamName);
    assert.ok(typeof topResult.voteCount === 'number');
    assert.equal(topResult.rank, 1);

    // CRITICAL SECURITY & ISOLATION CHECK:
    // Verify results NEVER contain judge scores, judge identities, z-scores, normalization data
    const rawResultString = JSON.stringify(data);
    assert.ok(!rawResultString.includes('zscore') && !rawResultString.includes('zScore'), 'Must not contain z-scores');
    assert.ok(!rawResultString.includes('judge_id') && !rawResultString.includes('judgeId'), 'Must not contain judge IDs');
    assert.ok(!rawResultString.includes('rubric'), 'Must not contain rubric info');
    assert.ok(!rawResultString.includes('raw_score') && !rawResultString.includes('rawScore'), 'Must not contain judge scores');
    assert.ok(!rawResultString.includes('proofHash'), 'Must not contain normalization proof hashes');
  });

  test('8.3 Audit log inspection is restricted to organizer and admin', async () => {
    // Participant rejected
    const resParticipant = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/audit`, {
      headers: { Authorization: 'Bearer dogfood_token_participant' }
    });
    assert.equal(resParticipant.status, 403);

    // Judge rejected
    const resJudge = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/audit`, {
      headers: { Authorization: 'Bearer dogfood_token_judge_a' }
    });
    assert.equal(resJudge.status, 403);

    // Organizer succeeds
    const resOrganizer = await fetch(`${baseUrl}/events/event_dogfood_2026/voting/${testRoundId}/audit`, {
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(resOrganizer.status, 200);
    const data = await resOrganizer.json();
    assert.ok(Array.isArray(data.auditLogs));
    assert.ok(data.auditLogs.length > 0);

    const actions = data.auditLogs.map((l: any) => l.action);
    assert.ok(actions.includes('voting_round_created'));
    assert.ok(actions.includes('voting_round_opened'));
    assert.ok(actions.includes('ballot_created'));
    assert.ok(actions.includes('vote_cast'));
    assert.ok(actions.includes('voting_round_closed'));
    assert.ok(actions.includes('results_published'));
  });

  // ==========================================================================
  // 9. ACCEPTANCE REGRESSION CHECKS
  // ==========================================================================

  test('9.1 Acceptance regression: GET /gallery returns 200', async () => {
    const res = await fetch(`${baseUrl}/gallery`);
    assert.equal(res.status, 200);
  });

  test('9.2 Acceptance regression: Judge A /judge/scores returns 200', async () => {
    const res = await fetch(`${baseUrl}/judge/scores`, {
      headers: { Authorization: 'Bearer dogfood_token_judge_a' }
    });
    assert.equal(res.status, 200);
  });

  test('9.3 Acceptance regression: Judge B /judge/scores/peer returns 403', async () => {
    const res = await fetch(`${baseUrl}/judge/scores/peer`, {
      headers: { Authorization: 'Bearer dogfood_token_judge_b' }
    });
    assert.equal(res.status, 403);
  });

  test('9.4 Acceptance regression: Participant /judge/scores returns 403', async () => {
    const res = await fetch(`${baseUrl}/judge/scores`, {
      headers: { Authorization: 'Bearer dogfood_token_participant' }
    });
    assert.equal(res.status, 403);
  });

  test('9.5 Acceptance regression: Organizer /exports/scores.csv returns 200 with CSV header', async () => {
    const res = await fetch(`${baseUrl}/exports/scores.csv?eventId=event_dogfood_2026`, {
      headers: { Authorization: 'Bearer dogfood_token_organizer' }
    });
    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType?.includes('text/csv'));
    const body = await res.text();
    assert.ok(body.includes('event,submission'));
  });
});
