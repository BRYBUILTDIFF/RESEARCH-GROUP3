UPDATE users
SET
  email = 'admin@helpdesk.local',
  full_name = 'HelpDesk Academy Administrator'
WHERE role = 'admin' AND email = 'admin@simlearn.local';

UPDATE users
SET
  email = 'user@helpdesk.local',
  full_name = 'HelpDesk Academy User'
WHERE role = 'user' AND email = 'user@simlearn.local';

UPDATE users
SET full_name = 'HelpDesk Academy Administrator'
WHERE role = 'admin' AND full_name = 'SIMLEARN Administrator';

UPDATE users
SET full_name = 'HelpDesk Academy User'
WHERE role = 'user' AND full_name = 'SIMLEARN User';
