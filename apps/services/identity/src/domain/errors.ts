/** Base class for identity domain errors. The HTTP layer maps `code` to a status. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class EmailAlreadyInUseError extends DomainError {
  readonly code = 'EMAIL_ALREADY_IN_USE';
  constructor() {
    super('Email is already in use');
  }
}

export class NicknameAlreadyInUseError extends DomainError {
  readonly code = 'NICKNAME_ALREADY_IN_USE';
  constructor() {
    super('Nickname is already in use');
  }
}

export class InvalidNicknameError extends DomainError {
  readonly code = 'INVALID_NICKNAME';
  constructor(reason: string) {
    super(reason);
  }
}

/** Same error for unknown email and wrong password — no user enumeration. */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  constructor() {
    super('Invalid email or password');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';
  constructor() {
    super('Invalid or expired refresh token');
  }
}

export class RefreshTokenReuseError extends DomainError {
  readonly code = 'REFRESH_TOKEN_REUSED';
  constructor() {
    super('Refresh token reuse detected; session revoked');
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  constructor() {
    super('User not found');
  }
}
