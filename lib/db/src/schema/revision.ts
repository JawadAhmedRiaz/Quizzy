import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const revisionCardsTable = pgTable(
  "revision_cards",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),              // Internal PostgreSQL UUID (usersTable.id)
    subject: text("subject").notNull(),            // Subject name
    questionHash: text("question_hash").notNull(),  // Canonical SHA-256 (normalized Q + Options + CorrectIndex)

    // Complete Immutable Snapshot
    questionText: text("question_text").notNull(),
    optionsJson: text("options_json").notNull().default("[]"), // Array of 4 option strings
    correctIndex: integer("correct_index").notNull(),          // 0..3
    lastSelectedIndex: integer("last_selected_index"),         // 0..3 or null
    explanation: text("explanation"),

    // Learning & Spaced Repetition Metrics
    mastered: boolean("mastered").notNull().default(false),
    masteredAt: timestamp("mastered_at", { withTimezone: true }),
    reviewCount: integer("review_count").notNull().default(0),  // Flashcard review sessions
    mistakeCount: integer("mistake_count").notNull().default(1), // Quiz exam mistakes
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),

    // Provenance
    sourceQuizId: text("source_quiz_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Exactly ONE active revision card per user per canonical question
    userQuestionUniq: uniqueIndex("revision_user_question_idx").on(
      table.userId,
      table.questionHash
    ),
  })
);

export const insertRevisionCardSchema = createInsertSchema(revisionCardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRevisionCard = z.infer<typeof insertRevisionCardSchema>;
export type RevisionCard = typeof revisionCardsTable.$inferSelect;
