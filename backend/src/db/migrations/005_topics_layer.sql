CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1 CHECK (sort_order > 0),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, sort_order)
);

ALTER TABLE lesson_content
ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE;

INSERT INTO topics (lesson_id, title, summary, sort_order, is_published)
SELECT
  l.id,
  'General',
  'Auto-created topic from existing lesson content.',
  1,
  TRUE
FROM lessons l
WHERE EXISTS (
  SELECT 1
  FROM lesson_content lc
  WHERE lc.lesson_id = l.id
)
AND NOT EXISTS (
  SELECT 1
  FROM topics t
  WHERE t.lesson_id = l.id
);

UPDATE lesson_content lc
SET topic_id = (
  SELECT t.id
  FROM topics t
  WHERE t.lesson_id = lc.lesson_id
  ORDER BY t.sort_order ASC, t.id ASC
  LIMIT 1
)
WHERE lc.topic_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM lesson_content WHERE topic_id IS NULL) THEN
    RAISE EXCEPTION 'lesson_content.topic_id backfill failed for one or more rows';
  END IF;
END$$;

ALTER TABLE lesson_content
ALTER COLUMN topic_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_topics_lesson_sort ON topics(lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_content_topic_sort ON lesson_content(topic_id, sort_order);
