import { Router, Request, Response, NextFunction } from 'express';
import { NormalizationService, NormalizationServiceError } from './normalizationService';
import { requireAuth } from '../../middleware/auth';

function handleNormalizationError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof NormalizationServiceError) {
    const statusMap: Record<string, number> = {
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409
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
 * Middleware ensuring only organizer or admin can access normalization endpoints.
 * Rejects judges, participants, and visitors with 403 Forbidden.
 */
function requireOrganizerOrAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      error: {
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      }
    });
    return;
  }

  if (user.role !== 'organizer' && user.role !== 'admin') {
    res.status(403).json({
      error: {
        message: 'Access denied: Only event organizers or administrators can access normalization data',
        code: 'FORBIDDEN'
      }
    });
    return;
  }

  next();
}

/**
 * Creates the router for event judging normalization endpoints.
 * Mounted at /events and /api/events.
 */
export function createNormalizationRouter(): Router {
  const router = Router();

  /**
   * POST /events/:eventId/judging/normalization
   * Executes a cross-judge normalization run for the event (organizer or admin only).
   */
  router.post(
    '/events/:eventId/judging/normalization',
    requireAuth,
    requireOrganizerOrAdmin,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const run = NormalizationService.createNormalizationRun(
          req.params.eventId,
          user.id,
          user.role
        );
        res.status(201).json({ run });
      } catch (err) {
        handleNormalizationError(err, res, next);
      }
    }
  );

  /**
   * GET /events/:eventId/judging/normalization
   * Lists all normalization runs for the event (organizer or admin only).
   */
  router.get(
    '/events/:eventId/judging/normalization',
    requireAuth,
    requireOrganizerOrAdmin,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const runs = NormalizationService.getNormalizationRuns(
          req.params.eventId,
          user.id,
          user.role
        );
        res.status(200).json({ runs });
      } catch (err) {
        handleNormalizationError(err, res, next);
      }
    }
  );

  /**
   * GET /events/:eventId/judging/normalization/:runId/results
   * Retrieves individual normalized results for a run with optional filtering.
   */
  router.get(
    '/events/:eventId/judging/normalization/:runId/results',
    requireAuth,
    requireOrganizerOrAdmin,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const submissionId = (req.query.submission || req.query.submissionId) as string | undefined;
        const judgeId = (req.query.judge || req.query.judgeId) as string | undefined;
        const criterionId = (req.query.criterion || req.query.criterionId) as string | undefined;

        const { results, submissionScores } = NormalizationService.getNormalizationResults(
          req.params.runId,
          req.params.eventId,
          user.id,
          user.role,
          { submissionId, judgeId, criterionId }
        );

        res.status(200).json({ results, submissionScores });
      } catch (err) {
        handleNormalizationError(err, res, next);
      }
    }
  );

  /**
   * POST /events/:eventId/judging/normalization/:runId/verify
   * Cryptographically verifies the SHA-256 canonical proof for a normalization run.
   */
  router.post(
    '/events/:eventId/judging/normalization/:runId/verify',
    requireAuth,
    requireOrganizerOrAdmin,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const verification = NormalizationService.verifyNormalizationRun(
          req.params.runId,
          req.params.eventId,
          user.id,
          user.role
        );
        res.status(200).json(verification);
      } catch (err) {
        handleNormalizationError(err, res, next);
      }
    }
  );

  /**
   * GET /events/:eventId/judging/normalization/:runId
   * Retrieves run detail, summary statistics, and proof metadata (organizer or admin only).
   */
  router.get(
    '/events/:eventId/judging/normalization/:runId',
    requireAuth,
    requireOrganizerOrAdmin,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const run = NormalizationService.getNormalizationRunById(
          req.params.runId,
          req.params.eventId,
          user.id,
          user.role
        );
        res.status(200).json({ run });
      } catch (err) {
        handleNormalizationError(err, res, next);
      }
    }
  );

  return router;
}
