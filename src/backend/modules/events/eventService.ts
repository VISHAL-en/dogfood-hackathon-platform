import { getDatabase } from '../../database/db';
import { generateId } from '../../utils/crypto';
import {
  HackathonEvent,
  EventTrack,
  EventPrize,
  EventDetail,
  EventStatus,
  CreateEventInput,
  UpdateEventInput,
  CreateTrackInput,
  UpdateTrackInput,
  CreatePrizeInput,
  UpdatePrizeInput,
  AuthUser,
  UserRole
} from '../../../shared/types';

export class EventServiceError extends Error {
  constructor(
    message: string,
    public code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'EventServiceError';
  }
}

const PUBLIC_STATUSES: EventStatus[] = [
  'published',
  'registration_open',
  'registration_closed',
  'judging_open',
  'judging_closed',
  'results_published'
];

export class EventService {
  /**
   * Validates date strings and enforces chronological lifecycle sequence.
   */
  static validateDates(dates: {
    registrationStart: string;
    registrationEnd: string;
    submissionDeadline: string;
    judgingStart: string;
    judgingEnd: string;
    resultsPublishAt: string;
  }): void {
    const regStart = new Date(dates.registrationStart).getTime();
    const regEnd = new Date(dates.registrationEnd).getTime();
    const subDeadline = new Date(dates.submissionDeadline).getTime();
    const judgeStart = new Date(dates.judgingStart).getTime();
    const judgeEnd = new Date(dates.judgingEnd).getTime();
    const resultsAt = new Date(dates.resultsPublishAt).getTime();

    if (
      isNaN(regStart) ||
      isNaN(regEnd) ||
      isNaN(subDeadline) ||
      isNaN(judgeStart) ||
      isNaN(judgeEnd) ||
      isNaN(resultsAt)
    ) {
      throw new EventServiceError('One or more dates are invalid ISO UTC strings', 'BAD_REQUEST');
    }

    if (regStart > regEnd) {
      throw new EventServiceError('registrationStart must be on or before registrationEnd', 'BAD_REQUEST');
    }
    if (regEnd > subDeadline) {
      throw new EventServiceError('registrationEnd must be on or before submissionDeadline', 'BAD_REQUEST');
    }
    if (subDeadline > judgeStart) {
      throw new EventServiceError('submissionDeadline must be on or before judgingStart', 'BAD_REQUEST');
    }
    if (judgeStart > judgeEnd) {
      throw new EventServiceError('judgingStart must be on or before judgingEnd', 'BAD_REQUEST');
    }
    if (judgeEnd > resultsAt) {
      throw new EventServiceError('judgingEnd must be on or before resultsPublishAt', 'BAD_REQUEST');
    }
  }

  /**
   * Validates slug format (lowercase alphanumeric and hyphens).
   */
  static validateSlug(slug: string): void {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slug || !slugRegex.test(slug)) {
      throw new EventServiceError(
        'Slug must consist only of lowercase alphanumeric characters separated by hyphens (e.g. "hackathon-2026")',
        'BAD_REQUEST'
      );
    }
  }

  /**
   * Creates a new hackathon event.
   */
  static createEvent(organizerId: string, input: CreateEventInput): HackathonEvent {
    if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
      throw new EventServiceError('Event name is required', 'BAD_REQUEST');
    }
    if (!input.description || typeof input.description !== 'string') {
      throw new EventServiceError('Event description is required', 'BAD_REQUEST');
    }

    const cleanSlug = input.slug?.trim().toLowerCase() || '';
    this.validateSlug(cleanSlug);
    this.validateDates(input);

    const db = getDatabase();

    // Verify organizer exists
    const organizer = db.prepare('SELECT id, name FROM users WHERE id = ?').get(organizerId) as
      | { id: string; name: string }
      | undefined;
    if (!organizer) {
      throw new EventServiceError('Organizer does not exist', 'BAD_REQUEST');
    }

    // Verify unique slug
    const existing = db.prepare('SELECT id FROM events WHERE slug = ? COLLATE NOCASE').get(cleanSlug);
    if (existing) {
      throw new EventServiceError(`Event with slug "${cleanSlug}" already exists`, 'CONFLICT');
    }

    const eventId = generateId('evt');
    const now = new Date().toISOString();
    const status: EventStatus = input.status || 'draft';

    db.prepare(`
      INSERT INTO events (
        id, organizer_id, name, slug, description, status,
        registration_start, registration_end, submission_deadline,
        judging_start, judging_end, results_publish_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      organizerId,
      input.name.trim(),
      cleanSlug,
      input.description.trim(),
      status,
      input.registrationStart,
      input.registrationEnd,
      input.submissionDeadline,
      input.judgingStart,
      input.judgingEnd,
      input.resultsPublishAt,
      now,
      now
    );

    return {
      id: eventId,
      organizerId,
      organizerName: organizer.name,
      name: input.name.trim(),
      slug: cleanSlug,
      description: input.description.trim(),
      status,
      registrationStart: input.registrationStart,
      registrationEnd: input.registrationEnd,
      submissionDeadline: input.submissionDeadline,
      judgingStart: input.judgingStart,
      judgingEnd: input.judgingEnd,
      resultsPublishAt: input.resultsPublishAt,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Updates an existing hackathon event with ownership authorization.
   */
  static updateEvent(
    eventId: string,
    userId: string,
    userRole: UserRole,
    input: UpdateEventInput
  ): HackathonEvent {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!row) {
      throw new EventServiceError('Event not found', 'NOT_FOUND');
    }

    // Authorization: only event owner or admin can modify
    if (row.organizer_id !== userId && userRole !== 'admin') {
      throw new EventServiceError('Forbidden: You do not have permission to modify this event', 'FORBIDDEN');
    }

    const merged = {
      name: input.name !== undefined ? input.name.trim() : row.name,
      slug: input.slug !== undefined ? input.slug.trim().toLowerCase() : row.slug,
      description: input.description !== undefined ? input.description.trim() : row.description,
      status: input.status !== undefined ? input.status : row.status,
      registrationStart: input.registrationStart || row.registration_start,
      registrationEnd: input.registrationEnd || row.registration_end,
      submissionDeadline: input.submissionDeadline || row.submission_deadline,
      judgingStart: input.judgingStart || row.judging_start,
      judgingEnd: input.judgingEnd || row.judging_end,
      resultsPublishAt: input.resultsPublishAt || row.results_publish_at
    };

    this.validateSlug(merged.slug);
    this.validateDates(merged);

    // Verify slug uniqueness if slug changed
    if (merged.slug !== row.slug) {
      const existing = db.prepare('SELECT id FROM events WHERE slug = ? COLLATE NOCASE AND id != ?').get(
        merged.slug,
        eventId
      );
      if (existing) {
        throw new EventServiceError(`Event with slug "${merged.slug}" already exists`, 'CONFLICT');
      }
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE events SET
        name = ?,
        slug = ?,
        description = ?,
        status = ?,
        registration_start = ?,
        registration_end = ?,
        submission_deadline = ?,
        judging_start = ?,
        judging_end = ?,
        results_publish_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.slug,
      merged.description,
      merged.status,
      merged.registrationStart,
      merged.registrationEnd,
      merged.submissionDeadline,
      merged.judgingStart,
      merged.judgingEnd,
      merged.resultsPublishAt,
      now,
      eventId
    );

    return {
      id: eventId,
      organizerId: row.organizer_id,
      name: merged.name,
      slug: merged.slug,
      description: merged.description,
      status: merged.status,
      registrationStart: merged.registrationStart,
      registrationEnd: merged.registrationEnd,
      submissionDeadline: merged.submissionDeadline,
      judgingStart: merged.judgingStart,
      judgingEnd: merged.judgingEnd,
      resultsPublishAt: merged.resultsPublishAt,
      createdAt: row.created_at,
      updatedAt: now
    };
  }

  /**
   * Retrieves public or owner details for an event by ID or Slug.
   */
  static getEventByIdOrSlug(idOrSlug: string, viewingUser?: AuthUser | null): EventDetail | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT
        e.*,
        u.name as organizer_name
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      WHERE e.id = ? OR e.slug = ? COLLATE NOCASE
    `).get(idOrSlug, idOrSlug) as any;

    if (!row) {
      return null;
    }

    // Visibility gating: draft/archived events are visible only to the event owner or an admin
    const isPublic = PUBLIC_STATUSES.includes(row.status);
    const isOwnerOrAdmin =
      viewingUser && (viewingUser.id === row.organizer_id || viewingUser.role === 'admin');

    if (!isPublic && !isOwnerOrAdmin) {
      return null;
    }

    const tracks = db.prepare('SELECT * FROM event_tracks WHERE event_id = ? ORDER BY name ASC').all(row.id) as any[];
    const prizes = db.prepare('SELECT * FROM event_prizes WHERE event_id = ? ORDER BY position ASC, amount DESC').all(row.id) as any[];

    return {
      id: row.id,
      organizerId: row.organizer_id,
      organizerName: row.organizer_name,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      registrationStart: row.registration_start,
      registrationEnd: row.registration_end,
      submissionDeadline: row.submission_deadline,
      judgingStart: row.judging_start,
      judgingEnd: row.judging_end,
      resultsPublishAt: row.results_publish_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tracks: tracks.map((t) => ({
        id: t.id,
        eventId: t.event_id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      })),
      prizes: prizes.map((p) => ({
        id: p.id,
        eventId: p.event_id,
        name: p.name,
        description: p.description,
        amount: p.amount,
        currency: p.currency,
        position: p.position,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }))
    };
  }

  /**
   * Lists events for public discovery or organizer management.
   */
  static listEvents(
    options: { search?: string; status?: EventStatus; organizerId?: string } = {},
    viewingUser?: AuthUser | null
  ): HackathonEvent[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    const isOwnerOrAdmin =
      viewingUser && (viewingUser.role === 'admin' || (options.organizerId && viewingUser.id === options.organizerId));

    if (!isOwnerOrAdmin) {
      conditions.push(`e.status IN (${PUBLIC_STATUSES.map(() => '?').join(',')})`);
      params.push(...PUBLIC_STATUSES);
    }

    if (options.status) {
      conditions.push('e.status = ?');
      params.push(options.status);
    }

    if (options.organizerId) {
      conditions.push('e.organizer_id = ?');
      params.push(options.organizerId);
    }

    if (options.search && options.search.trim()) {
      conditions.push('(e.name LIKE ? OR e.description LIKE ?)');
      const term = `%${options.search.trim()}%`;
      params.push(term, term);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT
        e.*,
        u.name as organizer_name
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      ${whereClause}
      ORDER BY e.submission_deadline DESC
    `;

    const rows = db.prepare(sql).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      organizerId: r.organizer_id,
      organizerName: r.organizer_name,
      name: r.name,
      slug: r.slug,
      description: r.description,
      status: r.status,
      registrationStart: r.registration_start,
      registrationEnd: r.registration_end,
      submissionDeadline: r.submission_deadline,
      judgingStart: r.judging_start,
      judgingEnd: r.judging_end,
      resultsPublishAt: r.results_publish_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  /**
   * Deletes an event and all cascading tracks and prizes.
   */
  static deleteEvent(eventId: string, userId: string, userRole: UserRole): boolean {
    const db = getDatabase();
    const row = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as
      | { organizer_id: string }
      | undefined;
    if (!row) {
      throw new EventServiceError('Event not found', 'NOT_FOUND');
    }

    if (row.organizer_id !== userId && userRole !== 'admin') {
      throw new EventServiceError('Forbidden: You do not have permission to delete this event', 'FORBIDDEN');
    }

    const result = db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    return result.changes > 0;
  }

  // --------------------------------------------------------------------------
  // TRACKS
  // --------------------------------------------------------------------------

  static createTrack(
    eventId: string,
    userId: string,
    userRole: UserRole,
    input: CreateTrackInput
  ): EventTrack {
    if (!input.name || !input.name.trim()) {
      throw new EventServiceError('Track name is required', 'BAD_REQUEST');
    }

    const db = getDatabase();
    const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as
      | { organizer_id: string }
      | undefined;
    if (!event) {
      throw new EventServiceError('Event not found', 'NOT_FOUND');
    }

    if (event.organizer_id !== userId && userRole !== 'admin') {
      throw new EventServiceError('Forbidden: You do not have permission to modify this event', 'FORBIDDEN');
    }

    const slug = (input.slug || input.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    this.validateSlug(slug);

    const existing = db.prepare('SELECT id FROM event_tracks WHERE event_id = ? AND (slug = ? OR name = ?)').get(
      eventId,
      slug,
      input.name.trim()
    );
    if (existing) {
      throw new EventServiceError(`Track "${input.name}" or slug "${slug}" already exists for this event`, 'CONFLICT');
    }

    const trackId = generateId('trk');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO event_tracks (id, event_id, name, slug, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(trackId, eventId, input.name.trim(), slug, input.description?.trim() || '', now, now);

    return {
      id: trackId,
      eventId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || '',
      createdAt: now,
      updatedAt: now
    };
  }

  static listTracks(eventId: string): EventTrack[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM event_tracks WHERE event_id = ? ORDER BY name ASC').all(eventId) as any[];
    return rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  static updateTrack(
    eventId: string,
    trackId: string,
    userId: string,
    userRole: UserRole,
    input: UpdateTrackInput
  ): EventTrack {
    const db = getDatabase();
    const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as any;
    if (!event) throw new EventServiceError('Event not found', 'NOT_FOUND');
    if (event.organizer_id !== userId && userRole !== 'admin') {
      throw new EventServiceError('Forbidden: You do not have permission to modify this event', 'FORBIDDEN');
    }

    const track = db.prepare('SELECT * FROM event_tracks WHERE id = ? AND event_id = ?').get(trackId, eventId) as any;
    if (!track) throw new EventServiceError('Track not found', 'NOT_FOUND');

    const newName = input.name !== undefined ? input.name.trim() : track.name;
    const newSlug = input.slug !== undefined ? input.slug.trim().toLowerCase() : track.slug;
    const newDesc = input.description !== undefined ? input.description.trim() : track.description;

    this.validateSlug(newSlug);

    const conflict = db.prepare(`
      SELECT id FROM event_tracks
      WHERE event_id = ? AND id != ? AND (slug = ? OR name = ?)
    `).get(eventId, trackId, newSlug, newName);
    if (conflict) {
      throw new EventServiceError(`Another track with name "${newName}" or slug "${newSlug}" already exists`, 'CONFLICT');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE event_tracks SET name = ?, slug = ?, description = ?, updated_at = ?
      WHERE id = ?
    `).run(newName, newSlug, newDesc, now, trackId);

    return {
      id: trackId,
      eventId,
      name: newName,
      slug: newSlug,
      description: newDesc,
      createdAt: track.created_at,
      updatedAt: now
    };
  }

  static deleteTrack(eventId: string, trackId: string, userId: string, userRole: UserRole): boolean {
    const db = getDatabase();
    const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as any;
    if (!event) throw new EventServiceError('Event not found', 'NOT_FOUND');
    if (event.organizer_id !== userId && userRole !== 'admin') {
      throw new EventServiceError('Forbidden: You do not have permission to modify this event', 'FORBIDDEN');
    }

    const result = db.prepare('DELETE FROM event_tracks WHERE id = ? AND event_id = ?').run(trackId, eventId);
    if (result.changes === 0) {
      throw new EventServiceError('Track not found', 'NOT_FOUND');
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // PRIZES
  // --------------------------------------------------------------------------

  static createPrize(
    eventId: string,
    userId: string,
    userRole: UserRole,
    input: CreatePrizeInput
  ): EventPrize {
    if (!input.name || !input.name.trim()) {
      throw new EventServiceError('Prize name is required', 'BAD_REQUEST');
    }
    if (typeof input.amount !== 'number' || input.amount < 0 || !Number.isInteger(input.amount)) {
      throw new EventServiceError('Prize amount must be a non-negative integer', 'BAD_REQUEST');
    }

    const db = getDatabase();
    const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as any;
    if (!event) throw new EventServiceError('Event not found', 'NOT_FOUND');
    if (event.organizer_id !== userId && userRole !== 'admin') {
      throw new EventServiceError('Forbidden: You do not have permission to modify this event', 'FORBIDDEN');
    }

    const prizeId = generateId('prz');
    const now = new Date().toISOString();
    const currency = (input.currency || 'USD').toUpperCase();
    const position = input.position !== undefined ? input.position : 0;

    db.prepare(`
      INSERT INTO event_prizes (id, event_id, name, description, amount, currency, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(prizeId, eventId, input.name.trim(), input.description?.trim() || '', input.amount, currency, position, now, now);

    return {
      id: prizeId,
      eventId,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      amount: input.amount,
      currency,
      position,
      createdAt: now,
      updatedAt: now
    };
  }

  static listPrizes(eventId: string): EventPrize[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM event_prizes WHERE event_id = ? ORDER BY position ASC, amount DESC').all(eventId) as any[];
    return rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      name: r.name,
      description: r.description,
      amount: r.amount,
      currency: r.currency,
      position: r.position,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  static updatePrize(
    eventId: string,
    prizeId: string,
    userId: string,
    userRole: UserRole,
    input: UpdatePrizeInput
  ): EventPrize {
    const db = getDatabase();
    const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as any;
    if (!event) throw new EventServiceError('Event not found', 'NOT_FOUND');
    if (event.organizer_id !== userId && userRole !== 'admin') {
      throw new EventServiceError('Forbidden: You do not have permission to modify this event', 'FORBIDDEN');
    }

    const prize = db.prepare('SELECT * FROM event_prizes WHERE id = ? AND event_id = ?').get(prizeId, eventId) as any;
    if (!prize) throw new EventServiceError('Prize not found', 'NOT_FOUND');

    const newName = input.name !== undefined ? input.name.trim() : prize.name;
    const newDesc = input.description !== undefined ? input.description.trim() : prize.description;
    const newAmount = input.amount !== undefined ? input.amount : prize.amount;
    const newCurrency = input.currency !== undefined ? input.currency.toUpperCase() : prize.currency;
    const newPos = input.position !== undefined ? input.position : prize.position;

    if (typeof newAmount !== 'number' || newAmount < 0 || !Number.isInteger(newAmount)) {
      throw new EventServiceError('Prize amount must be a non-negative integer', 'BAD_REQUEST');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE event_prizes SET name = ?, description = ?, amount = ?, currency = ?, position = ?, updated_at = ?
      WHERE id = ?
    `).run(newName, newDesc, newAmount, newCurrency, newPos, now, prizeId);

    return {
      id: prizeId,
      eventId,
      name: newName,
      description: newDesc,
      amount: newAmount,
      currency: newCurrency,
      position: newPos,
      createdAt: prize.created_at,
      updatedAt: now
    };
  }

  static deletePrize(eventId: string, prizeId: string, userId: string, userRole: UserRole): boolean {
    const db = getDatabase();
    const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as any;
    if (!event) throw new EventServiceError('Event not found', 'NOT_FOUND');
    if (event.organizer_id !== userId && userRole !== 'admin') {
      throw new EventServiceError('Forbidden: You do not have permission to modify this event', 'FORBIDDEN');
    }

    const result = db.prepare('DELETE FROM event_prizes WHERE id = ? AND event_id = ?').run(prizeId, eventId);
    if (result.changes === 0) {
      throw new EventServiceError('Prize not found', 'NOT_FOUND');
    }
    return true;
  }
}
