import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onFinish: () => void;
  minDurationMs?: number;
}

export function SplashScreen({ onFinish, minDurationMs = 1200 }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Smooth progress bar fill
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
      setProgress(pct);

      if (elapsed >= minDurationMs) {
        clearInterval(interval);
        setTimeout(onFinish, 300);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [minDurationMs, onFinish]);

  return (
    <motion.div
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none"
      style={{
        backgroundColor: "#FAF7F2",
        backgroundImage: "radial-gradient(circle at 50% 40%, rgba(0, 122, 255, 0.08) 0%, #FAF7F2 70%)",
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
    >
      {/* Floating Logo with Pulsing Glow */}
      <div className="relative flex items-center justify-center mb-5">
        <motion.div
          className="absolute w-32 h-32 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(0, 122, 255, 0.25) 0%, rgba(0, 122, 255, 0) 70%)",
          }}
          animate={{ scale: [0.85, 1.3, 0.85], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="cursor-default"
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 20 }}
        >
          <img
            src="/logo-transparent.png"
            alt="Quizzy"
            className="w-24 h-24 sm:w-28 sm:h-28 object-contain filter drop-shadow(0 8px 24px rgba(0, 122, 255, 0.35))"
          />
        </motion.div>
      </div>

      {/* Title - Quizzy Royal/Electric Blue */}
      <motion.h1
        className="text-4xl font-black mb-1 tracking-tight"
        style={{
          fontFamily: "'Poppins', sans-serif",
          background: "linear-gradient(135deg, #1E3A8A 0%, #007AFF 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        Quizzy
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="text-xs font-semibold mb-8 tracking-wider uppercase"
        style={{ color: "#475569" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        Your Own Learning Management System
      </motion.p>

      {/* Progress Track & Bar */}
      <motion.div
        className="w-48 h-1.5 rounded-full overflow-hidden relative"
        style={{ background: "rgba(0, 122, 255, 0.12)", border: "1px solid rgba(0, 122, 255, 0.18)" }}
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #1E3A8A 0%, #007AFF 100%)",
            boxShadow: "0 0 14px rgba(0, 122, 255, 0.6)",
            transition: "width 0.04s linear",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
