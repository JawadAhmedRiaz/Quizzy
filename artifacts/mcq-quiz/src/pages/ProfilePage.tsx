import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";
import { useUser } from "@/context/UserContext";
import { TopNavbar } from "@/components/TopNavbar";

const API = import.meta.env.BASE_URL + "api";

const DEPARTMENTS = [
  "Cyber Security",
  "Computer Science",
  "Software Engineering",
  "Information Technology",
  "Data Science",
  "Artificial Intelligence",
  "Other",
];

function completionPct(profile: any): number {
  if (!profile) return 0;
  const fields = [profile.displayName, profile.rollNumber, profile.department, profile.section, profile.gender];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function xpLevelInfo(xp: number) {
  if (xp < 201) return { level: "Beginner", emoji: "🌱", next: 201, cur: 0 };
  if (xp < 501) return { level: "Scholar", emoji: "📚", next: 501, cur: 201 };
  if (xp < 1001) return { level: "Expert", emoji: "🎓", next: 1001, cur: 501 };
  if (xp < 2001) return { level: "Master", emoji: "⚔️", next: 2001, cur: 1001 };
  return { level: "Legend", emoji: "👑", next: Infinity, cur: 2001 };
}

export function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, login, logout } = useAuth();
  const { profile, gamification, saveProfile, refreshProfile, isGuest } = useUser();

  // Profile fields state
  const [displayName, setDisplayName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Logout state
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setRollNumber(profile.rollNumber ?? "");
      setDepartment(profile.department ?? "");
      setSection(profile.section ?? "");
      setGender(profile.gender ?? "");
    }
    if (isGuest) {
      const first = localStorage.getItem("quizzy_guest_firstname") ?? "";
      const sur = localStorage.getItem("quizzy_guest_surname") ?? "";
      const g = localStorage.getItem("quizzy_guest_gender") ?? "";
      if (!profile?.displayName && first) setDisplayName(`${first} ${sur}`.trim());
      if (!profile?.gender && g) setGender(g);
    }
  }, [profile, isGuest]);

  async function handleSave() {
    setSaving(true);
    if (isGuest) {
      const parts = displayName.trim().split(" ");
      const first = parts[0] || "";
      const sur = parts.slice(1).join(" ") || "";
      if (first) localStorage.setItem("quizzy_guest_firstname", first);
      if (sur) localStorage.setItem("quizzy_guest_surname", sur);
      if (gender) localStorage.setItem("quizzy_guest_gender", gender);
    }
    await saveProfile({
      displayName: displayName || null,
      rollNumber: rollNumber || null,
      department: department || null,
      section: section || null,
      gender: gender || null,
    } as any);
    await refreshProfile();
    window.dispatchEvent(new Event("quizzy_profile_updated"));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Failed to update password.");
      } else {
        setPasswordSuccess("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(""), 4000);
      }
    } catch {
      setPasswordError("Network error. Please try again.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      if (isGuest) {
        localStorage.removeItem("quizzy_guest_continued");
        localStorage.removeItem("quizzy_guest_id");
        localStorage.removeItem("quizzy_guest_firstname");
        localStorage.removeItem("quizzy_guest_surname");
        localStorage.removeItem("quizzy_guest_gender");
      }
      await logout();
    } catch {
      window.location.href = "/";
    }
  }

  const pct = completionPct({ ...profile, displayName, rollNumber, department, section, gender });
  const xp = gamification?.xp ?? profile?.xp ?? 0;
  const lvl = xpLevelInfo(xp);
  const xpPct = lvl.next === Infinity ? 100 : Math.round(((xp - lvl.cur) / (lvl.next - lvl.cur)) * 100);
  const streakCount = gamification?.streakCount ?? profile?.streakCount ?? 0;
  const displayNameFirst = displayName || (isGuest ? "Guest Scholar" : user?.firstName || "Student");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      <TopNavbar />

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-xl transition-all hover:scale-[1.02] flex items-center gap-1.5 text-xs font-bold"
              style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
            >
              <span>←</span>
              <span>Dashboard</span>
            </button>
            <div>
              <h1 className="text-xl font-black" style={{ fontFamily: "'Poppins', sans-serif" }}>
                👤 Student Profile
              </h1>
              {isGuest ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                    Guest Mode
                  </span>
                  <button
                    onClick={login}
                    className="text-xs font-semibold px-2 py-0.5 rounded-lg transition-all hover:opacity-80"
                    style={{
                      background: "rgba(99,102,241,0.2)",
                      color: "#a5b4fc",
                      border: "1px solid rgba(99,102,241,0.4)",
                    }}
                  >
                    Log In / Register →
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Avatar + Level Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glow-card p-5 flex items-center gap-4 rounded-3xl"
        >
          {isAuthenticated && user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
              style={{ border: "2px solid rgba(0, 122, 255, 0.6)" }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl flex-shrink-0 font-black text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #007aff, #2563eb)" }}
            >
              {(displayNameFirst[0] || "U").toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-black text-base truncate">{displayNameFirst}</p>
              <span className="text-lg">{lvl.emoji}</span>
            </div>
            <p className="text-sm font-bold" style={{ color: "#fbbf24" }}>
              {lvl.level} · {xp.toLocaleString()} XP
            </p>
            {streakCount > 0 && (
              <p className="text-xs font-bold text-amber-500 mt-0.5">🔥 {streakCount}-day streak</p>
            )}
            {gender && (
              <p className="text-xs mt-0.5 text-muted-foreground">
                {gender === "male" ? "👦 Male" : "👧 Female"}
              </p>
            )}
          </div>
        </motion.div>

        {/* XP Progress Bar */}
        <div className="glow-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">⚡ Level Progress</p>
            <span className="text-xs font-bold">{xpPct}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden bg-muted">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${xpPct}%` }}
              style={{ background: "linear-gradient(90deg, #007aff, #f59e0b)" }}
              transition={{ duration: 1 }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1.5 text-muted-foreground">
            <span>{xp} XP</span>
            {lvl.next !== Infinity ? (
              <span>{lvl.next - xp} XP to next level</span>
            ) : (
              <span style={{ color: "#fbbf24" }}>Max Tier Reached!</span>
            )}
          </div>
        </div>

        {/* Profile Completion Card (if not 100%) */}
        {pct < 100 && (
          <div className="glow-card p-4 rounded-2xl" style={{ borderColor: "rgba(0, 122, 255, 0.3)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">📋 Profile Completion</p>
              <span className="text-sm font-black text-blue-500">{pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-muted">
              <motion.div
                className="h-full rounded-full bg-blue-500"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
        )}

        {/* ─── EDIT PROFILE FIELDS ─── */}
        <div className="glow-card p-5 flex flex-col gap-3 rounded-3xl">
          <p className="text-sm font-bold flex items-center gap-1.5">
            <span>✏️</span>
            <span>Academic & Personal Details</span>
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Hamid Mukhtar"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none bg-muted border border-border text-foreground transition-colors focus:border-blue-500"
            />
          </div>

          {/* Gender toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Gender</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "male", label: "👦 Male" },
                { v: "female", label: "👧 Female" },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setGender(v)}
                  className="py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background:
                      gender === v
                        ? v === "male"
                          ? "rgba(59,130,246,0.2)"
                          : "rgba(236,72,153,0.2)"
                        : "hsl(var(--muted))",
                    color:
                      gender === v ? (v === "male" ? "#60a5fa" : "#f472b6") : "hsl(var(--muted-foreground))",
                    border: `2px solid ${
                      gender === v ? (v === "male" ? "#3b82f6" : "#ec4899") : "hsl(var(--border))"
                    }`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Roll / Registration Number</label>
            <input
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g., S26-0001"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none bg-muted border border-border text-foreground transition-colors focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none bg-muted border border-border text-foreground transition-colors focus:border-blue-500"
            >
              <option value="">Select department…</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Section / Batch</label>
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g., BCS-2A"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none bg-muted border border-border text-foreground transition-colors focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-95 shadow-md mt-1"
            style={{
              background: saved ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #007aff, #2563eb)",
              color: saved ? "#34d399" : "#fff",
            }}
          >
            {saving ? "Saving…" : saved ? "✓ Profile Saved!" : "Save Profile Details"}
          </button>
        </div>

        {/* ─── CHANGE PASSWORD SECTION ─── */}
        <div className="glow-card p-5 flex flex-col gap-3 rounded-3xl">
          <p className="text-sm font-bold flex items-center gap-1.5">
            <span>🔐</span>
            <span>Security & Password</span>
          </p>

          {isGuest ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-400">
              <p className="font-bold mb-1">Guest Account</p>
              <p className="text-[11px] mb-2.5">
                Password protection is available for registered student accounts.
              </p>
              <button
                type="button"
                onClick={login}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow"
              >
                Create Account or Log In
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              {passwordError && (
                <div className="p-2.5 rounded-xl text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  ✓ {passwordSuccess}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm outline-none bg-muted border border-border text-foreground transition-colors focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm outline-none bg-muted border border-border text-foreground transition-colors focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showNewPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none bg-muted border border-border text-foreground transition-colors focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={passwordSaving}
                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-95 shadow text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 mt-1"
              >
                {passwordSaving ? "Updating Password…" : "Update Password"}
              </button>
            </form>
          )}
        </div>

        {/* ─── LOG OUT SECTION ─── */}
        <div className="glow-card p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 border-rose-500/20">
          <div>
            <p className="text-sm font-bold text-foreground">
              {isGuest ? "Exit Guest Mode" : "Account Session"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isGuest ? "Clear temporary guest session data" : "Sign out from this device"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all hover:scale-105 active:scale-95"
          >
            {loggingOut ? "Signing out…" : isGuest ? "🚪 Exit Session" : "🚪 Log Out"}
          </button>
        </div>
      </main>
    </div>
  );
}
