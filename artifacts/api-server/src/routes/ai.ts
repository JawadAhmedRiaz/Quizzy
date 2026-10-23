import { Router, type IRouter, type Request, type Response } from "express";
import { db, questionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/ai/explain", async (req: Request, res: Response): Promise<void> => {
  const { question, options, correctAnswer, subject, topic, questionId } = req.body ?? {};

  if (!question || !correctAnswer) {
    res.status(400).json({ error: "question and correctAnswer are required" });
    return;
  }

  // 1. Check if DB already has briefing cached for this question
  if (questionId) {
    try {
      const [found] = await db.select().from(questionsTable).where(eq(questionsTable.id, Number(questionId)));
      if (found?.briefing && found.briefing.trim().length > 10) {
        res.json({ explanation: found.briefing.trim() });
        return;
      }
    } catch {}
  }

  // 2. Call Gemini for instant conceptual breakdown
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.json({
      explanation: `In ${subject || "this subject"}, Option ${correctAnswer} represents the verified standard concept answering "${question}".`
    });
    return;
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an expert university exam tutor in ${subject || "Academics"}.
Explain clearly and concisely (2 to 3 sentences) why the correct answer is Option ${correctAnswer} for the following multiple-choice question:
Question: ${question}
Options: ${Array.isArray(options) ? options.join(" | ") : ""}
Correct Answer: Option ${correctAnswer}

Focus on explaining the underlying concept and principle so the student understands WHY this answer is factually correct. Do NOT say "The correct answer is Option X because". Directly explain the facts and mechanics.`;

  try {
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 350 },
      }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        if (questionId) {
          try {
            await db.update(questionsTable).set({ briefing: text }).where(eq(questionsTable.id, Number(questionId)));
          } catch {}
        }
        res.json({ explanation: text });
        return;
      }
    }
  } catch (err) {
    console.error("AI explanation error:", err);
  }

  res.json({
    explanation: `Option ${correctAnswer} accurately matches the established principles of ${subject || "the subject"}, directly fulfilling the requirements of "${question}".`
  });
});

export default router;
