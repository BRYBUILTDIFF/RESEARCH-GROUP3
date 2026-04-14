import { pool } from '../db/pool.js';
import { logUserEvent } from '../services/logService.js';
import {
  ensurePreviousLessonCompleted,
  getEnrollmentForUser,
  getLessonById,
  getModuleCompletionPercent,
} from '../services/progressionService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getEnrollmentProgress = asyncHandler(async (req, res) => {
  const { enrollmentId } = req.params;
  const enrollment = await getEnrollmentForUser({
    enrollmentId: Number(enrollmentId),
    userId: req.user.id,
    allowAdmin: true,
    role: req.user.role,
  });

  const lessonsResult = await pool.query(
    `
      SELECT id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url
      FROM lessons
      WHERE module_id = $1
        AND is_published = TRUE
      ORDER BY sequence_no ASC;
    `,
    [enrollment.module_id]
  );

  const progressResult = await pool.query(
    `
      SELECT lesson_id, completed, completed_at, last_position_seconds
      FROM progress
      WHERE enrollment_id = $1;
    `,
    [enrollment.id]
  );
  const progressByLesson = new Map(progressResult.rows.map((row) => [row.lesson_id, row]));
  const enriched = lessonsResult.rows.map((lesson) => {
    const lessonProgress = progressByLesson.get(lesson.id);
    return {
      ...lesson,
      completed: Boolean(lessonProgress?.completed),
      completedAt: lessonProgress?.completed_at ?? null,
      lastPositionSeconds: lessonProgress?.last_position_seconds ?? 0,
    };
  });

  const completionPercent = await getModuleCompletionPercent(enrollment.id, enrollment.module_id);
  res.json({ enrollment, completionPercent, lessons: enriched });
});

export const completeLesson = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const { enrollmentId, lastPositionSeconds = 0 } = req.body;
  if (!enrollmentId) {
    throw new AppError('enrollmentId is required.', 400);
  }

  const enrollment = await getEnrollmentForUser({
    enrollmentId: Number(enrollmentId),
    userId: req.user.id,
    allowAdmin: true,
    role: req.user.role,
  });
  const lesson = await getLessonById(Number(lessonId));

  if (lesson.module_id !== enrollment.module_id) {
    throw new AppError('Lesson does not belong to enrollment module.', 400);
  }

  await ensurePreviousLessonCompleted(enrollment.id, lesson.module_id, lesson.sequence_no);

  await pool.query(
    `
      INSERT INTO progress (enrollment_id, lesson_id, completed, completed_at, last_position_seconds)
      VALUES ($1, $2, TRUE, NOW(), $3)
      ON CONFLICT (enrollment_id, lesson_id)
      DO UPDATE SET
        completed = TRUE,
        completed_at = NOW(),
        last_position_seconds = EXCLUDED.last_position_seconds;
    `,
    [enrollment.id, lesson.id, Number(lastPositionSeconds)]
  );

  await pool.query(
    `
      UPDATE enrollments
      SET
        status = 'in_progress',
        last_lesson_id = $2
      WHERE id = $1;
    `,
    [enrollment.id, lesson.id]
  );

  const completionPercent = await getModuleCompletionPercent(enrollment.id, enrollment.module_id);

  await logUserEvent({
    userId: enrollment.user_id,
    eventType: 'lesson_completed',
    details: {
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      moduleId: lesson.module_id,
      completionPercent,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    message: 'Lesson completed.',
    completionPercent,
  });
});

export const saveLessonPosition = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const { enrollmentId, lastPositionSeconds = 0 } = req.body;
  if (!enrollmentId) {
    throw new AppError('enrollmentId is required.', 400);
  }

  const enrollment = await getEnrollmentForUser({
    enrollmentId: Number(enrollmentId),
    userId: req.user.id,
    allowAdmin: true,
    role: req.user.role,
  });
  const lesson = await getLessonById(Number(lessonId));
  if (lesson.module_id !== enrollment.module_id) {
    throw new AppError('Lesson does not belong to enrollment module.', 400);
  }

  await pool.query(
    `
      INSERT INTO progress (enrollment_id, lesson_id, last_position_seconds, completed)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (enrollment_id, lesson_id)
      DO UPDATE SET
        last_position_seconds = EXCLUDED.last_position_seconds;
    `,
    [enrollment.id, lesson.id, Number(lastPositionSeconds)]
  );

  res.json({ message: 'Progress checkpoint saved.' });
});
