import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Missing bearer token.', 401);
  }

  const token = authHeader.slice('Bearer '.length);
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError('Invalid or expired token.', 401);
  }

  const result = await pool.query(
    `
      SELECT id, email, full_name, role, is_active
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [payload.sub]
  );

  if (result.rowCount === 0) {
    throw new AppError('User not found.', 401);
  }

  const user = result.rows[0];
  if (!user.is_active) {
    throw new AppError('Account is deactivated.', 403);
  }

  req.user = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  };

  next();
});

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden.', 403));
    }
    return next();
  };
}
