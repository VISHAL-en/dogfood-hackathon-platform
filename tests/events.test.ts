import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from '../src/backend/app';
import { initDatabase, closeDatabase, getDatabase } from '../src/backend/database/db';

describe('DOGFOOD Event, Track & Prize Foundation Tests', () => {
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-events.sqlite');
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

  // 1. Public Event Discovery
  test('1. Public discovery endpoint returns published events without authentication', async () => {
    const res = await fetch(`${baseUrl}/events`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(Array.isArray(body.events), 'Response should contain events array');
    assert.equal(body.events.length >= 1, true, 'Seeded public event must be returned');

    const mainEvent = body.events.find((e: any) => e.slug === 'dogfood-2026');
    assert.ok(mainEvent, 'DOGFOOD Hackathon 2026 must be present in discovery');
    assert.equal(mainEvent.name, 'DOGFOOD Hackathon 2026');
    assert.equal(mainEvent.status, 'registration_open');
    assert.equal('password_hash' in mainEvent, false, 'Internal auth data must never be exposed');
  });

  // 2. Public Event Details
  test('2. Public details endpoint returns full event detail with tracks and prizes', async () => {
    const res = await fetch(`${baseUrl}/events/dogfood-2026`);
    assert.equal(res.status, 200);

    const body = await res.json();
    const event = body.event;
    assert.ok(event, 'Event detail must be present');
    assert.equal(event.id, 'event_dogfood_2026');
    assert.equal(event.slug, 'dogfood-2026');
    assert.equal(event.organizerName, 'Lead Organizer');

    // Verify tracks
    assert.ok(Array.isArray(event.tracks), 'Tracks array must be present');
    assert.equal(event.tracks.length, 3, 'Must have 3 seeded tracks');
    assert.ok(event.tracks.some((t: any) => t.slug === 'ai-agents'));

    // Verify prizes
    assert.ok(Array.isArray(event.prizes), 'Prizes array must be present');
    assert.equal(event.prizes.length, 3, 'Must have 3 seeded prizes');
    assert.ok(event.prizes.some((p: any) => p.name === 'Grand Champion' && p.amount === 10000));
  });

  // 3. Draft/Archived Event Visibility
  test('3. Draft event is hidden from public visitor but visible to owner organizer', async () => {
    // Organizer creates a draft event
    const createRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Internal Draft Hackathon',
        slug: 'internal-draft',
        description: 'Not yet published to the public',
        status: 'draft',
        registrationStart: '2026-11-01T00:00:00.000Z',
        registrationEnd: '2026-11-10T00:00:00.000Z',
        submissionDeadline: '2026-11-15T23:59:59.000Z',
        judgingStart: '2026-11-16T00:00:00.000Z',
        judgingEnd: '2026-11-20T23:59:59.000Z',
        resultsPublishAt: '2026-11-22T12:00:00.000Z'
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    const draftEventId = created.event.id;

    // Public visitor requests draft event -> 404
    const publicRes = await fetch(`${baseUrl}/events/internal-draft`);
    assert.equal(publicRes.status, 404, 'Public visitor must receive 404 for draft event');

    // Owner organizer requests draft event -> 200
    const ownerRes = await fetch(`${baseUrl}/events/internal-draft`, {
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });
    assert.equal(ownerRes.status, 200, 'Owner organizer must be able to view draft event');
    const ownerBody = await ownerRes.json();
    assert.equal(ownerBody.event.id, draftEventId);
  });

  // 4. Role Authorization for Event Creation
  test('4. Event creation requires organizer or admin role', async () => {
    const payload = {
      name: 'Community Open Hack',
      slug: 'community-open',
      description: 'Open to everyone',
      registrationStart: '2026-12-01T00:00:00.000Z',
      registrationEnd: '2026-12-10T00:00:00.000Z',
      submissionDeadline: '2026-12-15T23:59:59.000Z',
      judgingStart: '2026-12-16T00:00:00.000Z',
      judgingEnd: '2026-12-20T23:59:59.000Z',
      resultsPublishAt: '2026-12-22T12:00:00.000Z'
    };

    // Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(unauthRes.status, 401);

    // Participant request -> 403
    const participantRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify(payload)
    });
    assert.equal(participantRes.status, 403);

    // Judge request -> 403
    const judgeRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_judge_a'
      },
      body: JSON.stringify(payload)
    });
    assert.equal(judgeRes.status, 403);

    // Organizer request -> 201
    const organizerRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify(payload)
    });
    assert.equal(organizerRes.status, 201);
    const body = await organizerRes.json();
    assert.equal(body.event.organizerId, 'usr_organizer_001');
  });

  // 5. Date and Slug Validation
  test('5. Rejects invalid slug formats and illogical date sequences', async () => {
    // Invalid slug with spaces and uppercase
    const badSlugRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Bad Slug Event',
        slug: 'INVALID SLUG!',
        description: 'Test',
        registrationStart: '2026-12-01T00:00:00.000Z',
        registrationEnd: '2026-12-10T00:00:00.000Z',
        submissionDeadline: '2026-12-15T23:59:59.000Z',
        judgingStart: '2026-12-16T00:00:00.000Z',
        judgingEnd: '2026-12-20T23:59:59.000Z',
        resultsPublishAt: '2026-12-22T12:00:00.000Z'
      })
    });
    assert.equal(badSlugRes.status, 400);

    // Illogical date sequence: registrationEnd is AFTER submissionDeadline
    const badDatesRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Bad Dates Event',
        slug: 'bad-dates-event',
        description: 'Test',
        registrationStart: '2026-12-01T00:00:00.000Z',
        registrationEnd: '2026-12-25T00:00:00.000Z', // Past deadline!
        submissionDeadline: '2026-12-15T23:59:59.000Z',
        judgingStart: '2026-12-16T00:00:00.000Z',
        judgingEnd: '2026-12-20T23:59:59.000Z',
        resultsPublishAt: '2026-12-22T12:00:00.000Z'
      })
    });
    assert.equal(badDatesRes.status, 400);
    const badDatesBody = await badDatesRes.json();
    assert.ok(badDatesBody.error.message.includes('registrationEnd'));
  });

  // 6. Ownership Enforcement on Updates
  test('6. Event update enforces ownership (non-owner cannot modify)', async () => {
    // Create an event under Lead Organizer
    const createRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Protected Event',
        slug: 'protected-event',
        description: 'Original description',
        registrationStart: '2026-12-01T00:00:00.000Z',
        registrationEnd: '2026-12-10T00:00:00.000Z',
        submissionDeadline: '2026-12-15T23:59:59.000Z',
        judgingStart: '2026-12-16T00:00:00.000Z',
        judgingEnd: '2026-12-20T23:59:59.000Z',
        resultsPublishAt: '2026-12-22T12:00:00.000Z'
      })
    });
    const created = await createRes.json();
    const eventId = created.event.id;

    // Participant attempts to update -> 403 Forbidden
    const participantUpdate = await fetch(`${baseUrl}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({ name: 'Tampered Event' })
    });
    assert.equal(participantUpdate.status, 403);

    // Owner updates -> 200 OK
    const ownerUpdate = await fetch(`${baseUrl}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({ name: 'Updated by Owner' })
    });
    assert.equal(ownerUpdate.status, 200);
    const updated = await ownerUpdate.json();
    assert.equal(updated.event.name, 'Updated by Owner');
  });

  // 7. Track Management CRUD & Duplicate Protection
  test('7. Track management: CRUD, authorization, and duplicate prevention', async () => {
    const eventId = 'event_dogfood_2026';

    // Participant cannot create track -> 403
    const participantCreate = await fetch(`${baseUrl}/events/${eventId}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_participant'
      },
      body: JSON.stringify({ name: 'Hacker Track', description: 'desc' })
    });
    assert.equal(participantCreate.status, 403);

    // Organizer creates new track -> 201
    const createRes = await fetch(`${baseUrl}/events/${eventId}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Security & Verification',
        slug: 'security-verification',
        description: 'Cryptographic proofs and security analysis'
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    const trackId = created.track.id;
    assert.equal(created.track.slug, 'security-verification');

    // Duplicate track slug creation -> 409 Conflict
    const dupRes = await fetch(`${baseUrl}/events/${eventId}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Another Security',
        slug: 'security-verification',
        description: 'Duplicate slug'
      })
    });
    assert.equal(dupRes.status, 409);

    // Update track -> 200
    const updateRes = await fetch(`${baseUrl}/events/${eventId}/tracks/${trackId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Security, Privacy & Verification'
      })
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.track.name, 'Security, Privacy & Verification');

    // Delete track -> 200
    const deleteRes = await fetch(`${baseUrl}/events/${eventId}/tracks/${trackId}`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });
    assert.equal(deleteRes.status, 200);
  });

  // 8. Prize Management CRUD & Monetary Validation
  test('8. Prize management: CRUD, integer currency validation, and ordering', async () => {
    const eventId = 'event_dogfood_2026';

    // Negative prize amount -> 400 Bad Request
    const negativeRes = await fetch(`${baseUrl}/events/${eventId}/prizes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Negative Prize',
        amount: -100,
        currency: 'USD'
      })
    });
    assert.equal(negativeRes.status, 400);

    // Floating point prize -> 400 Bad Request (non-integer)
    const floatRes = await fetch(`${baseUrl}/events/${eventId}/prizes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Float Prize',
        amount: 100.55,
        currency: 'USD'
      })
    });
    assert.equal(floatRes.status, 400);

    // Valid prize creation -> 201 Created
    const createRes = await fetch(`${baseUrl}/events/${eventId}/prizes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Audience Choice',
        description: 'Voted by hackathon attendees',
        amount: 1500,
        currency: 'USD',
        position: 4
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    const prizeId = created.prize.id;
    assert.equal(created.prize.amount, 1500);

    // Update prize -> 200
    const updateRes = await fetch(`${baseUrl}/events/${eventId}/prizes/${prizeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        amount: 2000
      })
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.prize.amount, 2000);

    // Delete prize -> 200
    const deleteRes = await fetch(`${baseUrl}/events/${eventId}/prizes/${prizeId}`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });
    assert.equal(deleteRes.status, 200);
  });

  // 9. Cascade Deletion
  test('9. Deleting an event cascades and deletes all associated tracks and prizes', async () => {
    // Create temporary event with a track and prize
    const createRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({
        name: 'Ephemeral Event',
        slug: 'ephemeral-event',
        description: 'To be deleted',
        registrationStart: '2026-12-01T00:00:00.000Z',
        registrationEnd: '2026-12-10T00:00:00.000Z',
        submissionDeadline: '2026-12-15T23:59:59.000Z',
        judgingStart: '2026-12-16T00:00:00.000Z',
        judgingEnd: '2026-12-20T23:59:59.000Z',
        resultsPublishAt: '2026-12-22T12:00:00.000Z'
      })
    });
    const created = await createRes.json();
    const eventId = created.event.id;

    // Add track
    await fetch(`${baseUrl}/events/${eventId}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({ name: 'Track To Delete', description: 'desc' })
    });

    // Add prize
    await fetch(`${baseUrl}/events/${eventId}/prizes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dogfood_token_organizer'
      },
      body: JSON.stringify({ name: 'Prize To Delete', amount: 500 })
    });

    const db = getDatabase();
    assert.equal(
      (db.prepare('SELECT count(*) as c FROM event_tracks WHERE event_id = ?').get(eventId) as any).c,
      1
    );
    assert.equal(
      (db.prepare('SELECT count(*) as c FROM event_prizes WHERE event_id = ?').get(eventId) as any).c,
      1
    );

    // Delete event
    const deleteRes = await fetch(`${baseUrl}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer dogfood_token_organizer'
      }
    });
    assert.equal(deleteRes.status, 200);

    // Verify cascade in SQLite
    assert.equal(
      (db.prepare('SELECT count(*) as c FROM event_tracks WHERE event_id = ?').get(eventId) as any).c,
      0,
      'Tracks must be cascade deleted'
    );
    assert.equal(
      (db.prepare('SELECT count(*) as c FROM event_prizes WHERE event_id = ?').get(eventId) as any).c,
      0,
      'Prizes must be cascade deleted'
    );
  });
});
