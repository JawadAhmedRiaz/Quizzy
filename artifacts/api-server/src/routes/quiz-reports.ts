import { Router, type IRouter } from "express";
import { eq, desc, max, count } from "drizzle-orm";
import { db, quizReportsTable, profilesTable, usersTable, questionsTable } from "@workspace/db";
import { SubmitQuizReportBody } from "@workspace/api-zod";
import type { QuizReport } from "@workspace/db";

const router: IRouter = Router();

// Helper to map and cluster all user identities dynamically
async function getUserIdentities() {
  const users = await db.select().from(usersTable).catch(() => []);
  const profiles = await db.select().from(profilesTable).catch(() => []);

  const nameMap = new Map<string, string>();
  const identities: { canonicalName: string; aliases: Set<string> }[] = [];

  const userById = new Map<string, typeof users[0]>();
  for (const u of users) {
    userById.set(u.id, u);
  }

  const profileByUserId = new Map<string, typeof profiles[0]>();
  for (const p of profiles) {
    profileByUserId.set(p.userId, p);
    if (p.displayName && p.displayName.trim()) {
      nameMap.set(p.userId, p.displayName.trim());
    }
  }

  for (const u of users) {
    const prof = profileByUserId.get(u.id);
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    const canonicalName = prof?.displayName?.trim() || fullName || (u.email ? u.email.split("@")[0] : "Student");

    const aliases = new Set<string>();
    aliases.add(u.id.toLowerCase());
    if (u.email) {
      aliases.add(u.email.toLowerCase());
      aliases.add(u.email.split("@")[0].toLowerCase());
    }
    if (fullName) {
      aliases.add(fullName.toLowerCase());
    }
    if (prof?.displayName && prof.displayName.trim()) {
      aliases.add(prof.displayName.trim().toLowerCase());
    }
    if (canonicalName) {
      aliases.add(canonicalName.toLowerCase());
    }

    identities.push({
      canonicalName,
      aliases,
    });

    nameMap.set(u.id, canonicalName);
    if (u.email) nameMap.set(u.email, canonicalName);
    if (fullName) nameMap.set(fullName, canonicalName);
  }

  // Also handle profiles that might not have a usersTable row (e.g. guests who set their profile name)
  for (const p of profiles) {
    if (!userById.has(p.userId) && p.displayName && p.displayName.trim()) {
      const canonicalName = p.displayName.trim();
      const aliases = new Set<string>();
      aliases.add(p.userId.toLowerCase());
      aliases.add(canonicalName.toLowerCase());
      identities.push({ canonicalName, aliases });
      nameMap.set(p.userId, canonicalName);
    }
  }

  function resolveToCanonical(rawName: string): string {
    if (!rawName) return "Guest";
    const trimmed = rawName.trim();
    if (nameMap.has(trimmed)) return nameMap.get(trimmed)!;
    const lower = trimmed.toLowerCase();
    for (const ident of identities) {
      if (ident.aliases.has(lower)) {
        return ident.canonicalName;
      }
    }
    if (trimmed.startsWith("guest_") || trimmed.startsWith("Guest Student")) {
      return "Guest";
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return "Guest";
    }
    return trimmed;
  }

  function matchesUser(reportUserName: string, targetIdentifier: string): boolean {
    if (!reportUserName || !targetIdentifier) return false;
    const repLow = reportUserName.trim().toLowerCase();
    const targLow = targetIdentifier.trim().toLowerCase();

    // Exact direct match
    if (repLow === targLow) return true;

    // Find the identity cluster for targetIdentifier
    const targetIdent = identities.find(i => i.aliases.has(targLow) || i.canonicalName.toLowerCase() === targLow);
    if (targetIdent) {
      if (targetIdent.aliases.has(repLow)) return true;
      const resolvedRep = resolveToCanonical(reportUserName).toLowerCase();
      if (targetIdent.aliases.has(resolvedRep) || targetIdent.canonicalName.toLowerCase() === resolvedRep) {
        return true;
      }
    }

    // Also check if reportUserName itself maps to an identity that contains targetIdentifier
    const reportIdent = identities.find(i => i.aliases.has(repLow) || i.canonicalName.toLowerCase() === repLow);
    if (reportIdent) {
      if (reportIdent.aliases.has(targLow) || reportIdent.canonicalName.toLowerCase() === targLow) {
        return true;
      }
    }

    return false;
  }

  return { identities, nameMap, resolveToCanonical, matchesUser };
}

// Clean any legacy UUIDs or "Guest Student (...)" strings in quizReportsTable
async function cleanLegacyRecords() {
  try {
    const { nameMap, resolveToCanonical } = await getUserIdentities();
    const allReports = await db.select().from(quizReportsTable);
    for (const r of allReports) {
      const isLegacy =
        r.userName.startsWith("guest_") ||
        r.userName.startsWith("Guest Student") ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.userName);

      if (isLegacy || nameMap.has(r.userName)) {
        const clean = resolveToCanonical(r.userName);
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

  // Resolve raw ID/guest strings to clean canonical username
  const { resolveToCanonical } = await getUserIdentities();
  const cleanName = resolveToCanonical(parsed.data.userName);

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

  const { resolveToCanonical } = await getUserIdentities();
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
      userName: resolveToCanonical(r.userName),
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
  const { resolveToCanonical } = await getUserIdentities();
  const rows = await db
    .select({ userName: quizReportsTable.userName, attempts: count() })
    .from(quizReportsTable)
    .groupBy(quizReportsTable.userName)
    .orderBy(quizReportsTable.userName);

  const aggregated = new Map<string, { userName: string; attempts: number }>();

  for (const r of rows) {
    const clean = resolveToCanonical(r.userName);
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

router.get("/quiz-reports/analytics", async (req, res): Promise<void> => {
  const userName = req.query.userName as string;
  if (!userName) {
    res.status(400).json({ error: "userName is required" });
    return;
  }
  const { resolveToCanonical, matchesUser } = await getUserIdentities();
  const targetResolved = resolveToCanonical(userName);
  const allReports = await db.select().from(quizReportsTable);

  const reports = allReports.filter((r) => matchesUser(r.userName, userName));

  res.json(buildAnalytics(targetResolved, reports));
});

router.get("/quiz-reports/study-time", async (req, res): Promise<void> => {
  const userName = req.query.userName as string;
  const { matchesUser } = await getUserIdentities();
  const allReports = await db.select().from(quizReportsTable).orderBy(quizReportsTable.createdAt);

  const reports = allReports.filter((r) => {
    if (!userName || !userName.trim()) return false;
    return matchesUser(r.userName, userName);
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
  const { matchesUser } = await getUserIdentities();
  const allReports = await db.select().from(quizReportsTable).orderBy(desc(quizReportsTable.id));

  const userReports = allReports.filter((r) => matchesUser(r.userName, userName));

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

  const { resolveToCanonical, matchesUser } = await getUserIdentities();
  const target1 = resolveToCanonical(user1);
  const target2 = resolveToCanonical(user2);
  const allReports = await db.select().from(quizReportsTable);

  const r1 = allReports.filter((r) => matchesUser(r.userName, user1));
  const r2 = allReports.filter((r) => matchesUser(r.userName, user2));

  res.json([buildAnalytics(target1, r1), buildAnalytics(target2, r2)]);
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
