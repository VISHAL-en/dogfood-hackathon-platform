import { Router, Request, Response, NextFunction } from 'express';
import { SubmissionService, SubmissionServiceError } from './submissionService';
import { requireAuth } from '../../middleware/auth';
import { getDatabase } from '../../database/db';

function handleSubmissionError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof SubmissionServiceError) {
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

export function createSubmissionRouter(): Router {
  const router = Router();

  // --------------------------------------------------------------------------
  // PUBLIC GALLERY
  // --------------------------------------------------------------------------

  /**
   * GET /gallery
   * Public project gallery with search, event/track filtering, and pagination.
   */
  router.get('/gallery', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event, track, search, page, limit } = req.query;
      const result = SubmissionService.getPublicGallery({
        event: typeof event === 'string' ? event : undefined,
        track: typeof track === 'string' ? track : undefined,
        search: typeof search === 'string' ? search : undefined,
        page: typeof page === 'string' ? page : undefined,
        limit: typeof limit === 'string' ? limit : undefined
      });

      res.status(200).json(result);
    } catch (err) {
      handleSubmissionError(err, res, next);
    }
  });

  /**
   * GET /gallery/:idOrSlug
   * Public project detail endpoint.
   */
  router.get('/gallery/:idOrSlug', (req: Request, res: Response, next: NextFunction) => {
    try {
      const submission = SubmissionService.getPublicProjectDetail(req.params.idOrSlug);
      if (!submission) {
        res.status(404).json({
          error: {
            message: `Submission "${req.params.idOrSlug}" not found or not publicly available`,
            code: 'NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({ submission });
    } catch (err) {
      handleSubmissionError(err, res, next);
    }
  });

  // --------------------------------------------------------------------------
  // TEAM SUBMISSIONS
  // --------------------------------------------------------------------------

  /**
   * POST /events/:eventId/teams/:teamId/submission
   * Creates a draft submission for a team in an event.
   */
  router.post(
    '/events/:eventId/teams/:teamId/submission',
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const submission = SubmissionService.createSubmission(
          req.params.eventId,
          req.params.teamId,
          user.id,
          req.body || {}
        );
        res.status(201).json({ submission });
      } catch (err) {
        handleSubmissionError(err, res, next);
      }
    }
  );

  /**
   * GET /events/:eventId/teams/:teamId/submission
   * Retrieves the team's submission (team members and organizers only).
   */
  router.get(
    '/events/:eventId/teams/:teamId/submission',
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const submission = SubmissionService.getTeamSubmission(
          req.params.eventId,
          req.params.teamId,
          user.id,
          user.role
        );

        if (!submission) {
          res.status(404).json({
            error: {
              message: 'No submission found for this team',
              code: 'NOT_FOUND'
            }
          });
          return;
        }

        res.status(200).json({ submission });
      } catch (err) {
        handleSubmissionError(err, res, next);
      }
    }
  );

  /**
   * POST /submissions
   * Unified submission endpoint for acceptance checker and direct API usage.
   * Dispatches to event/team creation or rejects if closed / deadline passed.
   */
  router.post('/submissions', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const body = req.body || {};
      const eventId = body.eventId || body.event_id;
      let teamId = body.teamId || body.team_id;

      if (!eventId) {
        res.status(400).json({
          error: {
            message: 'eventId is required to create a submission',
            code: 'BAD_REQUEST'
          }
        });
        return;
      }

      // If teamId was not supplied, attempt to find user's team in eventId
      if (!teamId) {
        const db = getDatabase();
        const member = db.prepare(`
          SELECT tm.team_id, tm.role
          FROM team_members tm
          WHERE tm.user_id = ? AND tm.event_id = ?
        `).get(user.id, eventId) as { team_id: string; role: string } | undefined;

        if (!member) {
          res.status(400).json({
            error: {
              message: 'Participant does not belong to a team in this event',
              code: 'BAD_REQUEST'
            }
          });
          return;
        }

        teamId = member.team_id;
      }

      const submission = SubmissionService.createSubmission(
        eventId,
        teamId,
        user.id,
        body
      );
      res.status(201).json({ submission });
    } catch (err) {
      handleSubmissionError(err, res, next);
    }
  });

  /**
   * PATCH /submissions/:submissionId
   * Updates an existing draft or submission before the deadline.
   */
  router.patch('/submissions/:submissionId', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const submission = SubmissionService.updateSubmission(
        req.params.submissionId,
        user.id,
        user.role,
        req.body || {}
      );
      res.status(200).json({ submission });
    } catch (err) {
      handleSubmissionError(err, res, next);
    }
  });

  /**
   * POST /submissions/:submissionId/submit
   * Finalizes the submission.
   */
  router.post('/submissions/:submissionId/submit', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const submission = SubmissionService.submitProject(
        req.params.submissionId,
        user.id,
        user.role
      );
      res.status(200).json({
        message: 'Project submitted successfully',
        submission
      });
    } catch (err) {
      handleSubmissionError(err, res, next);
    }
  });

  return router;
}
