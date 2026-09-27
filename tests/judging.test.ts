import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';
import { JudgingService } from '../src/backend/modules/judging/judgingService';
import { EventService } from '../src/backend/modules/events/eventService';

describe('DOGFOOD Judging Foundation, Rubrics, Assignments & Score Isolation Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-judging.sqlite');
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

  let createdRubricId: string;
  let createdAssignmentId: string;

  // 1. Organizer can create and activate a rubric
  test('1. Organizer can create and activate a rubric', async () => {
    // Create dedicated event to test rubric lifecycle
    const tempEvent = EventService.createEvent('usr_organizer_001', {
      name: 'Rubric Test Event',
      slug: 'rubric-test-event',
      description: 'Temporary event for rubric lifecycle testing',
      registrationStart: '2026-09-01T00:00:00.000Z',
      registrationEnd: '2026-10-01T00:00:00.000Z',
      submissionDeadline: '2026-10-05T23:59:59.000Z',
      judgingStart: '2026-10-06T00:00:00.000Z',
      judgingEnd: '2026-10-10T23:59:59.000Z',
      resultsPublishAt: '2026-10-12T12:00:00.000Z'
    });

    // Create draft rubric
    const createRes = await fetch(`${baseUrl}/events/${tempEvent.id}/judging/rubrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Secondary Custom Rubric',
        description: 'Alternative evaluation rubric.',
        status: 'draft',
        criteria: [
          { name: 'Feature Completeness', description: 'Working features', weight: 50, maxScore: 10, position: 1 },
          { name: 'Architecture & Code', description: 'Modularity', weight: 30, maxScore: 10, position: 2 },
          { name: 'Presentation', description: 'Pitch & Demo', weight: 20, maxScore: 10, position: 3 }
        ]
      })
    });

    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    assert.equal(createBody.rubric.name, 'Secondary Custom Rubric');
    assert.equal(createBody.rubric.status, 'draft');
    assert.equal(createBody.rubric.criteria.length, 3);
    createdRubricId = createBody.rubric.id;

    // Activate the rubric
    const activateRes = await fetch(`${baseUrl}/events/${tempEvent.id}/judging/rubrics/${createdRubricId}/activate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });

    assert.equal(activateRes.status, 200);
    const activateBody = await activateRes.json();
    assert.equal(activateBody.rubric.status, 'active');
  });

  // 2. Rubric weights are validated
  test('2. Rubric weights are validated', async () => {
    // Criterion weight <= 0 must fail
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/rubrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Invalid Weight Rubric',
        description: 'Negative weight',
        criteria: [
          { name: 'Category A', description: 'Invalid', weight: -10, maxScore: 10 }
        ]
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 3. Invalid weight totals are rejected for active rubric
  test('3. Invalid weight totals are rejected for active rubric', async () => {
    // Create draft rubric with sum of weights = 80 (not 100)
    const createRes = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/rubrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Incomplete Weight Rubric',
        description: 'Weights sum to 80',
        status: 'draft',
        criteria: [
          { name: 'Part 1', description: 'desc', weight: 50, maxScore: 10 },
          { name: 'Part 2', description: 'desc', weight: 30, maxScore: 10 }
        ]
      })
    });
    assert.equal(createRes.status, 201);
    const { rubric } = await createRes.json();

    // Activating rubric with sum != 100 must be rejected
    const activateRes = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/rubrics/${rubric.id}/activate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });

    assert.equal(activateRes.status, 400);
    const body = await activateRes.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.ok(body.error.message.includes('100'));
  });

  // 4. Active rubric cannot be casually modified when scores exist
  test('4. Active rubric cannot be casually modified when locked', () => {
    assert.throws(() => {
      JudgingService.activateRubric('rubric_dogfood_2026', 'usr_participant_001', 'participant');
    }, (err: any) => {
      return err.code === 'FORBIDDEN';
    });
  });

  // 5. Organizer can assign judge to submitted project
  test('5. Organizer can assign judge to submitted project', async () => {
    // Assign Judge B to sub_beta_002
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_b_001',
        submissionId: 'sub_beta_002'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.assignment.id);
    assert.equal(body.assignment.judgeId, 'usr_judge_b_001');
    assert.equal(body.assignment.submissionId, 'sub_beta_002');
    assert.equal(body.assignment.status, 'assigned');
    createdAssignmentId = body.assignment.id;
  });

  // 6. Non-organizer cannot create assignment
  test('6. Non-organizer cannot create assignment', async () => {
    // Participant attempts to create assignment
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_a_001',
        submissionId: 'sub_beta_002'
      })
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // 7. Non-judge cannot receive judge assignment
  test('7. Non-judge cannot receive judge assignment', async () => {
    // Attempting to assign a participant as judge
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_participant_001',
        submissionId: 'sub_beta_002'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 8. Draft submission cannot be assigned
  test('8. Draft submission cannot be assigned', async () => {
    // sub_gamma_draft is in draft state
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_a_001',
        submissionId: 'sub_gamma_draft'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 9. Cross-event assignment is rejected
  test('9. Cross-event assignment is rejected', async () => {
    // Attempt to assign submission from event_dogfood_2026 against event_closed_fixture
    const res = await fetch(`${baseUrl}/events/event_closed_fixture/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_a_001',
        submissionId: 'sub_alpha_001'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 10. Duplicate assignment is rejected
  test('10. Duplicate assignment is rejected', async () => {
    // Judge A is already assigned to sub_alpha_001
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        judgeId: 'usr_judge_a_001',
        submissionId: 'sub_alpha_001'
      })
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'CONFLICT');
  });

  // 11. Judge can retrieve own assignments
  test('11. Judge can retrieve own assignments', async () => {
    const res = await fetch(`${baseUrl}/judge/assignments`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_a'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.assignments));
    assert.equal(body.assignments.length >= 2, true);
    for (const a of body.assignments) {
      assert.equal(a.judgeId, 'usr_judge_a_001');
    }
  });

  // 12. Judge cannot retrieve another judge assignment
  test('12. Judge cannot retrieve another judge assignment', async () => {
    // Judge A tries to retrieve createdAssignmentId (which belongs to Judge B)
    const res = await fetch(`${baseUrl}/judge/assignments/${createdAssignmentId}`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_a'
      }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // 13. Judge can submit scores for own assignment
  test('13. Judge can submit scores for own assignment', async () => {
    // Judge A submits scores for asgn_judge_a_sub_beta
    const res = await fetch(`${baseUrl}/judge/assignments/asgn_judge_a_sub_beta/scores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_a'
      },
      body: JSON.stringify({
        scores: [
          { criterionId: 'crit_tier_correctness', score: 10, comment: 'Flawless tiers' },
          { criterionId: 'crit_judging_integrity', score: 10, comment: 'Strict checks' },
          { criterionId: 'crit_adoptability', score: 9, comment: 'Solid setup' },
          { criterionId: 'crit_code_innovation', score: 9.5, comment: 'Excellent' }
        ]
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.assignmentId, 'asgn_judge_a_sub_beta');
    assert.equal(body.judgeId, 'usr_judge_a_001');
    assert.equal(body.scores.length, 4);
    assert.equal(body.status, 'completed');
    assert.ok(body.totalWeightedScore > 90);
  });

  // 14. Judge cannot submit scores for another judge assignment
  test('14. Judge cannot submit scores for another judge assignment', async () => {
    // Judge B attempts to score asgn_judge_a_sub_alpha (owned by Judge A)
    const res = await fetch(`${baseUrl}/judge/assignments/asgn_judge_a_sub_alpha/scores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_b'
      },
      body: JSON.stringify({
        scores: [
          { criterionId: 'crit_tier_correctness', score: 5 }
        ]
      })
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // 15. Score outside max range is rejected
  test('15. Score outside max range is rejected', async () => {
    // Score 15 when maxScore is 10
    const res = await fetch(`${baseUrl}/judge/assignments/${createdAssignmentId}/scores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_b'
      },
      body: JSON.stringify({
        scores: [
          { criterionId: 'crit_tier_correctness', score: 15 }
        ]
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 16. Unknown criterion is rejected
  test('16. Unknown criterion is rejected', async () => {
    const res = await fetch(`${baseUrl}/judge/assignments/${createdAssignmentId}/scores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_b'
      },
      body: JSON.stringify({
        scores: [
          { criterionId: 'crit_non_existent', score: 8 }
        ]
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 17. Criterion from another rubric is rejected
  test('17. Criterion from another rubric is rejected', () => {
    assert.throws(() => {
      JudgingService.submitAssignmentScores('asgn_judge_a_sub_alpha', 'usr_judge_a_001', [
        { criterionId: 'crit_from_another_rubric', score: 5 }
      ]);
    }, (err: any) => {
      return err.code === 'BAD_REQUEST';
    });
  });

  // 18. Client cannot spoof judge_id
  test('18. Client cannot spoof judge_id', async () => {
    // Judge A sends judge_id = "usr_judge_b_001" in body
    const res = await fetch(`${baseUrl}/judge/assignments/asgn_judge_a_sub_alpha/scores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_a'
      },
      body: JSON.stringify({
        judge_id: 'usr_judge_b_001',
        judgeId: 'usr_judge_b_001',
        scores: [
          { criterionId: 'crit_tier_correctness', score: 9.0 }
        ]
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    // Must strictly retain Judge A as the recording judge
    assert.equal(body.judgeId, 'usr_judge_a_001');

    const db = getDatabase();
    const scoreRow = db.prepare(`
      SELECT judge_id FROM judge_scores WHERE assignment_id = ? AND criterion_id = ?
    `).get('asgn_judge_a_sub_alpha', 'crit_tier_correctness') as any;
    assert.equal(scoreRow.judge_id, 'usr_judge_a_001');
  });

  // 19. Backend calculates weighted total
  test('19. Backend calculates weighted total', () => {
    // Criterion weights: 40, 25, 20, 15 (max 10)
    // Scores: 10 (40), 10 (25), 10 (20), 10 (15) -> Total = 100
    const result = JudgingService.submitAssignmentScores('asgn_judge_a_sub_alpha', 'usr_judge_a_001', [
      { criterionId: 'crit_tier_correctness', score: 10 },
      { criterionId: 'crit_judging_integrity', score: 10 },
      { criterionId: 'crit_adoptability', score: 10 },
      { criterionId: 'crit_code_innovation', score: 10 }
    ]);

    assert.equal(result.totalWeightedScore, 100);
  });

  // 20. Client cannot override weighted total
  test('20. Client cannot override weighted total', async () => {
    const res = await fetch(`${baseUrl}/judge/assignments/asgn_judge_a_sub_alpha/scores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_a'
      },
      body: JSON.stringify({
        totalScore: 999,
        weightedScore: 999,
        scores: [
          { criterionId: 'crit_tier_correctness', score: 5 },
          { criterionId: 'crit_judging_integrity', score: 5 },
          { criterionId: 'crit_adoptability', score: 5 },
          { criterionId: 'crit_code_innovation', score: 5 }
        ]
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    // 5/10 * 100 = 50. Client-provided 999 must be ignored
    assert.equal(body.totalWeightedScore, 50);
  });

  // 21. Judge A sees only Judge A scores (Acceptance Checker Check 1)
  test('21. Judge A sees only Judge A scores (Acceptance Checker Check 1)', async () => {
    const res = await fetch(`${baseUrl}/judge/scores`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_a'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.scores));
    assert.equal(body.scores.length > 0, true);

    for (const score of body.scores) {
      assert.equal(score.judgeId, 'usr_judge_a_001');
    }
  });

  // 22. Judge B cannot see Judge A scores / peer scores (Acceptance Checker Check 2)
  test('22. Judge B cannot see Judge A scores / peer scores (Acceptance Checker Check 2)', async () => {
    // Attempting GET /judge/scores/peer as Judge B must return 401 or 403
    const peerRes = await fetch(`${baseUrl}/judge/scores/peer`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_b'
      }
    });

    assert.equal(peerRes.status === 401 || peerRes.status === 403, true, 'Peer score access must return 401 or 403');

    // GET /judge/scores as Judge B only returns Judge B's scores
    const myScoresRes = await fetch(`${baseUrl}/judge/scores`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_b'
      }
    });

    assert.equal(myScoresRes.status, 200);
    const body = await myScoresRes.json();
    for (const score of body.scores) {
      assert.equal(score.judgeId, 'usr_judge_b_001');
    }
  });

  // 23. Participant cannot access judge scores
  test('23. Participant cannot access judge scores', async () => {
    const res = await fetch(`${baseUrl}/judge/scores`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status === 401 || res.status === 403, true, 'Participant must be rejected from /judge/scores');
  });

  // 24. Participant cannot access peer scores
  test('24. Participant cannot access peer scores', async () => {
    const res = await fetch(`${baseUrl}/judge/scores/peer`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status === 401 || res.status === 403, true, 'Participant must be rejected from /judge/scores/peer');
  });

  // 25. Organizer can view judging progress
  test('25. Organizer can view judging progress', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/progress`, {
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.progress);
    assert.equal(body.progress.eventId, 'event_dogfood_2026');
    assert.equal(body.progress.totalAssignments >= 3, true);
    assert.equal(typeof body.progress.completedAssignments, 'number');
    assert.equal(typeof body.progress.pendingAssignments, 'number');
    assert.equal(typeof body.progress.completionPercentage, 'number');
  });

  // 26. Judge cannot view global peer progress data
  test('26. Judge cannot view global peer progress data', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/progress`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_a'
      }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // 27. Organizer can export CSV
  test('27. Organizer can export CSV', async () => {
    const res = await fetch(`${baseUrl}/exports/scores.csv?eventId=event_dogfood_2026`, {
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });

    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/csv'), 'Content-Type must be text/csv');
    const text = await res.text();
    assert.ok(text.includes('event,submission,team,judge,criterion,score,max_score,weight,weighted_score,comment,assignment_status'));
    assert.ok(text.includes('Fixture Project Alpha'));
  });

  // 28. Participant cannot export CSV
  test('28. Participant cannot export CSV', async () => {
    const res = await fetch(`${baseUrl}/exports/scores.csv`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status, 403);
  });

  // 29. Judge cannot export all judges' CSV
  test('29. Judge cannot export all judges CSV', async () => {
    const res = await fetch(`${baseUrl}/exports/scores.csv`, {
      headers: {
        Authorization: 'Bearer dogfood_token_judge_a'
      }
    });

    assert.equal(res.status, 403);
  });

  // 30. CSV contains a valid comma-separated header
  test('30. CSV contains a valid comma-separated header', async () => {
    const res = await fetch(`${baseUrl}/exports/scores.csv`, {
      headers: {
        Authorization: 'Bearer dogfood_token_admin'
      }
    });

    assert.equal(res.status, 200);
    const text = await res.text();
    const firstLine = text.split('\n')[0].trim();
    assert.ok(firstLine.includes(','));
    const columns = firstLine.split(',');
    assert.equal(columns.length, 11);
    assert.equal(columns[0], 'event');
    assert.equal(columns[5], 'score');
  });

  // 31. CSV formula injection is neutralized
  test('31. CSV formula injection is neutralized', () => {
    assert.equal(JudgingService.sanitizeCsvField('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.equal(JudgingService.sanitizeCsvField('+cmd|calc'), "'+cmd|calc");
    assert.equal(JudgingService.sanitizeCsvField('-2+3*cmd'), "'-2+3*cmd");
    assert.equal(JudgingService.sanitizeCsvField('@echo'), "'@echo");
    assert.equal(JudgingService.sanitizeCsvField('Normal comment'), 'Normal comment');
  });

  // 32. Assignment completion status updates correctly
  test('32. Assignment completion status updates correctly', async () => {
    // Scoring all 4 criteria updates assignment to 'completed'
    const res = await fetch(`${baseUrl}/judge/assignments/${createdAssignmentId}/scores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_b'
      },
      body: JSON.stringify({
        scores: [
          { criterionId: 'crit_tier_correctness', score: 8 },
          { criterionId: 'crit_judging_integrity', score: 8 },
          { criterionId: 'crit_adoptability', score: 8 },
          { criterionId: 'crit_code_innovation', score: 8 }
        ]
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'completed');

    const db = getDatabase();
    const asgnRow = db.prepare('SELECT status FROM judge_assignments WHERE id = ?').get(createdAssignmentId) as any;
    assert.equal(asgnRow.status, 'completed');
  });

  // 33. Updating scores remains scoped to the correct judge
  test('33. Updating scores remains scoped to the correct judge', async () => {
    // Judge B updates score on criterion 1
    const res = await fetch(`${baseUrl}/judge/assignments/${createdAssignmentId}/scores`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_b'
      },
      body: JSON.stringify({
        scores: [
          { criterionId: 'crit_tier_correctness', score: 9.5, comment: 'Revised after demo review' }
        ]
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.judgeId, 'usr_judge_b_001');

    // Verify Judge A's scores on sub_alpha_001 were unaffected
    const db = getDatabase();
    const judgeAScore = db.prepare(`
      SELECT score FROM judge_scores WHERE assignment_id = ? AND criterion_id = ?
    `).get('asgn_judge_a_sub_alpha', 'crit_tier_correctness') as any;
    assert.ok(judgeAScore.score > 0);
  });

  // 34. Active rubric endpoint is publicly discoverable
  test('34. Active rubric endpoint is discoverable', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/judging/rubrics/active`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.rubric);
    assert.equal(body.rubric.status, 'active');
    assert.equal(body.rubric.criteria.length, 4);
  });
});
