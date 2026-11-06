import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";

interface Props {
  show: boolean;
  onDismiss: () => void;
  onLogin?: (user?: { email: string | null; firstName: string | null }) => void;
}

export function WelcomeModal({ show, onDismiss }: Props) {
  const { openAuthModal } = useAuth();

  function triggerClerkAuth() {
    openAuthModal();
    onDismiss();
  }

  const primaryBtnStyle = {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#fff",
    boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 16 }}
            className="w-full max-w-sm rounded-3xl p-6 relative flex flex-col gap-4 border"
            style={{
              background: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--card-foreground))",
            }}
          >
            <div className="text-center pt-2">
              <div className="text-4xl mb-2">🎓</div>
              <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Welcome to Quizzy!
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                Track your exam practice, earn XP, and compete on the global leaderboard.
              </p>
            </div>

            <div className="flex flex-col gap-3 my-2">
              <button
                type="button"
                onClick={triggerClerkAuth}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={primaryBtnStyle}
              >
                <span>🔐</span>
                <span>Sign In / Create Account</span>
                <span>→</span>
              </button>
            </div>

            <p className="text-[11px] text-center" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
              Secured with Clerk Authentication.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
