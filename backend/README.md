# HelpDesk Academy Backend

Node.js + Express + PostgreSQL API for a simulation-based LMS with strict sequential progression.

## Stack
- Node.js + Express
- PostgreSQL (`SIMLEARN`)
- JWT authentication
- SQL migrations

## Setup
1. Copy `.env.example` to `.env`
2. Configure `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`
   - Optional: set `API_BODY_LIMIT` (for large JSON payloads, e.g. base64 media), default `50mb`
3. Install dependencies
   - `npm install`
4. Run migrations
   - `npm run migrate`
5. Start API
   - `npm run dev`

## Default Seed Accounts
- Admin: `admin@helpdesk.local` / `admin123`
- User: `user@helpdesk.local` / `user123`

## API Surface
- `/api/auth` (`register`, `login`, `me`)
- `/api/users` (CRUD, role assignment, activate/deactivate, logs)
- `/api/modules` (CRUD, lock/unlock, prerequisites)
- `/api/lessons` (CRUD)
- `/api/content` (CRUD lesson content: text/image/video/simulation/file)
- `/api/enrollments` (enroll, list, details)
- `/api/progress` (checkpoints, complete lesson with sequential enforcement)
- `/api/quizzes` (CRUD + start)
- `/api/results` (submit attempts, scores, feedback)
- `/api/certificates` (list, details)
- `/api/notifications` (list/create/read)
- `/api/dashboard` (admin/user analytics)
