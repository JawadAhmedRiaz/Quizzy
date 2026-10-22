import { pgTable, text, integer, timestamp, boolean, serial } from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  rollNumber: text("roll_number"),
  department: text("department"),
  section: text("section"),
  gender: text("gender"),
  xp: integer("xp").notNull().default(0),
  streakCount: integer("streak_count").notNull().default(0),
  streakLastDate: text("streak_last_date"),
  freezesAvailable: integer("freezes_available").notNull().default(0),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(false),
  isGuest: boolean("is_guest").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const attemptedQuestionsTable = pgTable("attempted_questions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  quizId: text("quiz_id").notNull(),
  questionHashes: text("question_hashes").notNull().default("[]"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = typeof profilesTable.$inferInsert;
export type AttemptedQuestions = typeof attemptedQuestionsTable.$inferSelect;
