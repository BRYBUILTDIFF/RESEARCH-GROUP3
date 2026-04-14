import { pool } from '../db/pool.js';
import { logUserEvent } from '../services/logService.js';
import {
  ensureQuizUnlocked,
  evaluateQuizSubmission,
  getEnrollmentForUser,
} from '../services/progressionService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const submitQuiz = asyncHandler(async (req, res) => {
  const { enrollmentId, quizId, answers } = req.body;
  if (!enrollmentId || !quizId || !Array.isArray(answers)) {
    throw new AppError('enrollmentId, quizId, and answers[] are required.', 400);
  }

  const enrollment = await getEnrollmentForUser({
    enrollmentId: Number(enrollmentId),
    userId: req.user.id,
    allowAdmin: true,
    role: req.user.role,
  });
  const quiz = await ensureQuizUnlocked({ enrollmentId: Number(enrollmentId), quizId: Number(quizId) });

  const selectedAnswers = {};
  for (const item of answers) {
    if (item.questionId && item.answerId) {
      selectedAnswers[item.questionId] = item.answerId;
    }
  }

  const evaluation = await evaluateQuizSubmission({ quizId: Number(quizId), selectedAnswers });
  const passed = evaluation.score >= quiz.passing_score;

  const attemptsResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS attempts
      FROM results
      WHERE enrollment_id = $1
        AND quiz_id = $2;
    `,
    [enrollment.id, quiz.id]
  );
  const attemptNo = attemptsResult.rows[0].attempts + 1;

  const inserted = await pool.query(
    `
      INSERT INTO results (enrollment_id, user_id, quiz_id, attempt_no, score, passed, feedback)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, enrollment_id, user_id, quiz_id, attempt_no, score, passed, submitted_at, feedback;
    `,
    [
      enrollment.id,
      enrollment.user_id,
      quiz.id,
      attemptNo,
      evaluation.score,
      passed,
      JSON.stringify({
        earnedPoints: evaluation.earnedPoints,
        totalPoints: evaluation.totalPoints,
      }),
    ]
  );

  if (quiz.quiz_type === 'final_exam') {
    await pool.query(
      `
        UPDATE enrollments
        SET status = 'completed', completed_at = COALESCE(completed_at, NOW())
        WHERE id = $1;
      `,
      [enrollment.id]
    );
  }

  await logUserEvent({
    userId: enrollment.user_id,
    eventType: 'quiz_submitted',
    details: {
      quizId: quiz.id,
      enrollmentId: enrollment.id,
      score: evaluation.score,
      passed,
      attemptNo,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    result: inserted.rows[0],
  });
});

export const listResults = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const result = await pool.query(
    `
      SELECT
        r.id, r.enrollment_id, r.user_id, r.quiz_id, r.attempt_no, r.score, r.passed, r.submitted_at,
        q.title AS quiz_title,
        m.title AS module_title
      FROM results r
      JOIN quizzes q ON q.id = r.quiz_id
      JOIN modules m ON m.id = q.module_id
      WHERE ($1::boolean = TRUE OR r.user_id = $2)
      ORDER BY r.submitted_at DESC;
    `,
    [isAdmin, req.user.id]
  );
  res.json({ results: result.rows });
});

export const getEnrollmentResults = asyncHandler(async (req, res) => {
  const { enrollmentId } = req.params;
  const enrollment = await getEnrollmentForUser({
    enrollmentId: Number(enrollmentId),
    userId: req.user.id,
    allowAdmin: true,
    role: req.user.role,
  });

  const results = await pool.query(
    `
      SELECT
        r.id, r.quiz_id, r.attempt_no, r.score, r.passed, r.submitted_at, r.feedback,
        q.title AS quiz_title
      FROM results r
      JOIN quizzes q ON q.id = r.quiz_id
      WHERE r.enrollment_id = $1
      ORDER BY r.submitted_at DESC;
    `,
    [enrollment.id]
  );
  res.json({ results: results.rows });
});
