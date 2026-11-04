import { motion } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";

interface Props {
  onContinueAsGuest: (firstName: string, surname: string, gender: string) => void;
}

export function LoginPage({ onContinueAsGuest }: Props) {
  const { openAuthModal } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0b0f19] text-[#f8fafc]">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm rounded-3xl p-7 relative flex flex-col gap-5 border border-slate-800 shadow-2xl backdrop-blur-xl bg-slate-900/80"
      >
        <div className="text-center pt-2">
          <div className="text-5xl mb-3 drop-shadow-md">🎓</div>
          <h1 className="text-2xl font-black tracking-tight mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Quizzy LMS
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your Personal Learning Management System. Log in to track study time, earn XP, and compete on the leaderboard.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={openAuthModal}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25"
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            }}
          >
            <span>🔐</span>
            <span>Sign In / Register with Clerk</span>
            <span>→</span>
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              or explore
            </span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={() => {
              // Trigger guest entry modal
              const event = new CustomEvent("quizzy_open_guest_prompt");
              window.dispatchEvent(event);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/15"
          >
            <span>👤</span>
            <span>Continue as Guest</span>
          </button>
        </div>

        <p className="text-[11px] text-center text-slate-500">
          Secured by Clerk Authentication
        </p>
      </motion.div>
    </div>
  );
}
