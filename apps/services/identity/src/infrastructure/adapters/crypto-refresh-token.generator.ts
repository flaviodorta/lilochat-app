import { createHash, randomBytes } from 'node:crypto';
import type { RefreshTokenGenerator } from '../../domain/ports.js';

/** Opaque 256-bit tokens; only the sha256 hex digest is ever persisted. */
export class CryptoRefreshTokenGenerator implements RefreshTokenGenerator {
  generate(): { plain: string; hash: string } {
    const plain = randomBytes(32).toString('base64url');
    return { plain, hash: this.hash(plain) };
  }

  hash(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }
}
