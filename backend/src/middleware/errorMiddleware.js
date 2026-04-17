import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

export function errorHandler(error, _req, res, _next) {
  const statusCode =
    error instanceof AppError
      ? error.statusCode
      : typeof error?.statusCode === 'number'
        ? error.statusCode
        : typeof error?.status === 'number'
          ? error.status
          : 500;
  const message =
    error?.type === 'entity.too.large'
      ? 'Request payload too large. Reduce media size or increase API_BODY_LIMIT.'
      : error.message || 'Internal server error.';

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    message,
  });
}
