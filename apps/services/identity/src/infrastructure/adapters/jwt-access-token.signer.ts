import jwt from 'jsonwebtoken';
import type { AccessTokenSigner } from '../../domain/ports.js';

export const JWT_ISSUER = 'lilochat-identity';
export const JWT_AUDIENCE = 'lilochat';

/** RS256: this service holds the private key; every other service verifies with the public key. */
export class JwtAccessTokenSigner implements AccessTokenSigner {
  constructor(
    private readonly privateKeyPem: string,
    private readonly ttlSec: number,
  ) {}

  async sign(payload: { sub: string; nickname: string }) {
    const token = jwt.sign({ nickname: payload.nickname }, this.privateKeyPem, {
      algorithm: 'RS256',
      subject: payload.sub,
      expiresIn: this.ttlSec,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return { token, expiresInSec: this.ttlSec };
  }
}
