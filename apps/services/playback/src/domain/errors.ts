export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class InvalidVideoUrlError extends DomainError {
  readonly code = 'INVALID_VIDEO_URL';
  constructor() {
    super('Could not extract a video id from that URL');
  }
}

export class VideoNotFoundError extends DomainError {
  readonly code = 'VIDEO_NOT_FOUND';
  constructor() {
    super('YouTube does not know this video');
  }
}

export class VideoNotEmbeddableError extends DomainError {
  readonly code = 'VIDEO_NOT_EMBEDDABLE';
  constructor() {
    super('This video cannot be embedded outside YouTube');
  }
}

export class VideoTooLongError extends DomainError {
  readonly code = 'VIDEO_TOO_LONG';
  constructor(maxDurationS: number) {
    super(`Videos longer than ${Math.floor(maxDurationS / 3600)}h are not allowed`);
  }
}

export class DuplicateVideoError extends DomainError {
  readonly code = 'DUPLICATE_VIDEO';
  constructor() {
    super('This video is already in the queue');
  }
}

/** Circuit open / YouTube down — graceful degrade (CLAUDE.md §9.1). */
export class VideoMetadataUnavailableError extends DomainError {
  readonly code = 'VIDEO_METADATA_UNAVAILABLE';
  constructor() {
    super('Video metadata is temporarily unavailable — try again in a minute');
  }
}

export class QueueItemNotFoundError extends DomainError {
  readonly code = 'QUEUE_ITEM_NOT_FOUND';
  constructor() {
    super('Queue item not found');
  }
}

export class NotAllowedToRemoveError extends DomainError {
  readonly code = 'NOT_ALLOWED_TO_REMOVE';
  constructor() {
    super('Only the item adder or the room owner can remove it');
  }
}

export class CannotRemovePlayingItemError extends DomainError {
  readonly code = 'CANNOT_REMOVE_PLAYING';
  constructor() {
    super('The currently playing video cannot be removed — start a skip vote instead');
  }
}
