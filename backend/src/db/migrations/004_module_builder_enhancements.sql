ALTER TABLE modules
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE TABLE IF NOT EXISTS module_certification_settings (
  module_id INTEGER PRIMARY KEY REFERENCES modules(id) ON DELETE CASCADE,
  require_all_lessons BOOLEAN NOT NULL DEFAULT TRUE,
  require_lesson_quizzes BOOLEAN NOT NULL DEFAULT FALSE,
  require_final_exam BOOLEAN NOT NULL DEFAULT TRUE,
  min_final_exam_score INTEGER NOT NULL DEFAULT 70 CHECK (min_final_exam_score BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO module_certification_settings (
  module_id,
  require_all_lessons,
  require_lesson_quizzes,
  require_final_exam,
  min_final_exam_score
)
SELECT
  m.id,
  TRUE,
  FALSE,
  TRUE,
  COALESCE((
    SELECT q.passing_score
    FROM quizzes q
    WHERE q.module_id = m.id
      AND q.quiz_type = 'final_exam'
    ORDER BY q.id DESC
    LIMIT 1
  ), 70)
FROM modules m
ON CONFLICT (module_id) DO NOTHING;

ALTER TABLE answers
ADD COLUMN IF NOT EXISTS explanation TEXT NOT NULL DEFAULT '';
