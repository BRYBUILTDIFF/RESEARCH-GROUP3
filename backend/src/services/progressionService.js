import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

export async function getEnrollmentForUser({ enrollmentId, userId, allowAdmin = false, role = 'user' }) {
  const result = await pool.query(
    `
      SELECT e.*
      FROM enrollments e
      WHERE e.id = $1
      LIMIT 1;
    `,
    [enrollmentId]
  );
  if (result.rowCount === 0) {
    throw new AppError('Enrollment not found.', 404);
  }

  const enrollment = result.rows[0];
  if (!allowAdmin || role !== 'admin') {
    if (enrollment.user_id !== userId) {
      throw new AppError('Forbidden enrollment access.', 403);
    }
  }
  return enrollment;
}

export async function getLessonById(lessonId) {
  const result = await pool.query(
    `
      SELECT id, module_id, sequence_no, title
      FROM lessons
      WHERE id = $1
      LIMIT 1;
    `,
    [lessonId]
  );
  if (result.rowCount === 0) {
    throw new AppError('Lesson not found.', 404);
  }
  return result.rows[0];
}

export async function ensurePreviousLessonCompleted(enrollmentId, moduleId, sequenceNo) {
  if (sequenceNo <= 1) return;

  const previousLesson = await pool.query(
    `
      SELECT id
      FROM lessons
      WHERE module_id = $1
        AND sequence_no = $2
      LIMIT 1;
    `,
    [moduleId, sequenceNo - 1]
  );

  if (previousLesson.rowCount === 0) return;

  const progress = await pool.query(
    `
      SELECT completed
      FROM progress
      WHERE enrollment_id = $1
        AND lesson_id = $2
      LIMIT 1;
    `,
    [enrollmentId, previousLesson.rows[0].id]
  );

  if (progress.rowCount === 0 || !progress.rows[0].completed) {
    throw new AppError('Sequential learning enforced: complete previous lesson first.', 400);
  }
}

export async function getModuleCompletionPercent(enrollmentId, moduleId) {
  const totalLessonsResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM lessons
      WHERE module_id = $1
        AND is_published = TRUE;
    `,
    [moduleId]
  );
  const total = totalLessonsResult.rows[0].total;
  if (total === 0) return 0;

  const completedResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS completed
      FROM progress p
      JOIN lessons l ON l.id = p.lesson_id
      WHERE p.enrollment_id = $1
        AND l.module_id = $2
        AND p.completed = TRUE;
    `,
    [enrollmentId, moduleId]
  );
  const completed = completedResult.rows[0].completed;
  return Number(((completed / total) * 100).toFixed(2));
}

export async function ensureQuizUnlocked({ enrollmentId, quizId }) {
  const quizResult = await pool.query(
    `
      SELECT
        id,
        module_id,
        lesson_id,
        title,
        quiz_type,
        stage,
        passing_score,
        attempt_limit,
        time_limit_minutes,
        is_active
      FROM quizzes
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1;
    `,
    [quizId]
  );
  if (quizResult.rowCount === 0) {
    throw new AppError('Quiz not found or inactive.', 404);
  }

  const quiz = quizResult.rows[0];
  const enrollmentResult = await pool.query(
    `
      SELECT id, module_id
      FROM enrollments
      WHERE id = $1
      LIMIT 1;
    `,
    [enrollmentId]
  );
  if (enrollmentResult.rowCount === 0) {
    throw new AppError('Enrollment not found.', 404);
  }
  const enrollment = enrollmentResult.rows[0];

  if (enrollment.module_id !== quiz.module_id) {
    throw new AppError('Quiz does not belong to enrollment module.', 400);
  }

  const lessonsTotalResult = await pool.query(
    'SELECT COUNT(*)::INT AS total FROM lessons WHERE module_id = $1 AND is_published = TRUE;',
    [quiz.module_id]
  );
  const lessonsCompletedResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS completed
      FROM progress p
      JOIN lessons l ON l.id = p.lesson_id
      WHERE p.enrollment_id = $1
        AND l.module_id = $2
        AND p.completed = TRUE;
    `,
    [enrollmentId, quiz.module_id]
  );

  if (lessonsCompletedResult.rows[0].completed < lessonsTotalResult.rows[0].total) {
    throw new AppError('Complete all lessons first. Quizzes unlock after lessons.', 400);
  }

  if (quiz.quiz_type === 'final_exam') {
    const lessonQuizzesResult = await pool.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM quizzes
        WHERE module_id = $1
          AND quiz_type = 'lesson_quiz'
          AND is_active = TRUE;
      `,
      [quiz.module_id]
    );

    if (lessonQuizzesResult.rows[0].total > 0) {
      const passedLessonQuizzesResult = await pool.query(
        `
          SELECT COUNT(DISTINCT q.id)::INT AS passed
          FROM quizzes q
          JOIN results r ON r.quiz_id = q.id
          WHERE q.module_id = $1
            AND q.quiz_type = 'lesson_quiz'
            AND q.is_active = TRUE
            AND r.enrollment_id = $2
            AND r.passed = TRUE;
        `,
        [quiz.module_id, enrollmentId]
      );

      if (passedLessonQuizzesResult.rows[0].passed < lessonQuizzesResult.rows[0].total) {
        throw new AppError('Final exam unlocks only after passing module quizzes.', 400);
      }
    }
  }

  const attemptsResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS attempts
      FROM results
      WHERE enrollment_id = $1
        AND quiz_id = $2;
    `,
    [enrollmentId, quiz.id]
  );
  if (attemptsResult.rows[0].attempts >= quiz.attempt_limit) {
    throw new AppError('Attempt limit reached for this quiz.', 400);
  }

  return quiz;
}

export async function evaluateQuizSubmission({ quizId, selectedAnswers }) {
  const questionsResult = await pool.query(
    `
      SELECT id, points
      FROM questions
      WHERE quiz_id = $1
      ORDER BY sort_order ASC;
    `,
    [quizId]
  );
  if (questionsResult.rowCount === 0) {
    throw new AppError('Quiz has no questions configured.', 400);
  }

  const questions = questionsResult.rows;
  const totalPoints = questions.reduce((sum, q) => sum + Number(q.points), 0);
  let earnedPoints = 0;

  for (const question of questions) {
    const selectedAnswerId = selectedAnswers[question.id];
    if (!selectedAnswerId) continue;

    const answerResult = await pool.query(
      `
        SELECT is_correct
        FROM answers
        WHERE id = $1
          AND question_id = $2
        LIMIT 1;
      `,
      [selectedAnswerId, question.id]
    );
    if (answerResult.rowCount > 0 && answerResult.rows[0].is_correct) {
      earnedPoints += Number(question.points);
    }
  }

  const score = Number(((earnedPoints / totalPoints) * 100).toFixed(2));
  return { score, totalPoints, earnedPoints };
}

export async function createCertificateIfEligible({ enrollmentId, userId, moduleId }) {
  const hasCertificate = await pool.query(
    'SELECT id FROM certificates WHERE enrollment_id = $1 LIMIT 1;',
    [enrollmentId]
  );
  if (hasCertificate.rowCount > 0) {
    return hasCertificate.rows[0];
  }

  const settingsResult = await pool.query(
    `
      SELECT
        require_all_lessons,
        require_lesson_quizzes,
        require_final_exam,
        min_final_exam_score
      FROM module_certification_settings
      WHERE module_id = $1
      LIMIT 1;
    `,
    [moduleId]
  );

  const settings = settingsResult.rows[0] ?? {
    require_all_lessons: true,
    require_lesson_quizzes: false,
    require_final_exam: true,
    min_final_exam_score: 70,
  };

  if (settings.require_all_lessons) {
    const allLessonsResult = await pool.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM lessons
        WHERE module_id = $1
          AND is_published = TRUE;
      `,
      [moduleId]
    );
    const completedLessonsResult = await pool.query(
      `
        SELECT COUNT(*)::INT AS completed
        FROM progress p
        JOIN lessons l ON l.id = p.lesson_id
        WHERE p.enrollment_id = $1
          AND l.module_id = $2
          AND p.completed = TRUE;
      `,
      [enrollmentId, moduleId]
    );
    if (completedLessonsResult.rows[0].completed < allLessonsResult.rows[0].total) {
      return null;
    }
  }

  if (settings.require_lesson_quizzes) {
    const lessonQuizzesResult = await pool.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM quizzes
        WHERE module_id = $1
          AND quiz_type = 'lesson_quiz'
          AND is_active = TRUE;
      `,
      [moduleId]
    );
    if (lessonQuizzesResult.rows[0].total > 0) {
      const passedLessonQuizzesResult = await pool.query(
        `
          SELECT COUNT(DISTINCT q.id)::INT AS passed
          FROM quizzes q
          JOIN results r ON r.quiz_id = q.id
          WHERE q.module_id = $1
            AND q.quiz_type = 'lesson_quiz'
            AND q.is_active = TRUE
            AND r.enrollment_id = $2
            AND r.passed = TRUE;
        `,
        [moduleId, enrollmentId]
      );
      if (passedLessonQuizzesResult.rows[0].passed < lessonQuizzesResult.rows[0].total) {
        return null;
      }
    }
  }

  if (settings.require_final_exam) {
    const finalExamPassedResult = await pool.query(
      `
        SELECT r.id
        FROM results r
        JOIN quizzes q ON q.id = r.quiz_id
        WHERE r.enrollment_id = $1
          AND q.module_id = $2
          AND q.quiz_type = 'final_exam'
          AND r.passed = TRUE
          AND r.score >= $3
        LIMIT 1;
      `,
      [enrollmentId, moduleId, settings.min_final_exam_score]
    );
    if (finalExamPassedResult.rowCount === 0) {
      return null;
    }
  }

  await pool.query(
    `
      UPDATE enrollments
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1;
    `,
    [enrollmentId]
  );

  const certificateNo = `HDA-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const inserted = await pool.query(
    `
      INSERT INTO certificates (enrollment_id, user_id, module_id, certificate_no, pdf_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, enrollment_id, user_id, module_id, certificate_no, pdf_url, issued_at;
    `,
    [enrollmentId, userId, moduleId, certificateNo, `/api/certificates/${certificateNo}.pdf`]
  );
  return inserted.rows[0];
}
