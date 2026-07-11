import type { RefreshTokenRecord, RefreshTokenRepository } from '../../domain/ports.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(record: Omit<RefreshTokenRecord, 'rotatedAt' | 'revokedAt'>): Promise<void> {
    await this.prisma.refreshToken.create({ data: record });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!row) return null;
    const { id, userId, familyId, expiresAt, rotatedAt, revokedAt } = row;
    return { id, userId, tokenHash, familyId, expiresAt, rotatedAt, revokedAt };
  }

  async markRotated(id: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { rotatedAt: at } });
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
