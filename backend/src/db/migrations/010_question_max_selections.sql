ALTER TABLE questions
ADD COLUMN IF NOT EXISTS max_selections INTEGER;

UPDATE questions
SET max_selections = CASE
  WHEN question_type = 'single_choice' THEN 1
  WHEN max_selections IS NULL OR max_selections < 1 THEN 1
  ELSE max_selections
END;

ALTER TABLE questions
ALTER COLUMN max_selections SET DEFAULT 1;

ALTER TABLE questions
ALTER COLUMN max_selections SET NOT NULL;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_max_selections_check;

ALTER TABLE questions
ADD CONSTRAINT questions_max_selections_check
CHECK (max_selections >= 1);
