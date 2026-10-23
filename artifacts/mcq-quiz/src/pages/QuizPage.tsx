import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuiz, type QuizAnswer } from "@/context/QuizContext";
import { useUser } from "@/context/UserContext";
import { useSettings } from "@/context/SettingsContext";
import { getQuizMeta, getQuizQuestions } from "@/data/curriculum";
import type { Question } from "@/data/questions";

const API = import.meta.env.BASE_URL + "api";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function qHash(q: Question) {
  return btoa(encodeURIComponent(q.q.slice(0, 40))).replace(/[^a-z0-9]/gi, "").slice(0, 20);
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const LABELS = ["A", "B", "C", "D"];
const BREAK_OPTIONS = [5, 10, 20];

interface HistoryEntry { mode: "main" | "backlog"; idx: number; wasBacklogAdded: boolean; }

export function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [, navigate] = useLocation();
  const { totalToAttempt, session, difficulty, playerName, finalizeSession } = useQuiz();
  const { effectiveUserId, displayName } = useUser();
  const settings = useSettings();
  const meta = session?.meta ?? getQuizMeta(quizId!);
  const DIFFICULTY_SECONDS = { easy: settings.easyTime, medium: settings.mediumTime, hard: settings.hardTime };
  const perQ = DIFFICULTY_SECONDS[difficulty];
  const attemptCount = session?.totalToAttempt ?? totalToAttempt;

  // ── Queue Refs ──────────────────────────────────────────────────────────────
  const mainQueueRef = useRef<Question[]>([]);
  const backlogRef = useRef<Question[]>([]);
  const modeRef = useRef<"main" | "backlog">("main");
  const idxRef = useRef(0);
  const answersRef = useRef<QuizAnswer[]>([]);
  const historyRef = useRef<HistoryEntry[]>([]);
  const shuffleCache = useRef(new Map<string, { o: string; i: number }[]>());

  // ── Timer Refs ───────────────────────────────────────────────────────────────
  const perQTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const globalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPausedRef = useRef(false);
  const quizStartTimeRef = useRef(Date.now());

  // ── React State ─────────────────────────────────────────────────────────────
  const [mainQueue, setMainQueue] = useState<Question[]>([]);
  const [backlog, setBacklog] = useState<Question[]>([]);
  const [mode, setMode] = useState<"main" | "backlog">("main");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [answered, setAnswered] = useState(false);
  const [selectedOptIdx, setSelectedOptIdx] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(perQ);
  const [globalTimeLeft, setGlobalTimeLeft] = useState(0);
  const [shuffledOpts, setShuffledOpts] = useState<{ o: string; i: number }[]>([]);
  const [showExpl, setShowExpl] = useState(false);
  const [finished, setFinished] = useState(false);

  // review mode: 0 = live; positive = steps back in history
  const [reviewOffset, setReviewOffset] = useState(0);

  // break / pause
  const [paused, setPaused] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState<number | null>(null);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // flag
  const [flagging, setFlagging] = useState(false);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [flagReason, setFlagReason] = useState("");
  const [flagNote, setFlagNote] = useState("");

  // AI Deep Dive explanations
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  async function handleRequestAiExplanation(q: Question) {
    const key = q.q.trim();
    if (aiLoading[key]) return;
    setAiLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${API}/ai/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.q,
          options: q.o,
          correctAnswer: LABELS[q.a],
          subject: meta?.subject,
          topic: q.c,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.explanation) {
          setAiExplanations((prev) => ({ ...prev, [key]: data.explanation }));
        }
      }
    } catch {}
    setAiLoading((prev) => ({ ...prev, [key]: false }));
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const allQs =
      quizId?.startsWith("db-") && session?.questions && session.questions.length > 0
        ? session.questions
        : getQuizQuestions(quizId!);
    let filteredQs = allQs;

    (async () => {
      const poolPreference = sessionStorage.getItem(`quizzy_pool_${quizId}`);

      if (effectiveUserId) {
        try {
          const r = await fetch(`${API}/profile/${effectiveUserId}/attempted?quizId=${quizId}`);
          if (r.ok) {
            const data = await r.json();
            const attempted: string[] = data.questionHashes ?? [];

            if (poolPreference === "all") {
              filteredQs = allQs;
            } else if (attempted.length > 0) {
              const remaining = allQs.filter(q => !attempted.includes(qHash(q)));
              if (remaining.length === 0) {
                const reset = window.confirm(
                  `You've already attempted all ${allQs.length} questions in this quiz! Would you like to practice all questions again from the beginning?`
                );
                if (reset) {
                  await fetch(`${API}/profile/${effectiveUserId}/attempted`, {
                    method: "DELETE", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ quizId }),
                  });
                  filteredQs = allQs;
                } else {
                  navigate("/");
                  return;
                }
              } else if (remaining.length < allQs.length) {
                if (poolPreference === "remaining") {
                  filteredQs = remaining;
                } else {
                  const wantAll = window.confirm(
                    `You've previously attempted ${attempted.length} of ${allQs.length} questions.\n\n• Click OK to practice ALL ${allQs.length} questions (including previous ones).\n• Click Cancel to practice only the ${remaining.length} remaining unattempted questions.`
                  );
                  if (wantAll) {
                    await fetch(`${API}/profile/${effectiveUserId}/attempted`, {
                      method: "DELETE", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ quizId }),
                    });
                    filteredQs = allQs;
                  } else {
                    filteredQs = remaining;
                  }
                }
              }
            }
          }
        } catch {}
      }

      const ordered = shuffle(filteredQs);
      const selected = ordered.slice(0, Math.min(attemptCount, ordered.length));
      mainQueueRef.current = selected;
      setMainQueue(selected);
      const total = selected.length;
      setGlobalTimeLeft(total * perQ);
    })();
  }, []);

  // ── Global timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mainQueue.length === 0) return;
    globalTimerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      setGlobalTimeLeft((t) => {
        if (t <= 1) {
          if (globalTimerRef.current) clearInterval(globalTimerRef.current);
          setFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (globalTimerRef.current) clearInterval(globalTimerRef.current); };
  }, [mainQueue.length]);

  // ── Live question key ────────────────────────────────────────────────────────
  const currentQ = mode === "main" ? mainQueue[idx] : backlog[idx];
  const questionKey = currentQ ? `${mode}-${idx}-${currentQ.q.slice(0, 15)}` : null;

  // ── On question change (live) ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentQ || !questionKey || reviewOffset > 0) return;
    setAnswered(false);
    setSelectedOptIdx(null);
    setShowExpl(false);

    if (!shuffleCache.current.has(questionKey)) {
      shuffleCache.current.set(questionKey, shuffle(currentQ.o.map((o, i) => ({ o, i }))));
    }
    setShuffledOpts(shuffleCache.current.get(questionKey)!);
    setTimeLeft(perQ);

    if (perQTimerRef.current) clearInterval(perQTimerRef.current);
    perQTimerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      setTimeLeft((t) => {
        if (t <= 1) {
          if (perQTimerRef.current) clearInterval(perQTimerRef.current);
          doSkip();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (perQTimerRef.current) clearInterval(perQTimerRef.current); };
  }, [questionKey, reviewOffset]);

  // ── Navigate on finish ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!finished) return;
    const score = answersRef.current.reduce((s, a) => s + a.pointsEarned, 0);
    const correct = answersRef.current.filter((a) => a.isCorrect).length;
    const totalQ = mainQueueRef.current.length;
    const allowed = totalQ * perQ;
    const taken = allowed - Math.max(0, globalTimeLeft);
    finalizeSession(answersRef.current, score, correct, taken, allowed);

    // Save attempted question hashes
    if (effectiveUserId) {
      const hashes = answersRef.current.map(a => qHash(a.question));
      fetch(`${API}/profile/${effectiveUserId}/attempted`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, questionHashes: hashes }),
      }).catch(() => {});
    }

    navigate(`/quiz/${quizId}/result`);
  }, [finished]);

  function addAnswer(ans: QuizAnswer) {
    answersRef.current = [...answersRef.current, ans];
    setAnswers([...answersRef.current]);
  }

  function pushHistory(wasBacklogAdded = false) {
    historyRef.current.push({ mode: modeRef.current, idx: idxRef.current, wasBacklogAdded });
  }

  function advanceQueue(newBacklog?: Question[]) {
    const bl = newBacklog ?? backlogRef.current;
    if (modeRef.current === "main") {
      const next = idxRef.current + 1;
      if (next < mainQueueRef.current.length) { idxRef.current = next; setIdx(next); }
      else if (bl.length > 0) { modeRef.current = "backlog"; idxRef.current = 0; setMode("backlog"); setIdx(0); }
      else { setFinished(true); }
    } else {
      const next = idxRef.current + 1;
      if (next < bl.length) { idxRef.current = next; setIdx(next); }
      else { setFinished(true); }
    }
  }

  function doSkip() {
    if (perQTimerRef.current) clearInterval(perQTimerRef.current);
    const q = modeRef.current === "main" ? mainQueueRef.current[idxRef.current] : backlogRef.current[idxRef.current];
    if (!q) return;

    let wasBacklogAdded = false;
    let newBacklog = backlogRef.current;
    if (modeRef.current === "main") {
      newBacklog = [...backlogRef.current, q];
      backlogRef.current = newBacklog;
      setBacklog([...newBacklog]);
      wasBacklogAdded = true;
    }

    pushHistory(wasBacklogAdded);
    addAnswer({ question: q, selectedOptionIndex: null, isCorrect: false, skipped: true, pointsEarned: 0 });
    advanceQueue(newBacklog);
  }

  function handleAnswer(optIdx: number) {
    if (answered || !currentQ || reviewOffset > 0) return;
    if (perQTimerRef.current) clearInterval(perQTimerRef.current);
    const isCorrect = optIdx === currentQ.a;
    const pts = isCorrect ? Math.max(5, Math.round(10 * (timeLeft / perQ))) : 0;
    setSelectedOptIdx(optIdx);
    setAnswered(true);
    setShowExpl(true);
    pushHistory(false);
    addAnswer({ question: currentQ, selectedOptionIndex: optIdx, isCorrect, skipped: false, pointsEarned: pts });
  }

  function handleNext() {
    if (reviewOffset > 0) {
      setReviewOffset(o => o - 1);
      return;
    }
    advanceQueue();
  }

  function handleBack() {
    const total = historyRef.current.length;
    if (reviewOffset < total) {
      setReviewOffset(o => o + 1);
    }
  }

  // ── Break / Pause ─────────────────────────────────────────────────────────────
  function startBreak(minutes: number) {
    if (perQTimerRef.current) clearInterval(perQTimerRef.current);
    isPausedRef.current = true;
    setPaused(true);
    setBreakMinutes(minutes);
    setBreakTimeLeft(minutes * 60);
    breakTimerRef.current = setInterval(() => {
      setBreakTimeLeft(t => {
        if (t <= 1) {
          resumeBreak();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function resumeBreak() {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    isPausedRef.current = false;
    setPaused(false);
    setBreakMinutes(null);

    if (!answered && reviewOffset === 0) {
      if (perQTimerRef.current) clearInterval(perQTimerRef.current);
      perQTimerRef.current = setInterval(() => {
        if (isPausedRef.current) return;
        setTimeLeft((t) => {
          if (t <= 1) {
            if (perQTimerRef.current) clearInterval(perQTimerRef.current);
            doSkip();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
  }

  // ── Flagging ──────────────────────────────────────────────────────────────────
  async function submitFlag(q: Question) {
    if (!flagReason) return;
    const id = qHash(q);
    try {
      await fetch(`${API}/flags`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: id, questionText: q.q, quizId,
          userId: effectiveUserId ?? "anon", displayName,
          reason: flagReason, note: flagNote || null,
        }),
      });
      setFlaggedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    } catch {}
    setFlagging(false);
    setFlagReason("");
    setFlagNote("");
  }

  // ── Derived display state for review/live ─────────────────────────────────────
  const isReviewMode = reviewOffset > 0;
  const reviewHistIdx = historyRef.current.length - reviewOffset;
  const reviewEntry = isReviewMode ? historyRef.current[reviewHistIdx] : null;
  const reviewAnswer = isReviewMode ? answersRef.current[reviewHistIdx] : null;

  const displayQ: Question | null = isReviewMode && reviewEntry
    ? (reviewEntry.mode === "main" ? mainQueueRef.current[reviewEntry.idx] : backlogRef.current[reviewEntry.idx])
    : currentQ ?? null;
  const displayAnswered = isReviewMode ? true : answered;
  const displaySelectedOpt = isReviewMode ? (reviewAnswer?.selectedOptionIndex ?? null) : selectedOptIdx;
  const displayShowExpl = isReviewMode ? !reviewAnswer?.skipped : showExpl;

  // shuffled opts for display question
  const displayKey = displayQ ? `${isReviewMode ? "rev" : "live"}-${displayQ.q.slice(0, 15)}` : null;
  const displayOpts = displayQ ? (shuffleCache.current.get(displayKey?.replace("rev-", "").replace("live-", "") ?? "") ?? shuffle(displayQ.o.map((o, i) => ({ o, i })))) : [];

  const totalQ = mainQueue.length;
  const doneCount = answers.length;
  const progressPct = totalQ > 0 ? (doneCount / totalQ) * 100 : 0;
  const timerPct = (timeLeft / perQ) * 100;
  const timerColor = timeLeft > perQ * 0.5 ? "#22c55e" : timeLeft > perQ * 0.25 ? "#f59e0b" : "#ef4444";
  const globalPct = globalTimeLeft > 0 && totalQ > 0 ? (globalTimeLeft / (totalQ * perQ)) * 100 : 0;
  const isLastQuestion =
    !isReviewMode && (
      (mode === "main" && idx + 1 >= totalQ && backlog.length === 0) ||
      (mode === "backlog" && idx + 1 >= backlog.length)
    );
  const canGoBack = historyRef.current.length > 0 && reviewOffset < historyRef.current.length;
  const currentQHash = displayQ ? qHash(displayQ) : "";
  const isFlagged = flaggedIds.has(currentQHash);

  if (!displayQ || mainQueue.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Break Modal */}
      <AnimatePresence>
        {paused && (
          <motion.div key="break-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-xs rounded-2xl p-8 text-center flex flex-col gap-4 shadow-xl"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <div className="text-5xl">🕐</div>
              <h2 className="text-2xl font-black">Break Time</h2>
              {breakMinutes !== null ? (
                <>
                  <div className="text-5xl font-black" style={{ color: "#60a5fa", fontFamily: "monospace" }}>{fmtTime(breakTimeLeft)}</div>
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>All timers paused. Relax!</p>
                  <button onClick={resumeBreak}
                    className="w-full py-3 rounded-xl font-bold text-sm"
                    style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff" }}>
                    Resume Early →
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Select break duration:</p>
                  <div className="flex gap-2">
                    {BREAK_OPTIONS.map(m => (
                      <button key={m} onClick={() => startBreak(m)}
                        className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.04]"
                        style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>
                        {m}m
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setPaused(false); resumeBreak(); }}
                    className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Cancel
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flag Modal */}
      <AnimatePresence>
        {flagging && displayQ && (
          <motion.div key="flag-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
            <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
              className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-3 shadow-xl"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">🚩 Flag this question</p>
                <button onClick={() => setFlagging(false)} style={{ color: "hsl(var(--muted-foreground))" }}>✕</button>
              </div>
              <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{displayQ.q}</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { v: "incorrect_answer", l: "Incorrect Answer" },
                  { v: "confusing", l: "Confusing Wording" },
                  { v: "duplicate", l: "Duplicate Question" },
                  { v: "other", l: "Other" },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => setFlagReason(v)}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-left transition-all"
                    style={{
                      background: flagReason === v ? "rgba(239,68,68,0.2)" : "hsl(var(--muted))",
                      color: flagReason === v ? "#f87171" : "hsl(var(--foreground))",
                      border: `1px solid ${flagReason === v ? "rgba(239,68,68,0.4)" : "hsl(var(--border))"}`,
                    }}>
                    {l}
                  </button>
                ))}
              </div>
              <textarea value={flagNote} onChange={e => setFlagNote(e.target.value.slice(0, 200))}
                placeholder="Add a note (optional, max 200 chars)..."
                className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none"
                rows={2}
                style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
              <button onClick={() => submitFlag(displayQ)} disabled={!flagReason}
                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: flagReason ? "rgba(239,68,68,0.2)" : "hsl(var(--muted))",
                  color: flagReason ? "#f87171" : "hsl(var(--muted-foreground))",
                  border: `1px solid ${flagReason ? "rgba(239,68,68,0.4)" : "hsl(var(--border))"}`,
                  opacity: flagReason ? 1 : 0.5,
                }}>
                Submit Flag 🚩
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-4 flex flex-col gap-3">
        {/* Global timer bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: globalTimeLeft < 60 ? "#ef4444" : "#60a5fa" }}>
            ⏱ {fmtTime(globalTimeLeft)}
          </span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: globalTimeLeft < 60 ? "#ef4444" : "linear-gradient(90deg,#3b82f6,#6366f1)" }}
              animate={{ width: `${globalPct}%` }} transition={{ duration: 1 }} />
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>Global</span>
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
              {meta?.subjectName} · Q {doneCount + 1}/{totalQ}
            </p>
            {isReviewMode && (
              <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                👁 Review mode — answers locked
              </p>
            )}
            {!isReviewMode && mode === "backlog" && (
              <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                ⏭ Reviewing {backlog.length - idx} skipped
              </p>
            )}
          </div>

          {/* Per-question timer (only in live mode) */}
          {!isReviewMode && (
            <div className="relative flex items-center justify-center flex-shrink-0">
              <svg width="48" height="48" className={timeLeft <= 5 ? "timer-danger" : ""}>
                <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle cx="24" cy="24" r="20" fill="none" stroke={timerColor} strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - timerPct / 100)}`}
                  transform="rotate(-90 24 24)"
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }} />
              </svg>
              <span className="absolute text-xs font-bold" style={{ color: timerColor }}>{timeLeft}s</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Pause button */}
            <button onClick={() => { isPausedRef.current = true; setPaused(true); setBreakMinutes(null); if (perQTimerRef.current) clearInterval(perQTimerRef.current); }}
              className="p-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.05]"
              style={{ background: "rgba(99,102,241,0.12)", color: "#a78bfa", border: "1px solid rgba(99,102,241,0.2)" }}
              title="Pause / Take a break">
              ⏸
            </button>
            <span className="text-sm font-black" style={{ color: "#60a5fa" }}>
              {answers.reduce((s, a) => s + a.pointsEarned, 0)} pts
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
          <motion.div className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg,#3b82f6,#6366f1)" }}
            animate={{ width: `${progressPct}%` }} transition={{ duration: 0.4 }} />
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div key={`${isReviewMode ? "rev" : "live"}-${displayQ.q.slice(0, 20)}`}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }} className="glow-card p-5 flex flex-col gap-4"
            style={isReviewMode ? { borderColor: "rgba(251,191,36,0.25)" } : {}}>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.15)", color: "#a78bfa", border: "1px solid rgba(99,102,241,0.2)" }}>
                  {displayQ.c}
                </span>
                <button onClick={() => setFlagging(true)}
                  className="px-2 py-0.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.05] ml-auto"
                  style={{ background: isFlagged ? "rgba(239,68,68,0.2)" : "transparent", color: isFlagged ? "#f87171" : "hsl(var(--muted-foreground))", border: "1px solid transparent" }}
                  title="Flag this question">
                  🚩 {isFlagged ? "Flagged" : "Flag"}
                </button>
              </div>
              <p className="text-base font-semibold leading-relaxed">{displayQ.q}</p>
            </div>

            <div className="flex flex-col gap-2">
              {(() => {
                const opts = shuffleCache.current.get(`${mode}-${idx}-${displayQ.q.slice(0, 15)}`) ??
                  (isReviewMode && reviewEntry
                    ? (shuffleCache.current.get(`${reviewEntry.mode}-${reviewEntry.idx}-${displayQ.q.slice(0, 15)}`) ?? displayQ.o.map((o, i) => ({ o, i })))
                    : displayQ.o.map((o, i) => ({ o, i })));
                return opts.map(({ o, i }, pos) => {
                  const isSelected = displaySelectedOpt === i;
                  const isCorrect = i === displayQ.a;
                  let style: React.CSSProperties = { background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" };
                  if (displayAnswered) {
                    if (isCorrect) style = { background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.5)", color: "#34d399" };
                    else if (isSelected) style = { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.5)", color: "#f87171" };
                    else style = { background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", opacity: 0.5 };
                  }
                  return (
                    <button key={`${displayQ.q.slice(0, 8)}-${pos}`}
                      onClick={() => !displayAnswered && !isReviewMode ? handleAnswer(i) : undefined}
                      disabled={displayAnswered || isReviewMode}
                      className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all leading-relaxed"
                      style={{ ...style, cursor: displayAnswered || isReviewMode ? "default" : "pointer" }}
                      onMouseEnter={(e) => { if (!displayAnswered && !isReviewMode) { e.currentTarget.style.background = "hsl(var(--secondary))"; e.currentTarget.style.borderColor = "#6366f1"; } }}
                      onMouseLeave={(e) => { if (!displayAnswered && !isReviewMode) { e.currentTarget.style.background = "hsl(var(--muted))"; e.currentTarget.style.borderColor = "hsl(var(--border))"; } }}>
                      <span className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{ background: displayAnswered && isCorrect ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)" }}>
                          {LABELS[pos]}
                        </span>
                        {o}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>

            <AnimatePresence>
              {(displayShowExpl || displayAnswered || isReviewMode) && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="rounded-2xl p-4 text-xs sm:text-sm leading-relaxed overflow-hidden border shadow-sm transition-all"
                  style={{
                    background:
                      isReviewMode && reviewAnswer?.skipped
                        ? "rgba(251,191,36,0.08)"
                        : displaySelectedOpt === displayQ.a
                        ? "rgba(16,185,129,0.08)"
                        : "rgba(239,68,68,0.08)",
                    borderColor:
                      isReviewMode && reviewAnswer?.skipped
                        ? "rgba(251,191,36,0.3)"
                        : displaySelectedOpt === displayQ.a
                        ? "rgba(16,185,129,0.35)"
                        : "rgba(239,68,68,0.35)",
                  }}
                >
                  {/* Status row */}
                  <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {isReviewMode && reviewAnswer?.skipped
                          ? "⏭"
                          : displaySelectedOpt === displayQ.a
                          ? "✅"
                          : "❌"}
                      </span>
                      <span
                        className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                        style={{
                          background:
                            isReviewMode && reviewAnswer?.skipped
                              ? "rgba(251,191,36,0.2)"
                              : displaySelectedOpt === displayQ.a
                              ? "rgba(16,185,129,0.2)"
                              : "rgba(239,68,68,0.2)",
                          color:
                            isReviewMode && reviewAnswer?.skipped
                              ? "#fbbf24"
                              : displaySelectedOpt === displayQ.a
                              ? "#34d399"
                              : "#f87171",
                        }}
                      >
                        {isReviewMode && reviewAnswer?.skipped
                          ? "Skipped Question"
                          : displaySelectedOpt === displayQ.a
                          ? "Correct Attempt!"
                          : "Incorrect Attempt"}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                      <span>✓ Correct Option:</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        {LABELS[displayQ.a]}
                      </span>
                    </div>
                  </div>

                  {/* Why it is correct feedback */}
                  <div className="rounded-xl p-3.5 bg-muted/60 border border-border/80 text-foreground flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-blue-500 dark:text-blue-400">
                        <span>💡</span>
                        <span>Concept Breakdown (Option {LABELS[displayQ.a]}):</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRequestAiExplanation(displayQ)}
                        disabled={aiLoading[displayQ.q.trim()]}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer hover:scale-[1.02] active:scale-95"
                        style={{
                          background: "rgba(99,102,241,0.15)",
                          borderColor: "rgba(99,102,241,0.35)",
                          color: "#818cf8",
                        }}
                        title="Get an in-depth AI explanation of this concept"
                      >
                        <span>{aiLoading[displayQ.q.trim()] ? "⏳ Analyzing..." : "✨ AI Deep Dive"}</span>
                      </button>
                    </div>

                    <p className="text-xs leading-relaxed text-foreground/90 font-medium whitespace-pre-line">
                      {aiExplanations[displayQ.q.trim()] ||
                        (displayQ.e && displayQ.e.trim().length > 0
                          ? displayQ.e
                          : `Option (${LABELS[displayQ.a]}) "${displayQ.o[displayQ.a]}" is the correct concept answering "${displayQ.q}".`)}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex justify-between items-center gap-2">
          <button onClick={handleBack} disabled={!canGoBack}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: canGoBack ? "rgba(251,191,36,0.12)" : "hsl(var(--muted))",
              color: canGoBack ? "#fbbf24" : "hsl(var(--muted-foreground))",
              border: `1px solid ${canGoBack ? "rgba(251,191,36,0.3)" : "hsl(var(--border))"}`,
              opacity: canGoBack ? 1 : 0.4, cursor: canGoBack ? "pointer" : "not-allowed",
            }}>
            ↩ Back
          </button>

          <div className="flex gap-2">
            {!displayAnswered && !isReviewMode && (
              <button onClick={doSkip}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                Skip ⏭
              </button>
            )}
            {(displayAnswered || isReviewMode) && (
              <button onClick={handleNext}
                className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}>
                {isReviewMode && reviewOffset > 1 ? "← Newer" : isReviewMode ? "Resume Quiz →" : isLastQuestion ? "See Results 🏆" : "Next →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
