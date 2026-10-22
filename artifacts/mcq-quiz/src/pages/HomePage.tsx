import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";
import { type Subject, setDbSubjectsCache } from "@/data/curriculum";
import { Sidebar } from "@/components/Sidebar";
import { TopNavbar } from "@/components/TopNavbar";
import { useUser } from "@/context/UserContext";
import { useSettings } from "@/context/SettingsContext";

const API = import.meta.env.BASE_URL + "api";

const ORDINAL_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

function semLabel(sem: number) {
  return `${ORDINAL_LABELS[sem - 1] ?? sem + "th"} Semester`;
}

interface DbSubject {
  id: number;
  sem: number;
  name: string;
  icon: string;
  color: string;
  gradient: string;
  isActive: boolean;
  examTypes: string[];
  questionCounts?: Record<string, number>;
}

function dbToSubject(s: DbSubject): Subject {
  return {
    id: `db-${s.id}`,
    name: s.name,
    icon: s.icon,
    color: s.color,
    gradient: s.gradient,
    exams: s.examTypes.map((et) => {
      const count = s.questionCounts?.[et.toLowerCase()] ?? 0;
      return {
        id: `db-${s.id}-${et.toLowerCase()}`,
        label: et + " Exam",
        available: count > 0,
      };
    }),
  };
}

export function HomePage() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { effectiveUserId, profile, isAdmin } = useUser();
  const settings = useSettings();
  const [selectedSem, setSelectedSem] = useState(1);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attemptedMap, setAttemptedMap] = useState<Record<string, boolean>>({});
  const [dbSubjects, setDbSubjects] = useState<DbSubject[]>([]);
  const [activeSemesters, setActiveSemesters] = useState<number[]>([1]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [radialOpen, setRadialOpen] = useState(false);

  // Feedback modal state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  async function sendFeedback() {
    if (!feedbackMsg.trim() || feedbackSending) return;
    setFeedbackSending(true);
    try {
      await fetch(`${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: effectiveUserId,
          displayName: (profile as Record<string, unknown> | null)?.displayName ?? null,
          rollNumber: (profile as Record<string, unknown> | null)?.rollNumber ?? null,
          message: feedbackMsg.trim(),
        }),
      });
      setFeedbackSent(true);
      setFeedbackMsg("");
      setTimeout(() => { setFeedbackSent(false); setFeedbackOpen(false); }, 2500);
    } catch {
      // silent fail
    } finally {
      setFeedbackSending(false);
    }
  }

  // Fetch active semesters
  useEffect(() => {
    fetch(`${API}/semesters`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: { num: number; isActive: boolean }[]) => {
        const nums = data.filter((s) => s.isActive).map((s) => s.num).sort((a, b) => a - b);
        if (nums.length > 0) setActiveSemesters(nums);
      })
      .catch(() => {});
  }, []);

  // Fetch DB subjects
  useEffect(() => {
    fetch(`${API}/subjects`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: DbSubject[]) => {
        setDbSubjects(data);
        setDbSubjectsCache(data);
        setSubjectsLoading(false);
      })
      .catch(() => setSubjectsLoading(false));
  }, []);

  // Load attempted quizzes (DB subjects)
  useEffect(() => {
    if (!effectiveUserId || dbSubjects.length === 0) return;
    const dbQuizIds = dbSubjects.flatMap((s) =>
      s.examTypes.map((et) => `db-${s.id}-${et.toLowerCase()}`),
    );
    if (dbQuizIds.length === 0) return;
    Promise.all(
      dbQuizIds.map((qid) =>
        fetch(`${API}/profile/${effectiveUserId}/attempted?quizId=${qid}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
      ),
    ).then((results) => {
      const map: Record<string, boolean> = {};
      dbQuizIds.forEach((qid, i) => {
        const data = results[i];
        map[qid] = !!(data && Array.isArray(data.questionHashes) && data.questionHashes.length > 0);
      });
      setAttemptedMap((prev) => ({ ...prev, ...map }));
    });
  }, [effectiveUserId, dbSubjects]);

  // Semesters that have content or are active in DB
  const semsWithContent = activeSemesters.length > 0
    ? activeSemesters
    : [1];

  // Subjects for the current semester from the live database
  const allSubjectsForSem: Subject[] = dbSubjects
    .filter((s) => s.sem === selectedSem)
    .map(dbToSubject);

  // Reset selected subject when sem changes
  function changeSem(sem: number) {
    setSelectedSem(sem);
    setSelectedSubject(null);
  }

  function getSubjectBubbleCount(subj: Subject): number {
    return subj.exams.filter((e) => e.available && !attemptedMap[e.id]).length;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Admin Maintenance Banner */}
      {settings.maintenanceEnabled && isAdmin && (
        <div className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md z-50"
          style={{ background: "#dc2626", color: "#fff" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🛑</span>
            <span>MAINTENANCE MODE IS ACTIVE — Students cannot access the app. (You see this because you are an Admin)</span>
          </div>
          <button onClick={() => navigate("/admin/site-settings")}
            className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all hover:opacity-90 flex-shrink-0"
            style={{ background: "#fff", color: "#dc2626" }}>
            Settings →
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />

      {/* Hero Slogan */}
      <div className="w-full text-center px-4 pt-4 pb-2">
        <p className="text-xs sm:text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
          {settings.slogan || "Your Personal Learning Management System"}
        </p>
      </div>

      {/* Inline Semester Radial Selector (opens right here, no separate modal) */}
      <div
        className="w-full flex flex-col items-center justify-center relative z-30 transition-all duration-300"
        style={{
          minHeight: radialOpen ? "275px" : "85px",
          paddingTop: radialOpen ? "14px" : "2px",
          paddingBottom: radialOpen ? "24px" : "4px",
        }}
      >
        {/* Transparent click-outside dismisser when open */}
        {radialOpen && (
          <div
            className="fixed inset-0 z-20"
            onClick={() => setRadialOpen(false)}
          />
        )}

        {/* Caption Header - dynamically moves up when open to give 1st/8th buttons clear breathing room */}
        <div
          className="flex flex-col items-center justify-center text-center select-none transition-all duration-300 relative z-30"
          style={{ marginBottom: radialOpen ? "90px" : "10px" }}
        >
          <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Select Semester</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-base sm:text-lg font-black text-foreground">🎓 {semLabel(selectedSem)}</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors"
              style={{
                background: radialOpen ? "rgba(245,158,11,0.15)" : "rgba(0,122,255,0.1)",
                color: radialOpen ? "#d97706" : "#007AFF",
              }}
            >
              {radialOpen ? "Pick a semester below" : "Tap dial to switch"}
            </span>
          </div>
        </div>

        {/* The Radial Dial - controlled via React state */}
        <div className={`sem-dial-wrapper relative z-30 ${radialOpen ? "is-open" : ""}`}>
          <button
            type="button"
            onClick={() => setRadialOpen((prev) => !prev)}
            className="circle"
            title={radialOpen ? "Close dial" : "Open semester dial"}
          >
            <svg className="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <div className="subs">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
              const isSelected = selectedSem === s;
              const hasContent = semsWithContent.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    changeSem(s);
                    setRadialOpen(false);
                  }}
                  className={`sub-circle ${isSelected ? "active-sem" : ""}`}
                  style={!hasContent ? { opacity: 0.55 } : {}}
                >
                  {ORDINAL_LABELS[s - 1] ?? `${s}th`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 pb-4">
        <AnimatePresence mode="wait">
          {!selectedSubject ? (
            <motion.div key={`sem-${selectedSem}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}>
              {subjectsLoading ? (
                <>
                  <div className="h-3.5 bg-slate-300/80 rounded-md w-36 mb-3 animate-pulse" />
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="card-container">
                        <div className="box">
                          <div className="w-12 h-12 rounded-xl bg-slate-200/80 animate-pulse" />
                          <div className="space-y-2 mt-4 w-full">
                            <div className="h-4 bg-slate-200/80 rounded-md w-3/4 animate-pulse" />
                            <div className="h-3 bg-slate-200/50 rounded-md w-1/2 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : allSubjectsForSem.length === 0 ? (
                <div className="glow-card p-10 text-center">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-base font-semibold mb-1">No Data Available</p>
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Content for {semLabel(selectedSem)} will be added soon.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {semLabel(selectedSem)} — {allSubjectsForSem.length} Subject{allSubjectsForSem.length !== 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {allSubjectsForSem.map((subj, i) => {
                      const bubbleCount = getSubjectBubbleCount(subj);
                      return (
                        <motion.div
                          key={subj.id}
                          initial={{ opacity: 0, scale: 0.94 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="card-container"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedSubject(subj)}
                            className="box"
                            style={{ cursor: "pointer" }}
                          >
                            <div className="title">
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-xs"
                                style={{ background: subj.gradient }}
                              >
                                {subj.icon}
                              </div>
                              {bubbleCount > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xs"
                                  style={{
                                    background: "rgba(0, 122, 255, 0.16)",
                                    color: "#007AFF",
                                    border: "1px solid rgba(0, 122, 255, 0.3)",
                                  }}
                                  title={`${bubbleCount} ready to attempt`}
                                >
                                  <span>⚡</span>
                                  <span>{bubbleCount}</span>
                                </span>
                              )}
                            </div>

                            <div className="w-full">
                              <strong>{subj.name}</strong>
                              <p>
                                {subj.exams.filter((e) => e.available).length} Exam
                                {subj.exams.filter((e) => e.available).length !== 1 ? "s" : ""}
                              </p>
                              <span style={{ color: subj.color }}>Explore →</span>
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key={`subj-${selectedSubject.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setSelectedSubject(null)}
                  className="p-2 rounded-lg transition-all hover:scale-[1.02]"
                  style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                  ← Back
                </button>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: selectedSubject.gradient }}>
                  {selectedSubject.icon}
                </div>
                <div>
                  <p className="font-bold">{selectedSubject.name}</p>
                  <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{semLabel(selectedSem)}</p>
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Exam Type</p>
              <div className="flex flex-col gap-3">
                {selectedSubject.exams.map((exam, i) => (
                  <motion.div key={exam.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                    className="glass-exam-card p-4 flex items-center gap-4"
                    style={{ opacity: exam.available ? 1 : 0.6 }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: exam.available ? selectedSubject.gradient : "hsl(var(--muted))" }}>
                      {exam.available ? "📚" : "🔒"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold">{exam.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {exam.available
                          ? (attemptedMap[exam.id] ? "✓ Attempted" : "Ready to attempt")
                          : "Coming soon"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {exam.available ? (
                        <>
                          <button onClick={() => navigate(`/quiz/${exam.id}/setup`)}
                            className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                            style={{ background: selectedSubject.gradient, color: "#fff", boxShadow: `0 4px 16px ${selectedSubject.color}44` }}>
                            {attemptedMap[exam.id] ? "Retry →" : "Start →"}
                          </button>
                          <button onClick={() => navigate(`/quiz/${exam.id}/leaderboard`)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
                            style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>
                            🏆 Board
                          </button>
                        </>
                      ) : (
                        <span className="px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                          Soon
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="w-full px-4 py-4 mt-2"
        style={{ borderTop: "1px solid hsl(var(--border))" }}>
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <p className="text-xs font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>Contact & Feedback</p>
            {settings.footerLink ? (
              <a href={settings.footerLink.startsWith("http") ? settings.footerLink : `https://${settings.footerLink}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-[1.04]"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff" }}>
                🌐 Link
              </a>
            ) : null}
            <a href="https://instagram.com/syedhamidmukhtar" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-[1.04]"
              style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)", color: "#fff" }}
              title="@syedhamidmukhtar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
              Instagram
            </a>
            <button
              onClick={() => setFeedbackOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-[1.04]"
              style={{ background: "rgba(99,102,241,0.12)", color: "hsl(var(--foreground))", border: "1px solid rgba(99,102,241,0.25)" }}>
              💬 Add Feedback
            </button>
          </div>
          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
            © 2026 All rights reserved. Quizzy-LMS
          </p>
        </div>
      </footer>

      {/* Feedback Modal */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) { setFeedbackOpen(false); setFeedbackMsg(""); setFeedbackSent(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-5"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
            {feedbackSent ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">✅</div>
                <p className="font-bold text-lg" style={{ color: "hsl(var(--foreground))" }}>Thank you!</p>
                <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Your feedback has been sent to the admin.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-black text-base" style={{ color: "hsl(var(--foreground))" }}>💬 Send Feedback</h3>
                    <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Report a bug, request a quiz, or share suggestions.</p>
                  </div>
                  <button onClick={() => { setFeedbackOpen(false); setFeedbackMsg(""); }}
                    style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, lineHeight: 1 }}>✕</button>
                </div>
                <textarea
                  value={feedbackMsg}
                  onChange={e => setFeedbackMsg(e.target.value)}
                  placeholder="e.g. Question #42 in English Midterm has a wrong answer…"
                  rows={4}
                  style={{
                    width: "100%", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
                    borderRadius: 10, color: "hsl(var(--foreground))", padding: "10px 12px",
                    fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit",
                  }}
                />
                <div className="flex gap-3 mt-3">
                  <button onClick={sendFeedback} disabled={!feedbackMsg.trim() || feedbackSending}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all"
                    style={{
                      background: !feedbackMsg.trim() ? "hsl(var(--muted))" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                      color: !feedbackMsg.trim() ? "hsl(var(--muted-foreground))" : "#fff",
                    }}>
                    {feedbackSending ? "Sending…" : "Send Feedback"}
                  </button>
                  <button onClick={() => { setFeedbackOpen(false); setFeedbackMsg(""); }}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm"
                    style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
