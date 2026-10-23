import { Router, type IRouter } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import { db, subjectsTable, questionsTable, semestersTable, systemConfigsTable } from "@workspace/db";
import { autoGenerateMissingBriefings } from "../lib/explanationService";

const router: IRouter = Router();

// Public — list active semesters
router.get("/semesters", async (_req, res): Promise<void> => {
  const rows = await db.select().from(semestersTable)
    .where(eq(semestersTable.isActive, true))
    .orderBy(asc(semestersTable.num));
  res.json(rows);
});

// Public — list active subjects (optionally filtered by sem)
router.get("/subjects", async (req, res): Promise<void> => {
  const sem = req.query.sem ? parseInt(req.query.sem as string) : undefined;

  const rows = await db
    .select()
    .from(subjectsTable)
    .where(
      sem
        ? and(eq(subjectsTable.isActive, true), eq(subjectsTable.sem, sem))
        : eq(subjectsTable.isActive, true),
    )
    .orderBy(asc(subjectsTable.sem), asc(subjectsTable.name));

  const result = await Promise.all(
    rows.map(async (s) => {
      // Merge explicitly set examTypes + those derived from questions
      let explicitTypes: string[] = [];
      try { explicitTypes = JSON.parse(s.examTypes); } catch { explicitTypes = []; }

      const examCounts = await db
        .select({
          examType: questionsTable.examType,
          count: sql<number>`count(*)::int`,
        })
        .from(questionsTable)
        .where(and(eq(questionsTable.sem, s.sem), eq(questionsTable.subject, s.name)))
        .groupBy(questionsTable.examType);

      const countsMap: Record<string, number> = {};
      const derivedTypes: string[] = [];
      for (const row of examCounts) {
        countsMap[row.examType.toLowerCase()] = Number(row.count);
        derivedTypes.push(row.examType);
      }

      const merged = Array.from(new Set([...explicitTypes, ...derivedTypes]));
      return { ...s, examTypes: merged, questionCounts: countsMap };
    }),
  );

  res.json(result);
});

// Public quiz-questions endpoint — serves questions from DB for student quiz play
router.get("/quiz-questions/:quizId", async (req, res): Promise<void> => {
  const { quizId } = req.params;
  if (!quizId.startsWith("db-")) {
    res.status(404).json({ error: "Not a DB quiz" });
    return;
  }

  // Format: db-{subjectId}-{examType}  e.g. db-3-midterm
  const withoutPrefix = quizId.slice(3);
  const dashIdx = withoutPrefix.indexOf("-");
  if (dashIdx === -1) {
    res.status(400).json({ error: "Invalid quiz ID format" });
    return;
  }

  const subjectId = parseInt(withoutPrefix.substring(0, dashIdx));
  const examTypeRaw = withoutPrefix.substring(dashIdx + 1);

  if (isNaN(subjectId)) {
    res.status(400).json({ error: "Invalid subject ID" });
    return;
  }

  const [subject] = await db
    .select()
    .from(subjectsTable)
    .where(eq(subjectsTable.id, subjectId));

  if (!subject) {
    res.status(404).json({ error: "Subject not found" });
    return;
  }

  const questions = await db
    .select()
    .from(questionsTable)
    .where(
      and(
        eq(questionsTable.sem, subject.sem),
        eq(questionsTable.subject, subject.name),
        eq(questionsTable.examType, examTypeRaw.charAt(0).toUpperCase() + examTypeRaw.slice(1)),
      ),
    );

  // Background heal: if any questions are missing explanations, generate them automatically
  if (questions.some((q) => !q.briefing || !q.briefing.trim())) {
    autoGenerateMissingBriefings(15).catch(() => null);
  }

  res.json({
    meta: {
      quizId,
      sem: subject.sem,
      subject: subject.name,
      examType: examTypeRaw,
      subjectName: subject.name,
      examLabel: examTypeRaw.charAt(0).toUpperCase() + examTypeRaw.slice(1) + " Exam",
      icon: subject.icon,
    },
    questions: questions.map((q) => ({
      c: q.topic ?? q.subject,
      q: q.question,
      o: [q.optionA, q.optionB, q.optionC, q.optionD],
      a: ["A", "B", "C", "D"].indexOf(q.correctAnswer),
      e: q.briefing ?? "",
    })),
  });
});

// Public — quiz config settings (timers, default count, branding, maintenance)
router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(systemConfigsTable);
  const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    easyTime: parseInt(cfg["mcq.easyTime"] ?? "30"),
    mediumTime: parseInt(cfg["mcq.mediumTime"] ?? "15"),
    hardTime: parseInt(cfg["mcq.hardTime"] ?? "10"),
    defaultCount: parseInt(cfg["mcq.defaultCount"] ?? "40"),
    headerTitle: cfg["brand.headerTitle"] || "Quizzy",
    slogan: cfg["brand.slogan"] || "Your Own Learning Management System",
    footerLink: cfg["brand.footerLink"] || "",
    maintenanceEnabled: cfg["maintenance.enabled"] === "true",
  });
});

export default router;
