import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useGetQuizUsers, useCompareUsers, getGetQuizUsersQueryKey, getCompareUsersQueryKey } from "@workspace/api-client-react";
import { useUser } from "@/context/UserContext";
import { TopNavbar } from "@/components/TopNavbar";
import { Sidebar } from "@/components/Sidebar";

export function ComparisonPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { displayName } = useUser();

  const [compare1, setCompare1] = useState("");
  const [compare2, setCompare2] = useState("");

  const { data: usersRaw, isLoading: usersLoading } = useGetQuizUsers({
    query: { queryKey: getGetQuizUsersQueryKey() },
  });
  const rawUsers = Array.isArray(usersRaw) ? usersRaw : [];

  // Always ensure the current student's displayName is in the list
  const users = [...rawUsers];
  if (displayName && !users.some((u) => u.userName.toLowerCase() === displayName.toLowerCase())) {
    users.unshift({ userName: displayName, attempts: 0 });
  }

  // Initialize Student 1 to the current student's displayName
  useEffect(() => {
    if (displayName) {
      setCompare1(displayName);
    } else if (users.length > 0 && !compare1) {
      setCompare1(users[0].userName);
    }
  }, [users, displayName]);

  // Set default student 2 to a different student
  useEffect(() => {
    if (users.length > 1 && (!compare2 || compare2 === compare1)) {
      const other = users.find((u) => u.userName !== compare1);
      if (other) {
        setCompare2(other.userName);
      }
    }
  }, [users, compare1, compare2]);

  const { data: compareData, isLoading: compareLoading } = useCompareUsers(
    { user1: compare1, user2: compare2 },
    {
      query: {
        enabled: !!compare1 && !!compare2,
        queryKey: getCompareUsersQueryKey({ user1: compare1, user2: compare2 }),
      },
    }
  );

  const compareChartData =
    compareData && compareData.length === 2
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

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">⚖️</span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Student Comparison
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Compare quiz accuracy, subject mastery, and overall performance side-by-side with your peers.
          </p>
        </div>

        {/* Student Selector Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 border border-border shadow-xl relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(var(--card)/0.85) 0%, hsl(var(--muted)/0.4) 100%)",
            backdropFilter: "blur(12px)",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Select Students to Compare
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Student 1 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Student 1
              </label>
              <select
                value={compare1}
                onChange={(e) => setCompare1(e.target.value)}
                disabled={usersLoading}
                className="w-full px-4 py-3 rounded-2xl text-sm font-semibold outline-none bg-muted/60 border border-border text-foreground focus:border-blue-500 transition-all cursor-pointer shadow-xs"
              >
                <option value="">— Select student —</option>
                {users.map((u) => (
                  <option key={u.userName} value={u.userName}>
                    {u.userName} ({u.attempts} {u.attempts === 1 ? "quiz" : "quizzes"})
                  </option>
                ))}
              </select>
            </div>

            {/* Student 2 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Student 2
              </label>
              <select
                value={compare2}
                onChange={(e) => setCompare2(e.target.value)}
                disabled={usersLoading}
                className="w-full px-4 py-3 rounded-2xl text-sm font-semibold outline-none bg-muted/60 border border-border text-foreground focus:border-amber-500 transition-all cursor-pointer shadow-xs"
              >
                <option value="">— Select student —</option>
                {users
                  .filter((u) => u.userName !== compare1)
                  .map((u) => (
                    <option key={u.userName} value={u.userName}>
                      {u.userName} ({u.attempts} {u.attempts === 1 ? "quiz" : "quizzes"})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Loading Spinner */}
        {compareLoading && (
          <div className="flex items-center justify-center py-12 gap-3">
            <div className="w-6 h-6 rounded-full border-3 border-blue-500 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-muted-foreground">Calculating side-by-side performance…</span>
          </div>
        )}

        {/* Comparison Results */}
        {compareData && compareData.length === 2 && !compareLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-5"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {compareData.map((d, i) => {
                const isFirst = i === 0;
                const accentColor = isFirst ? "#007aff" : "#f59e0b";
                return (
                  <div
                    key={d.userName}
                    className="rounded-3xl p-5 border shadow-lg relative overflow-hidden"
                    style={{
                      background: "hsl(var(--card)/0.85)",
                      borderColor: isFirst ? "rgba(0,122,255,0.3)" : "rgba(245,158,11,0.3)",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white"
                          style={{ background: accentColor }}
                        >
                          {(d.userName[0] || "S").toUpperCase()}
                        </div>
                        <h3 className="text-sm font-black truncate max-w-[200px]" style={{ color: accentColor }}>
                          {d.userName}
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted border border-border">
                        {isFirst ? "Student 1" : "Student 2"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="p-3 rounded-2xl bg-muted/50 border border-border/60">
                        <span className="text-[11px] font-bold text-muted-foreground block">Quizzes Taken</span>
                        <span className="text-lg font-black text-foreground">{d.totalAttempts}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-muted/50 border border-border/60">
                        <span className="text-[11px] font-bold text-muted-foreground block">Average Score</span>
                        <span className="text-lg font-black" style={{ color: d.avgPct >= 60 ? "#10b981" : "#ef4444" }}>
                          {Math.round(d.avgPct)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subject Mastery Bar Chart */}
            {compareChartData.length > 0 && (
              <div
                className="rounded-3xl p-6 border border-border shadow-xl"
                style={{
                  background: "hsl(var(--card)/0.85)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Subject-by-Subject Score Comparison (%)
                  </h3>
                </div>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compareChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        formatter={(v: number) => [`${v}%`, "Score"]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                      <Bar dataKey={compareData[0].userName} fill="#007aff" radius={[6, 6, 0, 0]} />
                      <Bar dataKey={compareData[1].userName} fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State Prompt */}
        {(!compare1 || !compare2) && !compareLoading && (
          <div
            className="rounded-3xl p-12 text-center border border-border shadow-md flex flex-col items-center justify-center"
            style={{ background: "hsl(var(--card)/0.4)" }}
          >
            <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-3xl mb-3">
              ⚔️
            </div>
            <h4 className="text-sm font-black text-foreground mb-1">Select Two Students</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Pick two student profiles from the dropdowns above to compare their accuracy and academic performance side-by-side.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
