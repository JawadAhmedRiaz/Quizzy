import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, leaderboardTable } from "@workspace/db";
import { SubmitScoreBody, GetLeaderboardResponse, SubmitScoreResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leaderboard", async (req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(leaderboardTable)
    .orderBy(desc(leaderboardTable.score));
  res.json(GetLeaderboardResponse.parse(entries.map((e) => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }))));
});

router.post("/leaderboard/score", async (req, res): Promise<void> => {
  const parsed = SubmitScoreBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid score submission");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, score, correct, total, pct } = parsed.data;

  const [existing] = await db
    .select()
    .from(leaderboardTable)
    .where(eq(leaderboardTable.name, name))
    .limit(1);

  if (existing) {
    if (score > existing.score) {
      const [updated] = await db
        .update(leaderboardTable)
        .set({ score, correct, total, pct })
        .where(eq(leaderboardTable.id, existing.id))
        .returning();
      res.json(SubmitScoreResponse.parse({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      }));
    } else {
      res.json(SubmitScoreResponse.parse({
        ...existing,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      }));
    }
    return;
  }

  const [inserted] = await db
    .insert(leaderboardTable)
    .values({ name, score, correct, total, pct })
    .returning();

  res.json(SubmitScoreResponse.parse({
    ...inserted,
    createdAt: inserted.createdAt.toISOString(),
    updatedAt: inserted.updatedAt.toISOString(),
  }));
});

export default router;
