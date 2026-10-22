import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/context/UserContext";

export function ProfileCompletionPrompt() {
  const [location, navigate] = useLocation();
  const { profileComplete, effectiveUserId } = useUser();
  const [show, setShow] = useState(false);

  const isHomepage = location === "/";

  useEffect(() => {
    if (!effectiveUserId || profileComplete) { setShow(false); return; }
    if (!isHomepage) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [effectiveUserId, profileComplete, isHomepage]);

  if (profileComplete) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="profile-prompt"
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4"
        >
          <div className="rounded-2xl p-4 flex items-center gap-3 shadow-xl glow-card"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
            <span className="text-2xl flex-shrink-0">👤</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>Complete your profile</p>
              <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Unlock full features & appear with your name</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => { setShow(false); navigate("/profile"); }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff" }}>
                Go →
              </button>
              <button onClick={() => setShow(false)}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>✕</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
