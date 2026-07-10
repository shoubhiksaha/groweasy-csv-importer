import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(`Error processing request: ${err.message}`, err.stack);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.issues,
    });
  }

  if (err.name === 'MulterError') {
    // Use 413 for file size so the client's friendly error message is triggered
    const status = (err as any).code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: status === 413 ? 'File too large. Maximum allowed size is 10MB.' : err.message,
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};
