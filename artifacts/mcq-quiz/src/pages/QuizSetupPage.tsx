import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuiz, type QuizDifficulty } from "@/context/QuizContext";
import { getQuizMeta, getQuizQuestions, type QuizMeta } from "@/data/curriculum";
import { useSettings } from "@/context/SettingsContext";
import type { Question } from "@/data/questions";
import { QuizLaunchCountdown } from "@/components/QuizLaunchCountdown";

const API = import.meta.env.BASE_URL + "api";


export function QuizSetupPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const settings = useSettings();
  const {
    playerName, setPlayerName,
    totalToAttempt, setTotalToAttempt,
    difficulty, setDifficulty,
    startSession,
  } = useQuiz();
  const [customCount, setCustomCount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const DIFFICULTIES: { id: QuizDifficulty; label: string; time: string; sub: string }[] = [
    { id: "easy", label: "Easy", time: `${settings.easyTime}s`, sub: "Practice pace" },
    { id: "medium", label: "Medium", time: `${settings.mediumTime}s`, sub: "Exam pace" },
    { id: "hard", label: "Hard", time: `${settings.hardTime}s`, sub: "Speed drill" },
  ];

  // DB quiz support
  const isDbQuiz = !!quizId?.startsWith("db-");
  const [dbData, setDbData] = useState<{ meta: QuizMeta; questions: Question[] } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  useEffect(() => {
    if (!isDbQuiz || !quizId) return;
    setDbLoading(true);
    fetch(`${API}/quiz-questions/${quizId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setDbData({ meta: data.meta as QuizMeta, questions: data.questions as Question[] });
        setDbLoading(false);
      })
      .catch(() => setDbLoading(false));
  }, [quizId]);

  useEffect(() => {
    if (user && !playerName) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      if (name) setPlayerName(name);
    }
  }, [user]);

  const meta = isDbQuiz ? dbData?.meta ?? null : getQuizMeta(quizId!);
  const questions: Question[] = isDbQuiz ? dbData?.questions ?? [] : getQuizQuestions(quizId!);

  // Loading state for DB quizzes
  if (isDbQuiz && dbLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6 text-center select-none">
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <span className="absolute text-3xl">📚</span>
        </div>
        <div>
          <p className="text-base font-bold text-white tracking-wide">Connecting to Question Bank…</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving exam-grade MCQs from Supabase</p>
        </div>
      </div>
    );
  }

  if (!meta || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <div className="text-5xl">🔒</div>
        <p className="text-lg font-semibold">Quiz not available yet</p>
        <button onClick={() => navigate("/")} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>← Back</button>
      </div>
    );
  }

  const defaultN = Math.min(settings.defaultCount, questions.length);
  const presets = [
    { n: 10, label: "10 MCQs", sub: "Quick drill" },
    { n: 20, label: "20 MCQs", sub: "Short session" },
    { n: defaultN, label: `${defaultN} MCQs`, sub: "Standard" },
    { n: questions.length, label: `All ${questions.length}`, sub: "Full exam" },
  ].filter((p, i, arr) => arr.findIndex(x => x.n === p.n) === i);

  const finalCount = useCustom
    ? Math.min(Math.max(1, parseInt(customCount) || 1), questions.length)
    : totalToAttempt;
  const selectedDifficulty = DIFFICULTIES.find((d) => d.id === difficulty)!;

  function handleStart() {
    if (!playerName.trim()) { alert("Please enter your name!"); return; }
    if (useCustom) setTotalToAttempt(finalCount);
    startSession(quizId!, questions, finalCount, meta);
    setIsLaunching(true);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 flex flex-col gap-4">
        <button onClick={() => navigate("/")}
          className="self-start flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80"
          style={{ color: "hsl(var(--muted-foreground))" }}>← Back to Home</button>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="text-center py-2">
          <div className="text-5xl mb-3">{meta.icon}</div>
          <h1 className="text-2xl font-black mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>{meta.subjectName}</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: "rgba(99,102,241,0.15)", color: "#a78bfa", border: "1px solid rgba(99,102,241,0.3)" }}>
            Semester {meta.sem} · {meta.examLabel}
          </div>
        </motion.div>

        {/* Name */}
        <div className="glow-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            👤 Your Name
          </p>
          <input
            type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name…" maxLength={28}
            className="w-full px-4 py-3 rounded-lg text-sm font-medium outline-none transition-all"
            style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
          />
        </div>

        {/* MCQ count */}
        <div className="glow-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
            📝 Enter number of MCQs you want to attempt
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {presets.map(({ n, label, sub }) => (
              <button key={n}
                onClick={() => { setTotalToAttempt(n); setUseCustom(false); }}
                className="py-3 px-3 rounded-xl text-left transition-all hover:scale-[1.01]"
                style={{
                  background: !useCustom && totalToAttempt === n ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "hsl(var(--muted))",
                  color: !useCustom && totalToAttempt === n ? "#fff" : "hsl(var(--muted-foreground))",
                  border: `1px solid ${!useCustom && totalToAttempt === n ? "transparent" : "hsl(var(--border))"}`,
                  boxShadow: !useCustom && totalToAttempt === n ? "0 4px 16px rgba(59,130,246,0.3)" : "none",
                }}>
                <div className="font-bold text-sm">{label}</div>
                <div className="text-xs opacity-70">{sub}</div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={questions.length}
              value={customCount}
              onFocus={() => setUseCustom(true)}
              onChange={(e) => { setCustomCount(e.target.value); setUseCustom(true); }}
              placeholder={`Custom (1–${questions.length})`}
              className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{
                background: "hsl(var(--muted))",
                border: `1px solid ${useCustom ? "#6366f1" : "hsl(var(--border))"}`,
                color: "hsl(var(--foreground))",
              }}
            />
            {useCustom && customCount && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(99,102,241,0.15)", color: "#a78bfa" }}>
                {finalCount} Qs
              </span>
            )}
          </div>
        </div>

        {/* Difficulty */}
        <div className="glow-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
            ⚡ Difficulty
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map(({ id, label, time, sub }) => (
              <button key={id}
                onClick={() => setDifficulty(id)}
                className="py-3 px-2 rounded-xl text-center transition-all hover:scale-[1.01]"
                style={{
                  background: difficulty === id ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "hsl(var(--muted))",
                  color: difficulty === id ? "#fff" : "hsl(var(--muted-foreground))",
                  border: `1px solid ${difficulty === id ? "transparent" : "hsl(var(--border))"}`,
                  boxShadow: difficulty === id ? "0 4px 16px rgba(59,130,246,0.3)" : "none",
                }}>
                <div className="font-bold text-sm">{label}</div>
                <div className="text-xs opacity-80">{time}/Q</div>
                <div className="text-[10px] opacity-70">{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="glow-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Quiz Rules</p>
          <ul className="text-xs flex flex-col gap-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
            <li>⏱ {selectedDifficulty.time} per question in {selectedDifficulty.label} mode — faster answers earn more points</li>
            <li>🔀 Questions are always shuffled for exam-grade practice</li>
            <li>⏭ Skipped questions go to a backlog and reappear at the end</li>
            <li>↩️ Use Back button during the quiz to revise your answer</li>
            <li>📋 Detailed per-topic analysis shown after completion</li>
            <li>🏆 Score saved to per-quiz leaderboard automatically</li>
          </ul>
        </div>

        <button onClick={handleStart}
          className="w-full py-4 rounded-2xl font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", boxShadow: "0 8px 32px rgba(59,130,246,0.4)" }}>
          Start Quiz ({finalCount} MCQs) →
        </button>
      </div>

      <AnimatePresence>
        {isLaunching && meta && (
          <QuizLaunchCountdown
            meta={meta}
            totalQuestions={finalCount}
            onComplete={() => navigate(`/quiz/${quizId}/play`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
