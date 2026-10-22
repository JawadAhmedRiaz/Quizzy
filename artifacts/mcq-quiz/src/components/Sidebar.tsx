import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";
import { useUser } from "@/context/UserContext";

interface Props { open: boolean; onClose: () => void; }

function xpLevelInfo(xp: number) {
  if (xp < 201) return { level: "Beginner", emoji: "🌱", next: 201, cur: 0 };
  if (xp < 501) return { level: "Scholar", emoji: "📚", next: 501, cur: 201 };
  if (xp < 1001) return { level: "Expert", emoji: "🎓", next: 1001, cur: 501 };
  if (xp < 2001) return { level: "Master", emoji: "⚔️", next: 2001, cur: 1001 };
  return { level: "Legend", emoji: "👑", next: Infinity, cur: 2001 };
}

export function Sidebar({ open, onClose }: Props) {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, login, logout } = useAuth();
  const { effectiveUserId, profile, gamification, displayName, profileComplete, isAdmin } = useUser();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function goTo(path: string) { navigate(path); onClose(); }

  const xp = gamification?.xp ?? 0;
  const lvl = xpLevelInfo(xp);
  const xpPct = lvl.next === Infinity ? 100 : Math.round(((xp - lvl.cur) / (lvl.next - lvl.cur)) * 100);
  const streakCount = gamification?.streakCount ?? 0;
  const badges = gamification?.badges ?? [];
  const allBadges = gamification?.allBadges ?? [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />

          <motion.aside key="panel"
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col overflow-y-auto"
            style={{ background: "hsl(var(--card))", borderRight: "1px solid hsl(var(--border))" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎓</span>
                <span className="font-black text-lg" style={{ fontFamily: "'Poppins',sans-serif", color: "#007AFF" }}>Quizzy</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-all"
                style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>✕</button>
            </div>

            <div className="flex flex-col gap-3 px-4 pb-6">
              {/* ── PROFILE + XP merged ── */}
              <div className="glow-card overflow-hidden">
                {/* Profile top */}
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>👤 Profile</p>
                  {isAuthenticated && user ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        {user.profileImageUrl ? (
                          <img src={user.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: "2px solid rgba(99,102,241,0.5)" }} />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff" }}>
                            {(displayName[0] ?? "U").toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{displayName}</p>
                          {profile?.rollNumber && <p className="text-xs truncate" style={{ color: "#a78bfa" }}>{profile.rollNumber}</p>}
                          <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{user.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => goTo("/profile")}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: "rgba(99,102,241,0.15)", color: "#a78bfa", border: "1px solid rgba(99,102,241,0.3)" }}>
                          Edit Profile
                        </button>
                        <button onClick={logout}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }}>
                          Log out
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                          style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#1a1a2e" }}>👤</div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{displayName}</p>
                          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Guest · {effectiveUserId?.slice(0, 14) ?? "..."}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => goTo("/profile")}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                          Edit Profile
                        </button>
                        <button onClick={login}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff" }}>
                          Log in
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: "1px", background: "hsl(var(--border))", margin: "0 16px" }} />

                {/* XP & Level below profile, same card */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>⚡ XP & Level</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{lvl.emoji}</span>
                      <span className="text-xs font-black" style={{ color: "#fbbf24" }}>{lvl.level}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-black" style={{ color: "#60a5fa" }}>{xp.toLocaleString()} XP</span>
                    {lvl.next !== Infinity && <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{lvl.next - xp} to next</span>}
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                    <motion.div className="h-full rounded-full" animate={{ width: `${xpPct}%` }}
                      style={{ background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} transition={{ duration: 0.8 }} />
                  </div>
                  {streakCount > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-base">🔥</span>
                      <span className="text-sm font-bold" style={{ color: "#fb923c" }}>{streakCount}-day streak</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── NAVIGATION (above badges) ── */}
              <div className="glow-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>📍 Navigate</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { path: "/", label: "📊 Dashboard" },
                    { path: "/study", label: "📚 Study" },
                    { path: "/revision", label: "🎯 Revision Hub" },
                    { path: "/vault", label: "🏛️ Vault" },
                    { path: "/comparison", label: "⚖️ Comparison" },
                    { path: "/break", label: "☕ Break" },
                    { path: "/analytics?tab=mine", label: "📈 Detailed Analytics" },
                    ...(isAdmin ? [{ path: "/admin/import", label: "⚙️ Admin Dashboard" }] : []),
                  ].map(({ path, label }) => (
                    <button key={path} onClick={() => goTo(path)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all hover:bg-[rgba(0,122,255,0.08)]"
                      style={{ background: "hsl(var(--card))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── BADGES (below navigation) ── */}
              {allBadges.length > 0 && (
                <div className="glow-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>🏅 Badges</p>
                  <div className="grid grid-cols-4 gap-2">
                    {allBadges.map((b) => {
                      const earned = badges.some(eb => eb.badgeId === b.id);
                      return (
                        <div key={b.id} title={earned ? `${b.name} — Earned!` : `${b.name}: ${b.hint}`}
                          className="flex flex-col items-center gap-0.5 cursor-help"
                          style={{ opacity: earned ? 1 : 0.3 }}>
                          <span className="text-2xl">{b.emoji}</span>
                          <span className="text-[9px] text-center leading-tight" style={{ color: earned ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
                            {b.name.split(" ").slice(0, 2).join(" ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-center pt-1">
                <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>made with ❤️ for welfare of students</p>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
