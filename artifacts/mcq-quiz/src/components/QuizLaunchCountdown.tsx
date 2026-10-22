import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { QuizMeta } from "@/data/curriculum";

interface Props {
  meta: QuizMeta;
  totalQuestions: number;
  onComplete: () => void;
}

const STEPS = [
  { count: "3", label: "Connecting to question bank...", glow: "#3b82f6" },
  { count: "2", label: "Shuffling questions for practice...", glow: "#6366f1" },
  { count: "1", label: "Calibrating timers & difficulty...", glow: "#8b5cf6" },
  { count: "GO!", label: "Best of luck! Ace your exam 🔥", glow: "#ec4899" },
];

export function QuizLaunchCountdown({ meta, totalQuestions, onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIdx((prev) => {
        if (prev < STEPS.length - 1) {
          return prev + 1;
        } else {
          clearInterval(timer);
          setTimeout(onComplete, 400);
          return prev;
        }
      });
    }, 700);

    return () => clearInterval(timer);
  }, [onComplete]);

  const current = STEPS[stepIdx];

  return (
    <motion.div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center px-4 text-center select-none"
      style={{
        background: "rgba(9, 13, 22, 0.96)",
        backdropFilter: "blur(16px)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background glow orb */}
      <motion.div
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${current.glow}33 0%, rgba(9, 13, 22, 0) 70%)`,
        }}
        animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating Subject Badge */}
      <motion.div
        className="mb-8 flex items-center gap-3 px-5 py-2.5 rounded-2xl"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: `0 8px 32px ${current.glow}22`,
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <span className="text-3xl">{meta.icon || "📚"}</span>
        <div className="text-left">
          <p className="text-sm font-bold text-white leading-tight">{meta.subjectName}</p>
          <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
            {meta.examLabel} · {totalQuestions} MCQs
          </p>
        </div>
      </motion.div>

      {/* Main Countdown Display */}
      <div className="h-36 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.count}
            initial={{ scale: 0.3, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.6, opacity: 0, filter: "blur(8px)" }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 24,
            }}
            className="font-black tracking-tight"
            style={{
              fontSize: current.count === "GO!" ? "84px" : "110px",
              fontFamily: "'Poppins', sans-serif",
              color: "#fff",
              textShadow: `0 0 30px ${current.glow}, 0 0 60px ${current.glow}88`,
            }}
          >
            {current.count}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dynamic Status Text */}
      <motion.p
        key={current.label}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="text-sm font-semibold mt-4 tracking-wide"
        style={{ color: "#e2e8f0" }}
      >
        {current.label}
      </motion.p>

      {/* Skip button in bottom right corner */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 right-8 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          color: "#94a3b8",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        Skip ⚡
      </button>
    </motion.div>
  );
}
