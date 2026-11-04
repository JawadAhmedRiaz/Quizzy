import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";

interface Props {
  show: boolean;
  onDismiss: () => void;
  onLogin: (user?: { email: string | null; firstName: string | null }) => void;
  onContinueAsGuest: (firstName: string, surname: string, gender: string) => void;
}

type Step = "welcome" | "guestForm";

export function WelcomeModal({ show, onDismiss, onLogin, onContinueAsGuest }: Props) {
  const { openAuthModal } = useAuth();

  const [step, setStep] = useState<Step>("welcome");

  // Guest form state
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState("");

  // Guest validation state
  const [guestError, setGuestError] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    const handleGuestPrompt = () => {
      setStep("guestForm");
    };
    window.addEventListener("quizzy_open_guest_prompt", handleGuestPrompt);
    return () => {
      window.removeEventListener("quizzy_open_guest_prompt", handleGuestPrompt);
    };
  }, []);

  function triggerClerkAuth() {
    openAuthModal();
    onDismiss();
  }

  const canContinue = firstName.trim().length > 0 && surname.trim().length > 0 && gender !== "";

  async function handleGuestSubmit() {
    if (!canContinue || guestLoading) return;
    setGuestError("");
    setGuestLoading(true);
    const candidateName = `${firstName.trim()} ${surname.trim()}`;
    const guestId = localStorage.getItem("quizzy_guest_id") || "guest_check";
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: guestId, displayName: candidateName, gender, isGuest: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGuestError(data.error || "Failed to setup guest profile.");
        setGuestLoading(false);
        return;
      }
    } catch {
      // Offline fallback
    }

    setGuestLoading(false);
    onContinueAsGuest(firstName.trim(), surname.trim(), gender);
    onDismiss();
  }

  const primaryBtnStyle = {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#fff",
    boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
  };

  const inputStyle = {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#fff",
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
            {/* ── STEP 1: WELCOME ── */}
            {step === "welcome" && (
              <>
                <div className="text-center pt-2">
                  <div className="text-4xl mb-2">🎓</div>
                  <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Welcome to Quizzy!
                  </h2>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Track your exam practice, earn XP, and compete on the global leaderboard.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* Clerk Sign-In Button */}
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

                  {/* Divider */}
                  <div className="flex items-center gap-2 my-1">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-[11px] font-medium tracking-wider uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
                      or continue anonymously
                    </span>
                    <div className="flex-1 h-px bg-slate-800" />
                  </div>

                  {/* Continue as Guest */}
                  <button
                    onClick={() => setStep("guestForm")}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
                  >
                    <span>👤</span>
                    <span className="flex-1 text-left">Continue as Guest</span>
                    <span style={{ opacity: 0.7 }}>→</span>
                  </button>
                </div>

                <p className="text-[11px] text-center" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
                  Secured with Clerk Authentication.
                </p>
              </>
            )}

            {/* ── STEP 2: GUEST FORM ── */}
            {step === "guestForm" && (
              <>
                <div className="text-center pt-2">
                  <div className="text-3xl mb-1">👤</div>
                  <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Guest Details
                  </h2>
                  <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Enter your name to appear on the leaderboard.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="e.g. Ali"
                      autoFocus
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Surname <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={surname}
                      onChange={e => setSurname(e.target.value)}
                      placeholder="e.g. Khan"
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Gender <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {["Male", "Female"].map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className="py-2 rounded-xl text-sm font-medium border transition-all"
                          style={{
                            borderColor: gender === g ? "#3b82f6" : "rgba(255,255,255,0.1)",
                            background: gender === g ? "rgba(59,130,246,0.15)" : "transparent",
                            color: gender === g ? "#60a5fa" : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {g === "Male" ? "👨 Male" : "👩 Female"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {guestError && (
                    <p className="text-xs text-red-400 text-center font-medium">{guestError}</p>
                  )}

                  <button
                    onClick={handleGuestSubmit}
                    disabled={!canContinue || guestLoading}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 mt-1"
                    style={primaryBtnStyle}
                  >
                    {guestLoading ? "Setting up..." : "Start Learning →"}
                  </button>

                  <button
                    onClick={() => setStep("welcome")}
                    className="text-xs text-center hover:underline"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    ← Back
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
