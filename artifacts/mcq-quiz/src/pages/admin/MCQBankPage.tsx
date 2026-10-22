import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";

const API = import.meta.env.BASE_URL + "api";

interface Question {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  briefing: string | null;
  topic: string | null;
  sem: number;
  subject: string;
  examType: string;
  createdAt: string;
}

interface SubjectRow { id: number; sem: number; name: string; examTypes: string; }

const inputStyle = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#e2e8f0",
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

function parseET(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

export function MCQBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterSem, setFilterSem] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterExamType, setFilterExamType] = useState("");
  const [editing, setEditing] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Subjects from DB
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([]);
  useEffect(() => {
    fetch(`${API}/admin/subjects`).then(r => r.ok ? r.json() : [])
      .then((rows: SubjectRow[]) => setAllSubjects(rows)).catch(() => {});
  }, []);

  const semNums = Array.from(new Set(allSubjects.map(s => s.sem))).sort((a,b) => a-b);
  const filteredSubjects = filterSem ? allSubjects.filter(s => s.sem === parseInt(filterSem)) : allSubjects;
  const selectedSubjectRow = allSubjects.find(s => s.name === filterSubject && (filterSem ? s.sem === parseInt(filterSem) : true));
  const availableExamTypes = selectedSubjectRow ? parseET(selectedSubjectRow.examTypes) : [];

  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set("q", search);
      if (filterSem) params.set("sem", filterSem);
      if (filterSubject) params.set("subject", filterSubject);
      if (filterExamType) params.set("examType", filterExamType);
      const r = await fetch(`${API}/admin/questions?${params}`);
      if (r.ok) {
        const data = await r.json();
        setQuestions(data.questions);
        setTotal(data.total);
      }
    } finally { setLoading(false); }
  }, [page, search, filterSem, filterSubject, filterExamType]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setMutationError(null);
    try {
      const r = await fetch(`${API}/admin/questions/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (r.ok) { setEditing(null); void load(); }
      else { const e = await r.json().catch(() => ({})); setMutationError((e as { error?: string }).error ?? `Save failed (${r.status})`); }
    } catch { setMutationError("Network error — could not save question."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm(`Permanently delete question #${id}?`)) return;
    setDeleting(id);
    setMutationError(null);
    try {
      const r = await fetch(`${API}/admin/questions/${id}`, { method: "DELETE" });
      if (r.ok) { void load(); }
      else { const e = await r.json().catch(() => ({})); setMutationError((e as { error?: string }).error ?? `Delete failed (${r.status})`); }
    } catch { setMutationError("Network error — could not delete question."); }
    finally { setDeleting(null); }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-5">
          <h1 className="text-xl font-black text-white">📚 MCQ Bank</h1>
          <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
            {total} questions in the database · search, filter, edit, or delete
          </p>
        </div>
        {mutationError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between gap-3"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
            <span>⚠ {mutationError}</span>
            <button onClick={() => setMutationError(null)} style={{ color: "#f87171", fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="🔎 Search questions…"
            style={{ ...inputStyle, width: 240 }}
          />
          <select value={filterSem} onChange={e => { setFilterSem(e.target.value); setFilterSubject(""); setFilterExamType(""); setPage(1); }}
            style={{ ...inputStyle, width: 150, cursor: "pointer" }}>
            <option value="">All Semesters</option>
            {semNums.map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterExamType(""); setPage(1); }}
            style={{ ...inputStyle, width: 180, cursor: "pointer" }}>
            <option value="">All Subjects</option>
            {filteredSubjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          {filterSubject && availableExamTypes.length > 0 && (
            <select value={filterExamType} onChange={e => { setFilterExamType(e.target.value); setPage(1); }}
              style={{ ...inputStyle, width: 150, cursor: "pointer" }}>
              <option value="">All Types</option>
              {availableExamTypes.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          )}
          <button onClick={() => { setSearch(""); setFilterSem(""); setFilterSubject(""); setFilterExamType(""); setPage(1); }}
            className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "#1e293b", color: "#64748b", border: "1px solid #334155", whiteSpace: "nowrap" }}>
            Clear
          </button>
          <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
            Refresh
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center gap-2 py-12 justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span style={{ color: "#94a3b8" }}>Loading…</span>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📭</div>
            <p style={{ color: "#64748b" }}>No questions found. Use Add MCQs to import questions.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #334155" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1e293b", borderBottom: "1px solid #334155" }}>
                    {["ID", "Question", "Subject", "Sem", "Type", "Topic", "Ans", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                        style={{ color: "#64748b" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={q.id} style={{ background: i % 2 === 0 ? "#0f172a" : "#111827", borderBottom: "1px solid #1e293b" }}>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "#475569" }}>#{q.id}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#cbd5e1", maxWidth: 280 }}>
                        <p className="line-clamp-2">{q.question}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#94a3b8" }}>{q.subject}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#94a3b8" }}>{q.sem}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>{q.examType}</span>
                      </td>
                      <td className="px-4 py-3">
                        {q.topic && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc" }}>{q.topic}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                          style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", display: "inline-flex" }}>
                          {q.correctAnswer}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setEditing({ ...q })}
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)" }}>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(q.id)}
                            disabled={deleting === q.id}
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                            {deleting === q.id ? "…" : "Del"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs" style={{ color: "#64748b" }}>
                  Page {page} of {totalPages} · {total} total
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded text-xs font-semibold"
                    style={{ background: "#1e293b", color: page === 1 ? "#334155" : "#94a3b8", border: "1px solid #334155" }}>
                    ← Prev
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded text-xs font-semibold"
                    style={{ background: "#1e293b", color: page === totalPages ? "#334155" : "#94a3b8", border: "1px solid #334155" }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
            style={{ background: "#1e293b", border: "1px solid #334155" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-white">Edit Question #{editing.id}</h3>
              <button onClick={() => setEditing(null)} style={{ color: "#94a3b8", fontSize: 18 }}>✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#94a3b8" }}>Question</label>
                <textarea rows={3} value={editing.question}
                  onChange={e => setEditing({ ...editing, question: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              {(["optionA", "optionB", "optionC", "optionD"] as const).map((opt, i) => (
                <div key={opt}>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#94a3b8" }}>Option {["A","B","C","D"][i]}</label>
                  <input value={editing[opt]} onChange={e => setEditing({ ...editing, [opt]: e.target.value })} style={inputStyle} />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#94a3b8" }}>Correct Answer</label>
                  <select value={editing.correctAnswer}
                    onChange={e => setEditing({ ...editing, correctAnswer: e.target.value })}
                    style={{ ...inputStyle, cursor: "pointer" }}>
                    {["A","B","C","D"].map(o => <option key={o} value={o}>Option {o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#94a3b8" }}>Exam Type</label>
                  <input value={editing.examType}
                    onChange={e => setEditing({ ...editing, examType: e.target.value })}
                    style={inputStyle} placeholder="Midterm / Final…" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#94a3b8" }}>Topic</label>
                  <input value={editing.topic ?? ""}
                    onChange={e => setEditing({ ...editing, topic: e.target.value })}
                    style={inputStyle} placeholder="Tag…" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#94a3b8" }}>Briefing / Explanation</label>
                <textarea rows={2} value={editing.briefing ?? ""}
                  onChange={e => setEditing({ ...editing, briefing: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: saving ? "#334155" : "#16a34a", color: saving ? "#64748b" : "#fff" }}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => setEditing(null)}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: "#334155", color: "#94a3b8" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
