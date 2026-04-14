import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listLessons = asyncHandler(async (req, res) => {
  const { moduleId } = req.query;
  if (!moduleId) {
    throw new AppError('moduleId query parameter is required.', 400);
  }

  const result = await pool.query(
    `
      SELECT
        id, module_id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url,
        is_published, created_at, updated_at
      FROM lessons
      WHERE module_id = $1
      ORDER BY sequence_no ASC;
    `,
    [moduleId]
  );
  res.json({ lessons: result.rows });
});

export const getLessonById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lesson = await pool.query(
    `
      SELECT
        id, module_id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url,
        is_published, created_at, updated_at
      FROM lessons
      WHERE id = $1
      LIMIT 1;
    `,
    [id]
  );
  if (lesson.rowCount === 0) {
    throw new AppError('Lesson not found.', 404);
  }
  res.json({ lesson: lesson.rows[0] });
});

export const createLesson = asyncHandler(async (req, res) => {
  const {
    moduleId,
    sequenceNo,
    title,
    summary = '',
    estimatedMinutes = 10,
    overviewText = '',
    overviewImageUrl = null,
    isPublished = true,
  } = req.body;
  if (!moduleId || !title) {
    throw new AppError('moduleId and title are required.', 400);
  }

  let finalSequenceNo = sequenceNo;
  if (!finalSequenceNo) {
    const nextSequence = await pool.query(
      `
        SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next_sequence_no
        FROM lessons
        WHERE module_id = $1;
      `,
      [moduleId]
    );
    finalSequenceNo = nextSequence.rows[0].next_sequence_no;
  }

  const inserted = await pool.query(
    `
      INSERT INTO lessons (
        module_id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url, is_published
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id, module_id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url,
        is_published, created_at, updated_at;
    `,
    [moduleId, finalSequenceNo, title, summary, estimatedMinutes, overviewText, overviewImageUrl, isPublished]
  );
  res.status(201).json({ lesson: inserted.rows[0] });
});

export const updateLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sequenceNo, title, summary, estimatedMinutes, overviewText, overviewImageUrl, isPublished } = req.body;
  const updated = await pool.query(
    `
      UPDATE lessons
      SET
        sequence_no = COALESCE($2, sequence_no),
        title = COALESCE($3, title),
        summary = COALESCE($4, summary),
        estimated_minutes = COALESCE($5, estimated_minutes),
        overview_text = COALESCE($6, overview_text),
        overview_image_url = COALESCE($7, overview_image_url),
        is_published = COALESCE($8, is_published),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id, module_id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url,
        is_published, created_at, updated_at;
    `,
    [
      id,
      sequenceNo ?? null,
      title ?? null,
      summary ?? null,
      estimatedMinutes ?? null,
      overviewText ?? null,
      overviewImageUrl ?? null,
      isPublished ?? null,
    ]
  );
  if (updated.rowCount === 0) {
    throw new AppError('Lesson not found.', 404);
  }
  res.json({ lesson: updated.rows[0] });
});

export const deleteLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await pool.query('DELETE FROM lessons WHERE id = $1 RETURNING id;', [id]);
  if (deleted.rowCount === 0) {
    throw new AppError('Lesson not found.', 404);
  }
  res.status(204).send();
});

export const reorderLessons = asyncHandler(async (req, res) => {
  const { moduleId, orderedLessonIds } = req.body;
  if (!moduleId || !Array.isArray(orderedLessonIds) || orderedLessonIds.length === 0) {
    throw new AppError('moduleId and orderedLessonIds[] are required.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let index = 0; index < orderedLessonIds.length; index += 1) {
      const lessonId = Number(orderedLessonIds[index]);
      await client.query(
        `
          UPDATE lessons
          SET sequence_no = $1, updated_at = NOW()
          WHERE id = $2
            AND module_id = $3;
        `,
        [index + 1, lessonId, moduleId]
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
        id, module_id, sequence_no, title, summary, estimated_minutes, overview_text, overview_image_url,
        is_published, created_at, updated_at
      FROM lessons
      WHERE module_id = $1
      ORDER BY sequence_no ASC;
    `,
    [moduleId]
  );
  res.json({ lessons: result.rows });
});
