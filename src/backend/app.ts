import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { isDatabaseConnected } from './database/db';
import { authenticate } from './middleware/auth';
import { createAuthRouter } from './modules/auth/authRoutes';
import { createEventRouter } from './modules/events/eventRoutes';
import { createTeamRouter } from './modules/teams/teamRoutes';
import { createSubmissionRouter } from './modules/submissions/submissionRoutes';
import { createJudgeRouter, createEventJudgingRouter, createExportRouter } from './modules/judging/judgingRoutes';
import { createNormalizationRouter } from './modules/normalization/normalizationRoutes';
import { createVotingRouter } from './modules/voting/votingRoutes';
import { HealthResponse } from '../shared/types';

export function createApp(customSetup?: (app: express.Application) => void): express.Application {
  const app = express();

  // JSON request body parser
  app.use(express.json());

  // Global authentication extractor (resolves session if present, non-blocking for public routes)
  app.use(authenticate);

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    const dbConnected = isDatabaseConnected();
    const health: HealthResponse = {
      status: dbConnected ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: config.nodeEnv,
      database: {
        connected: dbConnected,
        path: config.dbPath
      }
    };

    const statusCode = dbConnected ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Mount authentication routes at /auth and /api/auth
  const authRouter = createAuthRouter();
  app.use('/auth', authRouter);
  app.use('/api/auth', authRouter);

  // Mount event routes at /events and /api/events
  const eventRouter = createEventRouter();
  app.use('/events', eventRouter);
  app.use('/api/events', eventRouter);

  // Mount team routes at root and /api
  const teamRouter = createTeamRouter();
  app.use('/', teamRouter);
  app.use('/api', teamRouter);

  // Mount submission & gallery routes at root and /api
  const submissionRouter = createSubmissionRouter();
  app.use('/', submissionRouter);
  app.use('/api', submissionRouter);

  // Mount judge routes at /judge and /api/judge
  const judgeRouter = createJudgeRouter();
  app.use('/judge', judgeRouter);
  app.use('/api/judge', judgeRouter);

  // Mount event judging routes at root and /api
  const eventJudgingRouter = createEventJudgingRouter();
  app.use('/', eventJudgingRouter);
  app.use('/api', eventJudgingRouter);

  // Mount export routes at /exports and /api/exports
  const exportRouter = createExportRouter();
  app.use('/exports', exportRouter);
  app.use('/api/exports', exportRouter);

  // Mount normalization routes at root and /api
  const normalizationRouter = createNormalizationRouter();
  app.use('/', normalizationRouter);
  app.use('/api', normalizationRouter);

  // Mount T3 community voting routes at root and /api
  const votingRouter = createVotingRouter();
  app.use('/', votingRouter);
  app.use('/api', votingRouter);

  // Allow test suites or custom modules to attach routes before fallback handlers
  if (customSetup) {
    customSetup(app);
  }

  // Serve static assets from the built frontend if they exist
  if (fs.existsSync(config.frontendDistPath)) {
    app.use(express.static(config.frontendDistPath));

    // Fallback to index.html for client-side SPA routing (only for browser page requests accepting text/html)
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Do not rewrite API, auth, event, team, submission, gallery, judge, export, health, or test routes
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/events') ||
        req.path.startsWith('/teams') ||
        req.path.startsWith('/team-invitations') ||
        req.path.startsWith('/submissions') ||
        req.path.startsWith('/gallery') ||
        req.path.startsWith('/judge') ||
        req.path.startsWith('/exports') ||
        req.path.startsWith('/test') ||
        req.path === '/health'
      ) {
        return next();
      }

      // Only serve index.html if the browser explicitly requests text/html
      if (req.headers.accept?.includes('text/html')) {
        const indexPath = path.join(config.frontendDistPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          return res.sendFile(indexPath);
        }
      }

      next();
    });
  }

  // 404 Handler for unhandled routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: `Route not found: ${req.method} ${req.path}`,
        code: 'NOT_FOUND'
      }
    });
  });

  // Centralized error handling middleware
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[Error Handler]', err);

    res.status(500).json({
      error: {
        message: config.nodeEnv === 'production' ? 'Internal Server Error' : message,
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  });

  return app;
}
