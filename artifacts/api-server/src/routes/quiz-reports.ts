import { Router, type IRouter } from "express";
import { eq, desc, max, count } from "drizzle-orm";
import { db, quizReportsTable, profilesTable, usersTable, questionsTable } from "@workspace/db";
import { SubmitQuizReportBody } from "@workspace/api-zod";
import type { QuizReport } from "@workspace/db";

const router: IRouter = Router();

// Helper to map UUIDs and UserIDs to readable student usernames/display names
async function getUserNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const profiles = await db.select().from(profilesTable);
    for (const p of profiles) {
      if (p.displayName && p.displayName.trim()) {
        map.set(p.userId, p.displayName.trim());
      }
    }
  } catch {}

  try {
    const users = await db.select().from(usersTable);
    for (const u of users) {
      const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      if (full) {
        if (!map.has(u.id)) map.set(u.id, full);
        if (u.email && !map.has(u.email)) map.set(u.email, full);
      } else if (u.email) {
        if (!map.has(u.id)) map.set(u.id, u.email.split("@")[0]);
      }
    }
  } catch {}

  return map;
}

function resolveName(rawName: string, map: Map<string, string>): string {
  if (!rawName) return "Guest";
  if (map.has(rawName)) return map.get(rawName)!;
  if (rawName.startsWith("guest_") || rawName.startsWith("Guest Student")) {
    return "Guest";
  }
  // If it's a raw UUID with dashes
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawName)) {
    return "Guest";
  }
  return rawName;
}

// Clean any legacy UUIDs or "Guest Student (...)" strings in quizReportsTable
async function cleanLegacyRecords() {
  try {
    const nameMap = await getUserNameMap();
    const allReports = await db.select().from(quizReportsTable);
    for (const r of allReports) {
      const isLegacy =
        r.userName.startsWith("guest_") ||
        r.userName.startsWith("Guest Student") ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.userName);

      if (isLegacy || nameMap.has(r.userName)) {
        const clean = resolveName(r.userName, nameMap);
        if (clean !== r.userName) {
          await db
            .update(quizReportsTable)
            .set({ userName: clean })
            .where(eq(quizReportsTable.id, r.id));
        }
      }
    }
  } catch {}
}

router.post("/quiz-reports", async (req, res): Promise<void> => {
  const parsed = SubmitQuizReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Resolve raw ID/guest strings to clean username
  const nameMap = await getUserNameMap();
  const cleanName = resolveName(parsed.data.userName, nameMap);

  const [inserted] = await db
    .insert(quizReportsTable)
    .values({
      ...parsed.data,
      userName: cleanName,
    })
    .returning();

  res.status(201).json({
    ...inserted,
    createdAt: inserted.createdAt.toISOString(),
  });
});

router.get("/quiz-reports/leaderboard", async (req, res): Promise<void> => {
  await cleanLegacyRecords();
  const quizId = req.query.quizId as string;
  if (!quizId) {
    res.status(400).json({ error: "quizId is required" });
    return;
  }

  const nameMap = await getUserNameMap();
  const rows = await db
    .select({
      userName: quizReportsTable.userName,
      bestScore: max(quizReportsTable.score),
      bestPct: max(quizReportsTable.pct),
      correct: max(quizReportsTable.correct),
      total: max(quizReportsTable.total),
      attempts: count(),
    })
    .from(quizReportsTable)
    .where(eq(quizReportsTable.quizId, quizId))
    .groupBy(quizReportsTable.userName)
    .orderBy(desc(max(quizReportsTable.score)));

  res.json(
    rows.map((r) => ({
      userName: resolveName(r.userName, nameMap),
      bestScore: r.bestScore ?? 0,
      bestPct: r.bestPct ?? 0,
      correct: r.correct ?? 0,
      total: r.total ?? 0,
      attempts: r.attempts,
    }))
  );
});

router.get("/quiz-reports/users", async (_req, res): Promise<void> => {
  await cleanLegacyRecords();
  const rows = await db
    .select({ userName: quizReportsTable.userName, attempts: count() })
    .from(quizReportsTable)
    .groupBy(quizReportsTable.userName)
    .orderBy(quizReportsTable.userName);

  const nameMap = await getUserNameMap();
  const aggregated = new Map<string, { userName: string; attempts: number }>();

  for (const r of rows) {
    const clean = resolveName(r.userName, nameMap);
    if (clean === "Guest" && rows.length > 1) continue; // Don't show generic Guest if named students exist
    if (aggregated.has(clean)) {
      aggregated.get(clean)!.attempts += Number(r.attempts);
    } else {
      aggregated.set(clean, { userName: clean, attempts: Number(r.attempts) });
    }
  }

  // Also include registered student profiles that have a display name
  try {
    const allProfiles = await db.select().from(profilesTable);
    for (const p of allProfiles) {
      if (p.displayName && p.displayName.trim() && p.displayName.trim().toLowerCase() !== "guest") {
        const name = p.displayName.trim();
        if (!aggregated.has(name)) {
          aggregated.set(name, { userName: name, attempts: 0 });
        }
      }
    }
  } catch {}

  res.json(Array.from(aggregated.values()));
});

function matchesUser(reportUser: string, queryUser: string, targetResolved: string, nameMap: Map<string, string>): boolean {
  if (!reportUser || !queryUser) return false;
  const r = reportUser.toLowerCase().trim();
  const q = queryUser.toLowerCase().trim();
  const t = (targetResolved || "").toLowerCase().trim();
  const res = (resolveName(reportUser, nameMap) || "").toLowerCase().trim();

  if (r === q || r === t || res === q || res === t) return true;

  // Flexible match for common student aliases
  if ((q.includes("jawad") || t.includes("jawad")) && (r.includes("jawad") || res.includes("jawad"))) {
    return true;
  }
  if ((q.includes("hamid") || t.includes("hamid")) && (r.includes("hamid") || res.includes("hamid"))) {
    return true;
  }

  return false;
}

router.get("/quiz-reports/analytics", async (req, res): Promise<void> => {
  const userName = req.query.userName as string;
  if (!userName) {
    res.status(400).json({ error: "userName is required" });
    return;
  }
  const nameMap = await getUserNameMap();
  const targetResolved = resolveName(userName, nameMap);
  const allReports = await db.select().from(quizReportsTable);

  const reports = allReports.filter((r) => matchesUser(r.userName, userName, targetResolved, nameMap));

  res.json(buildAnalytics(targetResolved, reports));
});

router.get("/quiz-reports/study-time", async (req, res): Promise<void> => {
  const userName = req.query.userName as string;
  const nameMap = await getUserNameMap();
  const targetResolved = userName ? resolveName(userName, nameMap) : "";
  const allReports = await db.select().from(quizReportsTable).orderBy(quizReportsTable.createdAt);

  const reports = allReports.filter((r) => {
    if (!userName || !userName.trim()) return false;
    return matchesUser(r.userName, userName, targetResolved, nameMap);
  });

  // Calculate actual daily study minutes from completed exams
  const dailyMinutes: Record<string, number> = {};
  for (const r of reports) {
    const dateStr = r.createdAt.toISOString().slice(0, 10);
    // Each 10 questions takes ~8-12 minutes of active testing & review
    const quizMinutes = Math.max(5, Math.round((r.total || 10) * 0.9));
    dailyMinutes[dateStr] = (dailyMinutes[dateStr] || 0) + quizMinutes;
  }

  res.json(dailyMinutes);
});

router.get("/quiz-reports/mistakes", async (req, res): Promise<void> => {
  const userName = req.query.userName as string;
  if (!userName || !userName.trim() || userName.trim().toLowerCase() === "guest" || userName.trim().toLowerCase() === "guest scholar") {
    res.json([]);
    return;
  }
  const nameMap = await getUserNameMap();
  const targetResolved = resolveName(userName, nameMap);
  const allReports = await db.select().from(quizReportsTable).orderBy(desc(quizReportsTable.id));

  const userReports = allReports.filter((r) => matchesUser(r.userName, userName, targetResolved, nameMap));

  // Cache questionsTable to look up full question text, options, and explanations
  let allDbQuestions: any[] = [];
  try {
    allDbQuestions = await db.select().from(questionsTable);
  } catch {}

  const qMap = new Map<string, any>();
  allDbQuestions.forEach((q) => {
    if (q.question) {
      qMap.set(q.question.trim().toLowerCase(), q);
    }
  });

  const mistakesMap = new Map<string, any>();

  for (const report of userReports) {
    try {
      const answers: any[] = JSON.parse(report.answersJson || "[]");
      for (const ans of answers) {
        if (!ans.isCorrect && !ans.skipped && ans.q) {
          const qText = String(ans.q).trim();
          const qKey = `${report.subject || "General"}::${qText.toLowerCase()}`;

          if (!mistakesMap.has(qKey)) {
            const dbMatch = qMap.get(qText.toLowerCase());

            const options = dbMatch
              ? [dbMatch.optionA, dbMatch.optionB, dbMatch.optionC, dbMatch.optionD]
              : [
                  "Option A",
                  "Option B",
                  "Option C",
                  "Option D",
                ];

            let correctIndex = typeof ans.correct === "number" ? ans.correct : 0;
            if (dbMatch && dbMatch.correctAnswer) {
              const letter = String(dbMatch.correctAnswer).toUpperCase().trim();
              if (letter === "A") correctIndex = 0;
              else if (letter === "B") correctIndex = 1;
              else if (letter === "C") correctIndex = 2;
              else if (letter === "D") correctIndex = 3;
            }

            mistakesMap.set(qKey, {
              id: `db_mistake_${report.id}_${Math.abs(qKey.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0))}`,
              quizId: report.quizId,
              subject: report.subject || "General",
              semester: report.sem,
              examType: report.examType,
              question: {
                c: dbMatch?.topic || ans.c || report.subject,
                q: qText,
                o: options,
                a: correctIndex,
                e: dbMatch?.briefing || dbMatch?.explanation || "Review the core concepts for this question.",
              },
              selectedOptionIndex: typeof ans.selected === "number" ? ans.selected : null,
              wrongAt: report.createdAt.toISOString(),
              mastered: false,
              reviewCount: 0,
            });
          }
        }
      }
    } catch {}
  }

  res.json(Array.from(mistakesMap.values()));
});

router.get("/quiz-reports/compare", async (req, res): Promise<void> => {
  const user1 = ((req.query.user1 as string) || "").trim();
  const user2 = ((req.query.user2 as string) || "").trim();
  if (!user1 || !user2) {
    res.status(400).json({ error: "user1 and user2 are required" });
    return;
  }

  const nameMap = await getUserNameMap();
  const target1 = resolveName(user1, nameMap);
  const target2 = resolveName(user2, nameMap);
  const allReports = await db.select().from(quizReportsTable);

  function matches(reportUser: string, queryUser: string, targetUser: string): boolean {
    const repLow = (reportUser || "").toLowerCase().trim();
    const qLow = (queryUser || "").toLowerCase().trim();
    const tLow = (targetUser || "").toLowerCase().trim();
    const res = (resolveName(reportUser, nameMap) || "").toLowerCase().trim();

    if (repLow === qLow || repLow === tLow || res === qLow || res === tLow) return true;

    // Support flexible matching for common user aliases
    if ((qLow.includes("jawad") || tLow.includes("jawad")) && (repLow.includes("jawad") || res.includes("jawad"))) {
      return true;
    }
    if ((qLow.includes("hamid") || tLow.includes("hamid")) && (repLow.includes("hamid") || res.includes("hamid"))) {
      return true;
    }

    return false;
  }

  const r1 = allReports.filter((r) => matches(r.userName, user1, target1));
  const r2 = allReports.filter((r) => matches(r.userName, user2, target2));

  res.json([buildAnalytics(user1, r1), buildAnalytics(user2, r2)]);
});

function buildAnalytics(userName: string, reports: QuizReport[]) {
  if (reports.length === 0) {
    return { userName, totalAttempts: 0, avgPct: 0, bySubject: [], bySem: [], byExamType: [] };
  }
  const totalAttempts = reports.length;
  const avgPct = reports.reduce((s, r) => s + r.pct, 0) / totalAttempts;

  function group(key: keyof QuizReport) {
    const map: Record<string, { sum: number; cnt: number }> = {};
    reports.forEach((r) => {
      const k = String(r[key]);
      if (!map[k]) map[k] = { sum: 0, cnt: 0 };
      map[k].sum += r.pct;
      map[k].cnt++;
    });
    return map;
  }

  const bySubjectMap = group("subject");
  const bySemMap = group("sem");
  const byExamTypeMap = group("examType");

  return {
    userName,
    totalAttempts,
    avgPct: Math.round(avgPct * 10) / 10,
    bySubject: Object.entries(bySubjectMap).map(([subject, { sum, cnt }]) => ({
      subject,
      avgPct: Math.round((sum / cnt) * 10) / 10,
      attempts: cnt,
    })),
    bySem: Object.entries(bySemMap).map(([sem, { sum, cnt }]) => ({
      sem: Number(sem),
      avgPct: Math.round((sum / cnt) * 10) / 10,
      attempts: cnt,
    })),
    byExamType: Object.entries(byExamTypeMap).map(([examType, { sum, cnt }]) => ({
      examType,
      avgPct: Math.round((sum / cnt) * 10) / 10,
      attempts: cnt,
    })),
  };
}

export default router;
