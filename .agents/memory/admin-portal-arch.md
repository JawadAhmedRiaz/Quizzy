---
name: Admin Portal Architecture
description: Overview of the Quizzy admin portal phases, routes, and key decisions
---

## The Rule
Admin portal is a 6-phase system under `/admin/*` routes, all guarded by `adminMiddleware` which checks `users.role = 'admin'` in the DB.

**Why:** Role is stored in the `users` table (role column, default 'student'). To promote: `UPDATE users SET role = 'admin' WHERE email = '...'`

**How to apply:**
- API routes: all under `/api/admin/*` in `artifacts/api-server/src/routes/admin.ts`
- Public content routes: `/api/subjects` and `/api/quiz-questions/:quizId` in `subjects.ts`
- Gemini AI: direct REST fetch to `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}` — no SDK package needed
- File extraction: multer (memoryStorage) + dynamic import of pdf-parse + mammoth for .pdf/.docx/.txt at `POST /api/admin/extract-file`
- subjects table: edit-only from admin UI (PUT /admin/subjects/:id); created automatically on batch import via onConflictDoNothing
- Palette: bg `#0f172a`, cards `#1e293b`, borders `#334155`
- isAdmin flag flows: `/api/admin/check` → UserContext.isAdmin → AdminLayout gate + Sidebar link
