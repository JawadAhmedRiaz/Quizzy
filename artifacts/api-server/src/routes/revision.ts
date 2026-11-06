import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, revisionCardsTable } from "@workspace/db";

const router: IRouter = Router();

export function generateCanonicalQuestionHash(
  questionText: string,
  options: string[],
  correctIndex: number
): string {
  const normQ = String(questionText || "").trim().toLowerCase().replace(/\s+/g, " ");
  const normOptions = Array.isArray(options)
    ? options.map((o) => String(o || "").trim().toLowerCase().replace(/\s+/g, " ")).join("|")
    : "";
  const payload = `${normQ}:::${normOptions}:::${correctIndex ?? 0}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ── GET /api/revision-cards ──
// Fetches the authenticated user's active revision deck directly from PostgreSQL
router.get("/revision-cards", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const targetUserId = req.user.id;

    const cards = await db
      .select()
      .from(revisionCardsTable)
      .where(eq(revisionCardsTable.userId, targetUserId))
      .orderBy(revisionCardsTable.mastered, desc(revisionCardsTable.updatedAt));

    const formatted = cards.map((c) => {
      let options: string[] = [];
      try {
        options = JSON.parse(c.optionsJson || "[]");
      } catch {
        options = ["Option A", "Option B", "Option C", "Option D"];
      }

      return {
        id: `card_${c.id}`,
        dbId: c.id,
        quizId: c.sourceQuizId || "revision",
        subject: c.subject,
        question: {
          q: c.questionText,
          o: options,
          a: c.correctIndex,
          e: c.explanation || "Review the core concepts for this question.",
        },
        selectedOptionIndex: c.lastSelectedIndex,
        wrongAt: c.updatedAt.toISOString(),
        mastered: c.mastered,
        masteredAt: c.masteredAt ? c.masteredAt.toISOString() : undefined,
        reviewCount: c.reviewCount,
        mistakeCount: c.mistakeCount,
      };
    });

    res.json(formatted);
  } catch (err) {
    req.log?.error?.({ err }, "Error fetching revision cards");
    res.status(500).json({ error: "Failed to fetch revision cards" });
  }
});

// ── PATCH /api/revision-cards/:id/master ──
// Updates mastery status and increments review count with ownership validation
router.patch("/revision-cards/:id/master", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const idStr = String(req.params.id || "").replace(/^card_/, "");
  const numId = parseInt(idStr, 10);
  if (isNaN(numId)) {
    res.status(400).json({ error: "Invalid card ID" });
    return;
  }

  const { mastered } = req.body as { mastered?: boolean };

  try {
    const existing = await db
      .select()
      .from(revisionCardsTable)
      .where(eq(revisionCardsTable.id, numId))
      .limit(1);

    if (existing.length === 0 || existing[0].userId !== req.user.id) {
      res.status(404).json({ error: "Revision card not found" });
      return;
    }

    const isMastered = Boolean(mastered);
    const [updated] = await db
      .update(revisionCardsTable)
      .set({
        mastered: isMastered,
        masteredAt: isMastered ? new Date() : null,
        reviewCount: sql`${revisionCardsTable.reviewCount} + 1`,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(revisionCardsTable.id, numId))
      .returning();

    res.json({ ok: true, card: updated });
  } catch (err) {
    req.log?.error?.({ err }, "Error updating card mastery");
    res.status(500).json({ error: "Failed to update card mastery" });
  }
});

// ── DELETE /api/revision-cards/:id ──
// Permanently removes a single card from PostgreSQL with ownership validation
router.delete("/revision-cards/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const idStr = String(req.params.id || "").replace(/^card_/, "");
  const numId = parseInt(idStr, 10);
  if (isNaN(numId)) {
    res.status(400).json({ error: "Invalid card ID" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(revisionCardsTable)
      .where(eq(revisionCardsTable.id, numId))
      .limit(1);

    if (existing.length === 0 || existing[0].userId !== req.user.id) {
      res.status(404).json({ error: "Revision card not found" });
      return;
    }

    await db.delete(revisionCardsTable).where(eq(revisionCardsTable.id, numId));
    res.json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err }, "Error deleting revision card");
    res.status(500).json({ error: "Failed to delete revision card" });
  }
});

// ── DELETE /api/revision-cards (Clear all mastered) ──
router.delete("/revision-cards", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const targetUserId = req.user.id;

    await db
      .delete(revisionCardsTable)
      .where(
        and(
          eq(revisionCardsTable.userId, targetUserId),
          eq(revisionCardsTable.mastered, true)
        )
      );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear mastered cards" });
  }
});

export default router;
