import { pool } from '../db/pool.js';

export async function logUserEvent({
  userId,
  eventType,
  details = {},
  ipAddress = null,
  userAgent = null,
}) {
  if (!userId) return;

  await pool.query(
    `
      INSERT INTO user_logs (user_id, event_type, details, ip_address, user_agent)
      VALUES ($1, $2, $3::jsonb, $4, $5);
    `,
    [userId, eventType, JSON.stringify(details), ipAddress, userAgent]
  );
}
