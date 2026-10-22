import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";

const API = import.meta.env.BASE_URL + "api";

interface AuditUser {
  userId: string;
  displayName: string;
  rollNumber: string | null;
  isGuest: boolean;
  attempts: number;
  lastAttempt: string | null;
  totalCorrect: number;
  totalQuestions: number;
}
interface QuizAttempt { id: number; quizId: string; subject: string; sem: number; examType: string; correct: number; total: number; pct: number; score: number; createdAt: string; }
interface AnswerDetail { questionId?: string; questionText?: string; selected?: string; correct?: string; timeTaken?: number; isCorrect?: boolean; }
interface AttemptDetail extends QuizAttempt { answers: AnswerDetail[]; }

type View = "users" | "attempts" | "detail";

export function AuditPage() {
  const [view, setView] = useState<View>("users");
  const [users, setUsers] = useState<AuditUser[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [selectedUser, setSelectedUser] = useState<AuditUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [wiping, setWiping] = useState<number | null>(null);
  const [wipeError, setWipeError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/audit/users`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function openAttempts(user: AuditUser) {
    setSelectedUser(user);
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/audit/attempts/${encodeURIComponent(user.userId)}`);
      if (r.ok) setAttempts(await r.json());
    } finally { setLoading(false); }
    setView("attempts");
  }

  async function openDetail(attempt: QuizAttempt) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/audit/attempt/${attempt.id}`);
      if (r.ok) setDetail(await r.json());
    } finally { setLoading(false); }
    setView("detail");
  }

  async function wipeAttempt(id: number) {
    if (!confirm("Permanently delete this attempt?")) return;
    setWiping(id);
    setWipeError(null);
    try {
      const r = await fetch(`${API}/admin/audit/attempt/${id}`, { method: "DELETE" });
      if (r.ok) {
        if (selectedUser) setAttempts(prev => prev.filter(a => a.id !== id));
        if (view === "detail") setView("attempts");
      } else {
        const e = await r.json().catch(() => ({}));
        setWipeError((e as { error?: string }).error ?? `Delete failed (${r.status})`);
      }
    } catch { setWipeError("Network error — could not delete attempt."); }
    finally { setWiping(null); }
  }

  const filteredUsers = users.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.userId.toLowerCase().includes(search.toLowerCase()) ||
    (u.rollNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none" };

  function pctColor(pct: number) {
    if (pct >= 80) return "#34d399";
    if (pct >= 60) return "#fbbf24";
    return "#f87171";
  }

  function accuracyBar(correct: number, total: number) {
    if (total === 0) return null;
    const pct = Math.round((correct / total) * 100);
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "#334155" }}>
          <div style={{ width: `${pct}%`, background: pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171", height: "100%", borderRadius: 999 }} />
        </div>
        <span className="text-xs font-bold" style={{ color: pctColor(pct) }}>{pct}%</span>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {wipeError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between gap-3"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
            <span>⚠ {wipeError}</span>
            <button onClick={() => setWipeError(null)} style={{ color: "#f87171", fontWeight: 700 }}>✕</button>
          </div>
        )}
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-5" style={{ color: "#64748b" }}>
          <button onClick={() => setView("users")} style={{ color: view === "users" ? "#e2e8f0" : "#64748b" }}>Users</button>
          {view !== "users" && <>
            <span>›</span>
            <button onClick={() => setView("attempts")} style={{ color: view === "attempts" ? "#e2e8f0" : "#64748b" }}>
              {selectedUser?.displayName ?? "Attempts"}
            </button>
          </>}
          {view === "detail" && <>
            <span>›</span>
            <span style={{ color: "#e2e8f0" }}>Attempt #{detail?.id}</span>
          </>}
        </div>

        {/* ── View: Users ── */}
        {view === "users" && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-black text-white">🔍 Audit Logs</h1>
                <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>{users.length} registered users · click any row to inspect</p>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, roll no, or ID…" style={{ ...inputStyle, width: 240 }} />
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #334155" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#1e293b", borderBottom: "1px solid #334155" }}>
                      {["User", "Roll #", "Type", "Quizzes", "Correct/Total", "Accuracy", "Last Active", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.userId} style={{ background: i % 2 === 0 ? "#0f172a" : "#111827", borderBottom: "1px solid #1e293b", cursor: "pointer" }}
                        onClick={() => openAttempts(u)}>
                        <td className="px-4 py-3 text-sm font-semibold text-white">{u.displayName || "—"}</td>
                        <td className="px-4 py-3">
                          {u.rollNumber ? (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>{u.rollNumber}</span>
                          ) : (
                            <span style={{ color: "#334155" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: u.isGuest ? "rgba(251,191,36,0.1)" : "rgba(99,102,241,0.1)", color: u.isGuest ? "#fbbf24" : "#a5b4fc" }}>
                            {u.isGuest ? "Guest" : "Auth"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-black" style={{ color: "#e2e8f0" }}>{u.attempts}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold" style={{ color: "#34d399" }}>{u.totalCorrect}</span>
                          <span className="text-xs" style={{ color: "#475569" }}>/{u.totalQuestions}</span>
                        </td>
                        <td className="px-4 py-3">{accuracyBar(u.totalCorrect, u.totalQuestions)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>
                          {u.lastAttempt ? new Date(u.lastAttempt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>View →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── View: Attempts ── */}
        {view === "attempts" && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-black text-white">{selectedUser?.displayName}</h1>
                <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
                  {attempts.length} quiz attempts
                  {selectedUser && selectedUser.totalQuestions > 0 && (
                    <> · <span style={{ color: "#34d399" }}>{selectedUser.totalCorrect}</span>/{selectedUser.totalQuestions} correct overall ({Math.round(selectedUser.totalCorrect / selectedUser.totalQuestions * 100)}%)</>
                  )}
                </p>
              </div>
              <button onClick={() => setView("users")} className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#334155", color: "#94a3b8" }}>← Back</button>
            </div>
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #334155" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#1e293b", borderBottom: "1px solid #334155" }}>
                      {["ID", "Quiz", "Subject", "Sem", "Type", "Score", "Pct", "Date", "Actions"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a, i) => (
                      <tr key={a.id} style={{ background: i % 2 === 0 ? "#0f172a" : "#111827", borderBottom: "1px solid #1e293b" }}>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: "#475569" }}>#{a.id}</td>
                        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => openDetail(a)}>
                          <span style={{ color: "#a5b4fc" }}>{a.quizId}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#94a3b8" }}>{a.subject}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{a.sem}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>{a.examType}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-white">{a.correct}/{a.total}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-black" style={{ color: pctColor(a.pct) }}>{a.pct}%</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>
                          {new Date(a.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openDetail(a)} className="px-2 py-1 rounded text-xs font-semibold"
                              style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>Detail</button>
                            <button onClick={() => wipeAttempt(a.id)} disabled={wiping === a.id}
                              className="px-2 py-1 rounded text-xs font-semibold"
                              style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                              {wiping === a.id ? "…" : "Wipe"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── View: Detail ── */}
        {view === "detail" && detail && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-black text-white">Attempt #{detail.id} — {detail.subject}</h1>
                <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
                  {detail.correct}/{detail.total} correct · <span style={{ color: pctColor(detail.pct) }}>{detail.pct}%</span> · {detail.examType} · {new Date(detail.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView("attempts")} className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "#334155", color: "#94a3b8" }}>← Back</button>
                <button onClick={() => wipeAttempt(detail.id)} disabled={wiping === detail.id}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                  {wiping === detail.id ? "Wiping…" : "🗑 Wipe Attempt"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>
            ) : detail.answers.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: "#64748b" }}>No per-question breakdown available for this attempt.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {detail.answers.map((ans, i) => {
                  const correct = ans.isCorrect ?? (ans.selected === ans.correct);
                  return (
                    <div key={i} className="rounded-xl p-4"
                      style={{ background: "#1e293b", border: `2px solid ${correct ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}` }}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded"
                              style={{ background: correct ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: correct ? "#34d399" : "#f87171" }}>
                              Q{i + 1} · {correct ? "✓ Correct" : "✗ Wrong"}
                            </span>
                            {ans.timeTaken != null && (
                              <span className="text-[10px] px-2 py-0.5 rounded font-semibold"
                                style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                                ⏱ {ans.timeTaken}s
                              </span>
                            )}
                          </div>
                          {ans.questionText && <p className="text-sm text-white mb-3">{ans.questionText}</p>}
                          {!correct && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                                <p className="text-[10px] font-bold mb-1" style={{ color: "#f87171" }}>Student answered</p>
                                <p className="text-sm text-white">{ans.selected ? `Option ${ans.selected}` : "Skipped"}</p>
                              </div>
                              <div className="rounded-lg p-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                                <p className="text-[10px] font-bold mb-1" style={{ color: "#34d399" }}>Correct answer</p>
                                <p className="text-sm text-white">{ans.correct ? `Option ${ans.correct}` : "—"}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
