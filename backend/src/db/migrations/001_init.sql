CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (email, full_name, role, password_hash)
VALUES
  ('admin@helpdesk.local', 'HelpDesk Academy Administrator', 'admin', '$2a$10$SWM9Hvzq7ZY/Vk2fKFmbEOpbJBxTPsNt/jqGSlYKpEhzJ3ziCWL82'),
  ('user@helpdesk.local', 'HelpDesk Academy User', 'user', '$2a$10$7aZPWfQZYto2NW0mklFCpu7tskLSUbO3uya/48tfmi.gaFazHIsBq')
ON CONFLICT (email) DO NOTHING;
