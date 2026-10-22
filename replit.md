# Workspace

## Overview

**Quizzy** — Learning Management System built by Hamid Mukhtar for exam preparation.  
pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Wouter + Framer Motion + TailwindCSS

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## App Features (Built)

### Authentication & Users
- Replit Auth (OAuth) for logged-in users
- Guest access via `quizzy_guest_id` in localStorage (`guest_<random>`)
- UserContext (`/src/context/UserContext.tsx`) — provides `effectiveUserId`, `isGuest`, `profile`, `gamification`
- WelcomeModal — shows on first visit with Login + Guest buttons
- ProfileCompletionPrompt — slides up after 3.5s if profile is incomplete

### Profile System
- `profiles` DB table: displayName, rollNumber, department, section, XP, streak, freezes
- `/api/profile/:userId` — GET profile
- `/api/profile` POST — create/update profile
- ProfilePage (`/profile`) — edit profile, view XP progress, badges

### Gamification
- XP earned per quiz (pct × difficulty multiplier + bonuses)
- XP levels: Beginner(<201), Scholar(<501), Expert(<1001), Master(<2001), Legend(2001+)
- Daily streaks with freeze mechanic (1 freeze per 7-day streak)
- 7 badges: first_perfect, week_warrior, speed_demon, sharp_shooter, never_skip, top_class, comeback_kid
- `/api/gamification/:userId` — fetch XP, level, streak, badges
- `/api/gamification/award-xp` — award XP after quiz completion
- `/api/gamification/leaderboard/xp` — XP leaderboard

### Quiz Engine (QuizPage)
- Global timer (total question count × per-question seconds)
- Per-question countdown timer (easy=30s, medium=15s, hard=10s)
- Skipped questions go to backlog queue, revisited after main queue
- Review-mode back navigation (↩ Back button) — answers are LOCKED when reviewing
- Pause/Break modal: 5, 10, or 20 minute break options with countdown
- Question flagging (🚩) — submits to DB with reason + optional note
- Practice mode: tracks attempted question hashes, skips already-seen questions

### Leaderboard
- Quiz board: best score, accuracy, correct/total, attempts per user — clickable user cards
- XP board: global XP ranking with level badges

### Flagged Questions
- `/api/flags` — CRUD for question flags
- FlaggedQuestionsPage (`/flagged`) — grouped by question, shows all flags with expand/collapse
- Toggle flag (same user flagging again = unflag)

### DB Schema
Tables: `profiles`, `attempted_questions`, `xp_log`, `user_badges`, `question_flags`, `quiz_reports`, `leaderboard`, `users`, `sessions`

### Frontend Routes
- `/` — HomePage (semester tabs, subject grid)
- `/quiz/:quizId/setup` — QuizSetupPage
- `/quiz/:quizId/play` — QuizPage
- `/quiz/:quizId/result` — ResultPage
- `/quiz/:quizId/leaderboard` — LeaderboardPage
- `/analytics` — AnalyticsPage
- `/profile` — ProfilePage
- `/flagged` — FlaggedQuestionsPage

## Quiz Content

126 English Midterm MCQs (Sem 2):
- 86 Grammar questions
- 20 Sentence Types questions
- 20 Tag Questions questions

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
