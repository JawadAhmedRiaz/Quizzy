import { db, questionsTable } from "@workspace/db";
import { eq, isNull, or, sql } from "drizzle-orm";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function generateSingleExplanation(
  question: string,
  options: string[],
  correctAnswer: string,
  subject?: string,
  topic?: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return `In ${subject || "this topic"}, Option ${correctAnswer} is the verified standard principle answering this question.`;
  }

  const prompt = `You are an expert university professor and exam tutor in ${subject || "Academics"}.
Write a clear, educational, and concept-rich explanation (1 to 2 sentences) of WHY the correct answer is Option ${correctAnswer} for this multiple-choice question:
Question: ${question}
Options: ${options.map((o, idx) => `${String.fromCharCode(65 + idx)}: ${o}`).join(" | ")}
Correct Answer: Option ${correctAnswer}

Focus directly on the core definition and mechanics of the concept. Do NOT start with "The correct answer is Option X because". Directly explain the facts and mechanics.`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 300 },
      }),
    });

    if (res.ok) {
      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    }
  } catch (err) {
    console.error("Gemini single explanation error:", err);
  }

  return `In ${subject || "this field"}${topic ? ` (${topic})` : ""}, Option ${correctAnswer} accurately fulfills the established criteria for "${question}".`;
}

export async function autoGenerateMissingBriefings(limit: number = 30): Promise<number> {
  if (!GEMINI_API_KEY) return 0;

  try {
    const missing = await db
      .select()
      .from(questionsTable)
      .where(or(isNull(questionsTable.briefing), sql`trim(${questionsTable.briefing}) = ''`))
      .limit(limit);

    if (missing.length === 0) return 0;

    console.log(`[Auto-Explanation] Found ${missing.length} new question(s) without explanations. Generating in background...`);

    const prompt = `You are an expert university exam tutor. For each multiple-choice question below, provide a clear, concise, and educational explanation (1 to 2 sentences) explaining WHY the correct option is true and what the key concept means.
Do NOT say "The correct answer is Option X because..." or "According to curriculum...". Instead, directly explain the underlying factual/conceptual reasoning.

Return ONLY a valid JSON array of strings in the exact same order as the questions, with NO Markdown code fences or extra commentary.

Questions:
${missing.map((q, idx) => {
  const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
  const cIndex = ["A", "B", "C", "D"].indexOf(q.correctAnswer.toUpperCase());
  const correctText = opts[cIndex] || q.correctAnswer;
  return `${idx + 1}. [Subject: ${q.subject} | Topic: ${q.topic || 'General'}]
Question: ${q.question}
Options: A: ${opts[0]} | B: ${opts[1]} | C: ${opts[2]} | D: ${opts[3]}
Correct Answer: Option ${q.correctAnswer} (${correctText})`;
}).join("\n\n")}`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      console.warn("[Auto-Explanation] Gemini API failed with status", res.status);
      return 0;
    }

    const data = await res.json() as any;
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const cleaned = raw.replace(/^```json/i, "").replace(/```$/i, "").trim();
    const parsed: string[] = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length === missing.length) {
      for (let i = 0; i < missing.length; i++) {
        if (parsed[i]) {
          await db
            .update(questionsTable)
            .set({ briefing: parsed[i], updatedAt: new Date() })
            .where(eq(questionsTable.id, missing[i].id));
        }
      }
      console.log(`[Auto-Explanation] Successfully saved explanations for ${missing.length} new question(s).`);
      return missing.length;
    }
  } catch (err) {
    console.error("[Auto-Explanation] Background generation error:", err);
  }

  return 0;
}
