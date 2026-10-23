import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";

const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  "319595872440-tga4634pp5950bi71n25mb2v0mbl9r2r.apps.googleusercontent.com";

interface Props {
  show: boolean;
  onDismiss: () => void;
  onLogin: (user?: { email: string | null; firstName: string | null }) => void;
  onContinueAsGuest: (firstName: string, surname: string, gender: string) => void;
}

type Step = "welcome" | "login" | "register" | "guestForm" | "socialLogin" | "verifyOtp";

export function WelcomeModal({ show, onDismiss, onLogin, onContinueAsGuest }: Props) {
  const { loginWithEmail, register, verifyEmail, resendVerificationCode, loginWithGoogle } = useAuth();

  const [step, setStep] = useState<Step>("welcome");

  // Guest form state
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Social login state
  const [socialEmail, setSocialEmail] = useState("");
  const [socialName, setSocialName] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  // OTP verification state
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResent, setOtpResent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingFirstName, setPendingFirstName] = useState("");

  // Guest validation state
  const [guestError, setGuestError] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    if (!show || step !== "welcome") return;

    let active = true;

    const initGoogle = () => {
      if (!active) return false;
      const google = (window as any).google?.accounts?.id;
      const container = document.getElementById("google-btn-container");
      if (!google || !container) return false;

      try {
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: { credential?: string }) => {
            if (!response?.credential) return;
            setGoogleLoading(true);
            try {
              const res = await loginWithGoogle({ credential: response.credential });
              if (res.error) {
                setSocialError(res.error);
                setStep("socialLogin");
              } else {
                localStorage.removeItem("quizzy_guest_continued");
                localStorage.setItem("welcomeDismissed", "1");
                onLogin({
                  email: res.user?.email || null,
                  firstName: res.user?.firstName || "Student",
                });
                onDismiss();
              }
            } catch (err: any) {
              setSocialError(err?.message || "Google sign-in failed");
              setStep("socialLogin");
            } finally {
              setGoogleLoading(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        container.innerHTML = "";
        google.renderButton(container, {
          theme: "outline",
          size: "large",
          type: "standard",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          width: 336,
        });
        return true;
      } catch (e) {
        console.error("Google button render error:", e);
        return false;
      }
    };

    if (!initGoogle()) {
      const interval = setInterval(() => {
        if (initGoogle()) {
          clearInterval(interval);
        }
      }, 200);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    return () => {
      active = false;
    };
  }, [show, step]);

  function triggerGooglePrompt() {
    const google = (window as any).google?.accounts?.id;
    if (google) {
      google.prompt();
    } else {
      startSocial("Google");
    }
  }

  const canContinue = firstName.trim().length > 0 && surname.trim().length > 0 && gender !== "";

  async function handleGuestSubmit() {
    if (!canContinue || guestLoading) return;
    setGuestError("");
    setGuestLoading(true);
    const candidateName = `${firstName.trim()} ${surname.trim()}`;
    const guestId = localStorage.getItem("quizzy_guest_id") || "guest_check";
    try {
      const res = await fetch(`${API}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: guestId, displayName: candidateName, gender, isGuest: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGuestError(data.error || `The name "${candidateName}" is already taken by another student. Please choose a unique name.`);
        setGuestLoading(false);
        return;
      }
    } catch {}
    setGuestLoading(false);
    onContinueAsGuest(firstName.trim(), surname.trim(), gender);
  }

  async function handleLogin() {
    setLoginError("");
    setLoginLoading(true);
    const result = await loginWithEmail(loginEmail, loginPassword);
    setLoginLoading(false);
    if (result.error) {
      setLoginError(result.error);
    } else {
      localStorage.removeItem("quizzy_guest_continued");
      localStorage.setItem("welcomeDismissed", "1");
      onLogin({ email: loginEmail, firstName: null });
      onDismiss();
    }
  }

  async function handleRegister() {
    setRegError("");
    setRegLoading(true);
    const result = await register(regEmail, regPassword, regFirstName, regLastName);
    setRegLoading(false);
    if (result.error) {
      setRegError(result.error);
    } else if (result.requireVerification) {
      setPendingEmail(result.email || regEmail.trim().toLowerCase());
      setPendingFirstName(regFirstName.trim());
      setOtpCode("");
      setOtpError("");
      setStep("verifyOtp");
    } else {
      localStorage.removeItem("quizzy_guest_continued");
      localStorage.setItem("welcomeDismissed", "1");
      onLogin({ email: regEmail, firstName: regFirstName });
      onDismiss();
    }
  }

  async function handleVerifyOtp() {
    if (otpCode.trim().length !== 6) {
      setOtpError("Please enter the 6-digit verification code");
      return;
    }
    setOtpError("");
    setOtpLoading(true);
    const result = await verifyEmail(pendingEmail, otpCode.trim());
    setOtpLoading(false);
    if (result.error) {
      setOtpError(result.error);
    } else {
      localStorage.removeItem("quizzy_guest_continued");
      localStorage.setItem("welcomeDismissed", "1");
      onLogin({
        email: result.user?.email || pendingEmail,
        firstName: result.user?.firstName || pendingFirstName,
      });
      onDismiss();
    }
  }

  async function handleResendOtp() {
    setOtpError("");
    const result = await resendVerificationCode(pendingEmail);
    if (result.error) {
      setOtpError(result.error);
    } else {
      setOtpResent(true);
      setTimeout(() => setOtpResent(false), 4000);
    }
  }

  async function handleSocialSubmit() {
    if (!socialEmail.trim()) {
      setSocialError("Please enter your email");
      return;
    }
    setSocialError("");
    setSocialLoading(true);

    const nameParts = socialName.trim().split(" ");
    const fName = nameParts[0] || "Google";
    const lName = nameParts.slice(1).join(" ") || "User";

    const res = await loginWithGoogle({
      email: socialEmail.trim(),
      firstName: fName,
      lastName: lName,
      profileImageUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fName + " " + lName)}&backgroundColor=3b82f6`,
    });

    setSocialLoading(false);
    if (res.error) {
      setSocialError(res.error);
    } else {
      localStorage.removeItem("quizzy_guest_continued");
      localStorage.setItem("welcomeDismissed", "1");
      onLogin({ email: socialEmail.trim(), firstName: fName });
      onDismiss();
    }
  }

  function startSocial() {
    setSocialError("");
    setSocialEmail("@gmail.com");
    setSocialName("");
    setStep("socialLogin");
  }

  const inputStyle = {
    background: "hsl(var(--muted))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))",
  };

  const primaryBtnStyle = {
    background: "linear-gradient(135deg, #3b82f6, #6366f1)",
    color: "#fff",
    boxShadow: "0 4px 20px rgba(59,130,246,0.35)",
  };

  const backLink = (target: Step) => (
    <button
      onClick={() => setStep(target)}
      className="text-xs mt-1 transition-opacity hover:opacity-80"
      style={{ color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer" }}
    >
      ← Back
    </button>
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5 relative"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            }}
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {/* ── WELCOME STEP ── */}
            {step === "welcome" && (
              <>
                <div className="text-center pt-2">
                  <div className="text-5xl mb-3">🎓</div>
                  <h2 className="text-xl font-bold mb-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Welcome to Quizzy!
                  </h2>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Track your exam practice, earn XP, and compete on the global leaderboard.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* Google Sign-In Container */}
                  <div className="w-full flex flex-col items-center">
                    <div
                      id="google-btn-container"
                      className="w-full flex items-center justify-center min-h-[44px]"
                    >
                      <button
                        type="button"
                        onClick={triggerGooglePrompt}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: "#ffffff",
                          color: "#1e293b",
                          border: "1px solid rgba(0,0,0,0.12)",
                          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                        }}
                      >
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>Continue with Google</span>
                      </button>
                    </div>

                    {googleLoading && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-blue-400 font-medium">
                        <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span>Connecting to Google...</span>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2 my-1">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-[11px] font-medium tracking-wider uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
                      or with email
                    </span>
                    <div className="flex-1 h-px bg-slate-800" />
                  </div>

                  {/* Email Login */}
                  <button
                    onClick={() => setStep("login")}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={primaryBtnStyle}
                  >
                    <span>🔐</span>
                    <span className="flex-1 text-left">Login with Email</span>
                    <span style={{ opacity: 0.7 }}>→</span>
                  </button>

                  {/* Register */}
                  <button
                    onClick={() => setStep("register")}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
                  >
                    <span>✨</span>
                    <span className="flex-1 text-left">Create Free Account</span>
                    <span style={{ opacity: 0.7 }}>→</span>
                  </button>

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
                  No password required for Google or Guest mode.
                </p>
              </>
            )}

            {/* ── SOCIAL LOGIN (GOOGLE) ── */}
            {step === "socialLogin" && (
              <>
                <div className="text-center pt-1">
                  <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-xl shadow-lg"
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Continue with Google
                  </h2>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Enter your Google email to sign into Quizzy.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Google Email
                    </label>
                    <input
                      type="email"
                      value={socialEmail}
                      onChange={e => setSocialEmail(e.target.value)}
                      placeholder="student@gmail.com"
                      autoFocus
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      value={socialName}
                      onChange={e => setSocialName(e.target.value)}
                      placeholder="e.g. Jawad Ahmed"
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>

                  {socialError && (
                    <p className="text-xs text-red-400 text-center font-medium">{socialError}</p>
                  )}

                  <button
                    onClick={handleSocialSubmit}
                    disabled={socialLoading}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={primaryBtnStyle}
                  >
                    {socialLoading ? "Connecting…" : `Sign in with ${socialProvider} →`}
                  </button>
                </div>

                {backLink("welcome")}
              </>
            )}

            {/* ── EMAIL LOGIN ── */}
            {step === "login" && (
              <>
                <div className="text-center">
                  <div className="text-4xl mb-3">🔐</div>
                  <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Login with Email
                  </h2>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Enter your email and password to continue.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoFocus
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Password
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={inputStyle}
                      onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                    />
                  </div>

                  {loginError && (
                    <p className="text-xs text-red-400 text-center font-medium">{loginError}</p>
                  )}

                  <button
                    onClick={handleLogin}
                    disabled={loginLoading}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={primaryBtnStyle}
                  >
                    {loginLoading ? "Logging in…" : "Login →"}
                  </button>
                </div>

                <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Don't have an account?{" "}
                  <button
                    onClick={() => setStep("register")}
                    className="font-semibold underline"
                    style={{ color: "#818cf8" }}
                  >
                    Create one
                  </button>
                </p>

                {backLink("welcome")}
              </>
            )}

            {/* ── REGISTER ── */}
            {step === "register" && (
              <>
                <div className="text-center">
                  <div className="text-4xl mb-3">✨</div>
                  <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Create Account
                  </h2>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Sign up to track your scores and appear on leaderboards.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                        First Name
                      </label>
                      <input
                        value={regFirstName}
                        onChange={e => setRegFirstName(e.target.value)}
                        placeholder="John"
                        autoFocus
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Last Name
                      </label>
                      <input
                        value={regLastName}
                        onChange={e => setRegLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Password
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={inputStyle}
                      onKeyDown={e => { if (e.key === "Enter") handleRegister(); }}
                    />
                  </div>

                  {regError && (
                    <p className="text-xs text-red-400 text-center font-medium">{regError}</p>
                  )}

                  <button
                    onClick={handleRegister}
                    disabled={regLoading}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={primaryBtnStyle}
                  >
                    {regLoading ? "Creating account…" : "Create Account →"}
                  </button>
                </div>

                <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Already have an account?{" "}
                  <button
                    onClick={() => setStep("login")}
                    className="font-semibold underline"
                    style={{ color: "#818cf8" }}
                  >
                    Login
                  </button>
                </p>

                {backLink("welcome")}
              </>
            )}

            {/* ── VERIFY EMAIL OTP ── */}
            {step === "verifyOtp" && (
              <>
                <div className="text-center pt-1">
                  <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl shadow-lg"
                    style={{
                      background: "rgba(59,130,246,0.15)",
                      border: "1px solid rgba(59,130,246,0.3)",
                      color: "#60a5fa",
                    }}
                  >
                    ✉️
                  </div>
                  <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Verify Your Email
                  </h2>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    We sent a 6-digit confirmation code to:
                  </p>
                  <p className="text-xs font-semibold text-blue-400 mt-0.5 break-all">
                    {pendingEmail}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1.5 text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Enter 6-Digit Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="• • • • • •"
                      autoFocus
                      className="w-full py-3 text-center text-2xl font-mono font-bold tracking-widest rounded-xl outline-none"
                      style={{
                        background: "hsl(var(--muted))",
                        border: "1px solid hsl(var(--border))",
                        color: "hsl(var(--foreground))",
                        letterSpacing: "8px",
                      }}
                      onKeyDown={e => { if (e.key === "Enter") handleVerifyOtp(); }}
                    />
                  </div>

                  {otpError && (
                    <p className="text-xs text-red-400 text-center font-medium">{otpError}</p>
                  )}

                  {otpResent && (
                    <p className="text-xs text-emerald-400 text-center font-medium">✓ A fresh verification code has been sent!</p>
                  )}

                  <button
                    onClick={handleVerifyOtp}
                    disabled={otpLoading || otpCode.length !== 6}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      ...primaryBtnStyle,
                      opacity: otpCode.length === 6 ? 1 : 0.6,
                      cursor: otpCode.length === 6 ? "pointer" : "not-allowed",
                    }}
                  >
                    {otpLoading ? "Verifying…" : "Verify & Activate Account →"}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1 px-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="hover:underline transition-colors"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
                    >
                      Didn't get code? <span className="text-blue-400 font-semibold">Resend</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep("register")}
                      className="hover:underline transition-colors"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
                    >
                      Change email
                    </button>
                  </div>
                </div>

                {backLink("register")}
              </>
            )}

            {/* ── GUEST FORM ── */}
            {step === "guestForm" && (
              <>
                <div className="text-center">
                  <div className="text-4xl mb-3">👤</div>
                  <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Quick Guest Setup
                  </h2>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Your name will appear on leaderboards and analytics.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      First Name <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="e.g., Hamid"
                      autoFocus
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: "hsl(var(--muted))", border: `1px solid ${firstName.trim() ? "#22c55e" : "hsl(var(--border))"}`, color: "hsl(var(--foreground))" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Surname <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      value={surname}
                      onChange={e => setSurname(e.target.value)}
                      placeholder="e.g., Mukhtar"
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: "hsl(var(--muted))", border: `1px solid ${surname.trim() ? "#22c55e" : "hsl(var(--border))"}`, color: "hsl(var(--foreground))" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Gender <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { v: "male", label: "👦 Male" },
                        { v: "female", label: "👧 Female" },
                      ].map(({ v, label }) => (
                        <button
                          key={v}
                          onClick={() => setGender(v)}
                          className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background: gender === v ? (v === "male" ? "rgba(59,130,246,0.25)" : "rgba(236,72,153,0.25)") : "hsl(var(--muted))",
                            color: gender === v ? (v === "male" ? "#60a5fa" : "#f472b6") : "hsl(var(--muted-foreground))",
                            border: `2px solid ${gender === v ? (v === "male" ? "#3b82f6" : "#ec4899") : "hsl(var(--border))"}`,
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {guestError && (
                  <p className="text-xs p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 font-semibold text-center">
                    {guestError}
                  </p>
                )}

                <button
                  onClick={handleGuestSubmit}
                  disabled={!canContinue || guestLoading}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: canContinue && !guestLoading ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "hsl(var(--muted))",
                    color: canContinue && !guestLoading ? "#fff" : "hsl(var(--muted-foreground))",
                    opacity: canContinue && !guestLoading ? 1 : 0.6,
                    cursor: canContinue && !guestLoading ? "pointer" : "not-allowed",
                    boxShadow: canContinue && !guestLoading ? "0 4px 20px rgba(59,130,246,0.35)" : "none",
                  }}
                >
                  {guestLoading ? "Checking Name..." : canContinue ? "Continue →" : "Fill all fields to continue"}
                </button>

                <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                  This is required to personalize your experience.
                </p>

                {backLink("welcome")}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
