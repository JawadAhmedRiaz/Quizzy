import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuiz } from "@/context/QuizContext";
import { useUser } from "@/context/UserContext";
import { getQuizMeta } from "@/data/curriculum";
import { useSubmitQuizReport } from "@workspace/api-client-react";
import { recordQuizSeconds } from "@/lib/studyTimeTracker";
import { recordMistakesFromQuiz } from "@/lib/revisionTracker";

const API = import.meta.env.BASE_URL + "api";

interface XpResult { xpGained: number; bonuses: { reason: string; amount: number }[]; newStreak: number; newBadges: string[]; }

const BADGE_MAP: Record<string, { name: string; emoji: string }> = {
  first_perfect: { name: "First Perfect Score", emoji: "🏆" },
  week_warrior: { name: "Week Warrior", emoji: "🔥" },
  speed_demon: { name: "Speed Demon", emoji: "⚡" },
  sharp_shooter: { name: "Sharp Shooter", emoji: "🎯" },
  never_skip: { name: "Never Skip", emoji: "💪" },
  top_class: { name: "Top of the Class", emoji: "🌟" },
  comeback_kid: { name: "Comeback Kid", emoji: "🧠" },
};

export function ResultPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [, navigate] = useLocation();
  const { session, playerName, difficulty, resetSession } = useQuiz();
  const { effectiveUserId, displayName, refreshGamification } = useUser();
  const meta = session?.meta ?? getQuizMeta(quizId!);
  const [showReport, setShowReport] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [showBadge, setShowBadge] = useState<string | null>(null);
  const awardedRef = useRef(false);

  const submitReport = useSubmitQuizReport();

  const answers = session?.answers ?? [];
  const total = answers.length;
  const correct = session?.correct ?? 0;
  const score = session?.score ?? 0;
  const skipped = answers.filter((a) => a.skipped).length;
  const wrong = total - correct - skipped;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  useEffect(() => {
    if (!session?.finished || !meta || awardedRef.current) return;
    awardedRef.current = true;

    // Persist any wrong answers automatically to student's Revision Deck
    recordMistakesFromQuiz(quizId!, meta.subject, answers, meta.sem, meta.examType);

    const name = displayName || playerName || "Student";
    submitReport.mutate({
      data: {
        userName: name,
        quizId: quizId!,
        sem: meta.sem,
        subject: meta.subject,
        examType: meta.examType,
        correct,
        total,
        pct,
        score,
        answersJson: JSON.stringify(
          answers.map((a) => ({
            q: a.question.q, c: a.question.c,
            selected: a.selectedOptionIndex,
            correct: a.question.a,
            isCorrect: a.isCorrect,
            skipped: a.skipped,
          }))
        ),
      },
    });

    if (effectiveUserId) {
      const timeTaken = session.timeTaken;
      const timeAllowed = session.timeAllowed;
      recordQuizSeconds(timeTaken);
      fetch(`${API}/quiz-reports/leaderboard?quizId=${quizId}`)
        .then(r => r.ok ? r.json() : [])
        .catch(() => [])
        .then((board: { userName: string; bestScore: number }[]) => {
          const topScore = board.length > 0 ? board[0].bestScore : -1;
          const isTopOfLeaderboard = score > topScore || board.length === 0;
          return fetch(`${API}/gamification/award-xp`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: effectiveUserId,
              quizId,
              pct,
              skipped,
              total,
              difficulty,
              timeTaken,
              timeAllowed,
              isTopOfLeaderboard,
            }),
          });
        })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setXpResult(data);
            refreshGamification();
            if (data.newBadges?.length > 0) {
              setTimeout(() => setShowBadge(data.newBadges[0]), 1500);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  if (!session?.finished) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg font-semibold">No result found</p>
        <button onClick={() => navigate("/")} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>← Home</button>
      </div>
    );
  }

  const emoji = pct >= 90 ? "🏆" : pct >= 75 ? "🌟" : pct >= 60 ? "😊" : pct >= 40 ? "📚" : "💪";
  const title = pct >= 90 ? "Outstanding!" : pct >= 75 ? "Great work!" : pct >= 60 ? "Good job!" : pct >= 40 ? "Keep studying!" : "Keep practicing!";
  const ringColor = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  const topicMap: Record<string, { total: number; correct: number }> = {};
  answers.forEach((ans) => {
    const t = ans.question.c;
    if (!topicMap[t]) topicMap[t] = { total: 0, correct: 0 };
    topicMap[t].total++;
    if (ans.isCorrect) topicMap[t].correct++;
  });
  const topics = Object.entries(topicMap)
    .map(([name, { total, correct }]) => ({ name, total, correct, pct: Math.round((correct / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
  const weakTopics = topics.filter((t) => t.pct < 60);
  const strongTopics = topics.filter((t) => t.pct >= 60);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Badge celebration modal */}
      <AnimatePresence>
        {showBadge && BADGE_MAP[showBadge] && (
          <motion.div key="badge-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowBadge(null)}>
            <motion.div initial={{ scale: 0.5, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.5 }}
              transition={{ type: "spring", stiffness: 250, damping: 20 }}
              className="text-center flex flex-col items-center gap-4 p-8 rounded-2xl shadow-2xl"
              style={{ background: "hsl(var(--card))", border: "1px solid rgba(245,158,11,0.5)" }}>
              <div className="text-7xl">{BADGE_MAP[showBadge].emoji}</div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#fbbf24" }}>New Badge Unlocked!</p>
              <p className="text-2xl font-black">{BADGE_MAP[showBadge].name}</p>
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Tap anywhere to continue</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Score card */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glow-card p-6 text-center">
          <div className="text-5xl mb-2">{emoji}</div>
          <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Poppins',sans-serif" }}>{title}</h2>
          <p className="text-sm mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
            {displayName || playerName || "You"} · {total} questions attempted
          </p>
          {submitReport.isSuccess && (
            <p className="text-xs mb-2" style={{ color: "#34d399" }}>✓ Score saved to leaderboard!</p>
          )}
          {/* XP award */}
          {xpResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="mb-3 flex flex-col items-center gap-1">
              <p className="text-xl font-black" style={{ color: "#fbbf24" }}>+{xpResult.xpGained} XP 🎉</p>
              {xpResult.bonuses.length > 0 && (
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {xpResult.bonuses.map(b => (
                    <span key={b.reason} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                      +{b.amount} {b.reason}
                    </span>
                  ))}
                </div>
              )}
              {xpResult.newStreak > 0 && (
                <p className="text-xs font-bold" style={{ color: "#fb923c" }}>🔥 {xpResult.newStreak}-day streak!</p>
              )}
            </motion.div>
          )}

          <div className="flex justify-center">
            <div className="relative w-24 h-24">
              <svg width="96" height="96">
                <circle cx="48" cy="48" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                <motion.circle cx="48" cy="48" r="40" fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  initial={{ strokeDashoffset: `${2 * Math.PI * 40}` }}
                  animate={{ strokeDashoffset: `${2 * Math.PI * 40 * (1 - pct / 100)}` }}
                  transition={{ duration: 1.5, ease: "easeOut" }} transform="rotate(-90 48 48)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black">{pct}%</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { v: score, l: "Score", c: "#60a5fa" },
            { v: correct, l: "Correct", c: "#34d399" },
            { v: wrong, l: "Wrong", c: "#f87171" },
            { v: skipped, l: "Skipped", c: "#fbbf24" },
          ].map(({ v, l, c }) => (
            <div key={l} className="glow-card p-3 text-center">
              <div className="text-xl font-black" style={{ color: c }}>{v}</div>
              <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Per-topic summary */}
        {topics.length > 0 && (
          <div className="glow-card p-4 flex flex-col gap-3">
            <p className="text-sm font-black">📊 Topic Performance</p>
            <div className="flex flex-col gap-2">
              {topics.map((t) => (
                <div key={t.name} className="flex items-center gap-2">
                  <span className="text-xs w-5 flex-shrink-0">{t.pct >= 60 ? "💪" : "📚"}</span>
                  <span className="text-xs font-medium flex-1 truncate">{t.name}</span>
                  <div className="w-24 h-2 rounded-full flex-shrink-0" style={{ background: "hsl(var(--muted))" }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: t.pct >= 75 ? "#22c55e" : t.pct >= 50 ? "#f59e0b" : "#ef4444" }}
                      initial={{ width: 0 }} animate={{ width: `${t.pct}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
                  </div>
                  <span className="text-xs font-bold w-12 text-right flex-shrink-0" style={{ color: t.pct >= 60 ? "#34d399" : "#f87171" }}>
                    {t.correct}/{t.total}
                  </span>
                  <span className="text-xs font-black w-10 text-right flex-shrink-0" style={{ color: t.pct >= 60 ? "#34d399" : "#f87171" }}>
                    {t.pct}%
                  </span>
                </div>
              ))}
            </div>
            {weakTopics.length > 0 && (
              <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", borderLeft: "3px solid #ef4444" }}>
                <span className="font-semibold" style={{ color: "#f87171" }}>Weak areas: </span>
                <span style={{ color: "hsl(var(--muted-foreground))" }}>{weakTopics.map(t => t.name).join(", ")}</span>
              </div>
            )}
            {strongTopics.length > 0 && (
              <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(16,185,129,0.08)", borderLeft: "3px solid #22c55e" }}>
                <span className="font-semibold" style={{ color: "#34d399" }}>Strong topics: </span>
                <span style={{ color: "hsl(var(--muted-foreground))" }}>{strongTopics.map(t => t.name).join(", ")}</span>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {wrong > 0 && (
            <button
              onClick={() => navigate(`/revision?subject=${encodeURIComponent(meta?.subject || "")}`)}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-between shadow-xs cursor-pointer"
              style={{
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.25))",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                color: "#f59e0b",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <span>Practice {wrong} Missed {wrong === 1 ? "Question" : "Questions"} in Revision Hub</span>
              </div>
              <span className="text-xs font-black uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-md">
                Flashcards →
              </span>
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={() => setShowReport(!showReport)}
              className="flex-1 py-3 rounded-xl font-bold text-sm hover:scale-[1.02] transition-all"
              style={{ background: showReport ? "rgba(99,102,241,0.2)" : "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: showReport ? "#a78bfa" : "hsl(var(--foreground))" }}>
              {showReport ? "Hide Report" : "📋 Detailed Report"}
            </button>
            <button onClick={() => navigate(`/quiz/${quizId}/leaderboard`)}
              className="flex-1 py-3 rounded-xl font-bold text-sm hover:scale-[1.02] transition-all"
              style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}>
              🏆 Leaderboard
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/quiz/${quizId}/setup`)}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm hover:scale-[1.02] transition-all"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff" }}>
            Play Again
          </button>
          <button onClick={() => { resetSession(); navigate("/"); }}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm hover:scale-[1.02] transition-all"
            style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
            Home
          </button>
        </div>

        {/* Detailed Report */}
        <AnimatePresence>
          {showReport && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="glow-card p-4 flex flex-col gap-4">
                <p className="text-sm font-black">📋 Detailed Report — {total} Questions</p>
                {answers.map((ans, i) => {
                  const q = ans.question;
                  const userOpt = ans.selectedOptionIndex !== null ? q.o[ans.selectedOptionIndex] : null;
                  const correctOpt = q.o[q.a];
                  return (
                    <div key={i} className="rounded-xl p-4 flex flex-col gap-2"
                      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${ans.isCorrect ? "rgba(16,185,129,0.3)" : ans.skipped ? "rgba(251,191,36,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0">{ans.isCorrect ? "✅" : ans.skipped ? "⏭" : "❌"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold" style={{ background: "rgba(99,102,241,0.15)", color: "#a78bfa" }}>{q.c}</span>
                            <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Q{i + 1}</span>
                          </div>
                          <p className="text-sm font-semibold leading-snug">{q.q}</p>
                        </div>
                      </div>
                      {userOpt && !ans.skipped && (
                        <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: ans.isCorrect ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: ans.isCorrect ? "#34d399" : "#f87171" }}>
                          Your answer: {userOpt}
                        </p>
                      )}
                      {!ans.isCorrect && !ans.skipped && (
                        <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>
                          ✓ Correct: {correctOpt}
                        </p>
                      )}
                      {ans.skipped && (
                        <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                          ⏭ Skipped · Correct: {correctOpt}
                        </p>
                      )}
                      {q.e && (
                        <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", borderLeft: "2px solid #3b82f6", color: "hsl(var(--muted-foreground))" }}>
                          💡 {q.e}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
