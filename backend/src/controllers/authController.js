import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logUserEvent } from '../services/logService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: '1d' });
}

function toAuthUser(user) {
  const hasChangedPassword = Boolean(user.password_changed_at);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
    mustChangePassword: Boolean(user.must_change_password),
    passwordChanged: hasChangedPassword && !Boolean(user.must_change_password),
  };
}

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    throw new AppError('fullName, email, and password are required.', 400);
  }
  if (String(password).length < 6) {
    throw new AppError('Password must be at least 6 characters.', 400);
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1;', [email]);
  if (existing.rowCount > 0) {
    throw new AppError('Email is already registered.', 409);
  }

  const hashed = await bcrypt.hash(password, 10);
  const inserted = await pool.query(
    `
      INSERT INTO users (email, full_name, role, role_id, password_hash, is_active, must_change_password, password_changed_at)
      VALUES (
        $1,
        $2,
        'user',
        (SELECT id FROM roles WHERE name = 'user' LIMIT 1),
        $3,
        TRUE,
        FALSE,
        NOW()
      )
      RETURNING id, email, full_name, role, must_change_password, password_changed_at;
    `,
    [email, fullName, hashed]
  );

  const user = inserted.rows[0];
  const token = signAccessToken(user);

  await logUserEvent({
    userId: user.id,
    eventType: 'register',
    details: { email: user.email },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    token,
    user: toAuthUser(user),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Email and password are required.', 400);
  }

  const result = await pool.query(
    `
      SELECT id, email, full_name, role, is_active, password_hash, must_change_password, password_changed_at
      FROM users
      WHERE email = $1
      LIMIT 1;
    `,
    [email]
  );

  if (result.rowCount === 0) {
    throw new AppError('Invalid credentials.', 401);
  }

  const user = result.rows[0];
  if (!user.is_active) {
    throw new AppError('Account is deactivated.', 403);
  }

  const matched = await bcrypt.compare(password, user.password_hash);
  if (!matched) {
    throw new AppError('Invalid credentials.', 401);
  }

  const token = signAccessToken(user);

  await logUserEvent({
    userId: user.id,
    eventType: 'login',
    details: { email: user.email },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    token,
    user: toAuthUser(user),
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
