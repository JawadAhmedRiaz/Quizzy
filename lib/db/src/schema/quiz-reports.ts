import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quizReportsTable = pgTable("quiz_reports", {
  id: serial("id").primaryKey(),
  userName: text("user_name").notNull(),
  quizId: text("quiz_id").notNull(),
  sem: integer("sem").notNull(),
  subject: text("subject").notNull(),
  examType: text("exam_type").notNull(),
  correct: integer("correct").notNull(),
  total: integer("total").notNull(),
  pct: integer("pct").notNull(),
  score: integer("score").notNull(),
  answersJson: text("answers_json").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuizReportSchema = createInsertSchema(quizReportsTable).omit({ id: true, createdAt: true });
export type InsertQuizReport = z.infer<typeof insertQuizReportSchema>;
export type QuizReport = typeof quizReportsTable.$inferSelect;
