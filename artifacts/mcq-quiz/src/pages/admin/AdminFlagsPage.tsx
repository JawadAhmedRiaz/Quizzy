import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";

const API = import.meta.env.BASE_URL + "api";

interface Flag {
  id: number;
  questionId: string;
  questionText: string;
  quizId: string;
  userId: string;
  displayName: string | null;
  reason: string;
  note: string | null;
  reviewed: boolean;
  createdAt: string;
  sem: number | null;
  subject: string | null;
  examType: string | null;
}

const REASON_COLORS: Record<string, { bg: string; text: string }> = {
  typo:          { bg: "rgba(251,191,36,0.1)",   text: "#fbbf24" },
  wrong_answer:  { bg: "rgba(239,68,68,0.1)",    text: "#f87171" },
  wrong_logic:   { bg: "rgba(239,68,68,0.1)",    text: "#f87171" },
  bad_briefing:  { bg: "rgba(168,85,247,0.1)",   text: "#c084fc" },
  other:         { bg: "rgba(99,102,241,0.1)",   text: "#a5b4fc" },
};

function reasonColor(reason: string) {
  return REASON_COLORS[reason] ?? REASON_COLORS.other;
}

export function AdminFlagsPage() {
  const [, navigate] = useLocation();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unreviewed">("unreviewed");
  const [filterSubject, setFilterSubject] = useState("");
  const [acting, setActing] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/flags`);
      if (r.ok) setFlags(await r.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function dismiss(id: number) {
    setActing(id);
    setActionError(null);
    try {
      const r = await fetch(`${API}/admin/flags/${id}/dismiss`, { method: "PATCH" });
      if (r.ok) { setFlags(prev => prev.filter(f => f.id !== id)); }
      else { const e = await r.json().catch(() => ({})); setActionError((e as { error?: string }).error ?? `Dismiss failed (${r.status})`); }
    } catch { setActionError("Network error — could not dismiss flag."); }
    finally { setActing(null); }
  }

  async function purge(id: number, questionId: string) {
    if (!confirm(`This will permanently delete question "${questionId}" and all related flags. Continue?`)) return;
    setActing(id);
    setActionError(null);
    try {
      const r = await fetch(`${API}/admin/flags/${id}/purge`, { method: "DELETE" });
      if (r.ok) { setFlags(prev => prev.filter(f => f.questionId !== questionId)); }
      else { const e = await r.json().catch(() => ({})); setActionError((e as { error?: string }).error ?? `Purge failed (${r.status})`); }
    } catch { setActionError("Network error — could not purge question."); }
    finally { setActing(null); }
  }

  const uniqueSubjects = Array.from(new Set(flags.map(f => f.subject).filter(Boolean) as string[]));

  let displayed = filter === "all" ? flags : flags.filter(f => !f.reviewed);
  if (filterSubject) displayed = displayed.filter(f => f.subject === filterSubject);

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-white">🚩 Flags Queue</h1>
            <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
              {flags.filter(f => !f.reviewed).length} unreviewed · {flags.length} total
            </p>
          </div>
          {actionError && (
            <div className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-3"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
              <span>⚠ {actionError}</span>
              <button onClick={() => setActionError(null)} style={{ color: "#f87171", fontWeight: 700 }}>✕</button>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {uniqueSubjects.length > 0 && (
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", padding: "6px 10px", fontSize: 12, outline: "none", cursor: "pointer" }}>
                <option value="">All Subjects</option>
                {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {(["unreviewed", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: filter === f ? "rgba(99,102,241,0.15)" : "#1e293b",
                  color: filter === f ? "#a5b4fc" : "#64748b",
                  border: filter === f ? "1px solid rgba(99,102,241,0.3)" : "1px solid #334155",
                }}>
                {f === "all" ? "All" : "Unreviewed"}
              </button>
            ))}
            <button onClick={load} className="px-4 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#1e293b", color: "#64748b", border: "1px solid #334155" }}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <p className="font-bold text-white">All clear!</p>
            <p className="text-sm mt-1" style={{ color: "#64748b" }}>No flagged questions in this queue.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {displayed.map(flag => {
              const rc = reasonColor(flag.reason);
              const isDbQuestion = !isNaN(parseInt(flag.questionId));
              return (
                <div key={flag.id} className="rounded-xl p-5"
                  style={{ background: "#1e293b", border: `1px solid ${flag.reviewed ? "#1e293b" : "#334155"}`, opacity: flag.reviewed ? 0.6 : 1 }}>

                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: rc.bg, color: rc.text }}>
                        {flag.reason.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      {flag.reviewed && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>Reviewed</span>
                      )}
                      {/* Sem / Subject / ExamType badges */}
                      {flag.sem != null && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc" }}>
                          Sem {flag.sem}
                        </span>
                      )}
                      {flag.subject && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                          {flag.subject}
                        </span>
                      )}
                      {flag.examType && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                          {flag.examType}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "#64748b" }}>
                        by <span style={{ color: "#a5b4fc" }}>{flag.displayName ?? flag.userId}</span>
                      </span>
                      <span className="text-xs" style={{ color: "#475569" }}>
                        {new Date(flag.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Question text */}
                  <div className="mb-3 p-3 rounded-lg" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "#64748b" }}>Question</p>
                    <p className="text-sm" style={{ color: "#e2e8f0" }}>{flag.questionText}</p>
                  </div>

                  {/* Student note */}
                  {flag.note && (
                    <div className="mb-3 p-3 rounded-lg" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: "#fbbf24" }}>Student's comment</p>
                      <p className="text-sm italic" style={{ color: "#d1d5db" }}>"{flag.note}"</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {isDbQuestion && (
                      <button
                        onClick={() => navigate(`/admin/mcq-bank`)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold"
                        style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
                        🔧 Fix in MCQ Bank
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(flag.id)}
                      disabled={acting === flag.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold"
                      style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                      {acting === flag.id ? "…" : "✓ Dismiss"}
                    </button>
                    <button
                      onClick={() => purge(flag.id, flag.questionId)}
                      disabled={acting === flag.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                      {acting === flag.id ? "…" : isDbQuestion ? "🗑 Purge Question" : "🗑 Delete Flag"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
