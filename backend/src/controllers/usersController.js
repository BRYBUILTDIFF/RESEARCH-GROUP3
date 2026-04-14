import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function normalizeRole(role) {
  if (!role) return null;
  if (!['admin', 'user'].includes(role)) {
    throw new AppError('Invalid role. Expected admin or user.', 400);
  }
  return role;
}

export const listUsers = asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `
      SELECT id, email, full_name, role, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC;
    `
  );
  res.json({ users: result.rows });
});

export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    `
      SELECT id, email, full_name, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [id]
  );
  if (result.rowCount === 0) {
    throw new AppError('User not found.', 404);
  }
  res.json({ user: result.rows[0] });
});

export const createUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, role = 'user', isActive = true } = req.body;
  if (!fullName || !email || !password) {
    throw new AppError('fullName, email, and password are required.', 400);
  }
  if (String(password).length < 6) {
    throw new AppError('Password must be at least 6 characters.', 400);
  }

  const normalizedRole = normalizeRole(role);
  const hashed = await bcrypt.hash(password, 10);

  const inserted = await pool.query(
    `
      INSERT INTO users (email, full_name, role, role_id, password_hash, is_active)
      VALUES (
        $1,
        $2,
        $3,
        (SELECT id FROM roles WHERE name = $3 LIMIT 1),
        $4,
        $5
      )
      RETURNING id, email, full_name, role, is_active, created_at, updated_at;
    `,
    [email, fullName, normalizedRole, hashed, Boolean(isActive)]
  );

  res.status(201).json({ user: inserted.rows[0] });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fullName, email, role, isActive, password } = req.body;

  const existing = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1;', [id]);
  if (existing.rowCount === 0) {
    throw new AppError('User not found.', 404);
  }

  const current = existing.rows[0];
  const nextRole = role ? normalizeRole(role) : current.role;
  const nextPasswordHash = password ? await bcrypt.hash(String(password), 10) : current.password_hash;

  const updated = await pool.query(
    `
      UPDATE users
      SET
        full_name = COALESCE($2, full_name),
        email = COALESCE($3, email),
        role = $4,
        role_id = (SELECT id FROM roles WHERE name = $4 LIMIT 1),
        is_active = COALESCE($5, is_active),
        password_hash = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, full_name, role, is_active, created_at, updated_at;
    `,
    [id, fullName ?? null, email ?? null, nextRole, typeof isActive === 'boolean' ? isActive : null, nextPasswordHash]
  );

  res.json({ user: updated.rows[0] });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id;', [id]);
  if (deleted.rowCount === 0) {
    throw new AppError('User not found.', 404);
  }
  res.status(204).send();
});

export const getUserLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const logs = await pool.query(
    `
      SELECT id, event_type, details, ip_address, user_agent, created_at
      FROM user_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 200;
    `,
    [id]
  );
  res.json({ logs: logs.rows });
});

export const getMyProfile = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, email, full_name, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [req.user.id]
  );
  res.json({ user: result.rows[0] });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const { fullName } = req.body;
  const updated = await pool.query(
    `
      UPDATE users
      SET
        full_name = COALESCE($2, full_name),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, full_name, role, is_active, created_at, updated_at;
    `,
    [req.user.id, fullName ?? null]
  );
  res.json({ user: updated.rows[0] });
});
