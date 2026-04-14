# HelpDesk Academy LMS

Simulation-based Learning Management System for IT training with strict sequential progression.

## Project Structure
- `frontend/` - React + Vite + Tailwind client
- `backend/` - Node.js + Express API + PostgreSQL migrations

## Quick Start
1. Configure backend `.env` using `backend/.env.example`
2. Run backend migration
   - `cd backend && npm install && npm run migrate && npm run dev`
3. Run frontend
   - `cd frontend && npm install && npm run dev`
