import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';
import { EventService } from '../src/backend/modules/events/eventService';

describe('DOGFOOD Regression Lifecycle: Submissions, Persistence, Assignment & Judging Isolation', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-regression-lifecycle.sqlite');
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  let testEvent: any;
  let team1Id: string;
  let team2Id: string;
  let testSubmissionId: string;
  let testAssignmentId: string;
  let team2DraftSubId: string;

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

    // Setup dedicated event for regression tests
    testEvent = EventService.createEvent('usr_organizer_001', {
      name: 'Lifecycle Regression Hackathon',
      slug: 'lifecycle-regression-hackathon',
      description: 'Dedicated hackathon event for full regression lifecycle verification.',
      status: 'registration_open',
      registrationStart: '2026-09-01T00:00:00.000Z',
      registrationEnd: '2026-10-01T00:00:00.000Z',
      submissionDeadline: '2026-10-05T23:59:59.000Z',
      judgingStart: '2026-10-06T00:00:00.000Z',
      judgingEnd: '2026-10-10T23:59:59.000Z',
      resultsPublishAt: '2026-10-12T12:00:00.000Z'
    });

    // Setup Team 1 for Participant 1
    const resTeam1 = await fetch(`${baseUrl}/events/${testEvent.id}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({
        name: 'Regression Team Alpha',
        slug: 'regression-team-alpha'
      })
    });
    assert.equal(resTeam1.status, 201);
    const bodyTeam1 = await resTeam1.json();
    team1Id = bodyTeam1.team.id;

    // Setup Team 2 for Participant 2
    const resTeam2 = await fetch(`${baseUrl}/events/${testEvent.id}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_2'
      },
      body: JSON.stringify({
        name: 'Regression Team Beta',
        slug: 'regression-team-beta'
      })
    });
    assert.equal(resTeam2.status, 201);
    const bodyTeam2 = await resTeam2.json();
    team2Id = bodyTeam2.team.id;
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

  // 1. Participant creates a draft
  test('1. Participant creates a draft', async () => {
    const res = await fetch(`${baseUrl}/events/${testEvent.id}/teams/${team1Id}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({
        title: 'CodeGuard Sentinel',
        slug: 'codeguard-sentinel',
        shortDescription: 'Developer security tool for hackathons.',
        description: 'Comprehensive static checks and validation pipeline for hackathon code.',
        repoUrl: 'https://github.com/dogfood/codeguard',
        status: 'draft'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.submission);
    assert.equal(body.submission.title, 'CodeGuard Sentinel');
    assert.equal(body.submission.status, 'draft');
    assert.equal(body.submission.submittedAt, null);
    testSubmissionId = body.submission.id;
  });

  // 2. Draft is persisted
  test('2. Draft is persisted', async () => {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(testSubmissionId) as any;
    assert.ok(row, 'Draft row must exist in SQLite database');
    assert.equal(row.title, 'CodeGuard Sentinel');
    assert.equal(row.status, 'draft');
    assert.equal(row.team_id, team1Id);
    assert.equal(row.event_id, testEvent.id);
    assert.equal(row.submitted_at, null);
  });

  // 3. Participant updates draft
  test('3. Participant updates draft', async () => {
    const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({
        title: 'CodeGuard Sentinel Advanced',
        shortDescription: 'Updated developer security and verification tool.',
        description: 'CodeGuard provides a simple automated workflow for reviewing project readiness.'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.submission.title, 'CodeGuard Sentinel Advanced');
    assert.equal(body.submission.status, 'draft');

    // Confirm update in database
    const db = getDatabase();
    const row = db.prepare('SELECT title, status FROM submissions WHERE id = ?').get(testSubmissionId) as any;
    assert.equal(row.title, 'CodeGuard Sentinel Advanced');
    assert.equal(row.status, 'draft');
  });

  // 4. Participant submits project
  test('4. Participant submits project', async () => {
    const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}/submit`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.submission.status, 'submitted');
    assert.ok(body.submission.submittedAt, 'submittedAt timestamp must be recorded');
  });

  // 5. Submitted project remains persisted
  test('5. Submitted project remains persisted', async () => {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(testSubmissionId) as any;
    assert.ok(row, 'Submitted row must remain in SQLite');
    assert.equal(row.status, 'submitted');
    assert.ok(row.submitted_at);
    assert.equal(row.title, 'CodeGuard Sentinel Advanced');
  });

  // 6. Submitted project is retrievable by its owning team/captain
  test('6. Submitted project is retrievable by its owning team/captain', async () => {
    const res = await fetch(`${baseUrl}/events/${testEvent.id}/teams/${team1Id}/submission`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.submission);
    assert.equal(body.submission.id, testSubmissionId);
    assert.equal(body.submission.title, 'CodeGuard Sentinel Advanced');
    assert.equal(body.submission.status, 'submitted');
  });

  // 7. Project does not disappear after navigation/reload
  test('7. Project does not disappear after navigation/reload', async () => {
    // Simulate multiple reloads using event ID
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/events/${testEvent.id}/teams/${team1Id}/submission`, {
        headers: {
          Authorization: 'Bearer dogfood_token_participant'
        }
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.submission.id, testSubmissionId);
      assert.equal(body.submission.status, 'submitted');
    }

    // Simulate navigation using event slug
    const slugRes = await fetch(`${baseUrl}/events/${testEvent.slug}/teams/${team1Id}/submission`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });
    assert.equal(slugRes.status, 200);
    const slugBody = await slugRes.json();
    assert.equal(slugBody.submission.id, testSubmissionId);
    assert.equal(slugBody.submission.status, 'submitted');
  });

  // 8. One submission per team per event is enforced
  test('8. One submission per team per event is enforced', async () => {
    const res = await fetch(`${baseUrl}/events/${testEvent.id}/teams/${team1Id}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({
        title: 'Duplicate Project Attempt',
        slug: 'duplicate-project-attempt',
        shortDescription: 'Attempting to create second submission for same team.',
        description: 'Should be rejected because team already has a submission.'
      })
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'CONFLICT');
  });

  // 9. Another participant cannot retrieve the submission
  test('9. Another participant cannot retrieve the submission', async () => {
    const res = await fetch(`${baseUrl}/events/${testEvent.id}/teams/${team1Id}/submission`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant_2'
      }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // 10. Organizer can assign a judge to the submitted project
  test('10. Organizer can assign a judge to the submitted project', async () => {
    const res = await fetch(`${baseUrl}/events/${testEvent.id}/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_a_001',
        submissionId: testSubmissionId
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.assignment);
    assert.equal(body.assignment.judgeId, 'usr_judge_a_001');
    assert.equal(body.assignment.submissionId, testSubmissionId);
    assert.equal(body.assignment.status, 'assigned');
    testAssignmentId = body.assignment.id;
  });

  // 11. Draft submission cannot be assigned
  test('11. Draft submission cannot be assigned', async () => {
    // Participant 2 creates a draft submission for Team 2
    const draftRes = await fetch(`${baseUrl}/events/${testEvent.id}/teams/${team2Id}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_2'
      },
      body: JSON.stringify({
        title: 'Team Beta Draft',
        slug: 'team-beta-draft',
        shortDescription: 'Incomplete draft for team beta',
        description: 'Team Beta draft description pending final completion.',
        status: 'draft'
      })
    });
    assert.equal(draftRes.status, 201);
    const draftBody = await draftRes.json();
    team2DraftSubId = draftBody.submission.id;

    // Organizer attempts to assign judge to draft
    const assignDraftRes = await fetch(`${baseUrl}/events/${testEvent.id}/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_b_001',
        submissionId: team2DraftSubId
      })
    });

    assert.equal(assignDraftRes.status, 400);
    const body = await assignDraftRes.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 12. Cross-event assignment is rejected
  test('12. Cross-event assignment is rejected', async () => {
    // Attempt to assign a submission from event_dogfood_2026 into testEvent
    const res = await fetch(`${baseUrl}/events/${testEvent.id}/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_a_001',
        submissionId: 'sub_dogfood_alpha' // belongs to event_dogfood_2026
      })
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  // 13. Duplicate judge assignment is rejected
  test('13. Duplicate judge assignment is rejected', async () => {
    const res = await fetch(`${baseUrl}/events/${testEvent.id}/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_a_001',
        submissionId: testSubmissionId
      })
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'CONFLICT');
  });

  // 14. Assigned judge sees the project
  test('14. Assigned judge sees the project', async () => {
    const res = await fetch(`${baseUrl}/judge/assignments`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_a'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.assignments));
    const match = body.assignments.find((a: any) => a.submissionId === testSubmissionId);
    assert.ok(match, 'Assigned judge must see the assigned project');
    assert.equal(match.id, testAssignmentId);
  });

  // 15. Unassigned judge does not see the project
  test('15. Unassigned judge does not see the project', async () => {
    const res = await fetch(`${baseUrl}/judge/assignments`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_b'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.assignments));
    const match = body.assignments.find((a: any) => a.submissionId === testSubmissionId);
    assert.equal(match, undefined, 'Unassigned judge must NOT see the project');
  });

  // 16. Judge can score the assigned project
  test('16. Judge can score the assigned project', async () => {
    // Submit scores using active rubric criteria
    const rubricRes = await fetch(`${baseUrl}/events/${testEvent.id}/judging/rubrics/active`);
    assert.equal(rubricRes.status, 200);
    const rubricBody = await rubricRes.json();
    assert.ok(rubricBody.rubric);
    assert.ok(rubricBody.rubric.criteria.length > 0);

    const scoresPayload = rubricBody.rubric.criteria.map((crit: any, idx: number) => ({
      criterionId: crit.id,
      score: idx === 2 ? 8 : 9,
      comment: 'Strong evaluation with self-hosted operation and clean architecture.'
    }));

    const res = await fetch(`${baseUrl}/judge/assignments/${testAssignmentId}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_a'
      },
      body: JSON.stringify({
        scores: scoresPayload
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.assignmentId, testAssignmentId);
    assert.equal(body.status, 'completed');
    assert.ok(body.totalWeightedScore > 0);
  });

  // 17. Judge score persists after reload
  test('17. Judge score persists after reload', async () => {
    const res = await fetch(`${baseUrl}/judge/scores?assignment=${testAssignmentId}`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_a'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.scores));
    assert.ok(body.scores.length > 0, 'Scores must persist');
    for (const score of body.scores) {
      assert.equal(score.assignmentId, testAssignmentId);
      assert.ok(score.score >= 8);
    }
  });

  // 18. Judge cannot access another judge's score
  test('18. Judge cannot access another judge\'s score', async () => {
    // Judge B attempts to view peer scores endpoint -> 403
    const peerRes = await fetch(`${baseUrl}/judge/scores/peer`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_b'
      }
    });
    assert.equal(peerRes.status, 403);

    // Judge B attempts to fetch Judge A's assignment detail -> 403/404
    const asgnRes = await fetch(`${baseUrl}/judge/assignments/${testAssignmentId}`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_b'
      }
    });
    assert.equal(asgnRes.status, 403);

    // Non-judge (Participant) attempts to fetch judge scores -> 403
    const participantRes = await fetch(`${baseUrl}/judge/scores?assignment=${testAssignmentId}`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });
    assert.equal(participantRes.status, 403);
  });
});
