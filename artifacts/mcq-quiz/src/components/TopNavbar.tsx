import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useUser } from "@/context/UserContext";
import { useSettings } from "@/context/SettingsContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useRevisionStats, syncMistakesFromDatabase } from "@/lib/revisionTracker";

interface Props {
  onOpenSidebar?: () => void;
}

export function TopNavbar(_props: Props = {}) {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { displayName, isAdmin, gamification } = useUser();
  const settings = useSettings();

  const isDashboard = location === "/" || location === "/dashboard";
  const isStudy = location === "/study" || location.startsWith("/quiz");
  const isRevision = location.startsWith("/revision");
  const isVault = location.startsWith("/vault");
  const isComparison = location.startsWith("/comparison");
  const isBreak = location.startsWith("/break");
  const revisionStats = useRevisionStats();

  const avatarInitial = (displayName?.[0] ?? "U").toUpperCase();

  useEffect(() => {
    syncMistakesFromDatabase(displayName || undefined);
  }, [displayName]);

  return (
    <header className="top-navbar w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 backdrop-blur-md bg-[#FAF7F2]/90 border-b border-[#E6DFD3] shadow-xs">
      {/* ── TOP LEFT: LOGO ── */}
      <div className="flex items-center flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
        >
          <img
            src="/logo-transparent.png"
            alt="Quizzy Logo"
            className="h-10 sm:h-12 w-auto object-contain filter drop-shadow(0 2px 8px rgba(0,122,255,0.25))"
          />
          <div className="flex flex-col">
            <span
              className="text-xl sm:text-2xl font-black tracking-tight leading-tight"
              style={{
                fontFamily: "'Poppins', sans-serif",
                background: "linear-gradient(135deg, #1e3a8a, #007aff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {settings.headerTitle || "Quizzy"}
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-blue-600 leading-none">
              Since 2026
            </span>
          </div>
        </Link>
      </div>

      {/* ── MIDDLE: NAVBAR (.menu) ── */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <nav className="menu" aria-label="Main Navigation">
          {/* 1. Dashboard */}
          <Link href="/" className={isDashboard ? "active" : ""}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
            <span>Dashboard</span>
          </Link>

          {/* 2. Study */}
          <Link href="/study" className={isStudy ? "active" : ""}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
            </svg>
            <span>Study</span>
          </Link>

          {/* 3. Revision */}
          <Link href="/revision" className={isRevision ? "active" : ""}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            <span className="flex items-center gap-1.5">
              <span>Revision</span>
              {revisionStats.unmastered > 0 && (
                <span
                  className="text-[9px] px-1.5 py-0.2 rounded-full font-black text-slate-950 shadow-xs"
                  style={{ background: "#f59e0b" }}
                >
                  {revisionStats.unmastered}
                </span>
              )}
            </span>
          </Link>

          {/* 4. Vault */}
          <Link href="/vault" className={isVault ? "active" : ""}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <circle cx="12" cy="12" r="3" />
              <path d="m14.5 9.5-5 5" />
              <path d="m9.5 9.5 5 5" />
            </svg>
            <span>Vault</span>
          </Link>

          {/* 4. Comparison */}
          <Link href="/comparison" className={isComparison ? "active" : ""}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" x2="18" y1="20" y2="10" />
              <line x1="12" x2="12" y1="20" y2="4" />
              <line x1="6" x2="6" y1="20" y2="14" />
            </svg>
            <span>Comparison</span>
          </Link>

          {/* 5. Break */}
          <Link href="/break" className={isBreak ? "active" : ""}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              <line x1="6" x2="6" y1="2" y2="4" />
              <line x1="10" x2="10" y1="2" y2="4" />
              <line x1="14" x2="14" y1="2" y2="4" />
            </svg>
            <span>Break</span>
          </Link>
        </nav>
      </div>

      {/* ── TOP RIGHT: USER CONTROLS ── */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Day/Night Theme Toggle */}
        <ThemeToggle />

        {/* XP Badge */}
        {gamification?.xp !== undefined && (
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-[1.03]"
            style={{
              background: "rgba(245, 158, 11, 0.14)",
              border: "1px solid rgba(245, 158, 11, 0.32)",
              color: "#b45309",
            }}
            title="View XP & Progress"
          >
            <span>⚡</span>
            <span>{gamification.xp.toLocaleString()} XP</span>
          </Link>
        )}

        {/* Admin Link if admin */}
        {isAdmin && (
          <Link
            href="/admin/site-settings"
            onClick={() => {
              if (location && !location.startsWith("/admin")) {
                sessionStorage.setItem("quizzy_last_student_page", location);
              }
            }}
            className="hidden sm:inline-flex px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all hover:opacity-90"
            style={{ background: "#dc2626", color: "#ffffff" }}
          >
            Admin
          </Link>
        )}

        {/* User Avatar Circle -> Opens Profile Page */}
        <Link
          href="/profile"
          className="flex items-center justify-center p-0.5 rounded-full transition-transform hover:scale-105 active:scale-95 group"
          title={`My Profile (${displayName || "Student"})`}
        >
          {isAuthenticated && user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={displayName}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-blue-500/70 group-hover:ring-blue-600 transition-all shadow-xs"
            />
          ) : (
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-sm text-white shadow-xs ring-2 ring-blue-500/70 group-hover:ring-blue-600 transition-all cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #007aff, #2563eb)",
              }}
            >
              {avatarInitial}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
