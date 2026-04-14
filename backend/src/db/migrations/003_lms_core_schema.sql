CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

INSERT INTO roles (name)
VALUES ('admin'), ('user')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);

UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role_id IS NULL
  AND r.name = u.role;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS user_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

INSERT INTO module_categories (name)
VALUES ('Hardware'), ('Software'), ('Networking'), ('Security')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  title TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES module_categories(id),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
  prerequisite_module_id INTEGER REFERENCES modules(id),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  estimated_minutes INTEGER NOT NULL DEFAULT 10 CHECK (estimated_minutes > 0),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS lesson_content (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image', 'video', 'simulation', 'file')),
  title TEXT NOT NULL,
  body_text TEXT NOT NULL DEFAULT '',
  content_url TEXT,
  simulation_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_lesson_id INTEGER REFERENCES lessons(id),
  UNIQUE (user_id, module_id)
);

CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  UNIQUE (enrollment_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('lesson_quiz', 'final_exam')),
  passing_score INTEGER NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 0 AND 100),
  time_limit_minutes INTEGER NOT NULL DEFAULT 15 CHECK (time_limit_minutes > 0),
  attempt_limit INTEGER NOT NULL DEFAULT 3 CHECK (attempt_limit > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'single_choice' CHECK (question_type IN ('single_choice')),
  points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
  sort_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS answers (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS results (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  score NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL,
  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, quiz_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL UNIQUE REFERENCES enrollments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  certificate_no TEXT NOT NULL UNIQUE,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_module_sequence ON lessons(module_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_progress_enrollment_lesson ON progress(enrollment_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_results_enrollment_quiz ON results(enrollment_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_user_created ON user_logs(user_id, created_at DESC);

INSERT INTO modules (title, description, category_id, difficulty, created_by_user_id)
SELECT
  'Hardware Troubleshooting',
  'Handle POST errors, RAM diagnostics, and physical hardware incidents in a simulated helpdesk environment.',
  (SELECT id FROM module_categories WHERE name = 'Hardware' LIMIT 1),
  'Beginner',
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE title = 'Hardware Troubleshooting');

INSERT INTO lessons (module_id, sequence_no, title, summary, estimated_minutes)
SELECT m.id, v.sequence_no, v.title, v.summary, v.estimated_minutes
FROM modules m
CROSS JOIN (
  VALUES
    (1, 'Diagnose Boot Failure', 'Learn the structured approach to first-response diagnostics.', 15),
    (2, 'Inspect Internal Components', 'Identify hardware indicators and apply safe troubleshooting.', 20),
    (3, 'Validate Repair', 'Run final checks and close incidents with documented evidence.', 15)
) AS v(sequence_no, title, summary, estimated_minutes)
WHERE m.title = 'Hardware Troubleshooting'
  AND NOT EXISTS (
    SELECT 1
    FROM lessons l
    WHERE l.module_id = m.id
      AND l.sequence_no = v.sequence_no
  );

INSERT INTO lesson_content (lesson_id, content_type, title, body_text, sort_order, is_required)
SELECT l.id, 'text', 'Core Concept', l.summary, 1, TRUE
FROM lessons l
WHERE NOT EXISTS (
  SELECT 1
  FROM lesson_content c
  WHERE c.lesson_id = l.id
    AND c.sort_order = 1
);

INSERT INTO quizzes (module_id, lesson_id, title, quiz_type, passing_score, time_limit_minutes, attempt_limit)
SELECT m.id, NULL, 'Hardware Final Exam', 'final_exam', 70, 20, 3
FROM modules m
WHERE m.title = 'Hardware Troubleshooting'
  AND NOT EXISTS (
    SELECT 1
    FROM quizzes q
    WHERE q.module_id = m.id
      AND q.quiz_type = 'final_exam'
  );

INSERT INTO questions (quiz_id, prompt, question_type, points, sort_order)
SELECT q.id, 'What should be checked first when a desktop does not power on?', 'single_choice', 1, 1
FROM quizzes q
WHERE q.title = 'Hardware Final Exam'
  AND NOT EXISTS (
    SELECT 1
    FROM questions qu
    WHERE qu.quiz_id = q.id
      AND qu.sort_order = 1
  );

INSERT INTO answers (question_id, answer_text, is_correct, sort_order)
SELECT qu.id, a.answer_text, a.is_correct, a.sort_order
FROM questions qu
CROSS JOIN (
  VALUES
    ('Power source and PSU switch', TRUE, 1),
    ('Install new operating system', FALSE, 2),
    ('Replace the motherboard immediately', FALSE, 3),
    ('Upgrade RAM modules first', FALSE, 4)
) AS a(answer_text, is_correct, sort_order)
WHERE qu.prompt = 'What should be checked first when a desktop does not power on?'
  AND NOT EXISTS (
    SELECT 1
    FROM answers ans
    WHERE ans.question_id = qu.id
  );
