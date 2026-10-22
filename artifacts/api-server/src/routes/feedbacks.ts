import { Router, type IRouter } from "express";
import { db, feedbacksTable } from "@workspace/db";

const router: IRouter = Router();

// Public — any user can submit feedback
router.post("/feedback", async (req, res): Promise<void> => {
  const { userId, displayName, rollNumber, message } = req.body;
  if (!message || typeof message !== "string" || message.trim().length < 3) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const [row] = await db
    .insert(feedbacksTable)
    .values({
      userId: userId ? String(userId) : null,
      displayName: displayName ? String(displayName) : null,
      rollNumber: rollNumber ? String(rollNumber) : null,
      message: message.trim(),
    })
    .returning();
  res.status(201).json(row);
});

export default router;
