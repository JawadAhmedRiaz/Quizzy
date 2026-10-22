import { pgTable, text, boolean, timestamp, serial } from "drizzle-orm/pg-core";

export const questionFlagsTable = pgTable("question_flags", {
  id: serial("id").primaryKey(),
  questionId: text("question_id").notNull(),
  questionText: text("question_text").notNull(),
  quizId: text("quiz_id").notNull(),
  userId: text("user_id").notNull(),
  displayName: text("display_name"),
  reason: text("reason").notNull(),
  note: text("note"),
  reviewed: boolean("reviewed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuestionFlag = typeof questionFlagsTable.$inferSelect;
export type InsertQuestionFlag = typeof questionFlagsTable.$inferInsert;
