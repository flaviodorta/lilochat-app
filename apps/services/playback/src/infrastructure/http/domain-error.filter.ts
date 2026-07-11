import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../domain/errors.js';

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_VIDEO_URL: 400,
  VIDEO_NOT_FOUND: 404,
  VIDEO_NOT_EMBEDDABLE: 422,
  VIDEO_TOO_LONG: 422,
  DUPLICATE_VIDEO: 409,
  VIDEO_METADATA_UNAVAILABLE: 503,
  QUEUE_ITEM_NOT_FOUND: 404,
  NOT_ALLOWED_TO_REMOVE: 403,
  CANNOT_REMOVE_PLAYING: 409,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = STATUS_BY_CODE[error.code] ?? 500;
    response.status(statusCode).json({ statusCode, code: error.code, message: error.message });
  }
}
