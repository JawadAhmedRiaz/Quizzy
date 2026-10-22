import { pgTable, text, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const xpLogTable = pgTable("xp_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  quizId: text("quiz_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  badgeId: text("badge_id").notNull(),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
});

export type XpLog = typeof xpLogTable.$inferSelect;
export type UserBadge = typeof userBadgesTable.$inferSelect;
