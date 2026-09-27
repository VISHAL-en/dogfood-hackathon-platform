import { getDatabase } from '../../database/db';
import { generateId } from '../../utils/crypto';
import {
  ProjectSubmission,
  SubmissionDetail,
  SubmissionMemberInfo,
  GalleryItem,
  GalleryResponse,
  CreateSubmissionInput,
  UpdateSubmissionInput,
  UserRole,
  EventStatus
} from '../../../shared/types';

export class SubmissionServiceError extends Error {
  constructor(
    message: string,
    public code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'UNAUTHORIZED' = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'SubmissionServiceError';
  }
}

const PUBLIC_EVENT_STATUSES: EventStatus[] = [
  'published',
  'registration_open',
  'registration_closed',
  'judging_open',
  'judging_closed',
  'results_published'
];

interface SubmissionRow {
  id: string;
  event_id: string;
  team_id: string;
  track_id: string | null;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
  video_url: string | null;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export class SubmissionService {
  /**
   * Normalizes a submission slug or generates one from the title.
   */
  static normalizeSlug(title: string, customSlug?: string): string {
    const raw = (customSlug && customSlug.trim().length > 0) ? customSlug.trim() : title.trim();
    const normalized = raw
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalized || normalized.length === 0) {
      throw new SubmissionServiceError(
        'Submission slug must contain valid alphanumeric characters',
        'BAD_REQUEST'
      );
    }

    return normalized;
  }

  /**
   * Validates URLs when provided (must be http:// or https://).
   */
  static validateUrl(url: string | null | undefined, fieldName: string): string | null {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return null;
    }

    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error();
      }
      return trimmed;
    } catch {
      throw new SubmissionServiceError(
        `Invalid URL format for ${fieldName}. Must be a valid http:// or https:// URL`,
        'BAD_REQUEST'
      );
    }
  }

  /**
   * Validates non-empty text fields.
   */
  static validateRequiredText(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new SubmissionServiceError(
        `${fieldName} is required and cannot be empty or whitespace only`,
        'BAD_REQUEST'
      );
    }
    return value.trim();
  }

  /**
   * Transforms a database row into a ProjectSubmission DTO.
   */
  private static toSubmissionDTO(row: SubmissionRow): ProjectSubmission {
    return {
      id: row.id,
      eventId: row.event_id,
      teamId: row.team_id,
      trackId: row.track_id,
      title: row.title,
      slug: row.slug,
      shortDescription: row.short_description,
      description: row.description,
      repoUrl: row.repo_url,
      demoUrl: row.demo_url,
      videoUrl: row.video_url,
      status: row.status,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Creates a draft submission for a team in an event.
   * Only the team captain can create a submission.
   * Validates server-side event state and submission deadline.
   */
  static createSubmission(
    eventId: string,
    teamId: string,
    userId: string,
    input: CreateSubmissionInput
  ): ProjectSubmission {
    const db = getDatabase();

    const title = this.validateRequiredText(input.title, 'Title');
    const shortDescription = this.validateRequiredText(
      input.shortDescription || (input as any).short_description,
      'Short description'
    );
    const description = this.validateRequiredText(input.description, 'Description');
    const repoUrl = this.validateUrl(input.repoUrl || (input as any).repo_url, 'repoUrl');
    const demoUrl = this.validateUrl(input.demoUrl || (input as any).demo_url, 'demoUrl');
    const videoUrl = this.validateUrl(input.videoUrl || (input as any).video_url, 'videoUrl');
    const trackId = input.trackId || (input as any).track_id || null;

    const slug = this.normalizeSlug(title, input.slug);

    return db.transaction(() => {
      // 1. Verify Event existence, state, and deadline
      const event = db.prepare(`
        SELECT id, name, status, submission_deadline
        FROM events
        WHERE id = ?
      `).get(eventId) as { id: string; name: string; status: EventStatus; submission_deadline: string } | undefined;

      if (!event) {
        throw new SubmissionServiceError(`Event "${eventId}" not found`, 'NOT_FOUND');
      }

      // Check event lifecycle state
      if (['judging_open', 'judging_closed', 'results_published', 'archived'].includes(event.status)) {
        throw new SubmissionServiceError('Event is closed for submissions', 'BAD_REQUEST');
      }

      if (event.status === 'draft') {
        throw new SubmissionServiceError('Event is in draft state and not open for submissions', 'BAD_REQUEST');
      }

      // Check server deadline
      const now = new Date();
      const deadline = new Date(event.submission_deadline);
      if (now.getTime() > deadline.getTime()) {
        throw new SubmissionServiceError('Submission deadline has passed', 'BAD_REQUEST');
      }

      // 2. Verify Team existence and event ownership
      const team = db.prepare(`
        SELECT id, event_id, name FROM teams WHERE id = ?
      `).get(teamId) as { id: string; event_id: string; name: string } | undefined;

      if (!team) {
        throw new SubmissionServiceError(`Team "${teamId}" not found`, 'NOT_FOUND');
      }

      if (team.event_id !== eventId) {
        throw new SubmissionServiceError('Team belongs to another event', 'BAD_REQUEST');
      }

      // 3. Verify User membership and Captain role
      const member = db.prepare(`
        SELECT role FROM team_members WHERE team_id = ? AND user_id = ?
      `).get(teamId, userId) as { role: string } | undefined;

      if (!member) {
        throw new SubmissionServiceError('User is not a member of this team', 'FORBIDDEN');
      }

      if (member.role !== 'captain') {
        throw new SubmissionServiceError('Only the team captain can create or manage submissions', 'FORBIDDEN');
      }

      // 4. Verify Track belongs to same event if provided
      if (trackId) {
        const track = db.prepare(`
          SELECT id, event_id FROM event_tracks WHERE id = ?
        `).get(trackId) as { id: string; event_id: string } | undefined;

        if (!track || track.event_id !== eventId) {
          throw new SubmissionServiceError('Track does not exist or belongs to another event', 'BAD_REQUEST');
        }
      }

      // 5. Verify no existing submission for this team in this event
      const existingTeamSub = db.prepare(`
        SELECT id FROM submissions WHERE event_id = ? AND team_id = ?
      `).get(eventId, teamId);

      if (existingTeamSub) {
        throw new SubmissionServiceError('Team already has a submission for this event', 'CONFLICT');
      }

      // 6. Verify slug uniqueness within event
      const existingSlugSub = db.prepare(`
        SELECT id FROM submissions WHERE event_id = ? AND slug = ?
      `).get(eventId, slug);

      if (existingSlugSub) {
        throw new SubmissionServiceError(`Submission with slug "${slug}" already exists for this event`, 'CONFLICT');
      }

      const id = generateId('sub');
      const nowIso = now.toISOString();

      db.prepare(`
        INSERT INTO submissions (
          id, event_id, team_id, track_id, title, slug,
          short_description, description, repo_url, demo_url, video_url,
          status, submitted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?)
      `).run(
        id,
        eventId,
        teamId,
        trackId,
        title,
        slug,
        shortDescription,
        description,
        repoUrl,
        demoUrl,
        videoUrl,
        nowIso,
        nowIso
      );

      const createdRow = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as SubmissionRow;
      return this.toSubmissionDTO(createdRow);
    })();
  }

  /**
   * Updates an existing draft or submission before the deadline.
   * Only the team captain can edit.
   */
  static updateSubmission(
    submissionId: string,
    userId: string,
    userRole: UserRole,
    input: UpdateSubmissionInput
  ): ProjectSubmission {
    const db = getDatabase();

    return db.transaction(() => {
      const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId) as SubmissionRow | undefined;
      if (!sub) {
        throw new SubmissionServiceError(`Submission "${submissionId}" not found`, 'NOT_FOUND');
      }

      // Check event state & deadline
      const event = db.prepare(`
        SELECT id, status, submission_deadline FROM events WHERE id = ?
      `).get(sub.event_id) as { id: string; status: EventStatus; submission_deadline: string } | undefined;

      if (!event) {
        throw new SubmissionServiceError('Associated event not found', 'NOT_FOUND');
      }

      if (['judging_open', 'judging_closed', 'results_published', 'archived'].includes(event.status)) {
        throw new SubmissionServiceError('Event is closed for submissions', 'BAD_REQUEST');
      }

      const now = new Date();
      const deadline = new Date(event.submission_deadline);
      if (now.getTime() > deadline.getTime()) {
        throw new SubmissionServiceError('Submission deadline has passed', 'BAD_REQUEST');
      }

      // Authorization: User must be captain of team or admin
      if (userRole !== 'admin') {
        const member = db.prepare(`
          SELECT role FROM team_members WHERE team_id = ? AND user_id = ?
        `).get(sub.team_id, userId) as { role: string } | undefined;

        if (!member) {
          throw new SubmissionServiceError('User is not a member of the submission team', 'FORBIDDEN');
        }

        if (member.role !== 'captain') {
          throw new SubmissionServiceError('Only the team captain can edit the submission', 'FORBIDDEN');
        }
      }

      let title = sub.title;
      if (input.title !== undefined) {
        title = this.validateRequiredText(input.title, 'Title');
      }

      let shortDescription = sub.short_description;
      const inputShortDesc = input.shortDescription || (input as any).short_description;
      if (inputShortDesc !== undefined) {
        shortDescription = this.validateRequiredText(inputShortDesc, 'Short description');
      }

      let description = sub.description;
      if (input.description !== undefined) {
        description = this.validateRequiredText(input.description, 'Description');
      }

      let repoUrl = sub.repo_url;
      const inputRepoUrl = input.repoUrl !== undefined ? input.repoUrl : (input as any).repo_url;
      if (inputRepoUrl !== undefined) {
        repoUrl = this.validateUrl(inputRepoUrl, 'repoUrl');
      }

      let demoUrl = sub.demo_url;
      const inputDemoUrl = input.demoUrl !== undefined ? input.demoUrl : (input as any).demo_url;
      if (inputDemoUrl !== undefined) {
        demoUrl = this.validateUrl(inputDemoUrl, 'demoUrl');
      }

      let videoUrl = sub.video_url;
      const inputVideoUrl = input.videoUrl !== undefined ? input.videoUrl : (input as any).video_url;
      if (inputVideoUrl !== undefined) {
        videoUrl = this.validateUrl(inputVideoUrl, 'videoUrl');
      }

      let trackId = sub.track_id;
      const inputTrackId = input.trackId !== undefined ? input.trackId : (input as any).track_id;
      if (inputTrackId !== undefined) {
        if (inputTrackId) {
          const track = db.prepare(`
            SELECT id, event_id FROM event_tracks WHERE id = ?
          `).get(inputTrackId) as { id: string; event_id: string } | undefined;

          if (!track || track.event_id !== sub.event_id) {
            throw new SubmissionServiceError('Track does not exist or belongs to another event', 'BAD_REQUEST');
          }
          trackId = inputTrackId;
        } else {
          trackId = null;
        }
      }

      let slug = sub.slug;
      if (input.slug !== undefined || input.title !== undefined) {
        const nextSlug = this.normalizeSlug(title, input.slug || (input.slug === undefined ? sub.slug : undefined));
        if (nextSlug !== sub.slug) {
          const conflict = db.prepare(`
            SELECT id FROM submissions WHERE event_id = ? AND slug = ? AND id != ?
          `).get(sub.event_id, nextSlug, sub.id);
          if (conflict) {
            throw new SubmissionServiceError(
              `Submission with slug "${nextSlug}" already exists for this event`,
              'CONFLICT'
            );
          }
          slug = nextSlug;
        }
      }

      const nowIso = now.toISOString();

      db.prepare(`
        UPDATE submissions SET
          title = ?,
          slug = ?,
          short_description = ?,
          description = ?,
          repo_url = ?,
          demo_url = ?,
          video_url = ?,
          track_id = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        title,
        slug,
        shortDescription,
        description,
        repoUrl,
        demoUrl,
        videoUrl,
        trackId,
        nowIso,
        sub.id
      );

      const updatedRow = db.prepare('SELECT * FROM submissions WHERE id = ?').get(sub.id) as SubmissionRow;
      return this.toSubmissionDTO(updatedRow);
    })();
  }

  /**
   * Finalizes a submission by transitioning status to 'submitted'.
   * Sets server-assigned submitted_at timestamp.
   * Only the team captain can submit.
   */
  static submitProject(
    submissionId: string,
    userId: string,
    userRole: UserRole
  ): ProjectSubmission {
    const db = getDatabase();

    return db.transaction(() => {
      const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId) as SubmissionRow | undefined;
      if (!sub) {
        throw new SubmissionServiceError(`Submission "${submissionId}" not found`, 'NOT_FOUND');
      }

      // Check event state & deadline
      const event = db.prepare(`
        SELECT id, status, submission_deadline FROM events WHERE id = ?
      `).get(sub.event_id) as { id: string; status: EventStatus; submission_deadline: string } | undefined;

      if (!event) {
        throw new SubmissionServiceError('Associated event not found', 'NOT_FOUND');
      }

      if (['judging_open', 'judging_closed', 'results_published', 'archived'].includes(event.status)) {
        throw new SubmissionServiceError('Event is closed for submissions', 'BAD_REQUEST');
      }

      const now = new Date();
      const deadline = new Date(event.submission_deadline);
      if (now.getTime() > deadline.getTime()) {
        throw new SubmissionServiceError('Submission deadline has passed', 'BAD_REQUEST');
      }

      // Authorization: Captain or Admin
      if (userRole !== 'admin') {
        const member = db.prepare(`
          SELECT role FROM team_members WHERE team_id = ? AND user_id = ?
        `).get(sub.team_id, userId) as { role: string } | undefined;

        if (!member) {
          throw new SubmissionServiceError('User is not a member of the submission team', 'FORBIDDEN');
        }

        if (member.role !== 'captain') {
          throw new SubmissionServiceError('Only the team captain can submit the project', 'FORBIDDEN');
        }
      }

      const nowIso = now.toISOString();

      db.prepare(`
        UPDATE submissions SET
          status = 'submitted',
          submitted_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(nowIso, nowIso, sub.id);

      const submittedRow = db.prepare('SELECT * FROM submissions WHERE id = ?').get(sub.id) as SubmissionRow;
      return this.toSubmissionDTO(submittedRow);
    })();
  }

  /**
   * Retrieves a team's submission.
   * Accessible by team members, event organizer, or platform admin.
   */
  static getTeamSubmission(
    eventId: string,
    teamId: string,
    userId: string,
    userRole: UserRole
  ): ProjectSubmission | null {
    const db = getDatabase();

    const team = db.prepare('SELECT id, event_id FROM teams WHERE id = ?').get(teamId) as { id: string; event_id: string } | undefined;
    if (!team || team.event_id !== eventId) {
      throw new SubmissionServiceError('Team not found for this event', 'NOT_FOUND');
    }

    // Check authorization: must be member of team, event organizer, or admin
    if (userRole !== 'admin') {
      const isMember = db.prepare(`
        SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?
      `).get(teamId, userId);

      if (!isMember) {
        const isOrganizer = db.prepare(`
          SELECT 1 FROM events WHERE id = ? AND organizer_id = ?
        `).get(eventId, userId);

        if (!isOrganizer) {
          throw new SubmissionServiceError('Access denied: You do not have permission to view this submission', 'FORBIDDEN');
        }
      }
    }

    const row = db.prepare(`
      SELECT * FROM submissions WHERE event_id = ? AND team_id = ?
    `).get(eventId, teamId) as SubmissionRow | undefined;

    return row ? this.toSubmissionDTO(row) : null;
  }

  /**
   * Retrieves a submission by ID.
   */
  static getSubmissionById(submissionId: string): ProjectSubmission | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId) as SubmissionRow | undefined;
    return row ? this.toSubmissionDTO(row) : null;
  }

  /**
   * Public gallery query engine.
   * Case-insensitive search, event/track filtering, bounded pagination.
   * Strictly returns submitted projects from publicly visible events.
   * Private drafts are NEVER returned.
   */
  static getPublicGallery(query: {
    event?: string;
    track?: string;
    search?: string;
    page?: number | string;
    limit?: number | string;
  }): GalleryResponse {
    const db = getDatabase();

    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
    const parsedLimit = parseInt(String(query.limit || '20'), 10) || 20;
    const limit = Math.min(50, Math.max(1, parsedLimit));
    const offset = (page - 1) * limit;

    const conditions: string[] = [
      "s.status = 'submitted'",
      `e.status IN (${PUBLIC_EVENT_STATUSES.map((s) => `'${s}'`).join(',')})`
    ];
    const params: any[] = [];

    if (query.event && query.event.trim().length > 0) {
      conditions.push('(e.id = ? OR e.slug = ?)');
      params.push(query.event.trim(), query.event.trim());
    }

    if (query.track && query.track.trim().length > 0) {
      conditions.push('(t.id = ? OR t.slug = ?)');
      params.push(query.track.trim(), query.track.trim());
    }

    if (query.search && query.search.trim().length > 0) {
      const searchTerm = `%${query.search.trim()}%`;
      conditions.push('(s.title LIKE ? OR s.short_description LIKE ? OR s.description LIKE ?)');
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.join(' AND ');

    const countRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM submissions s
      JOIN events e ON s.event_id = e.id
      JOIN teams tm ON s.team_id = tm.id
      LEFT JOIN event_tracks t ON s.track_id = t.id
      WHERE ${whereClause}
    `).get(...params) as { total: number };

    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const dataRows = db.prepare(`
      SELECT
        s.id,
        s.title,
        s.slug,
        s.short_description,
        s.description,
        s.repo_url,
        s.demo_url,
        s.video_url,
        s.submitted_at,
        s.created_at,
        s.event_id,
        e.name as event_name,
        e.slug as event_slug,
        s.team_id,
        tm.name as team_name,
        s.track_id,
        t.name as track_name,
        t.slug as track_slug
      FROM submissions s
      JOIN events e ON s.event_id = e.id
      JOIN teams tm ON s.team_id = tm.id
      LEFT JOIN event_tracks t ON s.track_id = t.id
      WHERE ${whereClause}
      ORDER BY s.submitted_at DESC, s.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Array<{
      id: string;
      title: string;
      slug: string;
      short_description: string;
      description: string;
      repo_url: string | null;
      demo_url: string | null;
      video_url: string | null;
      submitted_at: string;
      created_at: string;
      event_id: string;
      event_name: string;
      event_slug: string;
      team_id: string;
      team_name: string;
      track_id: string | null;
      track_name: string | null;
      track_slug: string | null;
    }>;

    const items: GalleryItem[] = dataRows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      shortDescription: row.short_description,
      description: row.description,
      teamId: row.team_id,
      teamName: row.team_name,
      eventId: row.event_id,
      eventName: row.event_name,
      eventSlug: row.event_slug,
      trackId: row.track_id,
      trackName: row.track_name,
      trackSlug: row.track_slug,
      repoUrl: row.repo_url,
      demoUrl: row.demo_url,
      videoUrl: row.video_url,
      submittedAt: row.submitted_at,
      createdAt: row.created_at
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  /**
   * Public project detail endpoint.
   * Returns submitted project details with public team members and metadata.
   * Draft projects return null (404).
   */
  static getPublicProjectDetail(idOrSlug: string): SubmissionDetail | null {
    const db = getDatabase();

    const row = db.prepare(`
      SELECT
        s.id,
        s.event_id,
        s.team_id,
        s.track_id,
        s.title,
        s.slug,
        s.short_description,
        s.description,
        s.repo_url,
        s.demo_url,
        s.video_url,
        s.status,
        s.submitted_at,
        s.created_at,
        s.updated_at,
        e.name as event_name,
        e.slug as event_slug,
        e.status as event_status,
        tm.name as team_name,
        t.name as track_name,
        t.slug as track_slug
      FROM submissions s
      JOIN events e ON s.event_id = e.id
      JOIN teams tm ON s.team_id = tm.id
      LEFT JOIN event_tracks t ON s.track_id = t.id
      WHERE (s.id = ? OR s.slug = ?)
        AND s.status = 'submitted'
    `).get(idOrSlug, idOrSlug) as {
      id: string;
      event_id: string;
      team_id: string;
      track_id: string | null;
      title: string;
      slug: string;
      short_description: string;
      description: string;
      repo_url: string | null;
      demo_url: string | null;
      video_url: string | null;
      status: 'submitted';
      submitted_at: string;
      created_at: string;
      updated_at: string;
      event_name: string;
      event_slug: string;
      event_status: EventStatus;
      team_name: string;
      track_name: string | null;
      track_slug: string | null;
    } | undefined;

    if (!row) {
      return null;
    }

    // Event must be public
    if (!PUBLIC_EVENT_STATUSES.includes(row.event_status)) {
      return null;
    }

    // Fetch team members (public info only: id, userId, userName, role)
    const memberRows = db.prepare(`
      SELECT
        tm.id,
        tm.user_id,
        u.name as user_name,
        tm.role
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role DESC, tm.joined_at ASC
    `).all(row.team_id) as Array<{
      id: string;
      user_id: string;
      user_name: string;
      role: 'captain' | 'member';
    }>;

    const members: SubmissionMemberInfo[] = memberRows.map((m) => ({
      id: m.id,
      userId: m.user_id,
      userName: m.user_name,
      role: m.role
    }));

    return {
      id: row.id,
      eventId: row.event_id,
      teamId: row.team_id,
      trackId: row.track_id,
      title: row.title,
      slug: row.slug,
      shortDescription: row.short_description,
      description: row.description,
      repoUrl: row.repo_url,
      demoUrl: row.demo_url,
      videoUrl: row.video_url,
      status: row.status,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      teamName: row.team_name,
      eventName: row.event_name,
      eventSlug: row.event_slug,
      trackName: row.track_name,
      trackSlug: row.track_slug,
      members
    };
  }
}
