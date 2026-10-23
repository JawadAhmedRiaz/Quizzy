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

  const isMe = (userName: string) => {
    if (!userName) return false;
    const cleanUser = userName.toLowerCase().trim();
    const cleanId = (effectiveUserId || "").toLowerCase().trim();
    const cleanMyName = (myDisplayName || "").toLowerCase().trim();
    const resolved = (resolveDisplayName(userName) || "").toLowerCase().trim();

    return Boolean(
      (cleanId && cleanUser === cleanId) ||
      (cleanMyName && cleanUser === cleanMyName) ||
      (cleanMyName && resolved === cleanMyName) ||
      (cleanMyName && profileMap[userName]?.displayName && profileMap[userName].displayName?.toLowerCase().trim() === cleanMyName)
    );
  };

  const medals = ["🥇", "🥈", "🥉"];
  const rankColors = ["#f59e0b", "#9ca3af", "#b45309"];

  // My stats on quiz board
  const myEntry = data?.find(e => isMe(e.userName));
  const myRank = myEntry ? (data?.indexOf(myEntry) ?? -1) + 1 : null;

  // My stats on XP board
  const myXpEntry = xpBoard.find(e => isMe(e.userId) || (e.displayName && e.displayName.toLowerCase().trim() === (myDisplayName || "").toLowerCase().trim()));
  const myXpRank = myXpEntry ? (xpBoard.indexOf(myXpEntry) + 1) : null;

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

        {/* My position banner on Quiz Board */}
        {tab === "quiz" && myEntry && myRank && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer shadow-md"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(99,102,241,0.18) 100%)",
              border: "1.5px solid rgba(59,130,246,0.45)"
            }}
            onClick={() => setSelectedUser({ ...myEntry, isMe: true })}>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center text-xl font-black">
              {myRank <= 3 ? medals[myRank - 1] : "👤"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Your Position</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-blue-600 text-white tracking-wider">YOU</span>
              </div>
              <p className="text-sm font-black text-foreground">
                Rank #{myRank} · {myEntry.bestScore} pts ({myEntry.bestPct}%)
              </p>
            </div>
            {gap.scoreGap !== undefined && gap.scoreGap > 0 && (
              <p className="text-xs text-right flex-shrink-0 font-bold text-amber-500">
                {gap.scoreGap} pts to #1
              </p>
            )}
          </motion.div>
        )}

        {/* My position banner on XP Board */}
        {tab === "xp" && myXpEntry && myXpRank && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer shadow-md"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(217,119,6,0.18) 100%)",
              border: "1.5px solid rgba(245,158,11,0.45)"
            }}>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-xl font-black">
              {myXpRank <= 3 ? medals[myXpRank - 1] : "⚡"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Your Overall XP Rank</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-slate-900 tracking-wider">YOU</span>
              </div>
              <p className="text-sm font-black text-foreground">
                Rank #{myXpRank} · {myXpEntry.xp.toLocaleString()} XP ({myXpEntry.level})
              </p>
            </div>
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
                      className="flex items-center gap-3 py-3 cursor-pointer rounded-2xl px-3 transition-all"
                      style={{
                        background: me ? "linear-gradient(90deg, rgba(59,130,246,0.18) 0%, rgba(99,102,241,0.12) 100%)" : "transparent",
                        border: me ? "2px solid #3b82f6" : "1px solid transparent",
                        boxShadow: me ? "0 0 14px rgba(59,130,246,0.2)" : "none",
                        marginBottom: "4px",
                      }}
                      onClick={() => setSelectedUser({ ...e, isMe: me, resolvedName: name })}>
                      <span className="text-lg w-8 text-center flex-shrink-0 font-black" style={{ color: i < 3 ? rankColors[i] : undefined }}>
                        {i < 3 ? medals[i] : `#${i + 1}`}
                      </span>
                      <span className="flex-1 text-sm font-bold flex items-center gap-2 min-w-0">
                        <span className={`truncate ${me ? "text-blue-500 dark:text-blue-400 font-black" : ""}`} style={{ maxWidth: "140px" }}>{name}</span>
                        {me && <span className="text-[10px] px-2 py-0.5 rounded-full font-black flex-shrink-0 text-white tracking-wider" style={{ background: "linear-gradient(135deg, #007aff, #2563eb)" }}>YOU</span>}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-bold" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>{e.bestPct}%</span>
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
                  const me = isMe(e.userId) || (e.displayName && e.displayName.toLowerCase().trim() === (myDisplayName || "").toLowerCase().trim());
                  const name = e.displayName || (me ? myDisplayName : (e.userId.startsWith("guest_") ? "Guest" : e.userId.slice(0, 16)));
                  return (
                    <motion.div key={e.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="flex items-center gap-3 py-3 rounded-2xl px-3 transition-all"
                      style={{
                        background: me ? "linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(217,119,6,0.12) 100%)" : "transparent",
                        border: me ? "2px solid #f59e0b" : "1px solid transparent",
                        boxShadow: me ? "0 0 14px rgba(245,158,11,0.2)" : "none",
                        marginBottom: "4px",
                      }}>
                      <span className="text-lg w-8 text-center flex-shrink-0 font-black" style={{ color: i < 3 ? rankColors[i] : undefined }}>
                        {i < 3 ? medals[i] : `#${i + 1}`}
                      </span>
                      <span className="flex-1 text-sm font-bold flex items-center gap-2 min-w-0">
                        <span className={`truncate ${me ? "text-amber-500 font-black" : ""}`}>{name}</span>
                        {me && <span className="text-[10px] px-2 py-0.5 rounded-full font-black flex-shrink-0 text-slate-900 tracking-wider" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>YOU</span>}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-bold" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>{e.level}</span>
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
