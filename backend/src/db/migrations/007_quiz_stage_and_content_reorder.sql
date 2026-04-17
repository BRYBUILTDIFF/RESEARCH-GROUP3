ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS stage VARCHAR(20);

UPDATE quizzes
SET stage = CASE
  WHEN quiz_type = 'final_exam' THEN 'final_exam'
  WHEN quiz_type = 'lesson_quiz' AND lesson_id IS NULL THEN 'pre_test'
  ELSE 'post_test'
END
WHERE stage IS NULL;

ALTER TABLE quizzes
ALTER COLUMN stage SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quizzes_stage_check'
  ) THEN
    ALTER TABLE quizzes
    ADD CONSTRAINT quizzes_stage_check
    CHECK (stage IN ('pre_test', 'post_test', 'final_exam'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lesson_content_topic_sort_order
ON lesson_content(topic_id, sort_order, id);
