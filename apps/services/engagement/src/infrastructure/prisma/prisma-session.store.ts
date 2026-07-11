import type { SessionStore } from '../../application/watch-time.tracker.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaSessionStore implements SessionStore {
  constructor(private readonly prisma: PrismaService) {}

  async open(session: { id: string; userId: string; roomId: string; startedAt: Date }) {
    await this.prisma.watchSession.upsert({
      where: { id: session.id },
      create: { ...session, lastCheckpointAt: session.startedAt },
      update: {}, // replayed joined event → no-op
    });
  }

  async credit(input: {
    sessionId: string;
    userId: string;
    roomId: string;
    seconds: number;
    at: Date;
  }): Promise<boolean> {
    const existing = await this.prisma.watchSession.findUnique({
      where: { id: input.sessionId },
    });
    if (existing?.endedAt) return false;

    await this.prisma.watchSession.upsert({
      where: { id: input.sessionId },
      // checkpoint arrived before joined (out of order) → open it on the fly
      create: {
        id: input.sessionId,
        userId: input.userId,
        roomId: input.roomId,
        startedAt: input.at,
        seconds: input.seconds,
        lastCheckpointAt: input.at,
      },
      update: { seconds: { increment: input.seconds }, lastCheckpointAt: input.at },
    });
    return true;
  }

  async end(sessionId: string, at: Date): Promise<number | null> {
    const session = await this.prisma.watchSession.findUnique({ where: { id: sessionId } });
    if (!session || session.endedAt) return null;
    await this.prisma.watchSession.update({
      where: { id: sessionId },
      data: { endedAt: at },
    });
    return Math.max(0, at.getTime() - session.lastCheckpointAt.getTime());
  }

  async isRoomPlaying(roomId: string): Promise<boolean> {
    const state = await this.prisma.roomState.findUnique({ where: { roomId } });
    return state?.playing ?? false;
  }

  async setRoomPlaying(roomId: string, playing: boolean, at: Date): Promise<void> {
    await this.prisma.roomState.upsert({
      where: { roomId },
      create: { roomId, playing, updatedAt: at },
      update: { playing, updatedAt: at },
    });
  }

  async addToTotals(userId: string, periods: string[], seconds: number): Promise<void> {
    await this.prisma.$transaction(
      periods.map((period) =>
        this.prisma.userTotal.upsert({
          where: { userId_period: { userId, period } },
          create: { userId, period, seconds },
          update: { seconds: { increment: seconds } },
        }),
      ),
    );
  }
}
