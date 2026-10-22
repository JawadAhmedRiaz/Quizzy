import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, profilesTable, xpLogTable, userBadgesTable, quizReportsTable } from "@workspace/db";

const router: IRouter = Router();

const BADGES = [
  { id: "first_perfect", name: "First Perfect Score", emoji: "🏆", hint: "Score 100% on any quiz" },
  { id: "week_warrior", name: "Week Warrior", emoji: "🔥", hint: "7-day streak" },
  { id: "speed_demon", name: "Speed Demon", emoji: "⚡", hint: "Complete a quiz in under 30% of allowed time" },
  { id: "sharp_shooter", name: "Sharp Shooter", emoji: "🎯", hint: "90%+ accuracy on 5 quizzes" },
  { id: "never_skip", name: "Never Skip", emoji: "💪", hint: "Complete a full quiz with 0 skips" },
  { id: "top_class", name: "Top of the Class", emoji: "🌟", hint: "Rank #1 on any leaderboard" },
  { id: "comeback_kid", name: "Comeback Kid", emoji: "🧠", hint: "Improve score by 30%+ on a re-attempt" },
];

export function xpLevel(xp: number) {
  if (xp < 201) return { level: "Beginner", next: 201, current: 0 };
  if (xp < 501) return { level: "Scholar", next: 501, current: 201 };
  if (xp < 1001) return { level: "Expert", next: 1001, current: 501 };
  if (xp < 2001) return { level: "Master", next: 2001, current: 1001 };
  return { level: "Legend", next: Infinity, current: 2001 };
}

router.get("/gamification/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  const badges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, userId));
  const recentXp = await db.select().from(xpLogTable)
    .where(eq(xpLogTable.userId, userId)).orderBy(desc(xpLogTable.createdAt)).limit(10);

  const xp = profile?.xp ?? 0;
  const level = xpLevel(xp);
  res.json({
    xp,
    level: level.level,
    levelNext: level.next,
    levelCurrent: level.current,
    streakCount: profile?.streakCount ?? 0,
    streakLastDate: profile?.streakLastDate ?? null,
    freezesAvailable: profile?.freezesAvailable ?? 0,
    badges: badges.map((b) => ({ ...b, earnedAt: b.earnedAt.toISOString() })),
    allBadges: BADGES,
    recentXp: recentXp.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })),
  });
});

router.get("/gamification/leaderboard/xp", async (req, res): Promise<void> => {
  const rows = await db.select({ userId: profilesTable.userId, displayName: profilesTable.displayName, xp: profilesTable.xp })
    .from(profilesTable).orderBy(desc(profilesTable.xp)).limit(50);
  res.json(rows.map((r, i) => ({ ...r, rank: i + 1, level: xpLevel(r.xp).level })));
});

router.get("/gamification/gender-compare", async (req, res): Promise<void> => {
  const allProfiles = await db.select({
    userId: profilesTable.userId,
    gender: profilesTable.gender,
    xp: profilesTable.xp,
    streakCount: profilesTable.streakCount,
  }).from(profilesTable);

  const genderMap: Record<string, { userId: string; xp: number; streak: number }[]> = { male: [], female: [] };
  for (const p of allProfiles) {
    const g = p.gender ?? "unknown";
    if (g === "male" || g === "female") {
      genderMap[g].push({ userId: p.userId, xp: p.xp ?? 0, streak: p.streakCount ?? 0 });
    }
  }

  // Get quiz reports per gender
  const allReports = await db.select().from(quizReportsTable);
  const reportsByGender: Record<string, typeof allReports> = { male: [], female: [] };
  for (const r of allReports) {
    const profile = allProfiles.find(p => p.userId === r.userName);
    if (profile?.gender === "male") reportsByGender.male.push(r);
    else if (profile?.gender === "female") reportsByGender.female.push(r);
  }

  function summarize(users: { userId: string; xp: number; streak: number }[], reports: typeof allReports) {
    const count = users.length;
    const avgXp = count > 0 ? Math.round(users.reduce((s, u) => s + u.xp, 0) / count) : 0;
    const avgStreak = count > 0 ? Math.round(users.reduce((s, u) => s + u.streak, 0) / count) : 0;
    const avgPct = reports.length > 0 ? Math.round(reports.reduce((s, r) => s + r.pct, 0) / reports.length) : 0;
    const perfectScores = reports.filter(r => r.pct === 100).length;
    const quizzesTaken = reports.length;
    // Unique quizzes with top scores per subject
    const bySubject: Record<string, { total: number; count: number }> = {};
    for (const r of reports) {
      if (!bySubject[r.quizId]) bySubject[r.quizId] = { total: 0, count: 0 };
      bySubject[r.quizId].total += r.pct;
      bySubject[r.quizId].count++;
    }
    return { count, avgXp, avgStreak, avgPct, perfectScores, quizzesTaken };
  }

  res.json({
    male: summarize(genderMap.male, reportsByGender.male),
    female: summarize(genderMap.female, reportsByGender.female),
  });
});

router.post("/gamification/award-xp", async (req, res): Promise<void> => {
  const { userId, quizId, pct, skipped, total, timeTaken, timeAllowed, isTopOfLeaderboard } = req.body;
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const difficulty = req.body.difficulty ?? "medium";
  const diffMultiplier = difficulty === "easy" ? 1 : difficulty === "hard" ? 2 : 1.5;
  let xpGained = Math.round((pct ?? 0) * diffMultiplier);
  const bonuses: { reason: string; amount: number }[] = [];

  if (pct === 100) { bonuses.push({ reason: "Perfect Score", amount: 50 }); }
  if (skipped === 0) { bonuses.push({ reason: "No Skips", amount: 20 }); }
  if (isTopOfLeaderboard) { bonuses.push({ reason: "Top of Leaderboard", amount: 30 }); }
  if (timeTaken && timeAllowed && timeTaken < timeAllowed * 0.5) { bonuses.push({ reason: "Speed Bonus", amount: 15 }); }

  const totalBonus = bonuses.reduce((s, b) => s + b.amount, 0);
  const totalXp = xpGained + totalBonus;

  await db.insert(xpLogTable).values({ userId, amount: totalXp, reason: `Quiz attempt (${pct}%)`, quizId });
  await db.update(profilesTable).set({ xp: (profile.xp ?? 0) + totalXp }).where(eq(profilesTable.userId, userId));

  const today = new Date().toISOString().split("T")[0];
  let newStreak = profile.streakCount ?? 0;
  if (profile.streakLastDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];
    if (profile.streakLastDate === yStr) {
      newStreak = newStreak + 1;
    } else if (!profile.streakLastDate) {
      newStreak = 1;
    } else {
      newStreak = 1;
    }
    const newFreezes = newStreak % 7 === 0 ? (profile.freezesAvailable ?? 0) + 1 : profile.freezesAvailable ?? 0;
    await db.update(profilesTable).set({ streakCount: newStreak, streakLastDate: today, freezesAvailable: newFreezes }).where(eq(profilesTable.userId, userId));
  }

  const newBadges: string[] = [];
  const existingBadgeIds = (await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, userId))).map(b => b.badgeId);
  const allReports = await db.select().from(quizReportsTable).where(eq(quizReportsTable.userName, userId));

  if (pct === 100 && !existingBadgeIds.includes("first_perfect")) {
    newBadges.push("first_perfect");
  }
  if (newStreak >= 7 && !existingBadgeIds.includes("week_warrior")) {
    newBadges.push("week_warrior");
  }
  if (skipped === 0 && total > 0 && !existingBadgeIds.includes("never_skip")) {
    newBadges.push("never_skip");
  }
  if (timeTaken && timeAllowed && timeTaken < timeAllowed * 0.3 && !existingBadgeIds.includes("speed_demon")) {
    newBadges.push("speed_demon");
  }

  const perfectCount = allReports.filter(r => r.pct >= 90).length;
  if (perfectCount >= 5 && !existingBadgeIds.includes("sharp_shooter")) {
    newBadges.push("sharp_shooter");
  }

  if (newBadges.length > 0) {
    await db.insert(userBadgesTable).values(newBadges.map(id => ({ userId, badgeId: id })));
  }

  res.json({ xpGained: totalXp, bonuses, newStreak, newBadges });
});

export default router;
