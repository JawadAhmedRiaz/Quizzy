import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, questionFlagsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/flags", async (req, res): Promise<void> => {
  const rows = await db.select().from(questionFlagsTable).orderBy(desc(questionFlagsTable.createdAt));
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/flags", async (req, res): Promise<void> => {
  const { questionId, questionText, quizId, userId, displayName, reason, note } = req.body;
  if (!questionId || !quizId || !userId || !reason) {
    res.status(400).json({ error: "questionId, quizId, userId, reason required" });
    return;
  }
  const existing = await db.select().from(questionFlagsTable)
    .where(eq(questionFlagsTable.questionId, questionId));
  const alreadyFlaggedByUser = existing.some(f => f.userId === userId);
  if (alreadyFlaggedByUser) {
    await db.delete(questionFlagsTable)
      .where(eq(questionFlagsTable.id, existing.find(f => f.userId === userId)!.id));
    res.json({ unflagged: true });
    return;
  }
  const [row] = await db.insert(questionFlagsTable).values({
    questionId,
    questionText: questionText ?? "",
    quizId,
    userId,
    displayName: displayName ?? null,
    reason,
    note: note ?? null,
  }).returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.patch("/flags/:id/review", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [row] = await db.update(questionFlagsTable).set({ reviewed: true }).where(eq(questionFlagsTable.id, Number(id))).returning();
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/flags/:id", async (req, res): Promise<void> => {
  await db.delete(questionFlagsTable).where(eq(questionFlagsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
