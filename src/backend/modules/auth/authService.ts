import { getDatabase } from '../../database/db';
import { hashPassword, verifyPassword, generateSessionToken, hashSessionToken, generateId } from '../../utils/crypto';
import { AuthUser, UserRole } from '../../../shared/types';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
}

export interface CreatedSession {
  sessionId: string;
  rawToken: string;
  expiresAt: string;
}

export class AuthService {
  /**
   * Finds a user record by email (including password hash for authentication).
   */
  static findUserByEmail(email: string): UserRecord | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as UserRecord | undefined;
    return row || null;
  }

  /**
   * Finds a public safe user representation by user ID.
   */
  static findUserById(id: string): AuthUser | null {
    const db = getDatabase();
    const row = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(id) as
      | { id: string; email: string; name: string; role: UserRole; created_at: string }
      | undefined;

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at
    };
  }

  /**
   * Verifies user credentials. Returns the safe AuthUser if valid, or null if invalid.
   */
  static authenticateCredentials(email: string, password: string): AuthUser | null {
    const user = this.findUserByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.created_at
    };
  }

  /**
   * Registers a new user via public registration.
   * STRICT SECURITY INVARIANT: Public registration always creates a 'participant' account.
   * Any client-supplied role is strictly discarded. Privileged roles (organizer, judge, admin)
   * can only be assigned through authorized server-side mechanisms or seed fixtures.
   */
  static registerUser(data: { name: string; email: string; password: string }): AuthUser {
    const { name, email, password } = data;
    const db = getDatabase();

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email address already exists');
    }

    const userId = generateId('usr');
    const passwordHash = hashPassword(password);
    const nowIso = new Date().toISOString();
    const role: UserRole = 'participant'; // AUTHORITATIVE: Public registration is always 'participant'

    db.prepare(`
      INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, name.trim(), role, passwordHash, nowIso, nowIso);

    return {
      id: userId,
      email: normalizedEmail,
      name: name.trim(),
      role,
      createdAt: nowIso
    };
  }

  /**
   * Creates a new server-side session for a user.
   * Generates a raw token, hashes it, and stores ONLY the hash in SQLite.
   * Returns the raw token to send to the client.
   */
  static createSession(userId: string, expiresInDays: number = 7): CreatedSession {
    const db = getDatabase();
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const sessionId = generateId('sess');

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, userId, tokenHash, nowIso, expiresAt);

    return {
      sessionId,
      rawToken,
      expiresAt
    };
  }

  /**
   * Resolves an authenticated user from a raw session token.
   * Hashes the token, looks up the hash, and verifies expiration.
   */
  static resolveSessionUser(rawToken: string): { user: AuthUser; sessionId: string } | null {
    if (!rawToken || typeof rawToken !== 'string') {
      return null;
    }

    const tokenHash = hashSessionToken(rawToken);
    const db = getDatabase();
    const nowIso = new Date().toISOString();

    const row = db.prepare(`
      SELECT
        s.id as session_id,
        s.expires_at,
        u.id as user_id,
        u.email,
        u.name,
        u.role,
        u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(tokenHash, nowIso) as
      | {
          session_id: string;
          expires_at: string;
          user_id: string;
          email: string;
          name: string;
          role: UserRole;
          user_created_at: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      sessionId: row.session_id,
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.user_created_at
      }
    };
  }

  /**
   * Invalidates a session by raw token.
   */
  static invalidateSessionByToken(rawToken: string): boolean {
    if (!rawToken) return false;
    const tokenHash = hashSessionToken(rawToken);
    const db = getDatabase();
    const result = db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return result.changes > 0;
  }

  /**
   * Invalidates a session by session ID.
   */
  static invalidateSessionById(sessionId: string): boolean {
    if (!sessionId) return false;
    const db = getDatabase();
    const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return result.changes > 0;
  }
}
