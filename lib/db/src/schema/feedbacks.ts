import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const feedbacksTable = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  displayName: text("display_name"),
  rollNumber: text("roll_number"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Feedback = typeof feedbacksTable.$inferSelect;
export type InsertFeedback = typeof feedbacksTable.$inferInsert;
