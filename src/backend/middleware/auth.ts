import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../modules/auth/authService';
import { AuthUser, UserRole } from '../../shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
      rawToken?: string;
    }
  }
}

/**
 * Extracts a specific cookie value from the raw Cookie header.
 */
export function extractCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Extracts raw authentication token from Authorization header or HttpOnly cookie.
 */
export function extractRawToken(req: Request): string | null {
  // 1. Check standard Authorization header (Bearer <token> or raw token)
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string') {
    const trimmed = authHeader.trim();
    if (trimmed.startsWith('Bearer ')) {
      return trimmed.slice(7).trim();
    }
    if (trimmed.startsWith('Token ')) {
      return trimmed.slice(6).trim();
    }
    return trimmed;
  }

  // 2. Check custom header fallback
  const customHeader = req.headers['x-auth-token'] || req.headers['x-dogfood-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  // 3. Check browser HttpOnly cookie
  const cookieToken =
    extractCookie(req.headers.cookie, 'session') || extractCookie(req.headers.cookie, 'dogfood_session');
  if (cookieToken && cookieToken.trim()) {
    return cookieToken.trim();
  }

  return null;
}

/**
 * Authentication middleware that extracts, hashes, and validates session tokens.
 * Populates req.user if a valid unexpired session exists.
 * Does NOT reject unauthenticated requests, allowing public routes to function.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractRawToken(req);
  if (!token) {
    return next();
  }

  const result = AuthService.resolveSessionUser(token);
  if (result) {
    req.user = result.user;
    req.sessionId = result.sessionId;
    req.rawToken = token;
  }

  next();
}

/**
 * Middleware guard that rejects unauthenticated requests with 401 Unauthorized.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      }
    });
    return;
  }
  next();
}

/**
 * Middleware guard that enforces specific role permissions.
 * Rejects unauthenticated requests with 401.
 * Rejects authenticated requests with insufficient role with 403 Forbidden.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED'
        }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          message: `Forbidden: Access requires one of [${allowedRoles.join(', ')}] role`,
          code: 'FORBIDDEN'
        }
      });
      return;
    }

    next();
  };
}
