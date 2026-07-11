import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../domain/errors.js';

const STATUS_BY_CODE: Record<string, number> = {
  EMAIL_ALREADY_IN_USE: 409,
  NICKNAME_ALREADY_IN_USE: 409,
  INVALID_NICKNAME: 400,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  REFRESH_TOKEN_REUSED: 401,
  USER_NOT_FOUND: 404,
};

/** Domain errors cross the HTTP boundary as {statusCode, code, message} — no stack leaks. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = STATUS_BY_CODE[error.code] ?? 500;
    response.status(statusCode).json({ statusCode, code: error.code, message: error.message });
  }
}
