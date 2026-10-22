import { Router, type IRouter } from "express";
import { eq, desc, count, max, sum, ilike, and, inArray } from "drizzle-orm";
import multer from "multer";
import {
  db,
  usersTable,
  questionsTable,
  systemConfigsTable,
  quizReportsTable,
  questionFlagsTable,
  profilesTable,
  subjectsTable,
  semestersTable,
  feedbacksTable,
} from "@workspace/db";
import { adminMiddleware } from "../middlewares/adminMiddleware";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Phase 1: Role Check ──────────────────────────────────────────────────

router.get("/admin/check", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.json({ isAdmin: false });
    return;
  }
  const [user] = await db
    .select({ id: usersTable.id, role: usersTable.role, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, (req.user as { id: string }).id));

  let isAdmin = user?.role === "admin";
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (adminEmail && user?.email?.toLowerCase() === adminEmail) {
    isAdmin = true;
  }

  // If no admin exists in the database at all, auto-promote this user to admin
  if (!isAdmin && user) {
    const [anyAdmin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);
    if (!anyAdmin) {
      await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, user.id));
      isAdmin = true;
    }
  }

  res.json({ isAdmin: !!isAdmin });
});

// ─── Semesters CRUD ───────────────────────────────────────────────────────

router.get("/admin/semesters", adminMiddleware, async (_req, res): Promise<void> => {
  const rows = await db.select().from(semestersTable).orderBy(semestersTable.num);
  res.json(rows);
});

router.post("/admin/semesters", adminMiddleware, async (req, res): Promise<void> => {
  const { num, label, isActive } = req.body;
  if (!num || !label) { res.status(400).json({ error: "num and label required" }); return; }
  const [row] = await db.insert(semestersTable)
    .values({ num: Number(num), label: String(label), isActive: isActive !== false, sortOrder: Number(num) })
    .onConflictDoUpdate({ target: semestersTable.num, set: { label: String(label), isActive: isActive !== false } })
    .returning();
  res.status(201).json(row);
});

router.put("/admin/semesters/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { label, isActive } = req.body;
  const [updated] = await db.update(semestersTable)
    .set({ ...(label !== undefined && { label: String(label) }), ...(isActive !== undefined && { isActive: Boolean(isActive) }) })
    .where(eq(semestersTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/semesters/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(semestersTable).where(eq(semestersTable.id, id));
  res.json({ success: true });
});

// ─── Subjects CRUD ────────────────────────────────────────────────────────

router.get("/admin/subjects", adminMiddleware, async (req, res): Promise<void> => {
  const sem = req.query.sem ? parseInt(req.query.sem as string) : undefined;
  const rows = await db.select().from(subjectsTable)
    .where(sem ? eq(subjectsTable.sem, sem) : undefined)
    .orderBy(subjectsTable.sem, subjectsTable.name);
  res.json(rows);
});

router.post("/admin/subjects", adminMiddleware, async (req, res): Promise<void> => {
  const { sem, name, icon, color, gradient, examTypes } = req.body;
  if (!sem || !name) { res.status(400).json({ error: "sem and name required" }); return; }
  const [row] = await db.insert(subjectsTable)
    .values({
      sem: Number(sem),
      name: String(name).trim(),
      icon: icon ? String(icon) : "📚",
      color: color ? String(color) : "#6366f1",
      gradient: gradient ? String(gradient) : `linear-gradient(135deg,${color ?? "#4f46e5"},${color ?? "#6366f1"})`,
      examTypes: Array.isArray(examTypes) ? JSON.stringify(examTypes) : "[]",
    })
    .returning();
  res.status(201).json(row);
});

router.put("/admin/subjects/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, icon, color, gradient, isActive, examTypes } = req.body;
  const updateData: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updateData.name = name.trim();
  if (icon !== undefined) updateData.icon = icon;
  if (color !== undefined) updateData.color = color;
  if (gradient !== undefined) updateData.gradient = gradient;
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);
  if (Array.isArray(examTypes)) updateData.examTypes = JSON.stringify(examTypes);
  const [updated] = await db.update(subjectsTable).set(updateData).where(eq(subjectsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/subjects/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(subjectsTable).where(eq(subjectsTable.id, id));
  res.json({ success: true });
});

// ─── MCQ Chunked Extraction Utilities ────────────────────────────────────────

function chunkMcqText(rawText: string, chunkSize = 35): string[] {
  const normalized = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/(\S)(\s*\n?\s*)(\d{1,3}\.\s)/g, "$1\n\n$3")
    .trim();

  // Try multiple common numbering patterns
  let questions = normalized
    .split(/(?=^(?:Q\d{1,4}[:.)]|Question\s*\d{1,4}[:.)]|\d{1,4}[.)]\s))/mi)
    .map((q) => q.trim())
    .filter((q) => q.length > 25);

  // Fallback if no numbered questions detected
  if (questions.length <= 1) {
    const paragraphs = normalized.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
    if (paragraphs.length > 5) {
      questions = paragraphs;
    } else {
      const chunks: string[] = [];
      const CHUNK_LEN = 12000;
      for (let i = 0; i < normalized.length; i += CHUNK_LEN) {
        chunks.push(normalized.slice(i, i + CHUNK_LEN));
      }
      return chunks.length > 0 ? chunks : [rawText];
    }
  }

  const chunks: string[] = [];
  for (let i = 0; i < questions.length; i += chunkSize) {
    chunks.push(questions.slice(i, i + chunkSize).join("\n\n"));
  }
  return chunks;
}

function cleanAndParseJson(raw: string): unknown[] {
  let cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found in Gemini response");
  cleaned = match[0];

  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    let openBraces = 0, openBrackets = 0, inString = false;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (ch === '"' && cleaned[i - 1] !== "\\") inString = !inString;
      if (inString) continue;
      if (ch === "{") openBraces++;
      if (ch === "}") openBraces--;
      if (ch === "[") openBrackets++;
      if (ch === "]") openBrackets--;
    }
    let repaired = cleaned.replace(/,\s*$/, "");
    repaired += "}".repeat(Math.max(0, openBraces));
    repaired += "]".repeat(Math.max(0, openBrackets));
    return JSON.parse(repaired);
  }
}

function buildExtractPrompt(chunk: string, customInstructions?: string): string {
  return `You are an expert exam paper digitizer. Extract every pre-existing multiple-choice question from the text below and return them as a JSON array.

CRITICAL INSTRUCTIONS:
- IGNORE AND STRIP all document titles, chapter names, institute names, dates, teacher names, instructions, and page numbers.
- Extract the questions and options accurately as written in the source document.
- Determine the correct answer ("A", "B", "C", or "D"). If indicated in the text (e.g. "Ans: B" or bolded), use that; otherwise deduce the correct answer accurately.
- Provide a concise 1-2 sentence explanation in "Briefing" explaining why the correct answer is right.
- Infer a concise 1-3 word "Topic" tag in Title Case from the context.

Each object must have these exact keys:
- "Question": full question text without leading numbers (string)
- "Option_A": text for option A without letter prefix (string)
- "Option_B": text for option B without letter prefix (string)
- "Option_C": text for option C without letter prefix (string)
- "Option_D": text for option D without letter prefix (string)
- "Correct_Answer": exactly "A", "B", "C", or "D" (string)
- "Briefing": explanation (string)
- "Topic": topic tag (string)

${customInstructions ? `Additional User Instructions: ${customInstructions}\n` : ""}Return ONLY the raw JSON array. No markdown, no code blocks, no other text. Do not output anything before "[" or after "]".

Document Text:
---
${chunk}
---`;
}

function buildGeneratePrompt(content: string, targetCount: number, difficulty = "balanced", customInstructions?: string): string {
  const diffDesc = difficulty === "hard"
    ? "advanced, conceptual, and scenario-based questions"
    : difficulty === "easy"
    ? "direct factual and definition-based questions"
    : "a balanced mix of direct factual and conceptual questions";

  return `You are a university professor and exam creator. Read the study notes / educational material below and generate EXACTLY ${targetCount} high-quality Multiple Choice Questions (MCQs) to test student mastery of these concepts.

CRITICAL INSTRUCTIONS:
- Generate brand new questions based directly on the provided study notes.
- Each question must have 4 distinct, plausible options (A, B, C, D) with only one unambiguously correct answer.
- Focus on key definitions, core principles, components, and applications.
- Difficulty target: ${diffDesc}.
- Provide a concise 1-2 sentence explanation in "Briefing" citing why the answer is correct based on the text.
- Infer a concise 1-3 word "Topic" tag in Title Case for each question.

Each object must have these exact keys:
- "Question": full question text (string)
- "Option_A": text for option A (string)
- "Option_B": text for option B (string)
- "Option_C": text for option C (string)
- "Option_D": text for option D (string)
- "Correct_Answer": exactly "A", "B", "C", or "D" (string)
- "Briefing": explanation (string)
- "Topic": topic tag (string)

${customInstructions ? `Additional User Instructions: ${customInstructions}\n` : ""}Return ONLY the raw JSON array. No markdown, no code blocks, no other text. Do not output anything before "[" or after "]".

Study Material:
---
${content}
---`;
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Phase 2: AI Ingestion Engine ────────────────────────────────────────

router.post("/admin/parse", adminMiddleware, async (req, res): Promise<void> => {
  const {
    rawText,
    customInstructions,
    sem,
    subject,
    examType,
    mode = "extract",
    generateCount = 20,
    generateDifficulty = "balanced",
  } = req.body;

  if (!rawText || typeof rawText !== "string" || rawText.trim().length < 10) {
    res.status(400).json({ error: "rawText is required" });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    return;
  }

  // Helper to query Gemini with retry
  async function callGemini(promptText: string, index = 0): Promise<{ questions: unknown[]; error?: string }> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
            }),
          }
        );

        if (!geminiRes.ok) {
          const status = geminiRes.status;
          const errText = await geminiRes.text();
          if (attempt < 3 && (status === 429 || status >= 500)) {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
            continue;
          }
          return { questions: [], error: `HTTP ${status}: ${errText.slice(0, 200)}` };
        }

        const geminiData = await geminiRes.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const rawJson = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (!rawJson) return { questions: [], error: "Empty response from Gemini" };

        const parsed = cleanAndParseJson(rawJson);
        return { questions: parsed };
      } catch (err: any) {
        req.log.warn({ index, attempt, err }, "Gemini attempt failed");
        if (attempt === 3) return { questions: [], error: String(err?.message ?? err) };
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    return { questions: [], error: "Max retries exceeded" };
  }

  const allQuestions: unknown[] = [];
  let chunksProcessed = 0;
  let failedChunks = 0;
  const errors: string[] = [];

  if (mode === "generate") {
    // GENERATE MODE: Synthesizes brand new MCQs from notes
    const targetTotal = Math.max(1, Math.min(100, Number(generateCount) || 20));
    // If target <= 30 questions, 1 single prompt is fastest and highest quality
    if (targetTotal <= 30) {
      chunksProcessed = 1;
      const prompt = buildGeneratePrompt(rawText.slice(0, 35000), targetTotal, generateDifficulty, customInstructions);
      const res = await callGemini(prompt, 0);
      if (res.questions.length > 0) {
        allQuestions.push(...res.questions);
      } else {
        failedChunks++;
        if (res.error) errors.push(res.error);
      }
    } else {
      // Split into 2 batches
      const half = Math.ceil(targetTotal / 2);
      const otherHalf = targetTotal - half;
      chunksProcessed = 2;
      const prompt1 = buildGeneratePrompt(rawText.slice(0, 25000), half, generateDifficulty, customInstructions);
      const res1 = await callGemini(prompt1, 0);
      if (res1.questions.length > 0) allQuestions.push(...res1.questions);
      else { failedChunks++; if (res1.error) errors.push(res1.error); }

      await new Promise((r) => setTimeout(r, 1000));

      const prompt2 = buildGeneratePrompt(rawText.slice(25000, 50000) || rawText.slice(0, 25000), otherHalf, generateDifficulty, customInstructions);
      const res2 = await callGemini(prompt2, 1);
      if (res2.questions.length > 0) allQuestions.push(...res2.questions);
      else { failedChunks++; if (res2.error) errors.push(res2.error); }
    }
  } else {
    // EXTRACT MODE: Extracts pre-existing MCQs from document sheets
    const chunks = chunkMcqText(rawText, 35);
    chunksProcessed = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000));
      const prompt = buildExtractPrompt(chunks[i], customInstructions);
      const res = await callGemini(prompt, i);
      if (res.questions.length > 0) {
        allQuestions.push(...res.questions);
      } else {
        failedChunks++;
        if (res.error) errors.push(res.error);
      }
    }
  }

  // Deduplicate by question text
  const seen = new Set<string>();
  const questions = allQuestions.filter((q: any) => {
    const key = String(q?.Question ?? "").slice(0, 80).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.json({
    questions,
    sem,
    subject,
    examType,
    total: questions.length,
    chunksProcessed,
    chunksFailed: failedChunks,
    geminiErrors: errors.length > 0 ? errors : undefined,
  });
});

// File text extraction
router.post("/admin/extract-file", adminMiddleware, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const { originalname, buffer, mimetype } = req.file;
  let text = "";

  try {
    if (mimetype === "application/pdf" || originalname.toLowerCase().endsWith(".pdf")) {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default;
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      originalname.toLowerCase().endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await (mammoth as unknown as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> }).extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString("utf-8");
    }
    res.json({ text, filename: originalname, charCount: text.length });
  } catch (err) {
    req.log.error({ err }, "File extraction error");
    res.status(500).json({ error: "Failed to extract text from file" });
  }
});

// ─── Phase 3: Questions CRUD ──────────────────────────────────────────────

router.get("/admin/questions", adminMiddleware, async (req, res): Promise<void> => {
  const { q, sem, subject, examType, topic, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (q) conditions.push(ilike(questionsTable.question, `%${q}%`));
  if (sem) conditions.push(eq(questionsTable.sem, parseInt(sem)));
  if (subject) conditions.push(eq(questionsTable.subject, subject));
  if (examType) conditions.push(eq(questionsTable.examType, examType));
  if (topic) conditions.push(ilike(questionsTable.topic, `%${topic}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(questionsTable).where(where).orderBy(desc(questionsTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ total: count() }).from(questionsTable).where(where),
  ]);

  res.json({ questions: rows, total, page: pageNum, limit: limitNum });
});

router.post("/admin/questions/batch", adminMiddleware, async (req, res): Promise<void> => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "questions array required" });
    return;
  }

  const values = questions.map((q: Record<string, unknown>) => ({
    question: String(q.Question ?? q.question ?? ""),
    optionA: String(q.Option_A ?? q.optionA ?? ""),
    optionB: String(q.Option_B ?? q.optionB ?? ""),
    optionC: String(q.Option_C ?? q.optionC ?? ""),
    optionD: String(q.Option_D ?? q.optionD ?? ""),
    correctAnswer: String(q.Correct_Answer ?? q.correctAnswer ?? "A"),
    briefing: String(q.Briefing ?? q.briefing ?? "") || null,
    topic: String(q.Topic ?? q.topic ?? "") || null,
    sem: Number(q.sem ?? 1),
    subject: String(q.subject ?? ""),
    examType: String(q.examType ?? "Midterm"),
  }));

  const inserted = await db.insert(questionsTable).values(values).returning();

  // Auto-upsert subjects + update examTypes
  const pairs = new Map<string, { sem: number; name: string; examType: string }>();
  for (const v of values) {
    const key = `${v.sem}::${v.subject}`;
    if (v.subject) pairs.set(key, { sem: v.sem, name: v.subject, examType: v.examType });
  }
  for (const { sem, name, examType } of pairs.values()) {
    await db.insert(subjectsTable)
      .values({ sem, name, icon: "📚", color: "#6366f1", gradient: "linear-gradient(135deg,#4f46e5,#6366f1)", examTypes: JSON.stringify([examType]) })
      .onConflictDoNothing();
    const [existing] = await db.select().from(subjectsTable).where(and(eq(subjectsTable.sem, sem), eq(subjectsTable.name, name)));
    if (existing) {
      let ets: string[] = [];
      try { ets = JSON.parse(existing.examTypes); } catch (_e) { ets = []; }
      if (!ets.includes(examType)) {
        ets.push(examType);
        await db.update(subjectsTable).set({ examTypes: JSON.stringify(ets) }).where(eq(subjectsTable.id, existing.id));
      }
    }
    const ordinals = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"];
    const semLabel = `${ordinals[sem - 1] ?? sem + "th"} Semester`;
    await db.insert(semestersTable).values({ num: sem, label: semLabel, sortOrder: sem }).onConflictDoNothing();
  }

  res.status(201).json({ inserted: inserted.length });
});

router.put("/admin/questions/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { question, optionA, optionB, optionC, optionD, correctAnswer, briefing, topic, sem, subject, examType } = req.body;
  const [updated] = await db
    .update(questionsTable)
    .set({ question, optionA, optionB, optionC, optionD, correctAnswer, briefing, topic, sem, subject, examType })
    .where(eq(questionsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/questions/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(questionsTable).where(eq(questionsTable.id, id));
  res.json({ success: true });
});

// ─── Phase 4: Audit Logs ──────────────────────────────────────────────────

router.get("/admin/audit/users", adminMiddleware, async (req, res): Promise<void> => {
  const stats = await db
    .select({
      userId: quizReportsTable.userName,
      attempts: count(),
      lastAttempt: max(quizReportsTable.createdAt),
      totalCorrect: sum(quizReportsTable.correct),
      totalQuestions: sum(quizReportsTable.total),
    })
    .from(quizReportsTable)
    .groupBy(quizReportsTable.userName)
    .orderBy(desc(count()));

  const userIds = stats.map((s) => s.userId);
  const profiles = userIds.length > 0
    ? await db.select({ userId: profilesTable.userId, displayName: profilesTable.displayName, rollNumber: profilesTable.rollNumber, isGuest: profilesTable.isGuest })
        .from(profilesTable).where(inArray(profilesTable.userId, userIds))
    : [];

  const profileMap = Object.fromEntries(profiles.map((p) => [p.userId, p]));
  res.json(stats.map((s) => ({
    userId: s.userId,
    displayName: profileMap[s.userId]?.displayName ?? s.userId,
    rollNumber: profileMap[s.userId]?.rollNumber ?? null,
    isGuest: profileMap[s.userId]?.isGuest ?? false,
    attempts: Number(s.attempts),
    lastAttempt: s.lastAttempt?.toISOString() ?? null,
    totalCorrect: Number(s.totalCorrect ?? 0),
    totalQuestions: Number(s.totalQuestions ?? 0),
  })));
});

router.get("/admin/audit/attempts/:userId", adminMiddleware, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const rows = await db.select().from(quizReportsTable)
    .where(eq(quizReportsTable.userName, userId)).orderBy(desc(quizReportsTable.createdAt));
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.get("/admin/audit/attempt/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(quizReportsTable).where(eq(quizReportsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  let answers: unknown[] = [];
  try { answers = JSON.parse(row.answersJson); } catch (_e) { answers = []; }
  res.json({ ...row, createdAt: row.createdAt.toISOString(), answers });
});

router.delete("/admin/audit/attempt/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(quizReportsTable).where(eq(quizReportsTable.id, id));
  res.json({ success: true });
});

// ─── Phase 5: Flags Moderation ───────────────────────────────────────────

router.get("/admin/flags", adminMiddleware, async (req, res): Promise<void> => {
  const rows = await db.select().from(questionFlagsTable).orderBy(desc(questionFlagsTable.createdAt));

  const enriched = await Promise.all(rows.map(async (flag) => {
    let sem: number | null = null;
    let subject: string | null = null;
    let examType: string | null = null;
    const numericId = parseInt(flag.questionId);
    if (!isNaN(numericId)) {
      const [q] = await db.select({ sem: questionsTable.sem, subject: questionsTable.subject, examType: questionsTable.examType })
        .from(questionsTable).where(eq(questionsTable.id, numericId));
      if (q) { sem = q.sem; subject = q.subject; examType = q.examType; }
    }
    return { ...flag, createdAt: flag.createdAt.toISOString(), sem, subject, examType };
  }));

  res.json(enriched);
});

router.patch("/admin/flags/:id/dismiss", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(questionFlagsTable).where(eq(questionFlagsTable.id, id));
  res.json({ success: true });
});

router.delete("/admin/flags/:id/purge", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [flag] = await db.select().from(questionFlagsTable).where(eq(questionFlagsTable.id, id));
  if (!flag) { res.status(404).json({ error: "Not found" }); return; }
  const numericId = parseInt(flag.questionId);
  if (!isNaN(numericId)) {
    await db.delete(questionsTable).where(eq(questionsTable.id, numericId));
    await db.delete(questionFlagsTable).where(eq(questionFlagsTable.questionId, flag.questionId));
  } else {
    await db.delete(questionFlagsTable).where(eq(questionFlagsTable.id, id));
  }
  res.json({ success: true });
});

// ─── Feedbacks ────────────────────────────────────────────────────────────

router.get("/admin/feedbacks", adminMiddleware, async (_req, res): Promise<void> => {
  const rows = await db.select().from(feedbacksTable).orderBy(desc(feedbacksTable.createdAt));
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.delete("/admin/feedbacks/:id", adminMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(feedbacksTable).where(eq(feedbacksTable.id, id));
  res.json({ success: true });
});

// ─── Phase 6: System Settings ────────────────────────────────────────────

router.get("/admin/settings", adminMiddleware, async (req, res): Promise<void> => {
  const rows = await db.select().from(systemConfigsTable);
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

router.post("/admin/settings", adminMiddleware, async (req, res): Promise<void> => {
  const { key, value } = req.body;
  if (!key || value === undefined) { res.status(400).json({ error: "key and value required" }); return; }
  await db.insert(systemConfigsTable).values({ key: String(key), value: String(value) })
    .onConflictDoUpdate({ target: systemConfigsTable.key, set: { value: String(value) } });
  res.json({ success: true });
});

router.post("/admin/settings/batch", adminMiddleware, async (req, res): Promise<void> => {
  const { settings } = req.body;
  if (!settings || typeof settings !== "object") { res.status(400).json({ error: "settings object required" }); return; }
  const entries = Object.entries(settings as Record<string, string>);
  for (const [key, value] of entries) {
    await db.insert(systemConfigsTable).values({ key, value: String(value) })
      .onConflictDoUpdate({ target: systemConfigsTable.key, set: { value: String(value) } });
  }
  res.json({ success: true, updated: entries.length });
});

export default router;