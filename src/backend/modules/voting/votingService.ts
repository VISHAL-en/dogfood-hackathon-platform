import crypto from 'crypto';
import { getDb } from '../../database/db';
import { generateId } from '../../utils/crypto';
import {
  UserRole,
  VotingRound,
  VotingRoundStatus,
  VotingCandidate,
  VotingBallot,
  VotingBallotItem,
  CommunityVote,
  CommunityComment,
  CommunityCommentStatus,
  VotingAuditLogEntry,
  PublicVotingResult,
  PublicVotingResultsResponse
} from '../../../shared/types';

export class VotingServiceError extends Error {
  constructor(
    message: string,
    public code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMIT_EXCEEDED'
  ) {
    super(message);
    this.name = 'VotingServiceError';
  }
}

// Rate limiting constants
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const VOTE_RATE_LIMIT = 30; // 30 votes per 10 minutes per voter key
export const COMMENT_RATE_LIMIT = 10; // 10 comments per 10 minutes per voter key
export const MAX_COMMENT_LENGTH = 1000;

/**
 * Computes SHA-256 hash of a string (e.g. voter token).
 */
export function hashVoterToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a random 256-bit voter token string.
 */
export function generateVoterToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Shuffles an array in place or returns a shuffled copy using Fisher-Yates and cryptographic randomness.
 */
export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class VotingService {
  /**
   * Validates that the user is the event organizer or an admin.
   */
  private static checkOrganizerAccess(eventId: string, userId: string, userRole: UserRole): void {
    if (userRole === 'admin') return;

    const db = getDb();
    const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as
      | { organizer_id: string }
      | undefined;

    if (!event) {
      throw new VotingServiceError('Event not found', 'NOT_FOUND');
    }

    if (userRole !== 'organizer' || event.organizer_id !== userId) {
      throw new VotingServiceError('Access denied: You must be the event organizer or an admin', 'FORBIDDEN');
    }
  }

  /**
   * Records an entry into the voting audit log.
   */
  public static recordAuditLog(
    roundId: string | null,
    actorKeyHash: string | null,
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, unknown>
  ): void {
    const db = getDb();
    const now = new Date().toISOString();
    const logId = generateId('vlog');

    db.prepare(`
      INSERT INTO voting_audit_log (
        id, voting_round_id, actor_key_hash, actor_user_id, action, target_type, target_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      roundId,
      actorKeyHash,
      actorUserId,
      action,
      targetType,
      targetId,
      metadata ? JSON.stringify(metadata) : null,
      now
    );
  }

  // --------------------------------------------------------------------------
  // VOTING ROUND LIFECYCLE
  // --------------------------------------------------------------------------

  /**
   * Creates a voting round in draft status.
   */
  public static createVotingRound(
    eventId: string,
    userId: string,
    userRole: UserRole,
    data?: { startsAt?: string; endsAt?: string }
  ): VotingRound {
    this.checkOrganizerAccess(eventId, userId, userRole);

    const db = getDb();
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) {
      throw new VotingServiceError('Event not found', 'NOT_FOUND');
    }

    // Check if an active voting round already exists for this event
    const activeRound = db.prepare(`
      SELECT id, status FROM voting_rounds
      WHERE event_id = ? AND status IN ('draft', 'voting_open', 'voting_closed')
    `).get(eventId) as { id: string; status: string } | undefined;

    if (activeRound) {
      throw new VotingServiceError(
        `An active voting round already exists for this event with status "${activeRound.status}"`,
        'CONFLICT'
      );
    }

    if (data?.startsAt && data?.endsAt && new Date(data.startsAt) >= new Date(data.endsAt)) {
      throw new VotingServiceError('Voting starts_at must be before ends_at', 'BAD_REQUEST');
    }

    const now = new Date().toISOString();
    const roundId = generateId('vround');

    db.prepare(`
      INSERT INTO voting_rounds (
        id, event_id, status, starts_at, ends_at, results_published_at, created_by, created_at, updated_at
      ) VALUES (?, ?, 'draft', ?, ?, NULL, ?, ?, ?)
    `).run(roundId, eventId, data?.startsAt || null, data?.endsAt || null, userId, now, now);

    this.recordAuditLog(roundId, null, userId, 'voting_round_created', 'voting_round', roundId, {
      eventId,
      status: 'draft'
    });

    return this.getVotingRoundById(roundId);
  }

  /**
   * Retrieves a voting round by ID.
   */
  public static getVotingRoundById(roundId: string): VotingRound {
    const db = getDb();
    const round = db.prepare(`
      SELECT
        vr.id,
        vr.event_id as eventId,
        vr.status,
        vr.starts_at as startsAt,
        vr.ends_at as endsAt,
        vr.results_published_at as resultsPublishedAt,
        vr.created_by as createdBy,
        vr.created_at as createdAt,
        vr.updated_at as updatedAt,
        (SELECT COUNT(*) FROM voting_candidates vc WHERE vc.voting_round_id = vr.id) as candidateCount
      FROM voting_rounds vr
      WHERE vr.id = ?
    `).get(roundId) as VotingRound | undefined;

    if (!round) {
      throw new VotingServiceError(`Voting round "${roundId}" not found`, 'NOT_FOUND');
    }

    return round;
  }

  /**
   * Lists all voting rounds for an event.
   */
  public static getVotingRoundsByEvent(eventId: string): VotingRound[] {
    const db = getDb();
    return db.prepare(`
      SELECT
        vr.id,
        vr.event_id as eventId,
        vr.status,
        vr.starts_at as startsAt,
        vr.ends_at as endsAt,
        vr.results_published_at as resultsPublishedAt,
        vr.created_by as createdBy,
        vr.created_at as createdAt,
        vr.updated_at as updatedAt,
        (SELECT COUNT(*) FROM voting_candidates vc WHERE vc.voting_round_id = vr.id) as candidateCount
      FROM voting_rounds vr
      WHERE vr.event_id = ?
      ORDER BY vr.created_at DESC
    `).all(eventId) as VotingRound[];
  }

  /**
   * Retrieves public-safe voting status (no internal secrets).
   */
  public static getPublicVotingStatus(roundId: string): {
    votingRoundId: string;
    eventId: string;
    status: VotingRoundStatus;
    startsAt: string | null;
    endsAt: string | null;
    candidateCount: number;
  } {
    const round = this.getVotingRoundById(roundId);
    return {
      votingRoundId: round.id,
      eventId: round.eventId,
      status: round.status,
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      candidateCount: round.candidateCount || 0
    };
  }

  /**
   * Transitions a round from draft to voting_open.
   */
  public static openVotingRound(roundId: string, userId: string, userRole: UserRole): VotingRound {
    const round = this.getVotingRoundById(roundId);
    this.checkOrganizerAccess(round.eventId, userId, userRole);

    if (round.status !== 'draft') {
      throw new VotingServiceError(
        `Cannot open voting round from status "${round.status}". Allowed transition: draft -> voting_open`,
        'BAD_REQUEST'
      );
    }

    const candidateCount = round.candidateCount || 0;
    if (candidateCount === 0) {
      throw new VotingServiceError('Cannot open voting round without any candidates', 'BAD_REQUEST');
    }

    const db = getDb();
    const now = new Date().toISOString();
    const startsAt = round.startsAt && round.startsAt <= now ? round.startsAt : now;

    db.prepare(`
      UPDATE voting_rounds
      SET status = 'voting_open', starts_at = ?, updated_at = ?
      WHERE id = ?
    `).run(startsAt, now, roundId);

    this.recordAuditLog(roundId, null, userId, 'voting_round_opened', 'voting_round', roundId, {
      previousStatus: 'draft',
      newStatus: 'voting_open',
      startsAt
    });

    return this.getVotingRoundById(roundId);
  }

  /**
   * Transitions a round from voting_open to voting_closed.
   */
  public static closeVotingRound(roundId: string, userId: string, userRole: UserRole): VotingRound {
    const round = this.getVotingRoundById(roundId);
    this.checkOrganizerAccess(round.eventId, userId, userRole);

    if (round.status !== 'voting_open') {
      throw new VotingServiceError(
        `Cannot close voting round from status "${round.status}". Allowed transition: voting_open -> voting_closed`,
        'BAD_REQUEST'
      );
    }

    const db = getDb();
    const now = new Date().toISOString();
    const startsAt = round.startsAt && round.startsAt <= now ? round.startsAt : now;

    db.prepare(`
      UPDATE voting_rounds
      SET status = 'voting_closed', starts_at = ?, ends_at = ?, updated_at = ?
      WHERE id = ?
    `).run(startsAt, now, now, roundId);

    this.recordAuditLog(roundId, null, userId, 'voting_round_closed', 'voting_round', roundId, {
      previousStatus: 'voting_open',
      newStatus: 'voting_closed',
      endsAt: now
    });

    return this.getVotingRoundById(roundId);
  }

  /**
   * Transitions a round from voting_closed to results_published.
   */
  public static publishResults(roundId: string, userId: string, userRole: UserRole): VotingRound {
    const round = this.getVotingRoundById(roundId);
    this.checkOrganizerAccess(round.eventId, userId, userRole);

    if (round.status !== 'voting_closed') {
      throw new VotingServiceError(
        `Cannot publish results unless voting round is "voting_closed" (current: "${round.status}")`,
        'BAD_REQUEST'
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE voting_rounds
      SET status = 'results_published', results_published_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, roundId);

    this.recordAuditLog(roundId, null, userId, 'results_published', 'voting_round', roundId, {
      previousStatus: 'voting_closed',
      newStatus: 'results_published',
      resultsPublishedAt: now
    });

    return this.getVotingRoundById(roundId);
  }

  // --------------------------------------------------------------------------
  // CANDIDATES MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Adds submissions as candidates to a draft voting round.
   */
  public static addCandidates(
    roundId: string,
    userId: string,
    userRole: UserRole,
    submissionIds: string[]
  ): VotingCandidate[] {
    const round = this.getVotingRoundById(roundId);
    this.checkOrganizerAccess(round.eventId, userId, userRole);

    if (round.status !== 'draft') {
      throw new VotingServiceError('Candidates can only be configured while the voting round is in draft', 'BAD_REQUEST');
    }

    if (!submissionIds || submissionIds.length === 0) {
      throw new VotingServiceError('At least one submission ID is required', 'BAD_REQUEST');
    }

    const db = getDb();
    const now = new Date().toISOString();

    const insertCandidate = db.prepare(`
      INSERT INTO voting_candidates (id, voting_round_id, submission_id, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const added: VotingCandidate[] = [];

    const transaction = db.transaction(() => {
      for (const submissionId of submissionIds) {
        // Validate submission exists, belongs to same event, and is submitted
        const sub = db.prepare(`
          SELECT id, event_id, status FROM submissions WHERE id = ?
        `).get(submissionId) as { id: string; event_id: string; status: string } | undefined;

        if (!sub) {
          throw new VotingServiceError(`Submission "${submissionId}" not found`, 'NOT_FOUND');
        }

        if (sub.event_id !== round.eventId) {
          throw new VotingServiceError(
            `Submission "${submissionId}" does not belong to the event for this voting round`,
            'BAD_REQUEST'
          );
        }

        if (sub.status !== 'submitted') {
          throw new VotingServiceError(
            `Only submitted projects can become voting candidates (submission "${submissionId}" is "${sub.status}")`,
            'BAD_REQUEST'
          );
        }

        // Check duplicate candidate in this round
        const existing = db.prepare(`
          SELECT id FROM voting_candidates WHERE voting_round_id = ? AND submission_id = ?
        `).get(roundId, submissionId);

        if (existing) {
          throw new VotingServiceError(
            `Submission "${submissionId}" is already a candidate in this voting round`,
            'CONFLICT'
          );
        }

        const candidateId = generateId('vcand');
        insertCandidate.run(candidateId, roundId, submissionId, now);

        added.push({
          id: candidateId,
          votingRoundId: roundId,
          submissionId,
          createdAt: now
        });
      }
    });

    transaction();
    return added;
  }

  /**
   * Auto-populates all submitted projects for the event into a draft voting round.
   */
  public static autoPopulateCandidates(roundId: string, userId: string, userRole: UserRole): VotingCandidate[] {
    const round = this.getVotingRoundById(roundId);
    this.checkOrganizerAccess(round.eventId, userId, userRole);

    if (round.status !== 'draft') {
      throw new VotingServiceError('Candidates can only be configured while the voting round is in draft', 'BAD_REQUEST');
    }

    const db = getDb();
    const submittedProjects = db.prepare(`
      SELECT s.id
      FROM submissions s
      WHERE s.event_id = ? AND s.status = 'submitted'
        AND s.id NOT IN (SELECT vc.submission_id FROM voting_candidates vc WHERE vc.voting_round_id = ?)
    `).all(round.eventId, roundId) as { id: string }[];

    if (submittedProjects.length === 0) {
      return this.getCandidates(roundId);
    }

    return this.addCandidates(
      roundId,
      userId,
      userRole,
      submittedProjects.map(p => p.id)
    );
  }

  /**
   * Retrieves all candidates for a voting round.
   */
  public static getCandidates(roundId: string): VotingCandidate[] {
    const db = getDb();
    return db.prepare(`
      SELECT
        vc.id,
        vc.voting_round_id as votingRoundId,
        vc.submission_id as submissionId,
        s.title,
        s.slug,
        s.short_description as shortDescription,
        t.name as teamName,
        vc.created_at as createdAt
      FROM voting_candidates vc
      JOIN submissions s ON vc.submission_id = s.id
      JOIN teams t ON s.team_id = t.id
      WHERE vc.voting_round_id = ?
      ORDER BY vc.created_at ASC
    `).all(roundId) as VotingCandidate[];
  }

  // --------------------------------------------------------------------------
  // RANDOMIZED BALLOTS
  // --------------------------------------------------------------------------

  /**
   * Retrieves an existing ballot for the voter or creates a new one with a cryptographically randomized candidate order.
   * Documented: Randomized ordering prevents position bias when community members evaluate projects.
   */
  public static getOrCreateBallot(roundId: string, voterKeyHash: string): VotingBallot {
    const round = this.getVotingRoundById(roundId);
    const db = getDb();

    // Check if ballot already exists for this voter in this round
    const existingBallot = db.prepare(`
      SELECT id, voting_round_id as votingRoundId, ordering_seed as orderingSeed, created_at as createdAt, last_activity_at as lastActivityAt
      FROM voting_ballots
      WHERE voting_round_id = ? AND voter_key_hash = ?
    `).get(roundId, voterKeyHash) as { id: string; votingRoundId: string; orderingSeed: string; createdAt: string; lastActivityAt: string } | undefined;

    if (existingBallot) {
      // Update last activity
      const now = new Date().toISOString();
      db.prepare('UPDATE voting_ballots SET last_activity_at = ? WHERE id = ?').run(now, existingBallot.id);

      // Query candidates in their persisted position order
      const candidates = db.prepare(`
        SELECT
          bc.candidate_id as candidateId,
          vc.submission_id as submissionId,
          s.title,
          s.slug,
          s.short_description as shortDescription,
          t.name as teamName,
          bc.position,
          EXISTS(
            SELECT 1 FROM community_votes cv
            WHERE cv.voting_round_id = ? AND cv.voter_key_hash = ? AND cv.candidate_id = bc.candidate_id
          ) as hasVotedRaw
        FROM ballot_candidates bc
        JOIN voting_candidates vc ON bc.candidate_id = vc.id
        JOIN submissions s ON vc.submission_id = s.id
        JOIN teams t ON s.team_id = t.id
        WHERE bc.ballot_id = ?
        ORDER BY bc.position ASC
      `).all(roundId, voterKeyHash, existingBallot.id) as Array<{
        candidateId: string;
        submissionId: string;
        title: string;
        slug: string;
        shortDescription: string;
        teamName: string;
        position: number;
        hasVotedRaw: number;
      }>;

      return {
        id: existingBallot.id,
        votingRoundId: roundId,
        candidates: candidates.map(c => ({
          candidateId: c.candidateId,
          submissionId: c.submissionId,
          title: c.title,
          slug: c.slug,
          shortDescription: c.shortDescription,
          teamName: c.teamName,
          position: c.position,
          hasVoted: Boolean(c.hasVotedRaw)
        })),
        createdAt: existingBallot.createdAt,
        lastActivityAt: now
      };
    }

    // New ballot creation requires round to be voting_open
    if (round.status !== 'voting_open') {
      throw new VotingServiceError(
        `Ballots are only available when voting is open (current status: "${round.status}")`,
        'BAD_REQUEST'
      );
    }

    const candidateRows = this.getCandidates(roundId);
    if (candidateRows.length === 0) {
      throw new VotingServiceError('No candidates available for this voting round', 'BAD_REQUEST');
    }

    const now = new Date().toISOString();
    const ballotId = generateId('vballot');
    const orderingSeed = crypto.randomBytes(16).toString('hex');

    // Cryptographic shuffle of candidate items to eliminate position bias
    const shuffled = shuffleArray(candidateRows);

    const insertBallot = db.prepare(`
      INSERT INTO voting_ballots (id, voting_round_id, voter_key_hash, ordering_seed, created_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertBallotCandidate = db.prepare(`
      INSERT INTO ballot_candidates (id, ballot_id, candidate_id, position)
      VALUES (?, ?, ?, ?)
    `);

    const ballotItems: VotingBallotItem[] = [];

    const transaction = db.transaction(() => {
      insertBallot.run(ballotId, roundId, voterKeyHash, orderingSeed, now, now);

      shuffled.forEach((cand, idx) => {
        const bcId = generateId('bcand');
        insertBallotCandidate.run(bcId, ballotId, cand.id, idx);

        ballotItems.push({
          candidateId: cand.id,
          submissionId: cand.submissionId,
          title: cand.title || '',
          slug: cand.slug || '',
          shortDescription: cand.shortDescription || '',
          teamName: cand.teamName || '',
          position: idx,
          hasVoted: false
        });
      });

      this.recordAuditLog(roundId, voterKeyHash, null, 'ballot_created', 'voting_ballot', ballotId, {
        candidateCount: shuffled.length
      });
    });

    transaction();

    return {
      id: ballotId,
      votingRoundId: roundId,
      candidates: ballotItems,
      createdAt: now,
      lastActivityAt: now
    };
  }

  // --------------------------------------------------------------------------
  // ANTI-ABUSE RATE LIMITING
  // --------------------------------------------------------------------------

  /**
   * Checks and increments persistent SQLite rate limit.
   * Returns true if allowed, false if limit exceeded.
   */
  public static checkAndIncrementRateLimit(
    roundId: string,
    action: 'vote' | 'comment',
    actorKeyHash: string
  ): boolean {
    const db = getDb();
    const now = Date.now();
    const limit = action === 'vote' ? VOTE_RATE_LIMIT : COMMENT_RATE_LIMIT;
    const windowStart = new Date(Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS).toISOString();
    const nowIso = new Date(now).toISOString();

    const existing = db.prepare(`
      SELECT id, request_count as requestCount
      FROM voting_rate_limits
      WHERE voting_round_id = ? AND action = ? AND actor_key_hash = ? AND window_started_at = ?
    `).get(roundId, action, actorKeyHash, windowStart) as { id: string; requestCount: number } | undefined;

    if (existing) {
      if (existing.requestCount >= limit) {
        return false;
      }

      db.prepare(`
        UPDATE voting_rate_limits
        SET request_count = request_count + 1, updated_at = ?
        WHERE id = ?
      `).run(nowIso, existing.id);

      return true;
    }

    const rateLimitId = generateId('vrl');
    db.prepare(`
      INSERT INTO voting_rate_limits (
        id, voting_round_id, action, actor_key_hash, window_started_at, request_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(rateLimitId, roundId, action, actorKeyHash, windowStart, nowIso);

    return true;
  }

  // --------------------------------------------------------------------------
  // VOTE SUBMISSION & DUPLICATE PREVENTION
  // --------------------------------------------------------------------------

  /**
   * Casts a community vote.
   * Enforces:
   * - round in voting_open
   * - rate limit: 30 requests / 10 min
   * - duplicate vote rejection (one vote per project per voter)
   * - audit log
   */
  public static castVote(
    roundId: string,
    voterKeyHash: string,
    candidateIdOrSubmissionId: string,
    actorUserId: string | null = null
  ): CommunityVote {
    const round = this.getVotingRoundById(roundId);

    if (round.status !== 'voting_open') {
      throw new VotingServiceError(
        `Votes can only be cast when voting is open (current status: "${round.status}")`,
        'BAD_REQUEST'
      );
    }

    // 1. Persistent rate limit check
    const allowed = this.checkAndIncrementRateLimit(roundId, 'vote', voterKeyHash);
    if (!allowed) {
      this.recordAuditLog(roundId, voterKeyHash, actorUserId, 'vote_rate_limited', 'voting_round', roundId, {
        limit: VOTE_RATE_LIMIT,
        windowMinutes: 10
      });
      throw new VotingServiceError(
        `Rate limit exceeded: maximum ${VOTE_RATE_LIMIT} votes per 10 minutes`,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    const db = getDb();

    // 2. Resolve candidate record
    const candidate = db.prepare(`
      SELECT vc.id, vc.submission_id as submissionId
      FROM voting_candidates vc
      WHERE vc.voting_round_id = ? AND (vc.id = ? OR vc.submission_id = ?)
    `).get(roundId, candidateIdOrSubmissionId, candidateIdOrSubmissionId) as
      | { id: string; submissionId: string }
      | undefined;

    if (!candidate) {
      throw new VotingServiceError('Candidate not found in this voting round', 'NOT_FOUND');
    }

    // 3. Ensure a ballot exists for this voter
    const ballot = this.getOrCreateBallot(roundId, voterKeyHash);

    // 4. Duplicate vote check
    const existingVote = db.prepare(`
      SELECT id FROM community_votes
      WHERE voting_round_id = ? AND voter_key_hash = ? AND candidate_id = ?
    `).get(roundId, voterKeyHash, candidate.id);

    if (existingVote) {
      this.recordAuditLog(roundId, voterKeyHash, actorUserId, 'duplicate_vote_rejected', 'voting_candidate', candidate.id);
      throw new VotingServiceError('You have already voted for this project in this voting round', 'CONFLICT');
    }

    const voteId = generateId('cvote');
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO community_votes (
          id, voting_round_id, ballot_id, candidate_id, voter_key_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(voteId, roundId, ballot.id, candidate.id, voterKeyHash, now);

      this.recordAuditLog(roundId, voterKeyHash, actorUserId, 'vote_cast', 'community_vote', voteId, {
        candidateId: candidate.id,
        submissionId: candidate.submissionId
      });
    });

    transaction();

    return {
      id: voteId,
      votingRoundId: roundId,
      ballotId: ballot.id,
      candidateId: candidate.id,
      submissionId: candidate.submissionId,
      createdAt: now
    };
  }

  // --------------------------------------------------------------------------
  // COMMUNITY COMMENTS & MODERATION
  // --------------------------------------------------------------------------

  /**
   * Creates a community comment.
   * Enforces:
   * - round in voting_open
   * - rate limit: 10 requests / 10 min
   * - body length constraints (1-1000 characters)
   * - audit log
   */
  public static createComment(
    roundId: string,
    submissionId: string,
    voterKeyHash: string,
    authorDisplayName: string,
    body: string,
    authorUserId: string | null = null
  ): CommunityComment {
    const round = this.getVotingRoundById(roundId);

    if (round.status !== 'voting_open') {
      throw new VotingServiceError(
        `Comments can only be submitted when voting is open (current status: "${round.status}")`,
        'BAD_REQUEST'
      );
    }

    const trimmedBody = (body || '').trim();
    if (!trimmedBody) {
      throw new VotingServiceError('Comment body cannot be empty', 'BAD_REQUEST');
    }

    if (trimmedBody.length > MAX_COMMENT_LENGTH) {
      throw new VotingServiceError(
        `Comment body cannot exceed ${MAX_COMMENT_LENGTH} characters (received ${trimmedBody.length})`,
        'BAD_REQUEST'
      );
    }

    // Verify submission is a candidate in this voting round
    const db = getDb();
    const candidate = db.prepare(`
      SELECT id FROM voting_candidates WHERE voting_round_id = ? AND submission_id = ?
    `).get(roundId, submissionId);

    if (!candidate) {
      throw new VotingServiceError('Submission is not an active candidate in this voting round', 'NOT_FOUND');
    }

    // Rate limit check
    const allowed = this.checkAndIncrementRateLimit(roundId, 'comment', voterKeyHash);
    if (!allowed) {
      this.recordAuditLog(roundId, voterKeyHash, authorUserId, 'comment_rate_limited', 'voting_round', roundId, {
        limit: COMMENT_RATE_LIMIT,
        windowMinutes: 10
      });
      throw new VotingServiceError(
        `Rate limit exceeded: maximum ${COMMENT_RATE_LIMIT} comments per 10 minutes`,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    const commentId = generateId('ccomment');
    const now = new Date().toISOString();
    const displayName = (authorDisplayName || 'Community Member').trim().slice(0, 100);

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO community_comments (
          id, voting_round_id, submission_id, author_user_id, author_display_name, body, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'visible', ?, ?)
      `).run(commentId, roundId, submissionId, authorUserId, displayName, trimmedBody, now, now);

      this.recordAuditLog(roundId, voterKeyHash, authorUserId, 'comment_created', 'community_comment', commentId, {
        submissionId
      });
    });

    transaction();

    return {
      id: commentId,
      votingRoundId: roundId,
      submissionId,
      authorUserId,
      authorDisplayName: displayName,
      body: trimmedBody,
      status: 'visible',
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Retrieves public visible comments for a submission. Hidden and deleted comments are strictly excluded.
   */
  public static getPublicComments(roundId: string, submissionId: string): CommunityComment[] {
    const db = getDb();
    return db.prepare(`
      SELECT
        id,
        voting_round_id as votingRoundId,
        submission_id as submissionId,
        author_user_id as authorUserId,
        author_display_name as authorDisplayName,
        body,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM community_comments
      WHERE voting_round_id = ? AND submission_id = ? AND status = 'visible'
      ORDER BY created_at ASC
    `).all(roundId, submissionId) as CommunityComment[];
  }

  /**
   * Hides a comment (moderation: organizer or admin only).
   */
  public static hideComment(
    roundId: string,
    commentId: string,
    userId: string,
    userRole: UserRole
  ): CommunityComment {
    const round = this.getVotingRoundById(roundId);
    this.checkOrganizerAccess(round.eventId, userId, userRole);

    const db = getDb();
    const comment = db.prepare(`
      SELECT id, status FROM community_comments WHERE id = ? AND voting_round_id = ?
    `).get(commentId, roundId) as { id: string; status: CommunityCommentStatus } | undefined;

    if (!comment) {
      throw new VotingServiceError('Comment not found', 'NOT_FOUND');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE community_comments
      SET status = 'hidden', updated_at = ?
      WHERE id = ?
    `).run(now, commentId);

    this.recordAuditLog(roundId, null, userId, 'comment_hidden', 'community_comment', commentId);

    return db.prepare(`
      SELECT
        id,
        voting_round_id as votingRoundId,
        submission_id as submissionId,
        author_user_id as authorUserId,
        author_display_name as authorDisplayName,
        body,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM community_comments
      WHERE id = ?
    `).get(commentId) as CommunityComment;
  }

  /**
   * Deletes a comment (comment author, organizer, or admin).
   */
  public static deleteComment(
    roundId: string,
    commentId: string,
    userId: string | null,
    userRole: UserRole | null
  ): void {
    const round = this.getVotingRoundById(roundId);
    const db = getDb();

    const comment = db.prepare(`
      SELECT id, author_user_id as authorUserId, status FROM community_comments
      WHERE id = ? AND voting_round_id = ?
    `).get(commentId, roundId) as { id: string; authorUserId: string | null; status: string } | undefined;

    if (!comment) {
      throw new VotingServiceError('Comment not found', 'NOT_FOUND');
    }

    // Check authorization: author, admin, or organizer
    let isAuthorized = false;
    if (userRole === 'admin') {
      isAuthorized = true;
    } else if (userId && comment.authorUserId === userId) {
      isAuthorized = true;
    } else if (userRole === 'organizer' && userId) {
      const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(round.eventId) as
        | { organizer_id: string }
        | undefined;
      if (event && event.organizer_id === userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new VotingServiceError('Access denied: You are not authorized to delete this comment', 'FORBIDDEN');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE community_comments
      SET status = 'deleted', updated_at = ?
      WHERE id = ?
    `).run(now, commentId);

    this.recordAuditLog(roundId, null, userId, 'comment_deleted', 'community_comment', commentId);
  }

  // --------------------------------------------------------------------------
  // PUBLIC RESULTS PUBLICATION BOUNDARY
  // --------------------------------------------------------------------------

  /**
   * Retrieves public community voting results.
   * CRITICAL ANTI-ANCHORING & SECURITY BOUNDARY:
   * - Strictly unavailable (HTTP 403) before status is 'results_published'
   * - ZERO judge scores, ZERO z-scores, ZERO judge identities exposed
   */
  public static getPublicResults(roundId: string): PublicVotingResultsResponse {
    const round = this.getVotingRoundById(roundId);

    if (round.status !== 'results_published') {
      throw new VotingServiceError(
        'Community voting results are hidden until they are officially published by the organizer',
        'FORBIDDEN'
      );
    }

    const db = getDb();
    const rows = db.prepare(`
      SELECT
        s.id as submissionId,
        s.title,
        s.slug,
        t.name as teamName,
        COUNT(cv.id) as voteCount
      FROM voting_candidates vc
      JOIN submissions s ON vc.submission_id = s.id
      JOIN teams t ON s.team_id = t.id
      LEFT JOIN community_votes cv ON vc.id = cv.candidate_id
      WHERE vc.voting_round_id = ?
      GROUP BY s.id, s.title, s.slug, t.name
      ORDER BY voteCount DESC, s.title ASC
    `).all(roundId) as { submissionId: string; title: string; slug: string; teamName: string; voteCount: number }[];

    let totalVotes = 0;
    const results: PublicVotingResult[] = rows.map((row, idx) => {
      totalVotes += row.voteCount;
      return {
        submissionId: row.submissionId,
        title: row.title,
        slug: row.slug,
        teamName: row.teamName,
        voteCount: row.voteCount,
        rank: idx + 1
      };
    });

    return {
      votingRoundId: round.id,
      eventId: round.eventId,
      resultsPublishedAt: round.resultsPublishedAt || round.updatedAt,
      totalVotes,
      results
    };
  }

  // --------------------------------------------------------------------------
  // AUDIT TRAIL
  // --------------------------------------------------------------------------

  /**
   * Retrieves voting audit log entries (organizer/admin only).
   */
  public static getAuditLogs(roundId: string, userId: string, userRole: UserRole): VotingAuditLogEntry[] {
    const round = this.getVotingRoundById(roundId);
    this.checkOrganizerAccess(round.eventId, userId, userRole);

    const db = getDb();
    const rows = db.prepare(`
      SELECT
        id,
        voting_round_id as votingRoundId,
        actor_key_hash as actorKeyHash,
        actor_user_id as actorUserId,
        action,
        target_type as targetType,
        target_id as targetId,
        metadata_json as metadataJson,
        created_at as createdAt
      FROM voting_audit_log
      WHERE voting_round_id = ?
      ORDER BY created_at DESC
    `).all(roundId) as {
      id: string;
      votingRoundId: string | null;
      actorKeyHash: string | null;
      actorUserId: string | null;
      action: string;
      targetType: string;
      targetId: string;
      metadataJson: string | null;
      createdAt: string;
    }[];

    return rows.map(r => ({
      id: r.id,
      votingRoundId: r.votingRoundId,
      actorKeyHash: r.actorKeyHash,
      actorUserId: r.actorUserId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadataJson ? JSON.parse(r.metadataJson) : null,
      createdAt: r.createdAt
    }));
  }
}
