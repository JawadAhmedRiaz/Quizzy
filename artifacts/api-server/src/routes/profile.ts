import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, profilesTable, attemptedQuestionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/profile/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  if (!profile) {
    res.json(null);
    return;
  }
  res.json({ ...profile, createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString() });
});

router.post("/profile", async (req, res): Promise<void> => {
  const { userId, displayName, rollNumber, department, section, gender, isGuest, notificationsEnabled } = req.body;
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const existing = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  const today = new Date().toISOString().split("T")[0];

  if (existing.length === 0) {
    const [created] = await db.insert(profilesTable).values({
      userId,
      displayName: displayName ?? null,
      rollNumber: rollNumber ?? null,
      department: department ?? null,
      section: section ?? null,
      gender: gender ?? null,
      isGuest: isGuest ?? false,
      notificationsEnabled: notificationsEnabled ?? false,
    }).returning();
    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() });
  } else {
    const updates: Partial<typeof profilesTable.$inferInsert> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (rollNumber !== undefined) updates.rollNumber = rollNumber;
    if (department !== undefined) updates.department = department;
    if (section !== undefined) updates.section = section;
    if (gender !== undefined) updates.gender = gender;
    if (notificationsEnabled !== undefined) updates.notificationsEnabled = notificationsEnabled;

    const [updated] = await db.update(profilesTable).set(updates).where(eq(profilesTable.userId, userId)).returning();
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  }
});

router.get("/profile/:userId/attempted", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { quizId } = req.query as { quizId: string };
  if (!quizId) { res.status(400).json({ error: "quizId required" }); return; }

  const [row] = await db.select().from(attemptedQuestionsTable)
    .where(and(eq(attemptedQuestionsTable.userId, userId), eq(attemptedQuestionsTable.quizId, quizId)));
  const hashes: string[] = row ? JSON.parse(row.questionHashes) : [];
  res.json({ userId, quizId, questionHashes: hashes });
});

router.post("/profile/:userId/attempted", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { quizId, questionHashes } = req.body as { quizId: string; questionHashes: string[] };
  if (!quizId || !questionHashes) { res.status(400).json({ error: "quizId and questionHashes required" }); return; }

  const existing = await db.select().from(attemptedQuestionsTable)
    .where(and(eq(attemptedQuestionsTable.userId, userId), eq(attemptedQuestionsTable.quizId, quizId)));

  if (existing.length === 0) {
    const [row] = await db.insert(attemptedQuestionsTable).values({ userId, quizId, questionHashes: JSON.stringify(questionHashes) }).returning();
    res.status(201).json({ userId, quizId, questionHashes });
  } else {
    const prev: string[] = JSON.parse(existing[0].questionHashes);
    const merged = Array.from(new Set([...prev, ...questionHashes]));
    await db.update(attemptedQuestionsTable)
      .set({ questionHashes: JSON.stringify(merged) })
      .where(and(eq(attemptedQuestionsTable.userId, userId), eq(attemptedQuestionsTable.quizId, quizId)));
    res.json({ userId, quizId, questionHashes: merged });
  }
});

router.delete("/profile/:userId/attempted", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { quizId } = req.body as { quizId: string };
  if (!quizId) { res.status(400).json({ error: "quizId required" }); return; }
  await db.delete(attemptedQuestionsTable)
    .where(and(eq(attemptedQuestionsTable.userId, userId), eq(attemptedQuestionsTable.quizId, quizId)));
  res.json({ ok: true });
});

export default router;
