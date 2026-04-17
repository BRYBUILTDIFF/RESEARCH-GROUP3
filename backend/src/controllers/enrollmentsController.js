import { pool } from '../db/pool.js';
import { assertModulePublishReady } from '../services/modulePublishValidationService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function ensurePrerequisiteCompleted(userId, module) {
  if (!module.prerequisite_module_id) return;

  const prerequisite = await pool.query(
    `
      SELECT status
      FROM enrollments
      WHERE user_id = $1
        AND module_id = $2
      LIMIT 1;
    `,
    [userId, module.prerequisite_module_id]
  );

  if (prerequisite.rowCount === 0 || prerequisite.rows[0].status !== 'completed') {
    throw new AppError('Prerequisite module must be completed before enrollment.', 400);
  }
}

export const listEnrollments = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const result = await pool.query(
    `
      SELECT
        e.id, e.user_id, e.module_id, e.status, e.enrolled_at, e.completed_at, e.last_lesson_id,
        u.email AS user_email,
        m.title AS module_title
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      JOIN modules m ON m.id = e.module_id
      WHERE ($1::boolean = TRUE OR e.user_id = $2)
      ORDER BY e.enrolled_at DESC;
    `,
    [isAdmin, req.user.id]
  );
  res.json({ enrollments: result.rows });
});

export const createEnrollment = asyncHandler(async (req, res) => {
  const { moduleId, userId } = req.body;
  if (!moduleId) {
    throw new AppError('moduleId is required.', 400);
  }

  const targetUserId = req.user.role === 'admin' && userId ? Number(userId) : req.user.id;

  const moduleResult = await pool.query(
    `
      SELECT id, is_locked, prerequisite_module_id
      FROM modules
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1;
    `,
    [moduleId]
  );
  if (moduleResult.rowCount === 0) {
    throw new AppError('Module not found or inactive.', 404);
  }
  const module = moduleResult.rows[0];
  if (module.is_locked) {
    throw new AppError('Module is currently locked by admin.', 403);
  }

  await ensurePrerequisiteCompleted(targetUserId, module);
  await assertModulePublishReady(module.id, { statusCode: 400, includeReasons: false });

  const inserted = await pool.query(
    `
      INSERT INTO enrollments (user_id, module_id, status)
      VALUES ($1, $2, 'enrolled')
      ON CONFLICT (user_id, module_id)
      DO UPDATE SET status = enrollments.status
      RETURNING id, user_id, module_id, status, enrolled_at, completed_at, last_lesson_id;
    `,
    [targetUserId, moduleId]
  );

  res.status(201).json({ enrollment: inserted.rows[0] });
});

export const getEnrollmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const result = await pool.query(
    `
      SELECT
        e.id, e.user_id, e.module_id, e.status, e.enrolled_at, e.completed_at, e.last_lesson_id,
        m.title AS module_title
      FROM enrollments e
      JOIN modules m ON m.id = e.module_id
      WHERE e.id = $1
        AND ($2::boolean = TRUE OR e.user_id = $3)
      LIMIT 1;
    `,
    [id, isAdmin, req.user.id]
  );
  if (result.rowCount === 0) {
    throw new AppError('Enrollment not found.', 404);
  }
  res.json({ enrollment: result.rows[0] });
});
