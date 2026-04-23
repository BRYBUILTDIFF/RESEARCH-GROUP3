import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { logUserEvent } from '../services/logService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const DEFAULT_ADMIN_CREATED_PASSWORD = 'password123';

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
      SELECT id, email, full_name, role, is_active, must_change_password, password_changed_at, created_at, updated_at
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
      SELECT id, email, full_name, role, is_active, must_change_password, password_changed_at, created_at, updated_at
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
  const { fullName, email, role = 'user', isActive = true } = req.body;
  if (!fullName || !email) {
    throw new AppError('fullName and email are required.', 400);
  }

  const normalizedRole = normalizeRole(role);
  const hashed = await bcrypt.hash(DEFAULT_ADMIN_CREATED_PASSWORD, 10);

  const inserted = await pool.query(
    `
      INSERT INTO users (
        email,
        full_name,
        role,
        role_id,
        password_hash,
        is_active,
        must_change_password,
        password_changed_at
      )
      VALUES (
        $1,
        $2,
        $3,
        (SELECT id FROM roles WHERE name = $3 LIMIT 1),
        $4,
        $5,
        TRUE,
        NULL
      )
      RETURNING id, email, full_name, role, is_active, must_change_password, password_changed_at, created_at, updated_at;
    `,
    [email, fullName, normalizedRole, hashed, Boolean(isActive)]
  );

  res.status(201).json({ user: inserted.rows[0], defaultPassword: DEFAULT_ADMIN_CREATED_PASSWORD });
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
  if (password && String(password).length < 6) {
    throw new AppError('Password must be at least 6 characters.', 400);
  }

  const hasPasswordReset = Boolean(password);
  const nextPasswordHash = hasPasswordReset ? await bcrypt.hash(String(password), 10) : current.password_hash;
  const nextMustChangePassword = hasPasswordReset ? true : current.must_change_password;
  const nextPasswordChangedAt = hasPasswordReset ? null : current.password_changed_at;

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
        must_change_password = $7,
        password_changed_at = $8,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, full_name, role, is_active, must_change_password, password_changed_at, created_at, updated_at;
    `,
    [
      id,
      fullName ?? null,
      email ?? null,
      nextRole,
      typeof isActive === 'boolean' ? isActive : null,
      nextPasswordHash,
      nextMustChangePassword,
      nextPasswordChangedAt,
    ]
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
      SELECT id, email, full_name, role, is_active, must_change_password, password_changed_at, created_at, updated_at
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
      RETURNING id, email, full_name, role, is_active, must_change_password, password_changed_at, created_at, updated_at;
    `,
    [req.user.id, fullName ?? null]
  );
  res.json({ user: updated.rows[0] });
});

export const updateMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new AppError('currentPassword and newPassword are required.', 400);
  }
  if (String(newPassword).length < 6) {
    throw new AppError('New password must be at least 6 characters.', 400);
  }
  if (String(currentPassword) === String(newPassword)) {
    throw new AppError('New password must be different from current password.', 400);
  }

  const existing = await pool.query(
    `
      SELECT id, password_hash
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [req.user.id]
  );
  if (existing.rowCount === 0) {
    throw new AppError('User not found.', 404);
  }

  const current = existing.rows[0];
  const matches = await bcrypt.compare(String(currentPassword), current.password_hash);
  if (!matches) {
    throw new AppError('Current password is incorrect.', 400);
  }

  const newPasswordHash = await bcrypt.hash(String(newPassword), 10);
  const updated = await pool.query(
    `
      UPDATE users
      SET
        password_hash = $2,
        must_change_password = FALSE,
        password_changed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, full_name, role, is_active, must_change_password, password_changed_at, created_at, updated_at;
    `,
    [req.user.id, newPasswordHash]
  );

  await logUserEvent({
    userId: req.user.id,
    eventType: 'password_changed',
    details: { via: 'self_service' },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ user: updated.rows[0] });
});
