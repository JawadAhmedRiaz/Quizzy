import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";
import { useUser } from "@/context/UserContext";
import {
  useGetQuizUsers, useGetUserAnalytics, useCompareUsers,
  getGetQuizUsersQueryKey, getGetUserAnalyticsQueryKey, getCompareUsersQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#22c55e", "#ef4444"];

type Tab = "mine" | "compare" | "gvb";

const API = import.meta.env.BASE_URL + "api";

interface GenderStats { count: number; avgXp: number; avgStreak: number; avgPct: number; perfectScores: number; quizzesTaken: number; }

export function AnalyticsPage() {
  const [, navigate] = useLocation();
  const initialTab: Tab = typeof window !== "undefined" && window.location.search.includes("tab=compare") ? "compare" : typeof window !== "undefined" && window.location.search.includes("tab=gvb") ? "gvb" : "mine";
  const [tab, setTab] = useState<Tab>(initialTab);
  const { user, isAuthenticated } = useAuth();
  const { effectiveUserId, displayName, isGuest } = useUser();
  const [gvbData, setGvbData] = useState<{ male: GenderStats; female: GenderStats } | null>(null);
  const [gvbLoading, setGvbLoading] = useState(false);

  // The key used to query analytics — for logged-in users it's their full name (legacy),
  // but for guests and for the primary lookup we use effectiveUserId
  const myKey = effectiveUserId ?? "";

  const [compare1, setCompare1] = useState("");
  const [compare2, setCompare2] = useState("");

  const { data: usersRaw } = useGetQuizUsers({ query: { queryKey: getGetQuizUsersQueryKey() } });
  const users = Array.isArray(usersRaw) ? usersRaw : [];

  // Pre-fill compare1 with this user's key once loaded
  useEffect(() => {
    if (myKey && !compare1) setCompare1(myKey);
  }, [myKey]);

  // Girls vs Boys data
  useEffect(() => {
    if (tab !== "gvb") return;
    setGvbLoading(true);
    fetch(`${API}/gamification/gender-compare`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setGvbData(d); setGvbLoading(false); })
      .catch(() => setGvbLoading(false));
  }, [tab]);

  const { data: myAnalytics, isLoading: myLoading } = useGetUserAnalytics(
    { userName: myKey },
    { query: { enabled: !!myKey, queryKey: getGetUserAnalyticsQueryKey({ userName: myKey }) } }
  );

  const { data: compareData, isLoading: compareLoading } = useCompareUsers(
    { user1: compare1, user2: compare2 },
    { query: { enabled: !!compare1 && !!compare2, queryKey: getCompareUsersQueryKey({ user1: compare1, user2: compare2 }) } }
  );

  const subjectChartData = myAnalytics?.bySubject.map((s) => ({
    name: s.subject.replace(/-/g, " "),
    avgPct: Math.round(s.avgPct),
  })) ?? [];

  const pieData = myAnalytics ? [
    { name: "Correct", value: Math.round(myAnalytics.avgPct) },
    { name: "Wrong", value: Math.max(0, 100 - Math.round(myAnalytics.avgPct)) },
  ] : [];

  const compareChartData = compareData && compareData.length === 2
    ? (() => {
        const subjectSet = new Set([
          ...compareData[0].bySubject.map((s) => s.subject),
          ...compareData[1].bySubject.map((s) => s.subject),
        ]);
        return Array.from(subjectSet).map((subj) => {
          const s1 = compareData[0].bySubject.find((s) => s.subject === subj);
          const s2 = compareData[1].bySubject.find((s) => s.subject === subj);
          return {
            name: subj,
            [compareData[0].userName]: s1 ? Math.round(s1.avgPct) : 0,
            [compareData[1].userName]: s2 ? Math.round(s2.avgPct) : 0,
          };
        });
      })()
    : [];

  const avatarLetter = (displayName[0] ?? "G").toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black" style={{ fontFamily: "'Poppins', sans-serif" }}>📊 Analytics</h1>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Performance insights & comparisons</p>
          </div>
          <button onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg text-xs font-semibold hover:scale-[1.02] transition-all"
            style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}>
            ← Home
          </button>
        </div>

        {/* Guest notice */}
        {isGuest && (
          <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
            <span>👤</span>
            <span>Viewing as guest — your scores are saved to this device. Log in to sync across devices.</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl p-1 gap-1" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
          {([
            { id: "mine", label: "📈 My Stats" },
            { id: "compare", label: "⚔️ Compare" },
            { id: "gvb", label: "⚥ Girls vs Boys" },
          ] as { id: Tab; label: string }[]).map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: tab === id ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "transparent",
                color: tab === id ? "#fff" : "hsl(var(--muted-foreground))",
                boxShadow: tab === id ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
              }}>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── MY STATS TAB ─── */}
          {tab === "mine" && (
            <motion.div key="mine" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4">
              {myLoading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                  <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading your stats…</span>
                </div>
              ) : !myAnalytics || myAnalytics.totalAttempts === 0 ? (
                <div className="glow-card p-10 text-center">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="font-semibold mb-1">No quiz history yet</p>
                  <p className="text-sm mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Complete a quiz to see your analytics here.
                    {isGuest && " Your scores are saved to this device."}
                  </p>
                  <button onClick={() => navigate("/")}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff" }}>
                    Take a Quiz →
                  </button>
                </div>
              ) : (
                <>
                  {/* Profile summary */}
                  <div className="glow-card p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {isAuthenticated && user?.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt="" className="w-10 h-10 rounded-full" style={{ border: "2px solid rgba(99,102,241,0.5)" }} />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                          style={{ background: isGuest ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "linear-gradient(135deg, #3b82f6, #6366f1)", color: isGuest ? "#1a1a2e" : "#fff" }}>
                          {isGuest ? "👤" : avatarLetter}
                        </div>
                      )}
                      <div>
                        <p className="font-bold">{displayName}</p>
                        <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {isGuest ? "Guest · your personal stats" : "Your personal stats"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: myAnalytics.totalAttempts, l: "Attempts", c: "#60a5fa" },
                        { v: `${Math.round(myAnalytics.avgPct)}%`, l: "Avg Score", c: Math.round(myAnalytics.avgPct) >= 60 ? "#34d399" : "#f87171" },
                        { v: myAnalytics.bySubject.length, l: "Subjects", c: "#a78bfa" },
                      ].map(({ v, l, c }) => (
                        <div key={l} className="rounded-xl p-3 text-center" style={{ background: "hsl(var(--muted))" }}>
                          <div className="text-lg font-black" style={{ color: c }}>{v}</div>
                          <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Success rate pie */}
                  <div className="glow-card p-4">
                    <p className="text-sm font-bold mb-3">Success vs Failure Rate</p>
                    <div className="flex items-center gap-4">
                      <PieChart width={130} height={130}>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                      <div className="flex flex-col gap-3 flex-1">
                        {pieData.map((d, i) => (
                          <div key={d.name}>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i] }} />
                              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{d.name}</span>
                              <span className="text-sm font-black ml-auto" style={{ color: PIE_COLORS[i] }}>{d.value}%</span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                              <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: PIE_COLORS[i] }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* By subject */}
                  {subjectChartData.length > 0 && (
                    <div className="glow-card p-4">
                      <p className="text-sm font-bold mb-3">Performance by Subject</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={subjectChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
                          <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="avgPct" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* By exam type */}
                  {myAnalytics.byExamType.length > 0 && (
                    <div className="glow-card p-4">
                      <p className="text-sm font-bold mb-3">Performance by Exam Type</p>
                      <div className="flex flex-col gap-2">
                        {myAnalytics.byExamType.map((e) => (
                          <div key={e.examType} className="flex items-center gap-3">
                            <span className="text-xs font-semibold w-20 capitalize flex-shrink-0">{e.examType}</span>
                            <div className="flex-1 h-2 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${e.avgPct}%` }} transition={{ duration: 0.8 }}
                                style={{ background: e.avgPct >= 60 ? "#22c55e" : "#f59e0b" }} />
                            </div>
                            <span className="text-xs font-bold w-10 text-right flex-shrink-0"
                              style={{ color: e.avgPct >= 60 ? "#34d399" : "#fbbf24" }}>
                              {Math.round(e.avgPct)}%
                            </span>
                            <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>×{e.attempts}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* By semester */}
                  {myAnalytics.bySem.length > 0 && (
                    <div className="glow-card p-4">
                      <p className="text-sm font-bold mb-3">Performance by Semester</p>
                      <div className="flex flex-col gap-2">
                        {myAnalytics.bySem.map((s) => (
                          <div key={s.sem} className="flex items-center gap-3">
                            <span className="text-xs font-semibold w-20 flex-shrink-0">Semester {s.sem}</span>
                            <div className="flex-1 h-2 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                              <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${s.avgPct}%` }} transition={{ duration: 0.8 }}
                                style={{ background: s.avgPct >= 60 ? "#22c55e" : "#f59e0b" }} />
                            </div>
                            <span className="text-xs font-bold w-10 text-right flex-shrink-0"
                              style={{ color: s.avgPct >= 60 ? "#34d399" : "#fbbf24" }}>
                              {Math.round(s.avgPct)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ─── COMPARE TAB ─── */}
          {tab === "compare" && (
            <motion.div key="compare" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4">
              <div className="glow-card p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Select Two Students to Compare
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "#6366f1" }}>Student 1</p>
                    <select value={compare1} onChange={(e) => setCompare1(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm font-medium outline-none"
                      style={{ background: "hsl(var(--muted))", border: "1px solid #6366f1", color: "hsl(var(--foreground))" }}>
                      <option value="">— Select —</option>
                      {users?.map((u) => <option key={u.userName} value={u.userName}>{u.userName}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "#f59e0b" }}>Student 2</p>
                    <select value={compare2} onChange={(e) => setCompare2(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm font-medium outline-none"
                      style={{ background: "hsl(var(--muted))", border: "1px solid #f59e0b", color: "hsl(var(--foreground))" }}>
                      <option value="">— Select —</option>
                      {users?.filter((u) => u.userName !== compare1).map((u) => <option key={u.userName} value={u.userName}>{u.userName}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {compareLoading && (
                <div className="flex items-center justify-center py-8 gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                  <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading comparison…</span>
                </div>
              )}

              {compareData && compareData.length === 2 && (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {compareData.map((d, i) => (
                      <div key={d.userName} className="glow-card p-4" style={{ borderColor: i === 0 ? "rgba(99,102,241,0.4)" : "rgba(245,158,11,0.4)" }}>
                        <p className="text-xs font-bold mb-2 truncate" style={{ color: i === 0 ? "#a78bfa" : "#fbbf24" }}>{d.userName}</p>
                        <div className="flex flex-col gap-1.5">
                          {[
                            { l: "Attempts", v: d.totalAttempts },
                            { l: "Avg Score", v: `${Math.round(d.avgPct)}%` },
                          ].map(({ l, v }) => (
                            <div key={l} className="flex justify-between">
                              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l}</span>
                              <span className="text-xs font-bold">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Side-by-side bar chart */}
                  {compareChartData.length > 0 && (
                    <div className="glow-card p-4">
                      <p className="text-sm font-bold mb-3">Subject Performance Comparison</p>
                      <div className="flex gap-4 mb-2 flex-wrap">
                        {compareData.map((d, i) => (
                          <div key={d.userName} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ background: i === 0 ? "#6366f1" : "#f59e0b" }} />
                            <span className="text-xs font-semibold truncate max-w-[100px]">{d.userName}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: i === 0 ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)", color: i === 0 ? "#a78bfa" : "#fbbf24" }}>
                              {Math.round(d.avgPct)}%
                            </span>
                          </div>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={compareChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
                          <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey={compareData[0].userName} fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey={compareData[1].userName} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Exam type comparison */}
                  {(compareData[0].byExamType.length > 0 || compareData[1].byExamType.length > 0) && (
                    <div className="glow-card p-4">
                      <p className="text-sm font-bold mb-3">Exam Type Breakdown</p>
                      {["midterm", "final"].map((et) => {
                        const v1 = compareData[0].byExamType.find((x) => x.examType === et);
                        const v2 = compareData[1].byExamType.find((x) => x.examType === et);
                        if (!v1 && !v2) return null;
                        return (
                          <div key={et} className="mb-3">
                            <p className="text-xs font-semibold capitalize mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>{et}</p>
                            <div className="flex gap-2">
                              {[{ d: v1, c: "#6366f1", name: compareData[0].userName }, { d: v2, c: "#f59e0b", name: compareData[1].userName }].map(({ d, c, name }) => (
                                <div key={name} className="flex-1 rounded-xl p-2 text-center" style={{ background: "hsl(var(--muted))" }}>
                                  <div className="text-sm font-black" style={{ color: c }}>{d ? `${Math.round(d.avgPct)}%` : "—"}</div>
                                  <div className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{name}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {(!compare1 || !compare2) && (
                <div className="glow-card p-8 text-center">
                  <div className="text-4xl mb-2">⚔️</div>
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Select two students above to compare their performance side by side.</p>
                </div>
              )}
            </motion.div>
          )}
          {/* ─── GIRLS VS BOYS TAB ─── */}
          {tab === "gvb" && (
            <motion.div key="gvb" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4">
              <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs"
                style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a78bfa" }}>
                <span>⚥</span>
                <span>Anonymous aggregate comparison by gender. Individual data is never shown.</span>
              </div>

              {gvbLoading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                  <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading comparison…</span>
                </div>
              ) : !gvbData || !gvbData.male || !gvbData.female ? (
                <div className="glow-card p-10 text-center">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Not enough data yet. More students need to complete quizzes with gender set.</p>
                </div>
              ) : (
                <>
                  {/* Head-to-head summary */}
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { g: "male", data: gvbData.male, color: "#60a5fa", border: "rgba(59,130,246,0.4)", emoji: "👦", label: "Boys" },
                      { g: "female", data: gvbData.female, color: "#f472b6", border: "rgba(236,72,153,0.4)", emoji: "👧", label: "Girls" },
                    ] as const).map(({ g, data, color, border, emoji, label }) => (
                      <div key={g} className="glow-card p-4 flex flex-col gap-3" style={{ borderColor: border }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{emoji}</span>
                          <div>
                            <p className="text-sm font-black" style={{ color }}>{label}</p>
                            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{data.count} students</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {[
                            { l: "Avg Score", v: `${data.avgPct}%`, c: data.avgPct >= 60 ? "#34d399" : "#f87171" },
                            { l: "Avg XP", v: `${data.avgXp.toLocaleString()}`, c: "#fbbf24" },
                            { l: "Quizzes Taken", v: `${data.quizzesTaken}`, c: color },
                            { l: "Perfect Scores", v: `${data.perfectScores}`, c: "#34d399" },
                          ].map(({ l, v, c }) => (
                            <div key={l} className="flex items-center justify-between">
                              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l}</span>
                              <span className="text-xs font-black" style={{ color: c }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bar chart comparison */}
                  <div className="glow-card p-4">
                    <p className="text-sm font-bold mb-3">Head-to-Head Comparison</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={[
                          { metric: "Avg Score%", Boys: gvbData.male.avgPct, Girls: gvbData.female.avgPct },
                          { metric: "Avg Streak", Boys: gvbData.male.avgStreak, Girls: gvbData.female.avgStreak },
                        ]}
                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Boys" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Girls" fill="#f472b6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Verdict */}
                  {gvbData.male.count > 0 && gvbData.female.count > 0 && (
                    <div className="rounded-xl p-4"
                      style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                      <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Score Verdict</p>
                      <p className="text-sm font-semibold">
                        {gvbData.female.avgPct > gvbData.male.avgPct
                          ? `👧 Girls lead by ${gvbData.female.avgPct - gvbData.male.avgPct}% avg score!`
                          : gvbData.male.avgPct > gvbData.female.avgPct
                          ? `👦 Boys lead by ${gvbData.male.avgPct - gvbData.female.avgPct}% avg score!`
                          : "🤝 It's a tie!"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
