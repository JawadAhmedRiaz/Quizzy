import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const vaultItemsTable = pgTable("vault_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("pdf"), // 'pdf' | 'handwritten' | 'notes' | 'summary' | 'other'
  description: text("description"),
  fileUrl: text("file_url").notNull(), // Data URI or URL
  fileName: text("file_name").notNull(),
  fileSize: text("file_size"),
  mimeType: text("mime_type"),
  tags: text("tags").default("[]"), // JSON stringified array of tags
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type VaultItem = typeof vaultItemsTable.$inferSelect;
export type InsertVaultItem = typeof vaultItemsTable.$inferInsert;
