import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listTopics = asyncHandler(async (req, res) => {
  const { lessonId } = req.query;
  if (!lessonId) {
    throw new AppError('lessonId query parameter is required.', 400);
  }

  const result = await pool.query(
    `
      SELECT id, lesson_id, title, summary, sort_order, is_published, created_at, updated_at
      FROM topics
      WHERE lesson_id = $1
      ORDER BY sort_order ASC, id ASC;
    `,
    [lessonId]
  );
  res.json({ topics: result.rows });
});

export const createTopic = asyncHandler(async (req, res) => {
  const {
    lessonId,
    title,
    summary = '',
    sortOrder,
    isPublished = true,
  } = req.body;

  if (!lessonId || !title) {
    throw new AppError('lessonId and title are required.', 400);
  }

  let finalSortOrder = sortOrder;
  if (!finalSortOrder) {
    const nextSortResult = await pool.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
        FROM topics
        WHERE lesson_id = $1;
      `,
      [lessonId]
    );
    finalSortOrder = nextSortResult.rows[0].next_sort_order;
  }

  const inserted = await pool.query(
    `
      INSERT INTO topics (lesson_id, title, summary, sort_order, is_published)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, lesson_id, title, summary, sort_order, is_published, created_at, updated_at;
    `,
    [lessonId, title, summary, finalSortOrder, isPublished]
  );

  res.status(201).json({ topic: inserted.rows[0] });
});

export const updateTopic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    summary,
    sortOrder,
    isPublished,
  } = req.body;

  const updated = await pool.query(
    `
      UPDATE topics
      SET
        title = COALESCE($2, title),
        summary = COALESCE($3, summary),
        sort_order = COALESCE($4, sort_order),
        is_published = COALESCE($5, is_published),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, lesson_id, title, summary, sort_order, is_published, created_at, updated_at;
    `,
    [id, title ?? null, summary ?? null, sortOrder ?? null, isPublished ?? null]
  );

  if (updated.rowCount === 0) {
    throw new AppError('Topic not found.', 404);
  }

  res.json({ topic: updated.rows[0] });
});

export const deleteTopic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await pool.query('DELETE FROM topics WHERE id = $1 RETURNING id;', [id]);
  if (deleted.rowCount === 0) {
    throw new AppError('Topic not found.', 404);
  }
  res.status(204).send();
});

export const reorderTopics = asyncHandler(async (req, res) => {
  const { lessonId, orderedTopicIds } = req.body;
  if (!lessonId || !Array.isArray(orderedTopicIds) || orderedTopicIds.length === 0) {
    throw new AppError('lessonId and orderedTopicIds[] are required.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let index = 0; index < orderedTopicIds.length; index += 1) {
      const topicId = Number(orderedTopicIds[index]);
      await client.query(
        `
          UPDATE topics
          SET sort_order = $1, updated_at = NOW()
          WHERE id = $2
            AND lesson_id = $3;
        `,
        [index + 1, topicId, lessonId]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const result = await pool.query(
    `
      SELECT id, lesson_id, title, summary, sort_order, is_published, created_at, updated_at
      FROM topics
      WHERE lesson_id = $1
      ORDER BY sort_order ASC, id ASC;
    `,
    [lessonId]
  );

  res.json({ topics: result.rows });
});
