import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetQuizLeaderboard, getGetQuizLeaderboardQueryKey } from "@workspace/api-client-react";
import { getQuizMeta } from "@/data/curriculum";
import { useUser } from "@/context/UserContext";

const API = import.meta.env.BASE_URL + "api";

interface XpEntry { userId: string; displayName: string | null; xp: number; rank: number; level: string; }
interface ProfileMap { [userId: string]: { displayName: string | null; gender?: string | null } }

export function LeaderboardPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [, navigate] = useLocation();
  const meta = getQuizMeta(quizId!);
  const { effectiveUserId, displayName: myDisplayName } = useUser();
  const [tab, setTab] = useState<"quiz" | "xp">("quiz");
  const [xpBoard, setXpBoard] = useState<XpEntry[]>([]);
  const [xpLoading, setXpLoading] = useState(false);
  const [xpError, setXpError] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [profileMap, setProfileMap] = useState<ProfileMap>({});

  const { data, isLoading } = useGetQuizLeaderboard(
    { quizId: quizId! },
    { query: { queryKey: getGetQuizLeaderboardQueryKey({ quizId: quizId! }) } }
  );

  useEffect(() => {
    if (tab !== "xp") return;
    setXpLoading(true);
    setXpError(false);
    fetch(`${API}/gamification/leaderboard/xp`)
      .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then(d => { setXpBoard(d); setXpLoading(false); })
      .catch(() => { setXpError(true); setXpLoading(false); });
  }, [tab]);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const userIds = data.map(e => e.userName);
    Promise.all(
      userIds.map(uid =>
        fetch(`${API}/profile/${uid}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(profiles => {
      const map: ProfileMap = {};
      userIds.forEach((uid, i) => {
        if (profiles[i]) map[uid] = { displayName: profiles[i].displayName, gender: profiles[i].gender };
      });
      setProfileMap(map);
    });
  }, [data]);

  function resolveDisplayName(userName: string): string {
    const profile = profileMap[userName];
    if (profile?.displayName) return profile.displayName;
    if (userName === effectiveUserId) return myDisplayName;
    if (userName.startsWith("guest_")) return "Guest";
    return userName.length > 18 ? userName.slice(0, 18) + "…" : userName;
  }

  const isMe = (userName: string) => userName === effectiveUserId;

  const medals = ["🥇", "🥈", "🥉"];
  const rankColors = ["#f59e0b", "#9ca3af", "#b45309"];

  // My stats on quiz board
  const myEntry = data?.find(e => isMe(e.userName));
  const myRank = myEntry ? (data?.indexOf(myEntry) ?? -1) + 1 : null;

  function getGapToFirst(myE: typeof myEntry, allData: typeof data): { xpGap?: number; scoreGap?: number } {
    if (!allData || allData.length === 0 || !myE) return {};
    const first = allData[0];
    return {
      scoreGap: Math.max(0, first.bestScore - myE.bestScore),
    };
  }

  const gap = myEntry ? getGapToFirst(myEntry, data) : {};

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black" style={{ fontFamily: "'Poppins',sans-serif" }}>🏆 Leaderboard</h1>
            {meta && <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Sem {meta.sem} · {meta.subjectName} · {meta.examLabel}</p>}
          </div>
          <button onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg text-xs font-semibold hover:scale-[1.02] transition-all"
            style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}>
            ← Home
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { id: "quiz", label: "🏆 Quiz Board" },
            { id: "xp", label: "⚡ XP Board" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: tab === t.id ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "hsl(var(--muted))",
                color: tab === t.id ? "#fff" : "hsl(var(--muted-foreground))",
                border: `1px solid ${tab === t.id ? "transparent" : "hsl(var(--border))"}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* My position banner — only show if I'm on this board */}
        {tab === "quiz" && myEntry && myRank && myRank > 3 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer"
            style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}
            onClick={() => setSelectedUser({ ...myEntry, isMe: true })}>
            <span className="text-lg">👤</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Your Position</p>
              <p className="text-sm font-black">#{myRank} · {myEntry.bestScore} pts · {myEntry.bestPct}%</p>
            </div>
            {gap.scoreGap !== undefined && gap.scoreGap > 0 && (
              <p className="text-xs text-right flex-shrink-0" style={{ color: "#fbbf24" }}>
                {gap.scoreGap} pts to #1
              </p>
            )}
          </motion.div>
        )}

        {/* Quiz leaderboard */}
        {tab === "quiz" && (
          <div className="glow-card p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>No scores yet — be the first!</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {data.map((e, i) => {
                  const me = isMe(e.userName);
                  const name = resolveDisplayName(e.userName);
                  return (
                    <motion.div key={e.userName} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="flex items-center gap-3 py-3 cursor-pointer rounded-xl px-2 transition-all"
                      style={{
                        background: me ? "rgba(251,191,36,0.08)" : "transparent",
                        border: me ? "1px solid rgba(251,191,36,0.25)" : "1px solid transparent",
                        marginBottom: "2px",
                      }}
                      onClick={() => setSelectedUser({ ...e, isMe: me, resolvedName: name })}>
                      <span className="text-lg w-8 text-center flex-shrink-0" style={{ color: i < 3 ? rankColors[i] : undefined }}>
                        {i < 3 ? medals[i] : `#${i + 1}`}
                      </span>
                      <span className="flex-1 text-sm font-semibold flex items-center gap-1.5 min-w-0">
                        <span className="truncate" style={{ maxWidth: "120px" }}>{name}</span>
                        {me && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>You</span>}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>{e.bestPct}%</span>
                      <span className="text-sm font-black flex-shrink-0" style={{ color: i < 3 ? rankColors[i] : "#60a5fa" }}>{e.bestScore}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{e.correct}/{e.total}</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* XP leaderboard */}
        {tab === "xp" && (
          <div className="glow-card p-4">
            {xpLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
              </div>
            ) : xpError ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">⚠️</div>
                <p className="font-semibold text-sm">Failed to load XP leaderboard</p>
                <button onClick={() => { setXpError(false); setXpLoading(true); fetch(`${API}/gamification/leaderboard/xp`).then(r => r.ok ? r.json() : Promise.reject()).then(d => { setXpBoard(d); setXpLoading(false); }).catch(() => { setXpError(true); setXpLoading(false); }); }}
                  className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                  Retry
                </button>
              </div>
            ) : xpBoard.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">⚡</div>
                <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>No XP data yet</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {xpBoard.map((e, i) => {
                  const me = e.userId === effectiveUserId;
                  const name = e.displayName || (me ? myDisplayName : (e.userId.startsWith("guest_") ? "Guest" : e.userId.slice(0, 16)));
                  return (
                    <motion.div key={e.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="flex items-center gap-3 py-3 rounded-xl px-2"
                      style={{
                        background: me ? "rgba(251,191,36,0.08)" : "transparent",
                        border: me ? "1px solid rgba(251,191,36,0.25)" : "1px solid transparent",
                        marginBottom: "2px",
                      }}>
                      <span className="text-lg w-8 text-center flex-shrink-0" style={{ color: i < 3 ? rankColors[i] : undefined }}>
                        {i < 3 ? medals[i] : `#${i + 1}`}
                      </span>
                      <span className="flex-1 text-sm font-semibold flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{name}</span>
                        {me && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>You</span>}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>{e.level}</span>
                      <span className="text-sm font-black flex-shrink-0" style={{ color: i < 3 ? rankColors[i] : "#fbbf24" }}>{e.xp.toLocaleString()} XP</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* User detail modal */}
        <AnimatePresence>
          {selectedUser && (
            <motion.div key="user-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
              onClick={() => setSelectedUser(null)}>
              <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4 shadow-xl"
                style={{
                  background: "hsl(var(--card))",
                  border: `1px solid ${selectedUser.isMe ? "rgba(245,158,11,0.5)" : "hsl(var(--border))"}`,
                }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-base">{selectedUser.resolvedName ?? selectedUser.userName}</p>
                    {selectedUser.isMe && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>👤 You</span>}
                  </div>
                  <button onClick={() => setSelectedUser(null)} style={{ color: "hsl(var(--muted-foreground))" }}>✕</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Best Score", value: `${selectedUser.bestScore} pts`, color: "#60a5fa" },
                    { label: "Accuracy", value: `${selectedUser.bestPct}%`, color: selectedUser.bestPct >= 75 ? "#34d399" : "#f87171" },
                    { label: "Correct", value: `${selectedUser.correct}/${selectedUser.total}`, color: "#34d399" },
                    { label: "Attempts", value: `×${selectedUser.attempts}`, color: "#a78bfa" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: "hsl(var(--muted))" }}>
                      <p className="text-lg font-black" style={{ color }}>{value}</p>
                      <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</p>
                    </div>
                  ))}
                </div>
                {selectedUser.isMe && gap.scoreGap !== undefined && (
                  <div className="rounded-xl px-4 py-3 text-sm"
                    style={{ background: gap.scoreGap === 0 ? "rgba(34,197,94,0.1)" : "rgba(251,191,36,0.08)", borderLeft: `3px solid ${gap.scoreGap === 0 ? "#22c55e" : "#fbbf24"}` }}>
                    {gap.scoreGap === 0
                      ? "👑 You're already #1! Defend your throne!"
                      : `🔥 You're only ${gap.scoreGap} points away from #1! Keep going!`}
                  </div>
                )}
                <button onClick={() => setSelectedUser(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {meta && (
          <button onClick={() => navigate(`/quiz/${quizId}/setup`)}
            className="w-full py-3 rounded-xl font-bold text-sm hover:scale-[1.02] transition-all"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}>
            Take This Quiz →
          </button>
        )}
      </div>
    </div>
  );
}
