import { useState, useEffect } from "react";
import { TopNavbar } from "@/components/TopNavbar";
import { motion, AnimatePresence } from "framer-motion";
import { setStudyTrackerPaused } from "@/lib/studyTimeTracker";
import {
  Coffee,
  Gamepad2,
  Wind,
  Eye,
  Droplets,
  RotateCcw,
  Play,
  Pause,
  Smile,
  ChevronDown,
  ChevronUp,
  Sparkles,
  PauseCircle,
  Timer,
} from "lucide-react";

export function BreakPage() {
  const [breakTimerSeconds, setBreakTimerSeconds] = useState(300); // 5 minutes default
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale">("Inhale");
  const [isPacmanOpen, setIsPacmanOpen] = useState(false);

  // Automatically pause the study time tracker while on the Break page
  useEffect(() => {
    setStudyTrackerPaused(true);
    return () => {
      setStudyTrackerPaused(false);
    };
  }, []);

  // Breather Timer Countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && breakTimerSeconds > 0) {
      interval = setInterval(() => {
        setBreakTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (breakTimerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, breakTimerSeconds]);

  // Mindful Breathing Guide Loop
  useEffect(() => {
    const cycle = setInterval(() => {
      setBreathPhase((prev) => {
        if (prev === "Inhale") return "Hold";
        if (prev === "Hold") return "Exhale";
        return "Inhale";
      });
    }, 4000);
    return () => clearInterval(cycle);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      <TopNavbar />

      {/* ─── BREAK ZONE MAIN CONTENT ─── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col items-center">
        {/* Header Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-3 shadow-xs">
            <Coffee className="w-4 h-4" />
            <span>Relaxation & Quick Game Hub</span>
          </div>
          <h1
            className="text-3xl md:text-4xl font-black tracking-tight mb-2"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Break Zone
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Give your brain a quick breather! Recharge with a mindful timer or play a fast retro round of Google PAC-MAN.
          </p>
        </div>

        {/* ─── STUDY TIME TRACKER PAUSED NOTICE ─── */}
        <div className="w-full mb-6 p-4 rounded-3xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs sm:text-sm font-extrabold text-foreground">
                  Study Time Tracker Paused
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Break Mode Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your study timer is temporarily paused while you relax. This break won't count against your study hours or analytics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 px-3 py-1.5 rounded-xl bg-background/80 border border-border/60 text-[11px] text-muted-foreground font-semibold">
            <Timer className="w-3.5 h-3.5 text-amber-500" />
            <span>Auto-resumes on Study/Quiz</span>
          </div>
        </div>

        {/* ─── GOOGLE PAC-MAN RETRO ARCADE SECTION ─── */}
        <div className="w-full mb-6">
          <div className="rounded-3xl border border-amber-500/30 bg-card overflow-hidden shadow-lg shadow-amber-500/5 transition-all">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shadow-xs">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-foreground tracking-tight">
                      Google PAC-MAN Arcade
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      30th Anniv.
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Authentic interactive Google Doodle doodle with sound & arcade maze
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPacmanOpen(!isPacmanOpen)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  isPacmanOpen
                    ? "border border-border bg-background hover:bg-muted text-muted-foreground"
                    : "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20 hover:brightness-110 active:scale-95"
                }`}
              >
                <span>{isPacmanOpen ? "Collapse Arcade" : "Play PAC-MAN"}</span>
                {isPacmanOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <AnimatePresence>
              {isPacmanOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden bg-[#090d16] flex flex-col items-center justify-center p-3 sm:p-5"
                >
                  <iframe
                    src="/games/pacman/index.html"
                    title="Google PAC-MAN Arcade"
                    scrolling="no"
                    className="w-full max-w-[620px] h-[340px] sm:h-[350px] border-0 rounded-2xl shadow-2xl overflow-hidden"
                    style={{ background: "#090d16", overflow: "hidden" }}
                    loading="lazy"
                  />
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Click inside game or tap <strong>INSERT COIN</strong> to start. Use Arrow keys to navigate!</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ─── INTERACTIVE WELLNESS GRID ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-6">
          {/* Card 1: 5-Minute Breather Timer */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm flex flex-col items-center justify-between text-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Quick Breather Timer
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                5 Min Break
              </span>
            </div>

            <div className="my-4">
              <div className="text-5xl font-black tracking-tight font-mono text-foreground mb-2">
                {formatTime(breakTimerSeconds)}
              </div>
              <p className="text-xs text-muted-foreground">
                {isTimerRunning ? "Take deep breaths & relax..." : "Ready to pause and step away?"}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full justify-center">
              <button
                type="button"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95 cursor-pointer text-white"
                style={{
                  background: isTimerRunning
                    ? "linear-gradient(135deg, #ef4444, #dc2626)"
                    : "linear-gradient(135deg, #f59e0b, #d97706)",
                }}
              >
                {isTimerRunning ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Start Break
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsTimerRunning(false);
                  setBreakTimerSeconds(300);
                }}
                className="p-2.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Guided Mindful Breathing */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm flex flex-col items-center justify-between text-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Guided Box Breathing
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                Mindfulness
              </span>
            </div>

            {/* Pulsing Breathing Circle */}
            <div className="relative my-4 flex items-center justify-center w-36 h-36">
              <motion.div
                animate={{
                  scale: breathPhase === "Inhale" ? [1, 1.25] : breathPhase === "Hold" ? 1.25 : [1.25, 1],
                  opacity: breathPhase === "Hold" ? 0.9 : 0.6,
                }}
                transition={{ duration: 4, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/20 to-teal-500/30 border border-emerald-500/40"
              />
              <div className="relative z-10 flex flex-col items-center">
                <Wind className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-1" />
                <span className="text-base font-extrabold text-foreground">{breathPhase}</span>
                <span className="text-[10px] text-muted-foreground">4 seconds</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Follow the circle pace to quickly calm your nervous system.
            </p>
          </div>
        </div>

        {/* Quick Break Wellness Tips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground mb-0.5">20-20-20 Rule</h4>
              <p className="text-[11px] text-muted-foreground">
                Look at something 20 feet away for 20 seconds to relax your eye muscles.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground mb-0.5">Hydrate</h4>
              <p className="text-[11px] text-muted-foreground">
                Drink a glass of water. Brain cells need hydration for optimal focus.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Smile className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground mb-0.5">Stand & Stretch</h4>
              <p className="text-[11px] text-muted-foreground">
                Roll your shoulders, stretch your arms, and take a quick 1-minute stroll.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
