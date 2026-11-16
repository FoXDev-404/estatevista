import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, keyLength: 64 });
const MAX_MEMORY = 64 * 1024 * 1024;

/**
 * Hash a password with scrypt. The parameters and salt are stored alongside
 * the digest so a future parameter change can be rolled out without locking
 * existing users out.
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || !password) {
    throw new TypeError('A password string is required.');
  }

  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_PARAMS.keyLength, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: MAX_MEMORY,
  });

  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64'),
    Buffer.from(derived).toString('base64'),
  ].join('$');
}

/**
 * Verify a password against a stored hash. Malformed hashes return false
 * instead of throwing so a corrupt row cannot break the login endpoint.
 */
export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;

  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 2 || r < 1 || p < 1) return false;

  try {
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (!salt.length || !expected.length) return false;

    const derived = Buffer.from(
      await scrypt(password, salt, expected.length, { N, r, p, maxmem: MAX_MEMORY }),
    );

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
