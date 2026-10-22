import { pgTable, text, serial, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const subjectsTable = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    sem: integer("sem").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("📚"),
    color: text("color").notNull().default("#6366f1"),
    gradient: text("gradient").notNull().default("linear-gradient(135deg,#4f46e5,#6366f1)"),
    isActive: boolean("is_active").notNull().default(true),
    examTypes: text("exam_types").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("subjects_sem_name_key").on(t.sem, t.name)],
);

export type Subject = typeof subjectsTable.$inferSelect;
export type InsertSubject = typeof subjectsTable.$inferInsert;
