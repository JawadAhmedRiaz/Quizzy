import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, vaultItemsTable, systemConfigsTable } from "@workspace/db";
import { adminMiddleware } from "../middlewares/adminMiddleware";

const router: IRouter = Router();

// 1. Vault Accessibility Settings (Public to read, Admin only to update)
router.get("/vault/settings", async (_req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(systemConfigsTable)
      .where(eq(systemConfigsTable.key, "vault.isPublic"));
    const isPublic = row ? row.value !== "false" : true;
    res.json({ isPublic });
  } catch {
    res.json({ isPublic: true });
  }
});

router.post("/vault/settings", adminMiddleware, async (req, res): Promise<void> => {
  const { isPublic } = req.body;
  const val = isPublic === false ? "false" : "true";

  await db
    .insert(systemConfigsTable)
    .values({ key: "vault.isPublic", value: val })
    .onConflictDoUpdate({ target: systemConfigsTable.key, set: { value: val } });

  res.json({ success: true, isPublic: val === "true" });
});

// 2. Get vault items for a subject or all subjects (public for students when enabled)
router.get("/vault", async (req, res): Promise<void> => {
  const subjectId = req.query.subjectId ? parseInt(req.query.subjectId as string) : undefined;
  const category = req.query.category as string | undefined;

  let items = await db.select().from(vaultItemsTable).orderBy(desc(vaultItemsTable.createdAt));

  if (subjectId && !isNaN(subjectId)) {
    items = items.filter((i) => i.subjectId === subjectId);
  }
  if (category && category !== "all") {
    items = items.filter((i) => i.category === category);
  }

  res.json(
    items.map((item) => ({
      ...item,
      tags: typeof item.tags === "string" ? JSON.parse(item.tags || "[]") : item.tags,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  );
});

// 3. Upload / Create a new vault item (Admin only!)
router.post("/vault", adminMiddleware, async (req, res): Promise<void> => {
  const { subjectId, title, category, description, fileUrl, fileName, fileSize, mimeType, tags } = req.body;
  const userId = req.user?.id || "admin";

  if (!subjectId || !title || !fileUrl || !fileName) {
    res.status(400).json({ error: "Missing required fields (subjectId, title, fileUrl, fileName)" });
    return;
  }

  const [created] = await db
    .insert(vaultItemsTable)
    .values({
      userId,
      subjectId: parseInt(String(subjectId)),
      title: title.trim(),
      category: category || "pdf",
      description: description ? description.trim() : null,
      fileUrl,
      fileName,
      fileSize: fileSize || null,
      mimeType: mimeType || null,
      tags: JSON.stringify(tags || []),
    })
    .returning();

  res.status(201).json({
    ...created,
    tags: JSON.parse(created.tags || "[]"),
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
});

// 4. Delete a vault item (Admin only!)
router.delete("/vault/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid item ID" });
    return;
  }

  const [deleted] = await db.delete(vaultItemsTable).where(eq(vaultItemsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json({ success: true, id });
});

export default router;
