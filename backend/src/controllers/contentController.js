import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function validateContentType(contentType) {
  if (!['text', 'image', 'video', 'simulation', 'file'].includes(contentType)) {
    throw new AppError('Invalid contentType.', 400);
  }
}

export const listContent = asyncHandler(async (req, res) => {
  const { lessonId, topicId } = req.query;
  if (!lessonId && !topicId) {
    throw new AppError('lessonId or topicId query parameter is required.', 400);
  }

  let result;
  if (topicId) {
    result = await pool.query(
      `
        SELECT
          id, lesson_id, topic_id, content_type, title, body_text, content_url, simulation_key,
          metadata, sort_order, is_required, created_at, updated_at
        FROM lesson_content
        WHERE topic_id = $1
        ORDER BY sort_order ASC, id ASC;
      `,
      [topicId]
    );
  } else {
    result = await pool.query(
      `
        SELECT
          lc.id, lc.lesson_id, lc.topic_id, lc.content_type, lc.title, lc.body_text, lc.content_url, lc.simulation_key,
          lc.metadata, lc.sort_order, lc.is_required, lc.created_at, lc.updated_at
        FROM lesson_content lc
        LEFT JOIN topics t ON t.id = lc.topic_id
        WHERE
          (t.lesson_id = $1)
          OR (lc.topic_id IS NULL AND lc.lesson_id = $1)
        ORDER BY COALESCE(t.sort_order, 2147483647) ASC, lc.sort_order ASC, lc.id ASC;
      `,
      [lessonId]
    );
  }
  res.json({ content: result.rows });
});

export const createContent = asyncHandler(async (req, res) => {
  const {
    topicId,
    contentType,
    title,
    bodyText = '',
    contentUrl = null,
    simulationKey = null,
    metadata = {},
    sortOrder,
    isRequired = true,
  } = req.body;

  if (!topicId || !contentType || !title) {
    throw new AppError('topicId, contentType, and title are required.', 400);
  }
  validateContentType(contentType);

  const topicResult = await pool.query(
    `
      SELECT id, lesson_id
      FROM topics
      WHERE id = $1
      LIMIT 1;
    `,
    [topicId]
  );
  if (topicResult.rowCount === 0) {
    throw new AppError('Topic not found.', 404);
  }

  let finalSortOrder = sortOrder;
  if (!finalSortOrder) {
    const nextSortResult = await pool.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
        FROM lesson_content
        WHERE topic_id = $1;
      `,
      [topicId]
    );
    finalSortOrder = nextSortResult.rows[0].next_sort_order;
  }

  const lessonId = topicResult.rows[0].lesson_id;
  const inserted = await pool.query(
    `
      INSERT INTO lesson_content (
        lesson_id, topic_id, content_type, title, body_text, content_url, simulation_key, metadata, sort_order, is_required
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
      RETURNING
        id, lesson_id, topic_id, content_type, title, body_text, content_url, simulation_key,
        metadata, sort_order, is_required, created_at, updated_at;
    `,
    [
      lessonId,
      topicId,
      contentType,
      title,
      bodyText,
      contentUrl,
      simulationKey,
      JSON.stringify(metadata),
      finalSortOrder,
      isRequired,
    ]
  );
  res.status(201).json({ content: inserted.rows[0] });
});

export const updateContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { topicId, contentType, title, bodyText, contentUrl, simulationKey, metadata, sortOrder, isRequired } = req.body;
  const hasTopicId = Object.prototype.hasOwnProperty.call(req.body, 'topicId');
  const hasContentType = Object.prototype.hasOwnProperty.call(req.body, 'contentType');

  if (hasContentType) {
    validateContentType(contentType);
  }

  let topicForUpdate = null;
  if (hasTopicId) {
    const topicResult = await pool.query(
      `
        SELECT id, lesson_id
        FROM topics
        WHERE id = $1
        LIMIT 1;
      `,
      [topicId]
    );
    if (topicResult.rowCount === 0) {
      throw new AppError('Topic not found.', 404);
    }
    topicForUpdate = topicResult.rows[0];
  }

  const updated = await pool.query(
    `
      UPDATE lesson_content
      SET
        topic_id = CASE WHEN $2::boolean THEN $3 ELSE topic_id END,
        lesson_id = CASE WHEN $2::boolean THEN $4 ELSE lesson_id END,
        content_type = CASE WHEN $5::boolean THEN $6 ELSE content_type END,
        title = COALESCE($7, title),
        body_text = COALESCE($8, body_text),
        content_url = COALESCE($9, content_url),
        simulation_key = COALESCE($10, simulation_key),
        metadata = COALESCE($11::jsonb, metadata),
        sort_order = COALESCE($12, sort_order),
        is_required = COALESCE($13, is_required),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id, lesson_id, topic_id, content_type, title, body_text, content_url, simulation_key,
        metadata, sort_order, is_required, created_at, updated_at;
    `,
    [
      id,
      hasTopicId,
      topicForUpdate?.id ?? null,
      topicForUpdate?.lesson_id ?? null,
      hasContentType,
      contentType ?? null,
      title ?? null,
      bodyText ?? null,
      contentUrl ?? null,
      simulationKey ?? null,
      metadata ? JSON.stringify(metadata) : null,
      sortOrder ?? null,
      isRequired ?? null,
    ]
  );
  if (updated.rowCount === 0) {
    throw new AppError('Content item not found.', 404);
  }
  res.json({ content: updated.rows[0] });
});

export const reorderContent = asyncHandler(async (req, res) => {
  const { topicId, orderedContentIds } = req.body;
  if (!topicId || !Array.isArray(orderedContentIds) || orderedContentIds.length === 0) {
    throw new AppError('topicId and orderedContentIds[] are required.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let index = 0; index < orderedContentIds.length; index += 1) {
      const contentId = Number(orderedContentIds[index]);
      await client.query(
        `
          UPDATE lesson_content
          SET sort_order = $1, updated_at = NOW()
          WHERE id = $2
            AND topic_id = $3;
        `,
        [index + 1, contentId, topicId]
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
      SELECT
        id, lesson_id, topic_id, content_type, title, body_text, content_url, simulation_key,
        metadata, sort_order, is_required, created_at, updated_at
      FROM lesson_content
      WHERE topic_id = $1
      ORDER BY sort_order ASC, id ASC;
    `,
    [topicId]
  );
  res.json({ content: result.rows });
});

export const deleteContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await pool.query('DELETE FROM lesson_content WHERE id = $1 RETURNING id;', [id]);
  if (deleted.rowCount === 0) {
    throw new AppError('Content item not found.', 404);
  }
  res.status(204).send();
});
