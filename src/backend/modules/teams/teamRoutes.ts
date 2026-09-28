import { Router, Request, Response, NextFunction } from 'express';
import { TeamService, TeamServiceError } from './teamService';
import { requireAuth } from '../../middleware/auth';

function handleTeamError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof TeamServiceError) {
    const statusMap: Record<string, number> = {
      BAD_REQUEST: 400,
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

export function createTeamRouter(): Router {
  const router = Router();

  // --------------------------------------------------------------------------
  // EVENT-SCOPED TEAMS
  // --------------------------------------------------------------------------

  /**
   * POST /events/:eventId/teams
   * Creates a new team with the authenticated user as captain.
   */
  router.post('/events/:eventId/teams', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const team = TeamService.createTeam(req.params.eventId, user.id, req.body || {});
      res.status(201).json({ team });
    } catch (err) {
      handleTeamError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/teams
   * Lists all teams created for an event.
   */
  router.get('/events/:eventId/teams', (req: Request, res: Response, next: NextFunction) => {
    try {
      const teams = TeamService.listTeamsByEvent(req.params.eventId);
      res.status(200).json({ teams });
    } catch (err) {
      handleTeamError(err, res, next);
    }
  });

  /**
   * GET /events/:eventId/my-team
   * Retrieves the authenticated user's team for a specific event (or null).
   */
  router.get('/events/:eventId/my-team', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const team = TeamService.getUserTeamForEvent(user.id, req.params.eventId);
      res.status(200).json({ team });
    } catch (err) {
      handleTeamError(err, res, next);
    }
  });

  // --------------------------------------------------------------------------
  // TEAM OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * GET /teams/mine
   * Lists all teams the authenticated user belongs to (as captain or member).
   * Supports optional query ?eventId=...
   */
  router.get('/teams/mine', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const eventId = req.query.eventId as string | undefined;
      const teams = TeamService.getUserTeams(user.id, eventId);
      res.status(200).json({ teams });
    } catch (err) {
      handleTeamError(err, res, next);
    }
  });

  router.get('/user/teams', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const eventId = req.query.eventId as string | undefined;
      const teams = TeamService.getUserTeams(user.id, eventId);
      res.status(200).json({ teams });
    } catch (err) {
      handleTeamError(err, res, next);
    }
  });

  /**
   * GET /teams/:teamId
   * Retrieves a team with full membership details.
   */
  router.get('/teams/:teamId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const team = TeamService.getTeamById(req.params.teamId);
      if (!team) {
        res.status(404).json({
          error: {
            message: `Team "${req.params.teamId}" not found`,
            code: 'NOT_FOUND'
          }
        });
        return;
      }
      res.status(200).json({ team });
    } catch (err) {
      handleTeamError(err, res, next);
    }
  });

  /**
   * PATCH /teams/:teamId
   * Updates team details (captain or admin only).
   */
  router.patch('/teams/:teamId', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const team = TeamService.updateTeam(req.params.teamId, user.id, user.role, req.body || {});
      res.status(200).json({ team });
    } catch (err) {
      handleTeamError(err, res, next);
    }
  });

  /**
   * POST /teams/:teamId/leave
   * Leaves the team. Captain cannot leave if other members remain.
   */
  router.post('/teams/:teamId/leave', requireAuth, (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const result = TeamService.leaveTeam(req.params.teamId, user.id);
      res.status(200).json({
        message: result.teamDeleted ? 'Left and disbanded empty team' : 'Left team successfully',
        ...result
      });
    } catch (err) {
      handleTeamError(err, res, next);
    }
  });

  /**
   * DELETE /teams/:teamId/members/:userId
   * Removes a member from the team (captain or admin only).
   */
  router.delete(
    '/teams/:teamId/members/:userId',
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        TeamService.removeMember(req.params.teamId, req.params.userId, user.id, user.role);
        res.status(200).json({ message: 'Member removed successfully' });
      } catch (err) {
        handleTeamError(err, res, next);
      }
    }
  );

  // --------------------------------------------------------------------------
  // INVITATIONS
  // --------------------------------------------------------------------------

  /**
   * POST /teams/:teamId/invitations
   * Generates a new invitation link/token (captain only).
   */
  router.post(
    '/teams/:teamId/invitations',
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const result = TeamService.createInvitation(req.params.teamId, user.id, user.role, req.body || {});
        res.status(201).json(result);
      } catch (err) {
        handleTeamError(err, res, next);
      }
    }
  );

  /**
   * POST /team-invitations/:token/accept
   * Accepts an invitation and joins the authenticated participant to the team.
   */
  router.post(
    '/team-invitations/:token/accept',
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const team = TeamService.acceptInvitation(req.params.token, user.id);
        res.status(200).json({
          message: 'Invitation accepted successfully',
          team
        });
      } catch (err) {
        handleTeamError(err, res, next);
      }
    }
  );

  /**
   * DELETE /team-invitations/:invitationId
   * Revokes a pending invitation (captain only).
   */
  router.delete(
    '/team-invitations/:invitationId',
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        TeamService.revokeInvitation(req.params.invitationId, user.id, user.role);
        res.status(200).json({ message: 'Invitation revoked successfully' });
      } catch (err) {
        handleTeamError(err, res, next);
      }
    }
  );

  return router;
}
