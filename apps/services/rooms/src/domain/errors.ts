export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class InvalidRoomNameError extends DomainError {
  readonly code = 'INVALID_ROOM_NAME';
  constructor(reason: string) {
    super(reason);
  }
}

export class RoomNotFoundError extends DomainError {
  readonly code = 'ROOM_NOT_FOUND';
  constructor() {
    super('Room not found');
  }
}
