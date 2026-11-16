import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../auth/password.js';

describe('password hashing', () => {
  it('hashes a password with scrypt and verifies it', async () => {
    const hash = await hashPassword('CorrectHorse1');

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(hash).not.toContain('CorrectHorse1');
    await expect(verifyPassword('CorrectHorse1', hash)).resolves.toBe(true);
    await expect(verifyPassword('correcthorse1', hash)).resolves.toBe(false);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-valid-hash')).resolves.toBe(false);
    await expect(verifyPassword('anything', '')).resolves.toBe(false);
  });
});
