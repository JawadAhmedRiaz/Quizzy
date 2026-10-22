---
name: DB Quiz ID Format
description: How DB-sourced quiz IDs are structured and handled across frontend + backend
---

## The Rule
DB quiz IDs follow the format `db-{subjectId}-{examType.toLowerCase()}` — e.g. `db-3-midterm`.

**Why:** Encodes the subjects table row ID + exam type into a URL-safe slug that works with Wouter path params. The subject ID links to the exact DB row, avoiding ambiguity with subject name collisions.

**How to apply:**
- When rendering DB subjects on HomePage, build exam IDs as `db-${s.id}-${et.toLowerCase()}`
- API endpoint `GET /api/quiz-questions/:quizId` parses: strips `db-` prefix, splits on first `-`, gets subjectId + examType
- `examType` stored in DB with capital first letter (e.g. "Midterm") but slug uses lowercase — API does `charAt(0).toUpperCase() + slice(1)` to match
- QuizSetupPage: if `quizId.startsWith("db-")`, fetch from `/api/quiz-questions/${quizId}` async
- QuizPage: if `quizId.startsWith("db-")`, use `session.questions` (already set by startSession in QuizSetupPage) instead of getQuizQuestions()
- subjects table auto-upserted (onConflictDoNothing) when questions are batch imported
