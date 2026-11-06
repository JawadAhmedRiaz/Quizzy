import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";
import { useUser } from "@/context/UserContext";
import { useRevisionStats } from "@/lib/revisionTracker";

export function BottomNavbar() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { isAdmin } = useUser();
  const revisionStats = useRevisionStats();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close more menu when route changes
  useEffect(() => {
    setMoreOpen(false);
  }, [location]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    if (moreOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [moreOpen]);

  // Don't render on admin routes or during active quiz play
  if (
    location.startsWith("/admin") ||
    (location.includes("/quiz/") && location.includes("/play"))
  ) {
    return null;
  }

  const isDashboard = location === "/" || location === "/dashboard";
  const isStudy = location === "/study";
  const isRevision = location.startsWith("/revision");
  const isVault = location.startsWith("/vault");
  const isMoreActive =
    location.startsWith("/comparison") ||
    location.startsWith("/break") ||
    location.startsWith("/profile") ||
    location.startsWith("/flagged") ||
    location.startsWith("/leaderboard");

  const moreLinks = [
    { path: "/leaderboard", label: "Leaderboard", icon: "🏆", desc: "Top quiz scores & XP ranks" },
    { path: "/comparison", label: "Comparison", icon: "⚖️", desc: "Compare stats with peers" },
    { path: "/break", label: "Break Room", icon: "☕", desc: "Breather exercises & games" },
    { path: "/profile", label: "My Profile", icon: "👤", desc: "Account & preferences" },
    { path: "/flagged", label: "Flagged Questions", icon: "🚩", desc: "Your flagged items" },
    ...(isAdmin ? [{ path: "/admin/site-settings", label: "Admin Portal", icon: "⚙️", desc: "App management" }] : []),
  ];

  return (
    <>
      {/* "More" Slide-up Menu Drawer */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-card p-5 pb-8 shadow-2xl md:hidden"
              style={{
                paddingBottom: "max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))",
              }}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
              <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-3">
                <span className="text-sm font-black tracking-wide uppercase text-muted-foreground">
                  More Features
                </span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground hover:text-foreground text-sm"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {moreLinks.map((item) => {
                  const active = location.startsWith(item.path.split("?")[0]);
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setMoreOpen(false);
                      }}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-left transition-all ${
                        active
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30"
                          : "bg-muted/50 hover:bg-muted text-foreground border border-transparent font-medium"
                      }`}
                    >
                      <span className="text-xl flex-shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">→</span>
                    </button>
                  );
                })}
              </div>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    logout();
                  }}
                  className="flex items-center justify-center gap-2 w-full mt-3 py-3 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all min-h-[44px] cursor-pointer"
                >
                  <span>🚪</span>
                  <span>Sign Out</span>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Fixed Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#FAF7F2]/95 dark:bg-[#090D16]/95 backdrop-blur-md border-t border-[#E6DFD3] dark:border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center justify-around h-14 px-1 max-w-lg mx-auto">
          {/* 1. Dashboard */}
          <Link
            href="/"
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-all active:scale-95 ${
              isDashboard
                ? "text-[#007AFF] font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div className="relative">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
              {isDashboard && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#007AFF]" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">Dashboard</span>
          </Link>

          {/* 2. Study */}
          <Link
            href="/study"
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-all active:scale-95 ${
              isStudy
                ? "text-[#007AFF] font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div className="relative">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
              {isStudy && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#007AFF]" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">Study</span>
          </Link>

          {/* 3. Revision */}
          <Link
            href="/revision"
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-all active:scale-95 ${
              isRevision
                ? "text-[#007AFF] font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div className="relative">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              {revisionStats.unmastered > 0 && (
                <span className="absolute -top-1 -right-2 text-[9px] px-1 py-0.2 rounded-full font-black bg-amber-500 text-slate-950 leading-none">
                  {revisionStats.unmastered > 99 ? "99+" : revisionStats.unmastered}
                </span>
              )}
              {isRevision && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#007AFF]" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">Revision</span>
          </Link>

          {/* 4. Vault */}
          <Link
            href="/vault"
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-all active:scale-95 ${
              isVault
                ? "text-[#007AFF] font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div className="relative">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="m14.5 9.5-5 5" />
                <path d="m9.5 9.5 5 5" />
              </svg>
              {isVault && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#007AFF]" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">Vault</span>
          </Link>

          {/* 5. More */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 transition-all active:scale-95 ${
              isMoreActive || moreOpen
                ? "text-[#007AFF] font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
            aria-label="Open more menu"
            aria-expanded={moreOpen}
          >
            <div className="relative">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
              </svg>
              {isMoreActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#007AFF]" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
