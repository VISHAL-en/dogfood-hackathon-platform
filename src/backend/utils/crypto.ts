import crypto from 'crypto';

/**
 * Hashes a plaintext password using Node's native scrypt with a random 16-byte salt.
 * Formats as "salt:hash".
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored "salt:hash" using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, expectedKeyHex] = storedHash.split(':');
    if (!salt || !expectedKeyHex) {
      return false;
    }

    const actualKey = crypto.scryptSync(password, salt, 64);
    const expectedKey = Buffer.from(expectedKeyHex, 'hex');

    if (actualKey.length !== expectedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure random session token (256-bit entropy).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes the SHA-256 hash of a session token.
 * Only this hash is ever stored in SQLite.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a unique string identifier.
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}
