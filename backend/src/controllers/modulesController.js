import { pool } from '../db/pool.js';
import { assertModulePublishReady, getModulePublishReadiness } from '../services/modulePublishValidationService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function validateDifficulty(difficulty) {
  if (!difficulty) return;
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(difficulty)) {
    throw new AppError('Invalid difficulty. Use Beginner, Intermediate, or Advanced.', 400);
  }
}

export const listModules = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `
      SELECT
        m.id,
        m.title,
        m.description,
        m.thumbnail_url,
        m.difficulty,
        m.prerequisite_module_id,
        m.is_locked,
        m.is_active,
        m.created_at,
        m.updated_at,
        c.name AS category,
        COUNT(l.id)::INT AS lessons_count
      FROM modules m
      LEFT JOIN module_categories c ON c.id = m.category_id
      LEFT JOIN lessons l ON l.module_id = m.id
      GROUP BY m.id, c.name
      ORDER BY m.created_at DESC;
    `
  );
  if (req.user.role === 'admin') {
    res.json({ modules: result.rows });
    return;
  }

  const activeModules = result.rows.filter((module) => module.is_active);
  const readyModules = (
    await Promise.all(
      activeModules.map(async (module) => {
        const readiness = await getModulePublishReadiness(module.id);
        return readiness.isReady ? module : null;
      })
    )
  ).filter(Boolean);

  res.json({ modules: readyModules });
});

export const getModuleById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const moduleResult = await pool.query(
    `
      SELECT
        m.id, m.title, m.description, m.thumbnail_url, m.difficulty, m.prerequisite_module_id, m.is_locked, m.is_active,
        m.created_at, m.updated_at, c.name AS category
      FROM modules m
      LEFT JOIN module_categories c ON c.id = m.category_id
      WHERE m.id = $1
      LIMIT 1;
    `,
    [id]
  );
  if (moduleResult.rowCount === 0) {
    throw new AppError('Module not found.', 404);
  }
  const moduleRow = moduleResult.rows[0];

  if (req.user.role !== 'admin') {
    if (!moduleRow.is_active) {
      throw new AppError('Module is not published for learners yet.', 403);
    }
    await assertModulePublishReady(Number(id), { statusCode: 403, includeReasons: false });
  }

  const lessonsResult = await pool.query(
    `
      SELECT id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url, is_published
      FROM lessons
      WHERE module_id = $1
      ORDER BY sequence_no ASC;
    `,
    [id]
  );

  const certificationResult = await pool.query(
    `
      SELECT
        module_id,
        require_all_lessons,
        require_lesson_quizzes,
        require_final_exam,
        min_final_exam_score
      FROM module_certification_settings
      WHERE module_id = $1
      LIMIT 1;
    `,
    [id]
  );

  res.json({
    module: {
      ...moduleRow,
      lessons: lessonsResult.rows,
      certification: certificationResult.rows[0] ?? null,
    },
  });
});

export const createModule = asyncHandler(async (req, res) => {
  const {
    title,
    description = '',
    category,
    difficulty,
    prerequisiteModuleId = null,
    thumbnailUrl = null,
  } = req.body;
  if (!title) {
    throw new AppError('title is required.', 400);
  }
  const finalDifficulty = difficulty ?? 'Beginner';
  validateDifficulty(finalDifficulty);

  const inserted = await pool.query(
    `
      INSERT INTO modules (
        title, description, thumbnail_url, category_id, difficulty, prerequisite_module_id, created_by_user_id, is_active
      )
      VALUES (
        $1,
        $2,
        $3,
        (SELECT id FROM module_categories WHERE name = $4 LIMIT 1),
        $5,
        $6,
        $7,
        FALSE
      )
      RETURNING id, title, description, thumbnail_url, difficulty, prerequisite_module_id, is_locked, is_active, created_at, updated_at;
    `,
    [title, description, thumbnailUrl, category ?? null, finalDifficulty, prerequisiteModuleId, req.user.id]
  );

  await pool.query(
    `
      INSERT INTO module_certification_settings (
        module_id,
        require_all_lessons,
        require_lesson_quizzes,
        require_final_exam,
        min_final_exam_score
      )
      VALUES ($1, TRUE, FALSE, TRUE, 70)
      ON CONFLICT (module_id) DO NOTHING;
    `,
    [inserted.rows[0].id]
  );

  res.status(201).json({ module: inserted.rows[0] });
});

export const updateModule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    thumbnailUrl,
    category,
    difficulty,
    prerequisiteModuleId,
    isLocked,
    isActive,
  } = req.body;
  if (difficulty) validateDifficulty(difficulty);
  if (isActive === true) {
    await assertModulePublishReady(Number(id), { statusCode: 400, includeReasons: true });
  }

  const updated = await pool.query(
    `
      UPDATE modules
      SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        thumbnail_url = COALESCE($4, thumbnail_url),
        category_id = COALESCE((SELECT id FROM module_categories WHERE name = $5 LIMIT 1), category_id),
        difficulty = COALESCE($6, difficulty),
        prerequisite_module_id = COALESCE($7, prerequisite_module_id),
        is_locked = COALESCE($8, is_locked),
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, description, thumbnail_url, difficulty, prerequisite_module_id, is_locked, is_active, created_at, updated_at;
    `,
    [
      id,
      title ?? null,
      description ?? null,
      thumbnailUrl ?? null,
      category ?? null,
      difficulty ?? null,
      prerequisiteModuleId ?? null,
      isLocked ?? null,
      isActive ?? null,
    ]
  );

  if (updated.rowCount === 0) {
    throw new AppError('Module not found.', 404);
  }

  res.json({ module: updated.rows[0] });
});

export const deleteModule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await pool.query('DELETE FROM modules WHERE id = $1 RETURNING id;', [id]);
  if (deleted.rowCount === 0) {
    throw new AppError('Module not found.', 404);
  }
  res.status(204).send();
});

export const setModuleLock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isLocked } = req.body;
  if (typeof isLocked !== 'boolean') {
    throw new AppError('isLocked must be a boolean.', 400);
  }

  const updated = await pool.query(
    `
      UPDATE modules
      SET is_locked = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, is_locked;
    `,
    [id, isLocked]
  );
  if (updated.rowCount === 0) {
    throw new AppError('Module not found.', 404);
  }
  res.json({ module: updated.rows[0] });
});

export const getModuleBuilder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const moduleResult = await pool.query(
    `
      SELECT
        m.id,
        m.title,
        m.description,
        m.thumbnail_url,
        m.difficulty,
        m.prerequisite_module_id,
        m.is_locked,
        m.is_active,
        c.name AS category
      FROM modules m
      LEFT JOIN module_categories c ON c.id = m.category_id
      WHERE m.id = $1
      LIMIT 1;
    `,
    [id]
  );
  if (moduleResult.rowCount === 0) {
    throw new AppError('Module not found.', 404);
  }

  const lessonsResult = await pool.query(
    `
      SELECT
        id, module_id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url, is_published
      FROM lessons
      WHERE module_id = $1
      ORDER BY sequence_no ASC;
    `,
    [id]
  );
  const lessonIds = lessonsResult.rows.map((lesson) => lesson.id);

  const topicsResult =
    lessonIds.length === 0
      ? { rows: [] }
      : await pool.query(
          `
            SELECT id, lesson_id, title, summary, sort_order, is_published
            FROM topics
            WHERE lesson_id = ANY($1::int[])
            ORDER BY lesson_id ASC, sort_order ASC, id ASC;
          `,
          [lessonIds]
        );
  const topicIds = topicsResult.rows.map((topic) => topic.id);

  const contentResult =
    lessonIds.length === 0
      ? { rows: [] }
      : await pool.query(
          `
            SELECT
              id, lesson_id, topic_id, content_type, title, body_text, content_url, simulation_key, metadata, sort_order, is_required
            FROM lesson_content
            WHERE
              (array_length($1::int[], 1) IS NOT NULL AND topic_id = ANY($1::int[]))
              OR (topic_id IS NULL AND lesson_id = ANY($2::int[]))
            ORDER BY lesson_id ASC, topic_id ASC NULLS LAST, sort_order ASC, id ASC;
          `,
          [topicIds, lessonIds]
        );

  const quizzesResult = await pool.query(
    `
      SELECT
        id, module_id, lesson_id, title, quiz_type, stage, passing_score, time_limit_minutes, attempt_limit, is_active
      FROM quizzes
      WHERE module_id = $1
      ORDER BY stage ASC, lesson_id ASC NULLS LAST, id ASC;
    `,
    [id]
  );
  const quizIds = quizzesResult.rows.map((quiz) => quiz.id);

  const questionsResult =
    quizIds.length === 0
      ? { rows: [] }
      : await pool.query(
          `
            SELECT id, quiz_id, prompt, question_type, points, sort_order
            FROM questions
            WHERE quiz_id = ANY($1::int[])
            ORDER BY quiz_id ASC, sort_order ASC;
          `,
          [quizIds]
        );
  const questionIds = questionsResult.rows.map((question) => question.id);

  const answersResult =
    questionIds.length === 0
      ? { rows: [] }
      : await pool.query(
          `
            SELECT id, question_id, answer_text, is_correct, explanation, sort_order
            FROM answers
            WHERE question_id = ANY($1::int[])
            ORDER BY question_id ASC, sort_order ASC;
          `,
          [questionIds]
        );

  const certificationResult = await pool.query(
    `
      SELECT
        module_id,
        require_all_lessons,
        require_lesson_quizzes,
        require_final_exam,
        min_final_exam_score
      FROM module_certification_settings
      WHERE module_id = $1
      LIMIT 1;
    `,
    [id]
  );

  res.json({
    module: moduleResult.rows[0],
    lessons: lessonsResult.rows,
    topics: topicsResult.rows,
    content: contentResult.rows,
    quizzes: quizzesResult.rows,
    questions: questionsResult.rows,
    answers: answersResult.rows,
    certification:
      certificationResult.rows[0] ?? {
        module_id: Number(id),
        require_all_lessons: true,
        require_lesson_quizzes: false,
        require_final_exam: true,
        min_final_exam_score: 70,
      },
  });
});

export const upsertModuleCertification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    requireAllLessons = true,
    requireLessonQuizzes = false,
    requireFinalExam = true,
    minFinalExamScore = 70,
  } = req.body;

  const updated = await pool.query(
    `
      INSERT INTO module_certification_settings (
        module_id,
        require_all_lessons,
        require_lesson_quizzes,
        require_final_exam,
        min_final_exam_score,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (module_id)
      DO UPDATE
      SET
        require_all_lessons = EXCLUDED.require_all_lessons,
        require_lesson_quizzes = EXCLUDED.require_lesson_quizzes,
        require_final_exam = EXCLUDED.require_final_exam,
        min_final_exam_score = EXCLUDED.min_final_exam_score,
        updated_at = NOW()
      RETURNING module_id, require_all_lessons, require_lesson_quizzes, require_final_exam, min_final_exam_score;
    `,
    [id, requireAllLessons, requireLessonQuizzes, requireFinalExam, minFinalExamScore]
  );

  res.json({ certification: updated.rows[0] });
});
