import { pool } from '../db/pool.js';
import { ensureQuizUnlocked, getEnrollmentForUser } from '../services/progressionService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function validateQuizType(type) {
  if (!['lesson_quiz', 'final_exam'].includes(type)) {
    throw new AppError('Invalid quizType. Use lesson_quiz or final_exam.', 400);
  }
}

export const listQuizzes = asyncHandler(async (req, res) => {
  const { moduleId, lessonId } = req.query;
  const whereClauses = [];
  const values = [];

  if (moduleId) {
    values.push(moduleId);
    whereClauses.push(`module_id = $${values.length}`);
  }
  if (lessonId) {
    values.push(lessonId);
    whereClauses.push(`lesson_id = $${values.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const quizzes = await pool.query(
    `
      SELECT id, module_id, lesson_id, title, quiz_type, passing_score, time_limit_minutes, attempt_limit, is_active
      FROM quizzes
      ${whereSql}
      ORDER BY created_at DESC;
    `,
    values
  );
  res.json({ quizzes: quizzes.rows });
});

export const createQuiz = asyncHandler(async (req, res) => {
  const {
    moduleId,
    lessonId = null,
    title,
    quizType,
    passingScore = 70,
    timeLimitMinutes = 15,
    attemptLimit = 3,
  } = req.body;
  if (!moduleId || !title || !quizType) {
    throw new AppError('moduleId, title, and quizType are required.', 400);
  }
  validateQuizType(quizType);

  const inserted = await pool.query(
    `
      INSERT INTO quizzes (module_id, lesson_id, title, quiz_type, passing_score, time_limit_minutes, attempt_limit)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, module_id, lesson_id, title, quiz_type, passing_score, time_limit_minutes, attempt_limit, is_active;
    `,
    [moduleId, lessonId, title, quizType, passingScore, timeLimitMinutes, attemptLimit]
  );
  res.status(201).json({ quiz: inserted.rows[0] });
});

export const updateQuiz = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { lessonId, title, passingScore, timeLimitMinutes, attemptLimit, isActive } = req.body;
  const hasLessonId = Object.prototype.hasOwnProperty.call(req.body, 'lessonId');
  const updated = await pool.query(
    `
      UPDATE quizzes
      SET
        lesson_id = CASE WHEN $2::boolean THEN $3 ELSE lesson_id END,
        title = COALESCE($4, title),
        passing_score = COALESCE($5, passing_score),
        time_limit_minutes = COALESCE($6, time_limit_minutes),
        attempt_limit = COALESCE($7, attempt_limit),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, module_id, lesson_id, title, quiz_type, passing_score, time_limit_minutes, attempt_limit, is_active;
    `,
    [id, hasLessonId, lessonId ?? null, title ?? null, passingScore ?? null, timeLimitMinutes ?? null, attemptLimit ?? null, isActive ?? null]
  );
  if (updated.rowCount === 0) {
    throw new AppError('Quiz not found.', 404);
  }
  res.json({ quiz: updated.rows[0] });
});

export const deleteQuiz = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await pool.query('DELETE FROM quizzes WHERE id = $1 RETURNING id;', [id]);
  if (deleted.rowCount === 0) {
    throw new AppError('Quiz not found.', 404);
  }
  res.status(204).send();
});

export const listQuizQuestions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const questions = await pool.query(
    `
      SELECT id, quiz_id, prompt, question_type, points, sort_order
      FROM questions
      WHERE quiz_id = $1
      ORDER BY sort_order ASC;
    `,
    [id]
  );
  res.json({ questions: questions.rows });
});

export const createQuizQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { prompt, points = 1, sortOrder } = req.body;
  if (!prompt) {
    throw new AppError('prompt is required.', 400);
  }

  let finalSortOrder = sortOrder;
  if (!finalSortOrder) {
    const result = await pool.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
        FROM questions
        WHERE quiz_id = $1;
      `,
      [id]
    );
    finalSortOrder = result.rows[0].next_sort_order;
  }

  const inserted = await pool.query(
    `
      INSERT INTO questions (quiz_id, prompt, question_type, points, sort_order)
      VALUES ($1, $2, 'single_choice', $3, $4)
      RETURNING id, quiz_id, prompt, question_type, points, sort_order;
    `,
    [id, prompt, points, finalSortOrder]
  );
  res.status(201).json({ question: inserted.rows[0] });
});

export const updateQuizQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const { prompt, points, sortOrder } = req.body;
  const updated = await pool.query(
    `
      UPDATE questions
      SET
        prompt = COALESCE($2, prompt),
        points = COALESCE($3, points),
        sort_order = COALESCE($4, sort_order)
      WHERE id = $1
      RETURNING id, quiz_id, prompt, question_type, points, sort_order;
    `,
    [questionId, prompt ?? null, points ?? null, sortOrder ?? null]
  );
  if (updated.rowCount === 0) {
    throw new AppError('Question not found.', 404);
  }
  res.json({ question: updated.rows[0] });
});

export const deleteQuizQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const deleted = await pool.query('DELETE FROM questions WHERE id = $1 RETURNING id;', [questionId]);
  if (deleted.rowCount === 0) {
    throw new AppError('Question not found.', 404);
  }
  res.status(204).send();
});

export const listQuestionAnswers = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const answers = await pool.query(
    `
      SELECT id, question_id, answer_text, is_correct, explanation, sort_order
      FROM answers
      WHERE question_id = $1
      ORDER BY sort_order ASC;
    `,
    [questionId]
  );
  res.json({ answers: answers.rows });
});

export const createQuestionAnswer = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const { answerText, isCorrect = false, explanation = '', sortOrder } = req.body;
  if (!answerText) {
    throw new AppError('answerText is required.', 400);
  }

  let finalSortOrder = sortOrder;
  if (!finalSortOrder) {
    const result = await pool.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
        FROM answers
        WHERE question_id = $1;
      `,
      [questionId]
    );
    finalSortOrder = result.rows[0].next_sort_order;
  }

  const inserted = await pool.query(
    `
      INSERT INTO answers (question_id, answer_text, is_correct, explanation, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, question_id, answer_text, is_correct, explanation, sort_order;
    `,
    [questionId, answerText, isCorrect, explanation, finalSortOrder]
  );
  res.status(201).json({ answer: inserted.rows[0] });
});

export const updateQuestionAnswer = asyncHandler(async (req, res) => {
  const { answerId } = req.params;
  const { answerText, isCorrect, explanation, sortOrder } = req.body;
  const updated = await pool.query(
    `
      UPDATE answers
      SET
        answer_text = COALESCE($2, answer_text),
        is_correct = COALESCE($3, is_correct),
        explanation = COALESCE($4, explanation),
        sort_order = COALESCE($5, sort_order)
      WHERE id = $1
      RETURNING id, question_id, answer_text, is_correct, explanation, sort_order;
    `,
    [answerId, answerText ?? null, isCorrect ?? null, explanation ?? null, sortOrder ?? null]
  );
  if (updated.rowCount === 0) {
    throw new AppError('Answer not found.', 404);
  }
  res.json({ answer: updated.rows[0] });
});

export const deleteQuestionAnswer = asyncHandler(async (req, res) => {
  const { answerId } = req.params;
  const deleted = await pool.query('DELETE FROM answers WHERE id = $1 RETURNING id;', [answerId]);
  if (deleted.rowCount === 0) {
    throw new AppError('Answer not found.', 404);
  }
  res.status(204).send();
});

export const startQuiz = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { enrollmentId } = req.body;
  if (!enrollmentId) {
    throw new AppError('enrollmentId is required.', 400);
  }

  await getEnrollmentForUser({
    enrollmentId: Number(enrollmentId),
    userId: req.user.id,
    allowAdmin: true,
    role: req.user.role,
  });
  const quiz = await ensureQuizUnlocked({ enrollmentId: Number(enrollmentId), quizId: Number(id) });

  const questionsResult = await pool.query(
    `
      SELECT id, prompt, question_type, points, sort_order
      FROM questions
      WHERE quiz_id = $1
      ORDER BY sort_order ASC;
    `,
    [id]
  );

  const questionIds = questionsResult.rows.map((q) => q.id);
  const answersResult =
    questionIds.length === 0
      ? { rows: [] }
      : await pool.query(
          `
            SELECT id, question_id, answer_text, sort_order
            FROM answers
            WHERE question_id = ANY($1::int[])
            ORDER BY sort_order ASC;
          `,
          [questionIds]
        );

  const answersByQuestion = new Map();
  for (const answer of answersResult.rows) {
    if (!answersByQuestion.has(answer.question_id)) {
      answersByQuestion.set(answer.question_id, []);
    }
    answersByQuestion.get(answer.question_id).push(answer);
  }

  const questions = questionsResult.rows.map((question) => ({
    ...question,
    answers: answersByQuestion.get(question.id) ?? [],
  }));

  res.json({
    quiz,
    questions,
  });
});
