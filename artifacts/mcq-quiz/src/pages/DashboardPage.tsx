import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@workspace/replit-auth-web";
import { useUser } from "@/context/UserContext";
import { TopNavbar } from "@/components/TopNavbar";
import { Sidebar } from "@/components/Sidebar";
import { AnimatedAvatar, getSavedAvatarId, saveAvatarId } from "@/components/AnimatedAvatar";
import { useWeeklyStudyTimeData } from "@/lib/studyTimeTracker";
import { useGetUserAnalytics, getGetUserAnalyticsQueryKey } from "@workspace/api-client-react";

const API = import.meta.env.BASE_URL + "api";

const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

function xpLevelInfo(xp: number) {
  if (xp < 201) return { level: "Beginner", emoji: "🌱", next: 201, cur: 0 };
  if (xp < 501) return { level: "Scholar", emoji: "📚", next: 501, cur: 201 };
  if (xp < 1001) return { level: "Expert", emoji: "🎓", next: 1001, cur: 501 };
  if (xp < 2001) return { level: "Master", emoji: "⚔️", next: 2001, cur: 1001 };
  return { level: "Legend", emoji: "👑", next: Infinity, cur: 2001 };
}

export function DashboardPage() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, login } = useAuth();
  const { effectiveUserId, displayName, profile, gamification, isGuest, saveProfile, refreshProfile } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Avatar state
  const [avatarId, setAvatarId] = useState(() => getSavedAvatarId());

  // Semester state
  const [selectedSemester, setSelectedSemester] = useState<number>(() => {
    const saved = localStorage.getItem("quizzy_student_sem");
    return saved ? Number(saved) : 4;
  });
  const [isEditingSem, setIsEditingSem] = useState(false);

  // Real-time live study time state synced from database + active engagement
  const { weekly: weeklyStudyTime, total: totalMinutes } = useWeeklyStudyTimeData(displayName || undefined);

  // Fetch live analytics
  const myKey = effectiveUserId ?? displayName ?? "";
  const { data: myAnalytics, isLoading: analyticsLoading } = useGetUserAnalytics(
    { userName: myKey },
    { query: { enabled: !!myKey, queryKey: getGetUserAnalyticsQueryKey({ userName: myKey }) } }
  );

  // Recent quiz reports history
  const [recentReports, setRecentReports] = useState<any[]>([]);

  useEffect(() => {
    setWeeklyStudyTime(getWeeklyStudyTime());
    setTotalMinutes(getTotalStudyMinutes());
    const interval = setInterval(() => {
      setWeeklyStudyTime(getWeeklyStudyTime());
      setTotalMinutes(getTotalStudyMinutes());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!effectiveUserId) return;
    // Fetch last quiz reports for recent history
    fetch(`${API}/quiz-reports/leaderboard?quizId=all`)
      .catch(() => null);
  }, [effectiveUserId]);

  function handleSemesterChange(sem: number) {
    setSelectedSemester(sem);
    localStorage.setItem("quizzy_student_sem", String(sem));
    setIsEditingSem(false);
  }

  function handleAvatarChange(newId: string) {
    setAvatarId(newId);
    saveAvatarId(newId);
  }

  // XP & Gamification details
  const xp = gamification?.xp ?? profile?.xp ?? 150;
  const streak = gamification?.streakCount ?? profile?.streakCount ?? 1;
  const lvl = xpLevelInfo(xp);
  const xpProgress = lvl.next === Infinity ? 100 : Math.round(((xp - lvl.cur) / (lvl.next - lvl.cur)) * 100);

  // Subject performance calculation from real quiz attempts
  const rawSubjects = myAnalytics?.bySubject ?? [];
  const subjectPerformance = useMemo(() => {
    if (rawSubjects.length > 0) {
      return rawSubjects.map((s) => ({
        name: s.subject.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        rawSubject: s.subject,
        pct: Math.round(s.avgPct),
        attempts: s.attempts,
      }));
    }
    return [];
  }, [rawSubjects]);

  // Strong vs Weak subjects
  const strongSubjects = useMemo(() => subjectPerformance.filter((s) => s.pct >= 70), [subjectPerformance]);
  const weakSubjects = useMemo(() => subjectPerformance.filter((s) => s.pct < 70), [subjectPerformance]);

  // Badges data
  const earnedBadgeIds = new Set(gamification?.badges?.map((b) => b.badgeId) || []);
  const allBadges = gamification?.allBadges || [
    { id: "first_perfect", name: "First Perfect Score", emoji: "🏆", hint: "Score 100% on any quiz" },
    { id: "week_warrior", name: "Week Warrior", emoji: "🔥", hint: "Maintain a 7-day quiz streak" },
    { id: "speed_demon", name: "Speed Demon", emoji: "⚡", hint: "Complete quiz in record time" },
    { id: "sharp_shooter", name: "Sharp Shooter", emoji: "🎯", hint: "90%+ accuracy on 5 quizzes" },
    { id: "never_skip", name: "Never Skip", emoji: "💪", hint: "Finish a quiz with zero skips" },
    { id: "top_class", name: "Top of the Class", emoji: "🌟", hint: "Reach #1 on subject leaderboard" },
    { id: "comeback_kid", name: "Comeback Kid", emoji: "🧠", hint: "Improve score by 30%+ on re-attempt" },
  ];

  // Overall accuracy
  const overallAccuracy = myAnalytics?.totalAttempts ? Math.round(myAnalytics.avgPct) : 0;
  const totalQuizzesCount = myAnalytics?.totalAttempts ?? 0;

  // Study time metrics
  const totalStudyHours = Math.round((totalMinutes / 60) * 10) / 10;
  const avgDailyMins = Math.round(
    weeklyStudyTime.reduce((sum, d) => sum + d.minutes, 0) / (weeklyStudyTime.length || 1)
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        
        {/* ─── TOP SECTION: PROFILE HERO & QUICK STATS ─── */}
        <section
          className="rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xl"
          style={{
            background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)/0.35) 100%)",
            border: "1px solid hsl(var(--border))",
          }}
        >
          {/* Subtle decorative background glow */}
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
            style={{ background: "radial-gradient(circle, #007AFF 0%, transparent 70%)" }}
          />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            {/* Left Column: Avatar + Identity */}
            <div className="flex items-center gap-5 sm:gap-6 min-w-0">
              {/* Interactive Animated Avatar */}
              <div className="flex-shrink-0">
                <AnimatedAvatar
                  avatarId={avatarId}
                  size={88}
                  interactive={true}
                  onSelectAvatar={handleAvatarChange}
                />
              </div>

              {/* User Metadata */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {displayName || (isGuest ? "Guest Scholar" : user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Student")}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                    {lvl.emoji} {lvl.level}
                  </span>
                </div>

                {/* Email / Roll Number */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span>📧</span>
                    <span>{user?.email || (profile?.rollNumber ? `ID: ${profile.rollNumber}` : "guest@quizzy.study")}</span>
                  </span>
                  {profile?.department && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <span>•</span>
                      <span>{profile.department}</span>
                    </span>
                  )}
                </div>

                {/* Semester Badge + Selector */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsEditingSem(!isEditingSem)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                      style={{
                        background: "rgba(0, 122, 255, 0.12)",
                        border: "1px solid rgba(0, 122, 255, 0.3)",
                        color: "#007AFF",
                      }}
                      title="Click to switch your current semester"
                    >
                      <span>🎓</span>
                      <span>Semester {selectedSemester}</span>
                      <span className="text-[10px] opacity-70">▼</span>
                    </button>

                    {/* Semester Dropdown */}
                    <AnimatePresence>
                      {isEditingSem && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -5 }}
                          className="absolute left-0 top-full mt-1.5 z-40 bg-card rounded-2xl p-2 shadow-2xl border border-border grid grid-cols-4 gap-1.5 min-w-[200px]"
                        >
                          {ALL_SEMESTERS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleSemesterChange(s)}
                              className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                                s === selectedSemester
                                  ? "bg-blue-600 text-white shadow-md"
                                  : "bg-muted/50 hover:bg-muted text-foreground"
                              }`}
                            >
                              Sem {s}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Daily Streak */}
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      color: "#b45309",
                    }}
                  >
                    <span>🔥</span>
                    <span>{streak} Day Streak</span>
                  </div>
                </div>

                {/* Level Progress Bar */}
                <div className="w-full max-w-xs mt-3.5">
                  <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground mb-1">
                    <span>XP Progress</span>
                    <span>
                      {xp.toLocaleString()} / {lvl.next === Infinity ? "MAX" : lvl.next.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${xpProgress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #007AFF, #F59E0B)" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Quick Stat Counter Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 w-full lg:w-auto flex-shrink-0">
              <div className="p-3.5 rounded-2xl bg-card/60 border border-border/80 flex flex-col justify-center">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Accuracy</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {overallAccuracy}%
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Quiz Mastery</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 border border-border/80 flex flex-col justify-center">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Quizzes</span>
                <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                  {totalQuizzesCount}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Completed</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 border border-border/80 flex flex-col justify-center">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Study Time</span>
                <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {totalStudyHours}h
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{avgDailyMins}m / day avg</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 border border-border/80 flex flex-col justify-center">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Badges</span>
                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                  {earnedBadgeIds.size} / {allBadges.length}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Achievements</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── MIDDLE SECTION: 2 DATA VISUALIZATION GRAPHS ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Graph 1: Time Spent on App */}
          <div
            className="rounded-3xl p-5 sm:p-6 shadow-md flex flex-col justify-between"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⏱️</span>
                  <h2 className="text-lg font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Time Spent on App
                  </h2>
                </div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                  Past 7 Days
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Daily learning and practice session time (minutes).
              </p>
            </div>

            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyStudyTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="timeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007AFF" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#007AFF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.5)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: "bold" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit="m"
                    domain={[0, (dataMax: number) => Math.max(30, Math.ceil(dataMax * 1.15))]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`${val} minutes`, "Active Study"]}
                    labelStyle={{ fontWeight: "bold" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="#007AFF"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#timeGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground mt-2">
              <span>Total Active Study: <strong className="text-foreground">{totalMinutes} mins</strong></span>
              <span>Streak Health: <strong className="text-emerald-500">100% On Track</strong></span>
            </div>
          </div>

          {/* Graph 2: Histogram of Subject Percentages */}
          <div
            className="rounded-3xl p-5 sm:p-6 shadow-md flex flex-col justify-between"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <h2 className="text-lg font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Subject Percentage Histogram
                  </h2>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Accuracy %
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Your average accuracy across academic subjects.
              </p>
            </div>

            {subjectPerformance.length === 0 ? (
              <div className="h-56 sm:h-64 w-full flex flex-col items-center justify-center text-center p-6 bg-muted/20 rounded-2xl border border-dashed border-border/80">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-2xl mb-2">
                  📊
                </div>
                <p className="text-xs font-bold text-foreground">No Quiz History Yet</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                  Complete quizzes in the Study section to populate your real subject accuracy breakdown!
                </p>
              </div>
            ) : (
              <div className="h-56 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.5)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 600 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`${val}%`, "Subject Score"]}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                      {subjectPerformance.map((entry, index) => {
                        const barColor =
                          entry.pct >= 75
                            ? "#10B981" // Green strong
                            : entry.pct >= 60
                            ? "#F59E0B" // Amber moderate
                            : "#EF4444"; // Red needs focus
                        return <Cell key={`cell-${index}`} fill={barColor} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &gt;75% Strong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 60-74% Moderate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &lt;60% Focus
              </span>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3: WEAK AND STRONG AREAS BREAKDOWN ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Strong Areas */}
          <div
            className="rounded-3xl p-5 sm:p-6 shadow-md"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h3 className="text-lg font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Strong Subjects
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                {strongSubjects.length} Proficient
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {strongSubjects.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Take a few quizzes to discover your high-scoring subjects!
                </p>
              ) : (
                strongSubjects.map((s) => (
                  <div
                    key={s.name}
                    className="p-3.5 rounded-2xl flex items-center justify-between gap-4 transition-all hover:scale-[1.01]"
                    style={{
                      background: "rgba(16, 185, 129, 0.06)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground truncate">{s.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          Mastered
                        </span>
                      </div>
                      <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        {s.attempts} attempts recorded
                      </span>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {s.pct}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Weak / Focus Needed Areas */}
          <div
            className="rounded-3xl p-5 sm:p-6 shadow-md"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <h3 className="text-lg font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Focus Needed (Weak Areas)
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                {weakSubjects.length} Topics
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {weakSubjects.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-3xl block mb-2">🎉</span>
                  <p className="text-sm font-bold text-foreground">Outstanding Work!</p>
                  <p className="text-xs text-muted-foreground">All your tested subjects are above 70% accuracy.</p>
                </div>
              ) : (
                weakSubjects.map((s) => (
                  <div
                    key={s.name}
                    className="p-3.5 rounded-2xl flex items-center justify-between gap-4 transition-all hover:scale-[1.01]"
                    style={{
                      background: "rgba(239, 68, 68, 0.06)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground truncate">{s.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400">
                          Needs Practice
                        </span>
                      </div>
                      <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        Target: Bring up to 75%+
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                        {s.pct}%
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate("/study")}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 shadow transition-all hover:scale-105"
                      >
                        🎯 Practice
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ─── SECTION 4: BADGES EARNED SHOWCASE ─── */}
        <section
          className="rounded-3xl p-5 sm:p-7 shadow-md"
          style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏅</span>
                <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Badges & Achievements
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Earn special badges by completing milestones, scoring high, and maintaining streaks.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/25">
              {earnedBadgeIds.size} / {allBadges.length} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {allBadges.map((badge) => {
              const isUnlocked = earnedBadgeIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className="rounded-2xl p-3.5 flex flex-col items-center text-center relative group transition-all"
                  style={{
                    background: isUnlocked ? "rgba(245, 158, 11, 0.08)" : "hsl(var(--muted)/0.3)",
                    border: isUnlocked
                      ? "1px solid rgba(245, 158, 11, 0.35)"
                      : "1px dashed hsl(var(--border))",
                    boxShadow: isUnlocked ? "0 4px 14px rgba(245, 158, 11, 0.15)" : "none",
                  }}
                >
                  <span
                    className={`text-3xl mb-2 transition-transform group-hover:scale-110 ${
                      isUnlocked ? "" : "grayscale opacity-40"
                    }`}
                  >
                    {badge.emoji}
                  </span>
                  <span className="text-xs font-bold leading-tight line-clamp-1 text-foreground">
                    {badge.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {isUnlocked ? "✓ Unlocked" : badge.hint}
                  </span>

                  {isUnlocked && (
                    <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-amber-500" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── SECTION 5: QUICK ACTIONS HUB ─── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6">
          <Link
            href="/study"
            className="p-4 rounded-2xl flex items-center gap-3.5 transition-all hover:scale-[1.02] shadow-sm"
            style={{
              background: "linear-gradient(135deg, rgba(0, 122, 255, 0.12), rgba(0, 122, 255, 0.04))",
              border: "1px solid rgba(0, 122, 255, 0.25)",
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-md">
              ⚡
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Start New Quiz</p>
              <p className="text-xs text-muted-foreground">Pick a subject & test knowledge</p>
            </div>
          </Link>

          <Link
            href="/comparison"
            className="p-4 rounded-2xl flex items-center gap-3.5 transition-all hover:scale-[1.02] shadow-sm"
            style={{
              background: "linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(168, 85, 247, 0.04))",
              border: "1px solid rgba(168, 85, 247, 0.25)",
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center text-lg font-bold shadow-md">
              ⚔️
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Peer Comparison</p>
              <p className="text-xs text-muted-foreground">Compare stats with classmates</p>
            </div>
          </Link>

          <Link
            href="/vault"
            className="p-4 rounded-2xl flex items-center gap-3.5 transition-all hover:scale-[1.02] shadow-sm"
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))",
              border: "1px solid rgba(245, 158, 11, 0.25)",
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg font-bold shadow-md">
              🔒
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Study Vault</p>
              <p className="text-xs text-muted-foreground">Saved MCQs and revision notes</p>
            </div>
          </Link>
        </section>

      </main>
    </div>
  );
}
