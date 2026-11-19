import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LoanInputError, PaymentError } from '@orgil/financial-engine';
import type { Response } from 'express';
import { requestContext } from './request-context';

/** Uniform error envelope; never leaks stack traces or SQL to clients. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = requestContext()?.requestId;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { message: 'Internal server error', code: 'INTERNAL' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { message: r } : { ...(r as object) };
    } else if (exception instanceof LoanInputError || exception instanceof PaymentError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      body = { message: exception.message, code: 'FINANCIAL_RULE' };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') { status = HttpStatus.CONFLICT; body = { message: 'Duplicate record', code: 'CONFLICT' }; }
      else if (exception.code === 'P2025') { status = HttpStatus.NOT_FOUND; body = { message: 'Not found', code: 'NOT_FOUND' }; }
      else if (exception.code === 'P2034') { status = HttpStatus.CONFLICT; body = { message: 'Concurrent update, please retry', code: 'RETRY' }; }
      else this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({ statusCode: status, error: HttpStatus[status] ?? 'Error', ...body, requestId });
  }
}
