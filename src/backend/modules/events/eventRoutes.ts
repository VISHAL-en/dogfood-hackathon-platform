import { Router, Request, Response, NextFunction } from 'express';
import { EventService, EventServiceError } from './eventService';
import { requireRole } from '../../middleware/auth';
import { EventStatus } from '../../../shared/types';

function handleServiceError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof EventServiceError) {
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

export function createEventRouter(): Router {
  const router = Router();

  // --------------------------------------------------------------------------
  // PUBLIC EVENT DISCOVERY & DETAILS
  // --------------------------------------------------------------------------

  /**
   * GET /events
   * Public discovery endpoint listing active/published events.
   */
  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = req.query.search as string | undefined;
      const status = req.query.status as EventStatus | undefined;
      const organizerId = req.query.organizerId as string | undefined;

      const events = EventService.listEvents({ search, status, organizerId }, req.user || null);
      res.status(200).json({ events });
    } catch (err) {
      handleServiceError(err, res, next);
    }
  });

  /**
   * GET /events/:idOrSlug
   * Public event detail endpoint returning event info, tracks, and prizes.
   */
  router.get('/:idOrSlug', (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = EventService.getEventByIdOrSlug(req.params.idOrSlug, req.user || null);
      if (!event) {
        res.status(404).json({
          error: {
            message: `Event "${req.params.idOrSlug}" not found`,
            code: 'NOT_FOUND'
          }
        });
        return;
      }
      res.status(200).json({ event });
    } catch (err) {
      handleServiceError(err, res, next);
    }
  });

  // --------------------------------------------------------------------------
  // ORGANIZER / ADMIN EVENT MUTATIONS
  // --------------------------------------------------------------------------

  /**
   * POST /events
   * Creates a new hackathon event. Organizer identity is derived server-side.
   */
  router.post(
    '/',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const targetOrganizerId =
          user.role === 'admin' && req.body.organizerId ? req.body.organizerId : user.id;

        const event = EventService.createEvent(targetOrganizerId, req.body);
        res.status(201).json({ event });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  /**
   * PUT /events/:id
   * Updates an existing event. Validates owner/admin authorization.
   */
  router.put(
    '/:id',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const event = EventService.updateEvent(req.params.id, user.id, user.role, req.body);
        res.status(200).json({ event });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  /**
   * DELETE /events/:id
   * Deletes an event and cascades to tracks and prizes.
   */
  router.delete(
    '/:id',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        EventService.deleteEvent(req.params.id, user.id, user.role);
        res.status(200).json({ message: 'Event deleted successfully' });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  // --------------------------------------------------------------------------
  // TRACKS
  // --------------------------------------------------------------------------

  router.get('/:eventId/tracks', (req: Request, res: Response, next: NextFunction) => {
    try {
      const tracks = EventService.listTracks(req.params.eventId);
      res.status(200).json({ tracks });
    } catch (err) {
      handleServiceError(err, res, next);
    }
  });

  router.post(
    '/:eventId/tracks',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const track = EventService.createTrack(req.params.eventId, user.id, user.role, req.body);
        res.status(201).json({ track });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  router.put(
    '/:eventId/tracks/:trackId',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const track = EventService.updateTrack(
          req.params.eventId,
          req.params.trackId,
          user.id,
          user.role,
          req.body
        );
        res.status(200).json({ track });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  router.delete(
    '/:eventId/tracks/:trackId',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        EventService.deleteTrack(req.params.eventId, req.params.trackId, user.id, user.role);
        res.status(200).json({ message: 'Track deleted successfully' });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  // --------------------------------------------------------------------------
  // PRIZES
  // --------------------------------------------------------------------------

  router.get('/:eventId/prizes', (req: Request, res: Response, next: NextFunction) => {
    try {
      const prizes = EventService.listPrizes(req.params.eventId);
      res.status(200).json({ prizes });
    } catch (err) {
      handleServiceError(err, res, next);
    }
  });

  router.post(
    '/:eventId/prizes',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const prize = EventService.createPrize(req.params.eventId, user.id, user.role, req.body);
        res.status(201).json({ prize });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  router.put(
    '/:eventId/prizes/:prizeId',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        const prize = EventService.updatePrize(
          req.params.eventId,
          req.params.prizeId,
          user.id,
          user.role,
          req.body
        );
        res.status(200).json({ prize });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  router.delete(
    '/:eventId/prizes/:prizeId',
    requireRole('organizer', 'admin'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user!;
        EventService.deletePrize(req.params.eventId, req.params.prizeId, user.id, user.role);
        res.status(200).json({ message: 'Prize deleted successfully' });
      } catch (err) {
        handleServiceError(err, res, next);
      }
    }
  );

  return router;
}
