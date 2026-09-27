import { Router, Request, Response, NextFunction } from 'express';
import {
  VotingService,
  VotingServiceError,
  generateVoterToken,
  hashVoterToken
} from './votingService';
import { requireAuth, extractCookie } from '../../middleware/auth';

function handleVotingError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof VotingServiceError) {
    const statusMap: Record<string, number> = {
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      RATE_LIMIT_EXCEEDED: 429
    };
    const statusCode = statusMap[err.code] || 400;
    res.status(statusCode).json({
      error: {
        message: err.message,
        code: err.code
      }
    });
    return;
  }
  next(err);
}

/**
 * Resolves or generates the privacy-conscious voter session token.
 * Extracts from X-Voter-Token header or voter_token cookie.
 * Generates fresh 256-bit token if none provided and attaches HttpOnly cookie + header.
 */
function resolveVoterToken(req: Request, res: Response): { rawToken: string; tokenHash: string } {
  // 1. Check custom test/API header
  const headerToken = req.headers['x-voter-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    const raw = headerToken.trim();
    return { rawToken: raw, tokenHash: hashVoterToken(raw) };
  }

  // 2. Check browser cookie
  const cookieToken = extractCookie(req.headers.cookie, 'voter_token');
  if (cookieToken && cookieToken.trim()) {
    const raw = cookieToken.trim();
    return { rawToken: raw, tokenHash: hashVoterToken(raw) };
  }

  // 3. Generate a new server-side token
  const rawToken = generateVoterToken();
  const tokenHash = hashVoterToken(rawToken);

  // Set HttpOnly SameSite cookie and test header
  res.cookie('voter_token', rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });
  res.setHeader('X-Voter-Token', rawToken);

  return { rawToken, tokenHash };
}

/**
 * Creates the router for T3 Community Voting operations.
 */
export function createVotingRouter(): Router {
  const router = Router();

  // --------------------------------------------------------------------------
  // ORGANIZER / ADMIN ENDPOINTS
  // --------------------------------------------------------------------------

  /**
   * POST /events/:eventId/voting
   * Creates a voting round in draft status (organizer/admin only).
   */
  router.post('/events/:eventId/voting', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const round = VotingService.createVotingRound(req.params.eventId, user.id, user.role, req.body || {});
      res.status(201).json({ votingRound: round });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/voting
   * Lists all voting rounds for an event.
   */
  router.get('/events/:eventId/voting', (req: Request, res: Response, next: NextFunction) => {
    try {
      const rounds = VotingService.getVotingRoundsByEvent(req.params.eventId);
      res.status(200).json({ votingRounds: rounds });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/voting/:roundId
   * Retrieves voting round details.
   */
  router.get('/events/:eventId/voting/:roundId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const round = VotingService.getVotingRoundById(req.params.roundId);
      res.status(200).json({ votingRound: round });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/voting/:roundId/candidates
   * Adds submissions as voting candidates (organizer/admin only, draft status).
   */
  router.post('/events/:eventId/voting/:roundId/candidates', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const submissionIds = Array.isArray(req.body?.submissionIds)
        ? req.body.submissionIds
        : req.body?.submissionId
        ? [req.body.submissionId]
        : [];

      const candidates = VotingService.addCandidates(req.params.roundId, user.id, user.role, submissionIds);
      res.status(201).json({ candidates });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/voting/:roundId/candidates/auto-populate
   * Auto-populates all submitted projects for the event into the round.
   */
  router.post('/events/:eventId/voting/:roundId/candidates/auto-populate', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const candidates = VotingService.autoPopulateCandidates(req.params.roundId, user.id, user.role);
      res.status(200).json({ candidates });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/voting/:roundId/candidates
   * Retrieves all candidates for the voting round.
   */
  router.get('/events/:eventId/voting/:roundId/candidates', (req: Request, res: Response, next: NextFunction) => {
    try {
      const candidates = VotingService.getCandidates(req.params.roundId);
      res.status(200).json({ candidates });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/voting/:roundId/open
   * Opens community voting (organizer/admin only).
   */
  router.post('/events/:eventId/voting/:roundId/open', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const round = VotingService.openVotingRound(req.params.roundId, user.id, user.role);
      res.status(200).json({ votingRound: round });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/voting/:roundId/close
   * Closes community voting (organizer/admin only).
   */
  router.post('/events/:eventId/voting/:roundId/close', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const round = VotingService.closeVotingRound(req.params.roundId, user.id, user.role);
      res.status(200).json({ votingRound: round });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/voting/:roundId/publish
   * Publishes community voting results (organizer/admin only).
   */
  router.post('/events/:eventId/voting/:roundId/publish', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const round = VotingService.publishResults(req.params.roundId, user.id, user.role);
      res.status(200).json({ votingRound: round });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/voting/:roundId/audit
   * Retrieves the voting audit log (organizer/admin only).
   */
  router.get('/events/:eventId/voting/:roundId/audit', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const auditLogs = VotingService.getAuditLogs(req.params.roundId, user.id, user.role);
      res.status(200).json({ auditLogs });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  // --------------------------------------------------------------------------
  // PUBLIC VOTING & STATUS ENDPOINTS
  // --------------------------------------------------------------------------

  /**
   * GET /events/:eventId/voting/:roundId/status
   * Returns public-safe voting status. Zero private scores or aggregates leaked.
   */
  router.get('/events/:eventId/voting/:roundId/status', (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = VotingService.getPublicVotingStatus(req.params.roundId);
      res.status(200).json(status);
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/voting/:roundId/ballot
   * Creates or retrieves the voter's randomized ballot.
   * Shuffles candidates server-side to prevent position bias.
   */
  router.get('/events/:eventId/voting/:roundId/ballot', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rawToken, tokenHash } = resolveVoterToken(req, res);
      const ballot = VotingService.getOrCreateBallot(req.params.roundId, tokenHash);
      res.status(200).json({ ballot, voterToken: rawToken });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/voting/:roundId/votes
   * Casts a community vote.
   * Enforces server voter identity, duplicate vote prevention, and rate limits.
   */
  router.post('/events/:eventId/voting/:roundId/votes', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tokenHash } = resolveVoterToken(req, res);
      const targetId = req.body?.candidateId || req.body?.submissionId;

      if (!targetId || typeof targetId !== 'string') {
        res.status(400).json({
          error: {
            message: 'candidateId or submissionId is required',
            code: 'BAD_REQUEST'
          }
        });
        return;
      }

      const actorUserId = req.user ? req.user.id : null;
      const vote = VotingService.castVote(req.params.roundId, tokenHash, targetId.trim(), actorUserId);

      res.status(201).json({ vote });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/voting/:roundId/results
   * Returns aggregated public results ONLY when status is results_published.
   * Strictly returns 403 while draft, voting_open, or voting_closed.
   * Completely isolated from judge scores and normalization info.
   */
  router.get('/events/:eventId/voting/:roundId/results', (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = VotingService.getPublicResults(req.params.roundId);
      res.status(200).json(results);
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  // --------------------------------------------------------------------------
  // COMMUNITY COMMENTS & MODERATION ENDPOINTS
  // --------------------------------------------------------------------------

  /**
   * GET /events/:eventId/voting/:roundId/submissions/:submissionId/comments
   * Returns public visible comments for a submission.
   */
  router.get('/events/:eventId/voting/:roundId/submissions/:submissionId/comments', (req: Request, res: Response, next: NextFunction) => {
    try {
      const comments = VotingService.getPublicComments(req.params.roundId, req.params.submissionId);
      res.status(200).json({ comments });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/voting/:roundId/submissions/:submissionId/comments
   * Posts a new community comment.
   */
  router.post('/events/:eventId/voting/:roundId/submissions/:submissionId/comments', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tokenHash } = resolveVoterToken(req, res);
      const body = req.body?.body;
      const authorDisplayName = req.user ? req.user.name : req.body?.authorDisplayName || 'Community Member';
      const authorUserId = req.user ? req.user.id : null;

      const comment = VotingService.createComment(
        req.params.roundId,
        req.params.submissionId,
        tokenHash,
        authorDisplayName,
        body,
        authorUserId
      );

      res.status(201).json({ comment });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/voting/:roundId/comments/:commentId/hide
   * Hides a comment (moderation: organizer/admin only).
   */
  router.post('/events/:eventId/voting/:roundId/comments/:commentId/hide', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const comment = VotingService.hideComment(req.params.roundId, req.params.commentId, user.id, user.role);
      res.status(200).json({ comment });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  /**
   * DELETE /events/:eventId/voting/:roundId/comments/:commentId
   * Deletes a comment (author, organizer, or admin).
   */
  router.delete('/events/:eventId/voting/:roundId/comments/:commentId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role : null;

      VotingService.deleteComment(req.params.roundId, req.params.commentId, userId, userRole);
      res.status(200).json({ success: true, message: 'Comment deleted successfully' });
    } catch (err) {
      handleVotingError(err, res, next);
    }
  });

  return router;
}
