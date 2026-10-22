import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const semestersTable = pgTable("semesters", {
  id: serial("id").primaryKey(),
  num: integer("num").notNull().unique(),
  label: text("label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Semester = typeof semestersTable.$inferSelect;
