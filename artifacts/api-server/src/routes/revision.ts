import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, revisionCardsTable, usersTable, profilesTable } from "@workspace/db";

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

// Resolve user identity to canonical internal PostgreSQL UUID
async function resolveInternalUserId(reqUserId?: string, queryParam?: string): Promise<string | null> {
  const users = await db.select().from(usersTable).catch(() => []);
  const profiles = await db.select().from(profilesTable).catch(() => []);

  // 1. Direct match on usersTable.id
  if (reqUserId) {
    const direct = users.find((u) => u.id === reqUserId);
    if (direct) return direct.id;
  }

  const query = (queryParam || reqUserId || "").trim().toLowerCase();
  if (!query || query.startsWith("guest") || query === "user") {
    return null;
  }

  // 2. Exact match on email or user ID
  for (const u of users) {
    if (u.id.toLowerCase() === query || u.email?.toLowerCase() === query) {
      return u.id;
    }
  }

  // 3. Match on profile displayName
  for (const p of profiles) {
    if (p.displayName?.trim().toLowerCase() === query) {
      // Return mapped userId
      return p.userId;
    }
  }

  // 4. Match on first + last name
  for (const u of users) {
    const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim().toLowerCase();
    if (full === query) {
      return u.id;
    }
  }

  return null;
}

// ── GET /api/revision-cards ──
// Fetches the user's active revision deck directly from PostgreSQL
router.get("/revision-cards", async (req, res): Promise<void> => {
  try {
    const queryParam = (req.query.userId || req.query.userName) as string | undefined;
    const targetUserId = await resolveInternalUserId(req.user?.id, queryParam);

    if (!targetUserId) {
      res.json([]);
      return;
    }

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
  const idStr = String(req.params.id || "").replace(/^card_/, "");
  const numId = parseInt(idStr, 10);
  if (isNaN(numId)) {
    res.status(400).json({ error: "Invalid card ID" });
    return;
  }

  const { mastered, userId, userName } = req.body as { mastered?: boolean; userId?: string; userName?: string };
  const queryParam = (req.query.userId || req.query.userName || userId || userName) as string | undefined;
  const targetUserId = await resolveInternalUserId(req.user?.id, queryParam);

  try {
    const existing = await db
      .select()
      .from(revisionCardsTable)
      .where(eq(revisionCardsTable.id, numId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Revision card not found" });
      return;
    }

    if (targetUserId && existing[0].userId !== targetUserId) {
      res.status(403).json({ error: "Forbidden: You do not own this revision card" });
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
  const idStr = String(req.params.id || "").replace(/^card_/, "");
  const numId = parseInt(idStr, 10);
  if (isNaN(numId)) {
    res.status(400).json({ error: "Invalid card ID" });
    return;
  }

  const queryParam = (req.query.userId || req.query.userName) as string | undefined;
  const targetUserId = await resolveInternalUserId(req.user?.id, queryParam);

  try {
    const existing = await db
      .select()
      .from(revisionCardsTable)
      .where(eq(revisionCardsTable.id, numId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Revision card not found" });
      return;
    }

    if (targetUserId && existing[0].userId !== targetUserId) {
      res.status(403).json({ error: "Forbidden: You do not own this revision card" });
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
  try {
    const queryParam = (req.query.userId || req.query.userName) as string | undefined;
    const targetUserId = await resolveInternalUserId(req.user?.id, queryParam);

    if (!targetUserId) {
      res.status(400).json({ error: "User identity required" });
      return;
    }

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
