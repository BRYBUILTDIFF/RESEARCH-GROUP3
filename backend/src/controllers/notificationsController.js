import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const result = await pool.query(
    `
      SELECT id, user_id, title, message, is_read, created_at
      FROM notifications
      WHERE ($1::boolean = TRUE OR user_id = $2)
      ORDER BY created_at DESC;
    `,
    [isAdmin, req.user.id]
  );
  res.json({ notifications: result.rows });
});

export const createNotification = asyncHandler(async (req, res) => {
  const { userId, title, message } = req.body;
  if (!userId || !title || !message) {
    throw new AppError('userId, title, and message are required.', 400);
  }

  const inserted = await pool.query(
    `
      INSERT INTO notifications (user_id, title, message)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, title, message, is_read, created_at;
    `,
    [userId, title, message]
  );
  res.status(201).json({ notification: inserted.rows[0] });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await pool.query(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1
        AND (user_id = $2 OR $3::boolean = TRUE)
      RETURNING id, user_id, title, message, is_read, created_at;
    `,
    [id, req.user.id, req.user.role === 'admin']
  );
  if (updated.rowCount === 0) {
    throw new AppError('Notification not found.', 404);
  }
  res.json({ notification: updated.rows[0] });
});
