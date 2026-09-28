import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';
import { TeamService } from '../src/backend/modules/teams/teamService';
import { hashSessionToken } from '../src/backend/utils/crypto';

describe('DOGFOOD Team Formation & Invitations Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-teams.sqlite');
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
        // ignore cleanup error
      }
    }
  });

  // ==========================================================================
  // CREATION
  // ==========================================================================

  let createdTeamId: string;

  test('1. Participant can create a team for an open-registration event', async () => {
    // Participant 3 creates a new team in the open event
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        name: 'Delta Force',
        slug: 'delta-force'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.team.name, 'Delta Force');
    assert.equal(body.team.slug, 'delta-force');
    assert.equal(body.team.createdBy, 'usr_participant_003');
    createdTeamId = body.team.id;
  });

  test('2. Team creator becomes captain', async () => {
    const res = await fetch(`${baseUrl}/teams/${createdTeamId}`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.team.members.length, 1);
    const captain = body.team.members[0];
    assert.equal(captain.userId, 'usr_participant_003');
    assert.equal(captain.role, 'captain');
  });

  test('3. Participant cannot create a second team in the same event', async () => {
    // Participant 3 is already captain of Delta Force
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_3'
      },
      body: JSON.stringify({
        name: 'Second Delta Team',
        slug: 'second-delta'
      })
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'CONFLICT');
  });

  test('4. Participant cannot create a team for a closed event', async () => {
    // event_closed_fixture is closed
    const res = await fetch(`${baseUrl}/events/event_closed_fixture/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_4'
      },
      body: JSON.stringify({
        name: 'Late Arrivals',
        slug: 'late-arrivals'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.message.includes('registration'));
  });

  test('5. Unauthenticated user cannot create a team', async () => {
    const res = await fetch(`${baseUrl}/events/event_dogfood_2026/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ghost Team',
        slug: 'ghost-team'
      })
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  // ==========================================================================
  // MEMBERSHIP
  // ==========================================================================

  test('6. Team has exactly one captain after creation', async () => {
    const db = getDatabase();
    const captains = db
      .prepare("SELECT * FROM team_members WHERE team_id = ? AND role = 'captain'")
      .all(createdTeamId);
    assert.equal(captains.length, 1);
  });

  test('7. Duplicate membership is rejected', () => {
    const db = getDatabase();
    assert.throws(
      () => {
        db.prepare(
          "INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at) VALUES ('tm_dup', ?, ?, 'event_dogfood_2026', 'member', ?)"
        ).run(createdTeamId, 'usr_participant_003', new Date().toISOString());
      },
      /UNIQUE constraint failed/,
      'Database UNIQUE(team_id, user_id) must reject duplicate team membership'
    );
  });

  test('8. User cannot join two teams in the same event', () => {
    const db = getDatabase();
    assert.throws(
      () => {
        // usr_participant_003 is already in Delta Force for event_dogfood_2026
        db.prepare(
          "INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at) VALUES ('tm_cross', 'team_alpha_001', 'usr_participant_003', 'event_dogfood_2026', 'member', ?)"
        ).run(new Date().toISOString());
      },
      /UNIQUE constraint failed/,
      'Database UNIQUE(event_id, user_id) must reject multi-team membership in same event'
    );
  });

  test('9. Team maximum size is enforced', () => {
    // Populate team up to 4 members
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at) VALUES ('tm_p4', ?, 'usr_participant_004', 'event_dogfood_2026', 'member', ?)"
    ).run(createdTeamId, now);
    db.prepare(
      "INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at) VALUES ('tm_p5', ?, 'usr_participant_005', 'event_dogfood_2026', 'member', ?)"
    ).run(createdTeamId, now);

    // Create a 6th temporary participant
    db.prepare(
      "INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at) VALUES ('usr_extra_6', 'extra6@dogfood.local', 'Extra Six', 'participant', 'hash:pass', ?, ?)"
    ).run(now, now);
    db.prepare(
      "INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at) VALUES ('tm_p6', ?, 'usr_extra_6', 'event_dogfood_2026', 'member', ?)"
    ).run(createdTeamId, now);

    // Team now has 4 members: 3, 4, 5, 6
    const count = (db.prepare('SELECT count(*) as c FROM team_members WHERE team_id = ?').get(createdTeamId) as any).c;
    assert.equal(count, 4, 'Team should now have 4 members (maximum size)');

    // Attempting to create an invite for a full team must fail
    assert.throws(
      () => {
        TeamService.createInvitation(createdTeamId, 'usr_participant_003', 'participant');
      },
      (err: any) => err.message.includes('maximum size'),
      'Cannot invite when team is full'
    );
  });

  // ==========================================================================
  // INVITATIONS
  // ==========================================================================

  let inviteRawToken = '';
  let inviteId = '';

  test('10. Captain can create an invitation', async () => {
    // We will use team_alpha_001 where usr_participant_001 is captain and has 2 members
    const res = await fetch(`${baseUrl}/teams/team_alpha_001/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.rawToken, 'Response must return the raw invitation token');
    assert.ok(body.invitation.id);
    assert.equal(body.invitation.status, 'pending');
    inviteRawToken = body.rawToken;
    inviteId = body.invitation.id;
  });

  test('11. Regular member cannot create an invitation', async () => {
    // usr_participant_002 is a regular member of team_alpha_001
    const res = await fetch(`${baseUrl}/teams/team_alpha_001/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_2'
      }
    });

    assert.equal(res.status, 403, 'Regular member must receive 403 when creating invite');
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('12. Invitation token is not stored plaintext', () => {
    const db = getDatabase();
    const plainMatch = db.prepare('SELECT * FROM team_invitations WHERE token_hash = ?').get(inviteRawToken);
    assert.equal(plainMatch, undefined, 'Raw token must never exist in token_hash column');

    const expectedHash = hashSessionToken(inviteRawToken);
    const hashMatch = db.prepare('SELECT * FROM team_invitations WHERE token_hash = ?').get(expectedHash) as any;
    assert.ok(hashMatch, 'Hashed token must exist in database');
    assert.equal(hashMatch.id, inviteId);
  });

  test('13. Valid invitation can be accepted', async () => {
    // Create new participant to accept invite
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at) VALUES ('usr_invitee_test', 'invitee@dogfood.local', 'Invitee User', 'participant', 'hash:pass', ?, ?)"
    ).run(now, now);
    db.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES ('sess_invitee', 'usr_invitee_test', ?, ?, '2028-01-01T00:00:00.000Z')"
    ).run(hashSessionToken('token_invitee_test'), now);

    const res = await fetch(`${baseUrl}/team-invitations/${inviteRawToken}/accept`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token_invitee_test'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.team.members.some((m: any) => m.userId === 'usr_invitee_test'));
  });

  test('14. Invitation becomes accepted after successful use', () => {
    const db = getDatabase();
    const invite = db.prepare('SELECT * FROM team_invitations WHERE id = ?').get(inviteId) as any;
    assert.equal(invite.status, 'accepted');
    assert.equal(invite.accepted_by, 'usr_invitee_test');
    assert.ok(invite.accepted_at);
  });

  test('15. Accepted invitation cannot be reused', async () => {
    // Another user tries to accept the same invitation token
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at) VALUES ('usr_reuser_test', 'reuser@dogfood.local', 'Reuser Test', 'participant', 'hash:pass', ?, ?)"
    ).run(now, now);
    db.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES ('sess_reuser', 'usr_reuser_test', ?, ?, '2028-01-01T00:00:00.000Z')"
    ).run(hashSessionToken('token_reuser_test'), now);

    const res = await fetch(`${baseUrl}/team-invitations/${inviteRawToken}/accept`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token_reuser_test'
      }
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.message.includes('no longer valid'));
  });

  test('16. Expired invitation cannot be accepted', async () => {
    const db = getDatabase();
    const past = '2020-01-01T00:00:00.000Z';
    const expiredRawToken = 'expired_invite_token_1234567890';
    db.prepare(
      "INSERT INTO team_invitations (id, team_id, invited_by, token_hash, expires_at, status, created_at) VALUES ('inv_exp', 'team_alpha_001', 'usr_participant_001', ?, ?, 'pending', ?)"
    ).run(hashSessionToken(expiredRawToken), past, past);

    const res = await fetch(`${baseUrl}/team-invitations/${expiredRawToken}/accept`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token_reuser_test'
      }
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.message.includes('expired'));
  });

  test('17. Revoked invitation cannot be accepted', async () => {
    const db = getDatabase();
    const future = '2028-01-01T00:00:00.000Z';
    const now = new Date().toISOString();
    const revokedRawToken = 'revoked_invite_token_1234567890';
    db.prepare(
      "INSERT INTO team_invitations (id, team_id, invited_by, token_hash, expires_at, status, created_at) VALUES ('inv_rev', 'team_alpha_001', 'usr_participant_001', ?, ?, 'revoked', ?)"
    ).run(hashSessionToken(revokedRawToken), future, now);

    const res = await fetch(`${baseUrl}/team-invitations/${revokedRawToken}/accept`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token_reuser_test'
      }
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.message.includes('no longer valid'));
  });

  test('18. Non-captain cannot revoke an invitation', async () => {
    // Create an invite to revoke
    const db = getDatabase();
    const future = '2028-01-01T00:00:00.000Z';
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO team_invitations (id, team_id, invited_by, token_hash, expires_at, status, created_at) VALUES ('inv_to_revoke', 'team_alpha_001', 'usr_participant_001', 'hash_rev_test', ?, 'pending', ?)"
    ).run(future, now);

    // Regular member attempts to revoke
    const res = await fetch(`${baseUrl}/team-invitations/inv_to_revoke`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer dogfood_token_participant_2'
      }
    });

    assert.equal(res.status, 403);
  });

  // ==========================================================================
  // AUTHORIZATION
  // ==========================================================================

  test('19. Team member can view their team', async () => {
    const res = await fetch(`${baseUrl}/teams/team_alpha_001`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.team.id, 'team_alpha_001');
    assert.equal(body.team.name, 'Alpha Agents');
  });

  test('20. Unrelated participant cannot modify another team details', async () => {
    // Participant 4 attempts to patch team_alpha_001
    const res = await fetch(`${baseUrl}/teams/team_alpha_001`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant_4'
      },
      body: JSON.stringify({ name: 'Hacked Alpha' })
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('21. Captain can remove a member', async () => {
    // team_alpha_001 has usr_invitee_test from test 13
    const res = await fetch(`${baseUrl}/teams/team_alpha_001/members/usr_invitee_test`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status, 200);
    const db = getDatabase();
    const member = db
      .prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?')
      .get('team_alpha_001', 'usr_invitee_test');
    assert.equal(member, undefined, 'Removed member should no longer be in database');
  });

  test('22. Member cannot remove another member', async () => {
    // usr_participant_002 is regular member; attempts to remove captain or another member
    const res = await fetch(`${baseUrl}/teams/team_alpha_001/members/usr_participant_001`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer dogfood_token_participant_2'
      }
    });

    assert.equal(res.status, 403);
  });

  test('23. Captain cannot remove themselves through member-removal endpoint', async () => {
    // Captain usr_participant_001 tries to remove usr_participant_001
    const res = await fetch(`${baseUrl}/teams/team_alpha_001/members/usr_participant_001`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer dogfood_token_participant'
      }
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.message.includes('leave endpoint'));
  });

  // ==========================================================================
  // CONCURRENCY & INTEGRITY
  // ==========================================================================

  test('24. Two acceptance attempts cannot exceed the team-size limit', () => {
    // Create an isolated team with 3 members
    const db = getDatabase();
    const now = new Date().toISOString();
    const teamId = 'team_capacity_test';

    // Insert 5 fresh users for this test
    for (let i = 1; i <= 5; i++) {
      db.prepare(
        `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, 'participant', 'hash:pass', ?, ?)`
      ).run(`usr_cap_${i}`, `cap_${i}@dogfood.local`, `Cap ${i}`, now, now);
    }

    db.prepare(
      "INSERT INTO teams (id, event_id, name, slug, created_by, created_at, updated_at) VALUES (?, 'event_dogfood_2026', 'Capacity Test Team', 'cap-test', 'usr_cap_1', ?, ?)"
    ).run(teamId, now, now);

    db.prepare(
      "INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at) VALUES ('tm_c1', ?, 'usr_cap_1', 'event_dogfood_2026', 'captain', ?)"
    ).run(teamId, now);
    db.prepare(
      "INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at) VALUES ('tm_c2', ?, 'usr_cap_2', 'event_dogfood_2026', 'member', ?)"
    ).run(teamId, now);
    db.prepare(
      "INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at) VALUES ('tm_c3', ?, 'usr_cap_3', 'event_dogfood_2026', 'member', ?)"
    ).run(teamId, now);

    // Create two separate invites
    const tokenA = 'token_race_a_1234567890';
    const tokenB = 'token_race_b_1234567890';
    db.prepare(
      "INSERT INTO team_invitations (id, team_id, invited_by, token_hash, expires_at, status, created_at) VALUES ('inv_race_a', ?, 'usr_cap_1', ?, '2028-01-01T00:00:00.000Z', 'pending', ?)"
    ).run(teamId, hashSessionToken(tokenA), now);
    db.prepare(
      "INSERT INTO team_invitations (id, team_id, invited_by, token_hash, expires_at, status, created_at) VALUES ('inv_race_b', ?, 'usr_cap_1', ?, '2028-01-01T00:00:00.000Z', 'pending', ?)"
    ).run(teamId, hashSessionToken(tokenB), now);

    // First user accepts -> team reaches max 4
    TeamService.acceptInvitation(tokenA, 'usr_cap_4');

    // Second user attempts to accept -> rejected due to max size
    assert.throws(
      () => {
        TeamService.acceptInvitation(tokenB, 'usr_cap_5');
      },
      (err: any) => err.message.includes('maximum size'),
      'Second accept must fail because team is at capacity (4)'
    );

    const finalCount = (db.prepare('SELECT count(*) as c FROM team_members WHERE team_id = ?').get(teamId) as any).c;
    assert.equal(finalCount, 4, 'Final member count must strictly equal 4');
  });

  test('25. Invitation acceptance and membership creation are atomic', () => {
    const db = getDatabase();
    const token = 'atomic_test_token_1234567890';
    const now = new Date().toISOString();

    // Create an invite pointing to team_alpha_001
    db.prepare(
      "INSERT INTO team_invitations (id, team_id, invited_by, token_hash, expires_at, status, created_at) VALUES ('inv_atomic', 'team_alpha_001', 'usr_participant_001', ?, '2028-01-01T00:00:00.000Z', 'pending', ?)"
    ).run(hashSessionToken(token), now);

    // Attempt accept with user who is ALREADY in an event team (usr_cap_4 is in Capacity Test Team for event_dogfood_2026)
    assert.throws(
      () => {
        TeamService.acceptInvitation(token, 'usr_cap_4');
      },
      (err: any) => err.code === 'CONFLICT'
    );

    // Confirm invitation remains pending because transaction rolled back
    const invite = db.prepare('SELECT status FROM team_invitations WHERE id = ?').get('inv_atomic') as any;
    assert.equal(invite.status, 'pending', 'Invitation status must remain pending after failed transaction');
  });

  // ==========================================================================
  // REGRESSION TESTS A - G (My Projects & Team Retrieval)
  // ==========================================================================

  // A. Participant who is captain sees their team
  test('A. Participant who is captain sees their team', async () => {
    const res = await fetch(`${baseUrl}/teams/mine`, {
      headers: { Authorization: 'Bearer dogfood_token_participant' }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.teams), 'Response must contain teams array');
    const captainTeam = body.teams.find((t: any) => t.id === 'team_alpha_001');
    assert.ok(captainTeam, 'Captain must see their team team_alpha_001');
    assert.equal(captainTeam.myRole, 'captain');
    assert.equal(captainTeam.name, 'Alpha Agents');
  });

  // B. Participant who is a normal member sees their team
  test('B. Participant who is a normal member sees their team', async () => {
    // usr_participant_002 is a normal member of team_alpha_001
    const res = await fetch(`${baseUrl}/teams/mine`, {
      headers: { Authorization: 'Bearer dogfood_token_participant_2' }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const memberTeam = body.teams.find((t: any) => t.id === 'team_alpha_001');
    assert.ok(memberTeam, 'Normal member must see their team team_alpha_001');
    assert.equal(memberTeam.myRole, 'member');
    assert.equal(memberTeam.name, 'Alpha Agents');
  });

  // C. Team with no submission still appears
  test('C. Team with no submission still appears', async () => {
    // usr_participant_003 created Delta Force in test 1 with no submission
    const res = await fetch(`${baseUrl}/teams/mine`, {
      headers: { Authorization: 'Bearer dogfood_token_participant_3' }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const noSubTeam = body.teams.find((t: any) => t.name === 'Delta Force');
    assert.ok(noSubTeam, 'Team with no submission must still appear in My Teams');
    assert.equal(noSubTeam.submissionId, undefined);
  });

  // D. Team belonging to another event does not appear
  test('D. Team belonging to another event does not appear', async () => {
    // team_alpha_001 belongs to event_dogfood_2026, query for event_closed_fixture
    const res = await fetch(`${baseUrl}/teams/mine?eventId=event_closed_fixture`, {
      headers: { Authorization: 'Bearer dogfood_token_participant' }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const wrongEventTeam = body.teams.find((t: any) => t.id === 'team_alpha_001');
    assert.equal(wrongEventTeam, undefined, 'Team belonging to another event must not appear');
  });

  // E. Participant cannot see another user team
  test('E. Participant cannot see another user team', async () => {
    // usr_participant_006 is captain of Beta Builders, not a member of team_alpha_001 or Delta Force
    const res = await fetch(`${baseUrl}/teams/mine`, {
      headers: { Authorization: 'Bearer dogfood_token_participant_6' }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(
      !body.teams.some((t: any) => t.id === 'team_alpha_001' || t.name === 'Delta Force'),
      'Participant 6 must not see teams they do not belong to'
    );

    // usr_participant_004 is a member of Delta Force, not team_alpha_001 or team_beta_002
    const res4 = await fetch(`${baseUrl}/teams/mine`, {
      headers: { Authorization: 'Bearer dogfood_token_participant_4' }
    });
    assert.equal(res4.status, 200);
    const body4 = await res4.json();
    assert.ok(
      !body4.teams.some((t: any) => t.id === 'team_alpha_001' || t.id === 'team_beta_002'),
      'Participant 4 must not see teams they do not belong to'
    );
  });

  // F. Existing DOGFOOD Demo Hackathon team appears in My Projects
  test('F. Existing DOGFOOD Demo Hackathon team appears in My Projects', async () => {
    // Check main database if present
    const prodDbPath = path.resolve(process.cwd(), 'data', 'dogfood.sqlite');
    if (fs.existsSync(prodDbPath)) {
      const prodDb = new (require('better-sqlite3'))(prodDbPath);
      const demoTeam = prodDb
        .prepare(`
          SELECT t.*, tm.role as my_role
          FROM team_members tm
          JOIN teams t ON tm.team_id = t.id
          WHERE tm.user_id = 'usr_participant_001' AND t.event_id = 'evt_1cb1c3b6fd3d8ba44060'
        `)
        .get() as any;
      if (demoTeam) {
        assert.equal(demoTeam.name, 'Demo Team Alpha');
        assert.equal(demoTeam.my_role, 'captain');
      }
    }

    // Also verify in test database by creating a demo event and team
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO events (id, organizer_id, name, slug, description, status, registration_start, registration_end, submission_deadline, judging_start, judging_end, results_publish_at, created_at, updated_at)
      VALUES ('evt_demo_test', 'usr_organizer_001', 'DOGFOOD Demo Hackathon', 'dogfood-demo-test', 'desc', 'registration_open', '2026-09-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z', '2026-10-25T00:00:00.000Z', '2026-10-26T00:00:00.000Z', '2026-10-28T00:00:00.000Z', '2026-10-30T00:00:00.000Z', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT OR IGNORE INTO teams (id, event_id, name, slug, created_by, created_at, updated_at)
      VALUES ('team_demo_test', 'evt_demo_test', 'Demo Team Alpha', 'demo-team-alpha', 'usr_participant_001', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT OR IGNORE INTO team_members (id, team_id, user_id, event_id, role, joined_at)
      VALUES ('tm_demo_test', 'team_demo_test', 'usr_participant_001', 'evt_demo_test', 'captain', ?)
    `).run(now);

    const res = await fetch(`${baseUrl}/events/evt_demo_test/my-team`, {
      headers: { Authorization: 'Bearer dogfood_token_participant' }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.team, 'Demo hackathon team must be returned');
    assert.equal(body.team.name, 'Demo Team Alpha');
    assert.equal(body.team.myRole, 'captain');
  });

  // G. Existing seeded teams continue working
  test('G. Existing seeded teams continue working', async () => {
    // 1. Get by ID
    const teamRes = await fetch(`${baseUrl}/teams/team_alpha_001`);
    assert.equal(teamRes.status, 200);
    const teamBody = await teamRes.json();
    assert.equal(teamBody.team.id, 'team_alpha_001');
    assert.equal(teamBody.team.name, 'Alpha Agents');
    assert.equal(teamBody.team.members.length, 2);

    // 2. List by event
    const listRes = await fetch(`${baseUrl}/events/event_dogfood_2026/teams`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(listBody.teams.some((t: any) => t.id === 'team_alpha_001'));
  });
});
