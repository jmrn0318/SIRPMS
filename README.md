# InternTrack – Internship Requirements & Progress Monitoring System

Node.js + Express + PostgreSQL. Roles: **Coordinator** and **Student**. Full BREAD (Browse, Read, Edit, Add, Delete) on students, requirements, submissions and hour logs.

## Run locally (Visual Studio Code)
1. Install Node.js 18+ and open this folder in VS Code (`File > Open Folder`).
2. Create a free PostgreSQL database (Neon, Supabase, Aiven, or Render) and copy its connection string.
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and a long random `SESSION_SECRET`.
   (For a local PostgreSQL without SSL, set `DATABASE_SSL=false`.)
4. In the VS Code terminal:
   ```
   npm install
   npm run seed     # creates tables + demo data
   npm start        # http://localhost:3000
   ```

## Demo accounts (created by the seed)
| Role | Email | Password |
|---|---|---|
| Coordinator | coordinator@school.edu | Admin@123 |
| Student | juan@school.edu | Student@123 |

Change these before the final demo (use Students > Edit to reset a student password).

## Deploy (production)
**Render (web service + database):**
1. Push this folder to GitHub (`.env` is git-ignored).
2. Render > New > Web Service > connect repo. Build: `npm install`. Start: `npm start`.
3. Environment variables: `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`, `APP_TZ=Asia/Manila`.
4. Run `npm run seed` once (Render Shell, or locally with the production `DATABASE_URL`).
The same service serves both the frontend (`public/`) and the API (`/api`), so one URL is the production URL.

## Project structure
```
server.js     Express API: auth, role checks, validation, business rules
db.js         PostgreSQL pool
schema.sql    Tables, primary/foreign keys (matches the ERD)
seed.js       Creates schema + demo data
public/
  index.html      Page shell (links the files below)
  css/styles.css  DESIGN: all styling
  js/data.js      DATA: state, API client, progress/status logic
  js/app.js       FUNCTIONALITY: screens, forms, actions, navigation
```

## Database (for the ERD)
users (PK id) 1—N requirements.created_by · users 1—N submissions · requirements 1—N submissions ·
users 1—N hour_logs · users 1—N activity_logs. `submissions` is the associative entity between students and requirements
(UNIQUE student_id + requirement_id). `reviewed_by` in submissions/hour_logs references users (coordinator).

## Business rules (enforced on the server)
1. No future-dated hours; max 12 hours per student per day.
2. Rejection requires remarks; approved records cannot be edited or deleted by students; editing a rejected record resubmits it as Pending.
3. Records with related data are archived/deactivated instead of deleted.
4. One submission per student per requirement.
5. Internship status is computed automatically: Completed when all active requirements are approved and required hours are reached.

## Security
Passwords hashed with bcrypt; sessions stored in PostgreSQL (httpOnly cookie); role checks on every endpoint; parameterized SQL; login rate limit; secrets only in environment variables.
