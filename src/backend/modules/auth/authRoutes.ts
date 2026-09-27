import { Router, Request, Response } from 'express';
import { AuthService } from './authService';
import { requireAuth } from '../../middleware/auth';
import { config } from '../../config';

export function createAuthRouter(): Router {
  const router = Router();

  /**
   * POST /auth/login
   * Validates credentials, creates server session, sets HttpOnly cookie, returns safe user object.
   */
  router.post('/login', (req: Request, res: Response) => {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        error: {
          message: 'Email and password are required',
          code: 'BAD_REQUEST'
        }
      });
      return;
    }

    const user = AuthService.authenticateCredentials(email, password);
    if (!user) {
      res.status(401).json({
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        }
      });
      return;
    }

    const session = AuthService.createSession(user.id);
    const isProduction = config.nodeEnv === 'production';
    const maxAgeSeconds = 7 * 24 * 60 * 60; // 7 days

    // Set secure HttpOnly session cookie
    const cookieParts = [
      `session=${session.rawToken}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      `Max-Age=${maxAgeSeconds}`
    ];
    if (isProduction) {
      cookieParts.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieParts.join('; '));
    res.status(200).json({ user });
  });

  /**
   * POST /auth/register
   * Public account registration.
   * HARDENED: Unauthenticated public registration unconditionally creates a 'participant' account.
   * Any client-supplied role in request body is strictly discarded. Privileged roles
   * can never be self-assigned.
   */
  router.post('/register', (req: Request, res: Response) => {
    const { name, email, password } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: {
          message: 'Full name is required',
          code: 'BAD_REQUEST'
        }
      });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({
        error: {
          message: 'A valid email address is required',
          code: 'BAD_REQUEST'
        }
      });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({
        error: {
          message: 'Password must be at least 8 characters long',
          code: 'BAD_REQUEST'
        }
      });
      return;
    }

    try {
      const user = AuthService.registerUser({ name, email, password });
      const session = AuthService.createSession(user.id);
      const isProduction = config.nodeEnv === 'production';
      const maxAgeSeconds = 7 * 24 * 60 * 60; // 7 days

      const cookieParts = [
        `session=${session.rawToken}`,
        'HttpOnly',
        'Path=/',
        'SameSite=Lax',
        `Max-Age=${maxAgeSeconds}`
      ];
      if (isProduction) {
        cookieParts.push('Secure');
      }

      res.setHeader('Set-Cookie', cookieParts.join('; '));
      res.status(201).json({ user, token: session.rawToken });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      const statusCode = message.includes('already exists') ? 409 : 400;
      res.status(statusCode).json({
        error: {
          message,
          code: statusCode === 409 ? 'CONFLICT' : 'BAD_REQUEST'
        }
      });
    }
  });

  /**
   * POST /auth/logout
   * Invalidates current server session and clears the browser cookie.
   */
  router.post('/logout', (req: Request, res: Response) => {
    if (req.rawToken) {
      AuthService.invalidateSessionByToken(req.rawToken);
    } else if (req.sessionId) {
      AuthService.invalidateSessionById(req.sessionId);
    }

    // Clear session cookie
    const clearCookie = 'session=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    res.setHeader('Set-Cookie', clearCookie);

    res.status(200).json({
      message: 'Logged out successfully'
    });
  });

  /**
   * GET /auth/me
   * Returns current authenticated user profile.
   */
  router.get('/me', requireAuth, (req: Request, res: Response) => {
    res.status(200).json({
      user: req.user
    });
  });

  return router;
}
