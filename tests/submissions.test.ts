import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';
import { EventService } from '../src/backend/modules/events/eventService';

describe('DOGFOOD Project Submissions & Public Gallery Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-submissions.sqlite');
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

  let testTeamId: string;
  let testSubmissionId: string;

  // Setup: Participant 3 creates a team on event_dogfood_2026
  test('0. Setup team for submission testing', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        name: 'Omega Operations',
        slug: 'omega-operations'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    testTeamId = body.team.id;

    // Add Participant 5 to team as regular member
    const db = getDatabase();
    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at)
      VALUES (?, ?, ?, ?, 'member', ?)
    `).run('tm_omega_member', testTeamId, 'usr_participant_005', 'event_dogfood_2026', new Date().toISOString());
  });

  // 1. Participant can create a draft for their team
  test('1. Participant can create a draft for their team', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams/${testTeamId}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        title: 'Project Omega Agent',
        slug: 'project-omega-agent',
        shortDescription: 'High-throughput operational agent.',
        description: 'Comprehensive agent architecture with robust error recovery.',
        trackId: 'track_ai_agents',
        repoUrl: 'https://github.com/dogfood/omega-agent',
        demoUrl: 'https://demo.dogfood.local/omega'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.submission.id);
    assert.equal(body.submission.title, 'Project Omega Agent');
    assert.equal(body.submission.slug, 'project-omega-agent');
    assert.equal(body.submission.status, 'draft');
    assert.equal(body.submission.submittedAt, null);
    testSubmissionId = body.submission.id;
  });

  // 2. Draft is persisted in SQLite
  test('2. Draft is persisted in SQLite', () => {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(testSubmissionId) as any;
    assert.ok(row, 'Draft row must exist in SQLite database');
    assert.equal(row.title, 'Project Omega Agent');
    assert.equal(row.status, 'draft');
    assert.equal(row.submitted_at, null);
    assert.equal(row.event_id, 'event_dogfood_2026');
    assert.equal(row.team_id, testTeamId);
  });

  // 3. Team member can retrieve the team submission
  test('3. Team member can retrieve the team submission', async () => {
    // Participant 5 is an ordinary member of testTeamId
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams/${testTeamId}/submission`, {
      headers: {
        Authorization: 'Bearer dogfood_token_participant_5'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.submission.id, testSubmissionId);
    assert.equal(body.submission.title, 'Project Omega Agent');
  });

  // 4. Captain can edit a draft
  test('4. Captain can edit a draft', async () => {
    const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        title: 'Project Omega Agent Enhanced',
        shortDescription: 'Updated short description for operational agent.'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.submission.title, 'Project Omega Agent Enhanced');
    assert.equal(body.submission.shortDescription, 'Updated short description for operational agent.');
  });

  // 5. Captain can submit a draft
  test('5. Captain can submit a draft', async () => {
    const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}/submit`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dogfood_token_participant_3'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.submission.status, 'submitted');
    assert.ok(body.submission.submittedAt);
  });

  // 6. Submission receives server-generated submitted_at
  test('6. Submission receives server-generated submitted_at', () => {
    const db = getDatabase();
    const row = db.prepare('SELECT submitted_at FROM submissions WHERE id = ?').get(testSubmissionId) as any;
    assert.ok(row.submitted_at, 'submitted_at must be populated');
    const timestamp = new Date(row.submitted_at).getTime();
    assert.equal(isNaN(timestamp), false, 'submitted_at must be valid date');
    // Must be close to current time (within 60 seconds)
    const diff = Math.abs(Date.now() - timestamp);
    assert.equal(diff < 60000, true, 'submitted_at must be near server current time');
  });

  // 7. Client cannot override submitted_at
  test('7. Client cannot override submitted_at', async () => {
    const fakeTimestamp = '2099-01-01T00:00:00.000Z';
    const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        submittedAt: fakeTimestamp,
        submitted_at: fakeTimestamp
      })
    });

    assert.equal(res.status, 200);
    const db = getDatabase();
    const row = db.prepare('SELECT submitted_at FROM submissions WHERE id = ?').get(testSubmissionId) as any;
    assert.notEqual(row.submitted_at, fakeTimestamp, 'Client fake submitted_at must not be saved');
  });

  // 8. Team cannot create a second submission
  test('8. Team cannot create a second submission', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams/${testTeamId}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        title: 'Second Omega Attempt',
        shortDescription: 'Duplicate attempt.',
        description: 'Should be rejected.'
      })
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'CONFLICT');
  });

  // 9. User cannot submit for another team
  test('9. User cannot submit for another team', async () => {
    // Participant 4 is NOT a member of testTeamId
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams/${testTeamId}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_4'
      },
      body: JSON.stringify({
        title: 'Intruder Submission',
        shortDescription: 'Illegal attempt.',
        description: 'Should be rejected.'
      })
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // 10. Wrong-event team is rejected
  test('10. Wrong-event team is rejected', async () => {
    // team_closed_001 belongs to event_closed_fixture, NOT event_dogfood_2026
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams/team_closed_001/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_8'
      },
      body: JSON.stringify({
        title: 'Mismatched Event Team',
        shortDescription: 'Cross event creation.',
        description: 'Must be rejected.'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 11. Wrong-event track is rejected
  test('11. Wrong-event track is rejected', async () => {
    // Setup temporary team for Participant 4 to test track validation
    const teamRes = await fetch(`${baseUrl}/events/event_dogfood_2026/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_4'
      },
      body: JSON.stringify({
        name: 'Track Tester Team',
        slug: 'track-tester-team'
      })
    });
    const { team } = await teamRes.json();

    // track_legacy_core belongs to event_closed_fixture
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams/${team.id}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_4'
      },
      body: JSON.stringify({
        title: 'Invalid Track Submission',
        shortDescription: 'Using track from another event.',
        description: 'Must fail validation.',
        trackId: 'track_legacy_core'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 12. Unauthenticated creation is rejected
  test('12. Unauthenticated creation is rejected', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams/${testTeamId}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Anonymous Project',
        shortDescription: 'No auth header.',
        description: 'Should return 401.'
      })
    });

    assert.equal(res.status, 401);
  });

  // 13. Non-captain cannot perform captain-only submission actions
  test('13. Non-captain cannot perform captain-only submission actions', async () => {
    // Participant 5 is a member, not captain of testTeamId
    const editRes = await fetch(`${baseUrl}/submissions/${testSubmissionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_5'
      },
      body: JSON.stringify({
        title: 'Hacked by Member'
      })
    });

    assert.equal(editRes.status, 403);

    const submitRes = await fetch(`${baseUrl}/submissions/${testSubmissionId}/submit`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dogfood_token_participant_5'
      }
    });

    assert.equal(submitRes.status, 403);
  });

  // 14. Closed event rejects submission
  test('14. Closed event rejects submission', async () => {
    // event_closed_fixture has status judging_closed
    const res = await fetch(`${baseUrl}/events/event_closed_fixture/teams/team_closed_001/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_8'
      },
      body: JSON.stringify({
        title: 'Late Past Submission',
        shortDescription: 'Event is already closed.',
        description: 'Must fail.'
      })
    });

    assert.equal(res.status >= 400 && res.status < 500, true, 'Closed event must return 4xx');
  });

  // 15. Submission after deadline is rejected
  test('15. Submission after deadline is rejected', async () => {
    const db = getDatabase();
    // Temporarily set submission_deadline of event_dogfood_2026 to yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE events SET submission_deadline = ? WHERE id = ?').run(yesterday, 'event_dogfood_2026');

    try {
      const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer dogfood_token_participant_3'
        },
        body: JSON.stringify({
          title: 'Post-Deadline Edit'
        })
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert.ok(body.error.message.includes('deadline'));
    } finally {
      // Restore future deadline
      db.prepare('UPDATE events SET submission_deadline = ? WHERE id = ?').run('2026-10-05T23:59:59.000Z', 'event_dogfood_2026');
    }
  });

  // 16. Client cannot bypass deadline using a fake timestamp
  test('16. Client cannot bypass deadline using a fake timestamp', async () => {
    const db = getDatabase();
    const pastDeadline = new Date(Date.now() - 3600 * 1000).toISOString();
    db.prepare('UPDATE events SET submission_deadline = ? WHERE id = ?').run(pastDeadline, 'event_dogfood_2026');

    try {
      const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer dogfood_token_participant_3'
        },
        body: JSON.stringify({
          submittedAt: '2026-09-01T00:00:00.000Z',
          serverTimeOverride: '2026-09-01T00:00:00.000Z'
        })
      });

      assert.equal(res.status, 400);
    } finally {
      db.prepare('UPDATE events SET submission_deadline = ? WHERE id = ?').run('2026-10-05T23:59:59.000Z', 'event_dogfood_2026');
    }
  });

  // 17. Draft does not appear in public gallery
  test('17. Draft does not appear in public gallery', async () => {
    // sub_gamma_draft is a seeded draft project titled "Secret Unfinished Draft"
    const res = await fetch(`${baseUrl}/gallery`);
    assert.equal(res.status, 200);
    const body = await res.json();

    const titles = body.items.map((i: any) => i.title);
    assert.equal(titles.includes('Secret Unfinished Draft'), false, 'Draft project must NEVER appear in gallery');
  });

  // 18. Submitted project appears in public gallery
  test('18. Submitted project appears in public gallery', async () => {
    const res = await fetch(`${baseUrl}/gallery`);
    assert.equal(res.status, 200);
    const body = await res.json();

    const titles = body.items.map((i: any) => i.title);
    assert.equal(titles.includes('Fixture Project Alpha'), true, 'Seeded submitted project must be visible');
  });

  // 19. Public gallery works without authentication
  test('19. Public gallery works without authentication', async () => {
    const res = await fetch(`${baseUrl}/gallery`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(body.pagination);
  });

  // 20. Gallery search works
  test('20. Gallery search works', async () => {
    const res = await fetch(`${baseUrl}/gallery?search=Sentinel`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].title, 'Infrastructure Sentinel');
  });

  // 21. Gallery event filter works
  test('21. Gallery event filter works', async () => {
    const res = await fetch(`${baseUrl}/gallery?event=dogfood-2026`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(body.items.length >= 2);
    for (const item of body.items) {
      assert.equal(item.eventSlug, 'dogfood-2026');
    }
  });

  // 22. Gallery track filter works
  test('22. Gallery track filter works', async () => {
    const res = await fetch(`${baseUrl}/gallery?track=ai-agents`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(body.items.length >= 1);
    for (const item of body.items) {
      assert.equal(item.trackSlug, 'ai-agents');
    }
  });

  // 23. Pagination is bounded
  test('23. Pagination is bounded', async () => {
    const res = await fetch(`${baseUrl}/gallery?page=1&limit=1`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.items.length, 1);
    assert.equal(body.pagination.limit, 1);
    assert.equal(body.pagination.page, 1);
    assert.ok(body.pagination.total >= 2);

    // Limit exceeding 50 should be capped at 50
    const capRes = await fetch(`${baseUrl}/gallery?limit=100`);
    const capBody = await capRes.json();
    assert.equal(capBody.pagination.limit, 50);
  });

  // 24. Public project detail works
  test('24. Public project detail works', async () => {
    // Accessible via ID or slug without authentication
    const res = await fetch(`${baseUrl}/gallery/fixture-project-alpha`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(body.submission);
    assert.equal(body.submission.title, 'Fixture Project Alpha');
    assert.equal(body.submission.teamName, 'Alpha Agents');
    assert.equal(body.submission.eventName, 'DOGFOOD Hackathon 2026');
    assert.ok(Array.isArray(body.submission.members));
    assert.ok(body.submission.members.length >= 1);
  });

  // 25. Public project detail does not expose private/internal data
  test('25. Public project detail does not expose private/internal data', async () => {
    const res = await fetch(`${baseUrl}/gallery/fixture-project-alpha`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const rawJson = JSON.stringify(body);

    assert.equal(rawJson.includes('password_hash'), false, 'Must not expose password_hash');
    assert.equal(rawJson.includes('token_hash'), false, 'Must not expose token_hash');
    assert.equal(rawJson.includes('OrganizerPassword'), false, 'Must not expose passwords');
    assert.equal(rawJson.includes('dogfood_token'), false, 'Must not expose session tokens');
  });

  // 26. Duplicate slug is rejected
  test('26. Duplicate slug is rejected', async () => {
    // Setup temporary team for duplicate slug test
    const teamRes = await fetch(`${baseUrl}/events/event_dogfood_2026/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Slug Collision Team',
        slug: 'slug-collision-team'
      })
    });
    const { team } = await teamRes.json();

    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams/${team.id}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        title: 'Collision Test',
        slug: 'fixture-project-alpha', // Existing seeded slug
        shortDescription: 'Duplicate slug test.',
        description: 'Should be rejected with 409 conflict.'
      })
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'CONFLICT');
  });

  // 27. Empty/whitespace title is rejected
  test('27. Empty/whitespace title is rejected', async () => {
    const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        title: '     '
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 28. Invalid URL is rejected
  test('28. Invalid URL is rejected', async () => {
    const res = await fetch(`${baseUrl}/submissions/${testSubmissionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        repoUrl: 'not_a_valid_url'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  // 29. Event deletion cascades submissions correctly
  test('29. Event deletion cascades submissions correctly', async () => {
    const db = getDatabase();
    // Create temporary event, team, and submission
    const tempEvent = EventService.createEvent('usr_organizer_001', {
      name: 'Temporary Cascade Event',
      slug: 'temp-cascade-event',
      description: 'Test event for cascade deletion.',
      registrationStart: '2026-09-01T00:00:00.000Z',
      registrationEnd: '2026-10-01T00:00:00.000Z',
      submissionDeadline: '2026-10-05T23:59:59.000Z',
      judgingStart: '2026-10-06T00:00:00.000Z',
      judgingEnd: '2026-10-10T23:59:59.000Z',
      resultsPublishAt: '2026-10-12T12:00:00.000Z'
    });

    db.prepare(`
      INSERT INTO teams (id, event_id, name, slug, created_by, created_at, updated_at)
      VALUES ('team_cascade_test', ?, 'Cascade Team', 'cascade-team', 'usr_participant_001', '2026-09-01', '2026-09-01')
    `).run(tempEvent.id);

    db.prepare(`
      INSERT INTO submissions (
        id, event_id, team_id, track_id, title, slug,
        short_description, description, repo_url, demo_url, video_url,
        status, submitted_at, created_at, updated_at
      ) VALUES ('sub_cascade_test', ?, 'team_cascade_test', NULL, 'Cascade Sub', 'cascade-sub', 'desc', 'full', NULL, NULL, NULL, 'draft', NULL, '2026-09-01', '2026-09-01')
    `).run(tempEvent.id);

    // Verify submission exists
    const beforeSub = db.prepare('SELECT id FROM submissions WHERE id = ?').get('sub_cascade_test');
    assert.ok(beforeSub);

    // Delete the event
    EventService.deleteEvent(tempEvent.id, 'usr_organizer_001', 'organizer');

    // Verify submission cascaded and was deleted
    const afterSub = db.prepare('SELECT id FROM submissions WHERE id = ?').get('sub_cascade_test');
    assert.equal(afterSub, undefined, 'Submission must be deleted when parent event is deleted');
  });

  // 30. Direct /submissions endpoint works and rejects on closed events (Acceptance Checker Check 3)
  test('30. Direct /submissions endpoint works and rejects on closed events (Acceptance Checker Check 3)', async () => {
    // Check 3: Participant attempts POST /submissions against a closed event -> 4xx
    const closedRes = await fetch(`${baseUrl}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({
        eventId: 'event_closed_fixture',
        title: 'Disallowed Closed Submission',
        shortDescription: 'Attempting to submit to closed event.',
        description: 'Should return 4xx error.'
      })
    });

    assert.equal(closedRes.status >= 400 && closedRes.status < 500, true, 'Must return 4xx on closed event');
  });
});
