import { roomNameSchema } from '@lilochat/contracts';
import { InvalidRoomNameError } from './errors.js';

export type RoomStatus = 'ACTIVE' | 'ARCHIVED';

export interface RoomProps {
  id: string;
  name: string;
  ownerId: string;
  status: RoomStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Room {
  private constructor(private readonly props: RoomProps) {}

  static create(input: { id: string; name: string; ownerId: string; now: Date }): Room {
    const parsed = roomNameSchema.safeParse(input.name);
    if (!parsed.success) {
      throw new InvalidRoomNameError(parsed.error.issues[0]?.message ?? 'Invalid room name');
    }
    return new Room({
      id: input.id,
      name: parsed.data,
      ownerId: input.ownerId,
      status: 'ACTIVE',
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static reconstitute(props: RoomProps): Room {
    return new Room({ ...props });
  }

  archive(now: Date): void {
    this.props.status = 'ARCHIVED';
    this.props.updatedAt = now;
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get ownerId(): string {
    return this.props.ownerId;
  }
  get status(): RoomStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
