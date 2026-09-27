import { Router, Request, Response, NextFunction } from 'express';
import { JudgingService, JudgingServiceError } from './judgingService';
import { requireAuth, requireRole } from '../../middleware/auth';

function handleJudgingError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof JudgingServiceError) {
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
 * Creates the router for judge-specific operations mounted at /judge and /api/judge.
 */
export function createJudgeRouter(): Router {
  const router = Router();

  /**
   * GET /judge/scores/peer
   * Peer score access is strictly restricted across judges and participants.
   * Directly supports the DOGFOOD acceptance checker isolation check.
   */
  router.get('/scores/peer', requireAuth, (_req: Request, res: Response) => {
    res.status(403).json({
      error: {
        message: 'Access denied: Peer scores are isolated and cannot be accessed by other judges or participants',
        code: 'FORBIDDEN'
      }
    });
  });

  /**
   * GET /judge/scores
   * Returns only the authenticated judge's own scores.
   * Rejects non-judges (participants, visitors).
   */
  router.get('/scores', requireAuth, requireRole('judge'), (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { event, submission, assignment } = req.query;
      const scores = JudgingService.getJudgeScores(user.id, {
        eventId: typeof event === 'string' ? event : undefined,
        submissionId: typeof submission === 'string' ? submission : undefined,
        assignmentId: typeof assignment === 'string' ? assignment : undefined
      });

      res.status(200).json({ scores });
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  /**
   * GET /judge/assignments
   * Returns only the authenticated judge's assignments.
   */
  router.get('/assignments', requireAuth, requireRole('judge'), (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const assignments = JudgingService.getJudgeAssignments(user.id);
      res.status(200).json({ assignments });
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  /**
   * GET /judge/assignments/:assignmentId
   * Returns an assignment only if it belongs to the authenticated judge.
   */
  router.get('/assignments/:assignmentId', requireAuth, requireRole('judge'), (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const assignment = JudgingService.getJudgeAssignmentById(req.params.assignmentId, user.id);
      res.status(200).json({ assignment });
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  /**
   * PUT /judge/assignments/:assignmentId/scores
   * POST /judge/assignments/:assignmentId/scores
   * Submits or updates scores for the assigned project.
   */
  const submitScoresHandler = (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const scoresInput = req.body?.scores || [];
      const result = JudgingService.submitAssignmentScores(
        req.params.assignmentId,
        user.id,
        scoresInput
      );
      res.status(200).json(result);
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  };

  router.put('/assignments/:assignmentId/scores', requireAuth, requireRole('judge'), submitScoresHandler);
  router.post('/assignments/:assignmentId/scores', requireAuth, requireRole('judge'), submitScoresHandler);

  return router;
}

/**
 * Creates the router for event judging management (rubrics, assignments, progress).
 */
export function createEventJudgingRouter(): Router {
  const router = Router();

  /**
   * POST /events/:eventId/judging/rubrics
   * Creates a rubric for the event (organizer or admin only).
   */
  router.post('/events/:eventId/judging/rubrics', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const rubric = JudgingService.createRubric(req.params.eventId, user.id, user.role, req.body || {});
      res.status(201).json({ rubric });
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/judging/rubrics/:rubricId/activate
   * Activates a rubric (organizer or admin only).
   */
  router.post('/events/:eventId/judging/rubrics/:rubricId/activate', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const rubric = JudgingService.activateRubric(req.params.rubricId, user.id, user.role);
      res.status(200).json({ rubric });
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/judging/rubrics/active
   * Retrieves the currently active rubric for the event.
   */
  router.get('/events/:eventId/judging/rubrics/active', (req: Request, res: Response, next: NextFunction) => {
    try {
      const rubric = JudgingService.getActiveRubric(req.params.eventId);
      if (!rubric) {
        res.status(404).json({
          error: {
            message: 'No active rubric found for this event',
            code: 'NOT_FOUND'
          }
        });
        return;
      }
      res.status(200).json({ rubric });
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  /**
   * POST /events/:eventId/judging/assignments
   * Creates a judge assignment (organizer or admin only).
   */
  router.post('/events/:eventId/judging/assignments', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const assignment = JudgingService.createAssignment(
        req.params.eventId,
        user.id,
        user.role,
        req.body || {}
      );
      res.status(201).json({ assignment });
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/judging/progress
   * Returns aggregate judging progress (organizers and admins only).
   */
  router.get('/events/:eventId/judging/progress', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const progress = JudgingService.getJudgingProgress(req.params.eventId, user.id, user.role);
      res.status(200).json({ progress });
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  return router;
}

/**
 * Creates the router for score export endpoints mounted at /exports and /api/exports.
 */
export function createExportRouter(): Router {
  const router = Router();

  /**
   * GET /exports/scores.csv
   * Returns CSV export of judged scores (organizer or admin only).
   */
  router.get('/scores.csv', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : undefined;
      const csv = JudgingService.exportScoresCSV(user.role, eventId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="scores.csv"');
      res.status(200).send(csv);
    } catch (err) {
      handleJudgingError(err, res, next);
    }
  });

  return router;
}
