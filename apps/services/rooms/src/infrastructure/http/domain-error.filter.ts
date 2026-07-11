import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../domain/errors.js';

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_ROOM_NAME: 400,
  ROOM_NOT_FOUND: 404,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = STATUS_BY_CODE[error.code] ?? 500;
    response.status(statusCode).json({ statusCode, code: error.code, message: error.message });
  }
}
