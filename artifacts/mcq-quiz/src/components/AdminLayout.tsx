import { type ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/context/UserContext";

const NAV_SECTIONS = [
  {
    label: "GENERAL",
    items: [
      { path: "/admin/site-settings", icon: "⚙️", label: "Site Settings" },
    ],
  },
  {
    label: "CONTENT",
    items: [
      { path: "/admin/content", icon: "📁", label: "Content Settings" },
      { path: "/admin/vault",   icon: "🏛️", label: "Vault Materials" },
    ],
  },
  {
    label: "MCQs",
    items: [
      { path: "/admin/import",    icon: "🤖", label: "Add MCQs" },
      { path: "/admin/mcq-bank",  icon: "📚", label: "MCQ Bank" },
      { path: "/admin/quiz-config", icon: "🔧", label: "Quiz Config" },
    ],
  },
  {
    label: "MODERATION",
    items: [
      { path: "/admin/flags",     icon: "🚩", label: "Flags" },
      { path: "/admin/feedbacks", icon: "💬", label: "Feedbacks" },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { path: "/admin/audit", icon: "🔍", label: "Audit Logs" },
    ],
  },
];

interface Props { children: ReactNode }

export function AdminLayout({ children }: Props) {
  const [location, navigate] = useLocation();
  const { isAdmin } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const lastStudentPage =
    typeof window !== "undefined"
      ? sessionStorage.getItem("quizzy_last_student_page") || "/"
      : "/";

  const getPageTitle = (path: string) => {
    if (path.startsWith("/vault")) return "Vault";
    if (path.startsWith("/revision")) return "Revision";
    if (path.startsWith("/study") || path.startsWith("/quiz")) return "Study";
    if (path.startsWith("/break")) return "Break";
    if (path.startsWith("/profile")) return "Profile";
    if (path.startsWith("/comparison")) return "Comparison";
    if (path.startsWith("/flagged")) return "Flagged";
    if (path.startsWith("/analytics")) return "Analytics";
    return "App";
  };

  const handleBackToApp = () => {
    const target =
      typeof window !== "undefined"
        ? sessionStorage.getItem("quizzy_last_student_page")
        : null;
    if (target && !target.startsWith("/admin")) {
      navigate(target);
    } else {
      navigate("/");
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f172a" }}>
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-bold text-white">Admin Access Only</p>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>You don't have permission to view this page.</p>
          <button onClick={handleBackToApp} className="mt-6 px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#3b82f6", color: "#fff" }}>Back to {getPageTitle(lastStudentPage)}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#0f172a", fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile Top Header */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40 shrink-0"
        style={{
          background: "#1e293b",
          borderBottom: "1px solid #334155",
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>⚡</div>
          <div>
            <p className="text-xs font-black text-white leading-none">Quizzy</p>
            <p className="text-[10px] font-semibold" style={{ color: "#6366f1" }}>Admin Portal</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 active:scale-95 transition-all cursor-pointer"
          aria-label="Toggle admin navigation menu"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>
      </header>

      {/* Backdrop for mobile drawer */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-64 md:w-56 flex flex-col z-50 overflow-y-auto transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "#1e293b",
          borderRight: "1px solid #334155",
          paddingTop: "max(0rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        }}
      >

        {/* Logo (Desktop & Mobile Drawer Header) */}
        <div className="px-4 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid #334155" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>⚡</div>
            <div>
              <p className="text-xs font-black text-white leading-none">Quizzy</p>
              <p className="text-[10px] font-semibold" style={{ color: "#6366f1" }}>Admin Portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
          {NAV_SECTIONS.map(({ label, items }) => (
            <div key={label} className="mb-2">
              <p className="text-[9px] font-black uppercase tracking-widest px-2 py-1.5"
                style={{ color: "#475569" }}>{label}</p>
              {items.map(({ path, icon, label: itemLabel }) => {
                const active = location === path || (path !== "/admin/site-settings" && location.startsWith(path));
                return (
                  <button key={path} onClick={() => { navigate(path); setSidebarOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-semibold text-left transition-all mb-0.5 cursor-pointer"
                    style={{
                      background: active ? "rgba(99,102,241,0.15)" : "transparent",
                      color: active ? "#a5b4fc" : "#94a3b8",
                      border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                    }}>
                    <span className="text-sm w-5 text-center shrink-0">{icon}</span>
                    <span className="truncate">{itemLabel}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Back to app */}
        <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid #334155" }}>
          <button onClick={() => { handleBackToApp(); setSidebarOpen(false); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
            style={{ background: "transparent", color: "#64748b", border: "1px solid transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}>
            <span className="text-sm w-5 text-center">←</span>
            Back to {getPageTitle(lastStudentPage)}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main flex-1 ml-0 md:ml-56 min-h-screen overflow-auto" style={{ color: "#e2e8f0" }}>
        {children}
      </main>
    </div>
  );
}
