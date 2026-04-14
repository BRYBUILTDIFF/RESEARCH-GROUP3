import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminDashboard = asyncHandler(async (_req, res) => {
  const [users, enrollments, avgScore, completionRate] = await Promise.all([
    pool.query('SELECT COUNT(*)::INT AS value FROM users WHERE role = \'user\';'),
    pool.query('SELECT COUNT(*)::INT AS value FROM enrollments;'),
    pool.query('SELECT COALESCE(AVG(score), 0)::NUMERIC(5,2) AS value FROM results;'),
    pool.query(
      `
        SELECT
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
          END AS value
        FROM enrollments;
      `
    ),
  ]);

  res.json({
    totalUsers: users.rows[0].value,
    totalEnrollments: enrollments.rows[0].value,
    averageScore: Number(avgScore.rows[0].value),
    completionRate: Number(completionRate.rows[0].value),
  });
});

export const userDashboard = asyncHandler(async (req, res) => {
  const [enrollments, averageScore, completedModules] = await Promise.all([
    pool.query('SELECT COUNT(*)::INT AS value FROM enrollments WHERE user_id = $1;', [req.user.id]),
    pool.query('SELECT COALESCE(AVG(score), 0)::NUMERIC(5,2) AS value FROM results WHERE user_id = $1;', [req.user.id]),
    pool.query('SELECT COUNT(*)::INT AS value FROM enrollments WHERE user_id = $1 AND status = \'completed\';', [req.user.id]),
  ]);

  res.json({
    enrollments: enrollments.rows[0].value,
    averageScore: Number(averageScore.rows[0].value),
    completedModules: completedModules.rows[0].value,
  });
});
