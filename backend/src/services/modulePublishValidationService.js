import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

export async function getModulePublishReadiness(moduleId) {
  const reasons = [];

  const lessonsResult = await pool.query(
    `
      SELECT id, sequence_no, title
      FROM lessons
      WHERE module_id = $1
        AND is_published = TRUE
      ORDER BY sequence_no ASC, id ASC;
    `,
    [moduleId]
  );

  const publishedLessons = lessonsResult.rows;
  if (publishedLessons.length === 0) {
    reasons.push('Add at least one published lesson.');
  }

  const lessonIds = publishedLessons.map((lesson) => lesson.id);
  let publishedTopics = [];
  if (lessonIds.length > 0) {
    const topicsResult = await pool.query(
      `
        SELECT id, lesson_id, title, sort_order
        FROM topics
        WHERE lesson_id = ANY($1::int[])
          AND is_published = TRUE
        ORDER BY lesson_id ASC, sort_order ASC, id ASC;
      `,
      [lessonIds]
    );
    publishedTopics = topicsResult.rows;

    const topicCountByLesson = new Map();
    for (const topic of publishedTopics) {
      topicCountByLesson.set(topic.lesson_id, (topicCountByLesson.get(topic.lesson_id) ?? 0) + 1);
    }

    const lessonsWithoutTopics = publishedLessons.filter((lesson) => (topicCountByLesson.get(lesson.id) ?? 0) === 0);
    if (lessonsWithoutTopics.length > 0) {
      reasons.push(
        `Each published lesson needs at least one published topic (missing: ${lessonsWithoutTopics
          .map((lesson) => `Lesson ${lesson.sequence_no}`)
          .join(', ')}).`
      );
    }
  }

  const topicIds = publishedTopics.map((topic) => topic.id);
  if (topicIds.length > 0) {
    const contentCountResult = await pool.query(
      `
        SELECT topic_id, COUNT(*)::INT AS content_count
        FROM lesson_content
        WHERE topic_id = ANY($1::int[])
        GROUP BY topic_id;
      `,
      [topicIds]
    );

    const contentByTopicId = new Map(contentCountResult.rows.map((row) => [row.topic_id, row.content_count]));
    const topicsWithoutContent = publishedTopics.filter((topic) => (contentByTopicId.get(topic.id) ?? 0) === 0);
    if (topicsWithoutContent.length > 0) {
      reasons.push('Each published topic needs at least one content block.');
    }
  }

  const preTestResult = await pool.query(
    `
      SELECT id
      FROM quizzes
      WHERE module_id = $1
        AND stage = 'pre_test'
        AND quiz_type = 'lesson_quiz'
        AND lesson_id IS NULL
        AND is_active = TRUE
      LIMIT 1;
    `,
    [moduleId]
  );
  if (preTestResult.rowCount === 0) {
    reasons.push('Configure an active Pre-Test.');
  }

  const finalExamResult = await pool.query(
    `
      SELECT id
      FROM quizzes
      WHERE module_id = $1
        AND stage = 'final_exam'
        AND quiz_type = 'final_exam'
        AND is_active = TRUE
      LIMIT 1;
    `,
    [moduleId]
  );
  if (finalExamResult.rowCount === 0) {
    reasons.push('Configure an active Final Exam.');
  }

  if (lessonIds.length > 0) {
    const postTestsResult = await pool.query(
      `
        SELECT lesson_id
        FROM quizzes
        WHERE module_id = $1
          AND stage = 'post_test'
          AND quiz_type = 'lesson_quiz'
          AND lesson_id IS NOT NULL
          AND is_active = TRUE;
      `,
      [moduleId]
    );

    const lessonsWithPostTest = new Set(postTestsResult.rows.map((row) => row.lesson_id));
    const missingPostTestLessons = publishedLessons.filter((lesson) => !lessonsWithPostTest.has(lesson.id));
    if (missingPostTestLessons.length > 0) {
      reasons.push('Each published lesson needs an active Post-Test.');
    }
  }

  const requiredQuizIds = [
    ...preTestResult.rows.map((row) => row.id),
    ...finalExamResult.rows.map((row) => row.id),
  ];
  if (requiredQuizIds.length > 0) {
    const questionCountResult = await pool.query(
      `
        SELECT quiz_id, COUNT(*)::INT AS question_count
        FROM questions
        WHERE quiz_id = ANY($1::int[])
        GROUP BY quiz_id;
      `,
      [requiredQuizIds]
    );
    const questionCountByQuiz = new Map(questionCountResult.rows.map((row) => [row.quiz_id, row.question_count]));
    const missingQuestions = requiredQuizIds.filter((quizId) => (questionCountByQuiz.get(quizId) ?? 0) === 0);
    if (missingQuestions.length > 0) {
      reasons.push('Pre-Test and Final Exam must include at least one question.');
    }
  }

  return {
    isReady: reasons.length === 0,
    reasons,
  };
}

export async function assertModulePublishReady(
  moduleId,
  { statusCode = 400, includeReasons = true } = {}
) {
  const readiness = await getModulePublishReadiness(moduleId);
  if (readiness.isReady) return readiness;

  const reasonText = includeReasons ? ` ${readiness.reasons.join(' ')}` : '';
  throw new AppError(`Module is incomplete and cannot be published.${reasonText}`.trim(), statusCode);
}

