import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";

const API = import.meta.env.BASE_URL + "api";

interface Semester { id: number; num: number; label: string; isActive: boolean; }
interface SubjectRow { id: number; sem: number; name: string; icon: string; color: string; gradient: string; isActive: boolean; examTypes: string; }

const ORDINALS = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"];

function ordinalLabel(n: number) {
  return `${ORDINALS[n - 1] ?? n + "th"} Semester`;
}

function parseExamTypes(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

const IS = {
  background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
  color: "#e2e8f0", padding: "7px 10px", fontSize: 13, outline: "none",
};

type Level = "semesters" | "subjects" | "examtypes";

export function ContentSettingsPage() {
  const [, navigate] = useLocation();
  const [level, setLevel] = useState<Level>("semesters");

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semLoading, setSemLoading] = useState(true);
  const [selectedSem, setSelectedSem] = useState<Semester | null>(null);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<SubjectRow | null>(null);

  // Semester form
  const [addSemNum, setAddSemNum] = useState("");
  const [addSemLabel, setAddSemLabel] = useState("");
  const [addSemLoading, setAddSemLoading] = useState(false);
  const [editSemId, setEditSemId] = useState<number | null>(null);
  const [editSemLabel, setEditSemLabel] = useState("");

  // Subject form
  const [addSubName, setAddSubName] = useState("");
  const [addSubIcon, setAddSubIcon] = useState("📚");
  const [addSubColor, setAddSubColor] = useState("#6366f1");
  const [addSubLoading, setAddSubLoading] = useState(false);
  const [editSubId, setEditSubId] = useState<number | null>(null);
  const [editSubField, setEditSubField] = useState<Partial<SubjectRow>>({});

  // Exam type form
  const [newExamType, setNewExamType] = useState("");
  const [savingET, setSavingET] = useState(false);

  const [acting, setActing] = useState<string | null>(null);

  const loadSemesters = useCallback(async () => {
    setSemLoading(true);
    const r = await fetch(`${API}/admin/semesters`).catch(() => null);
    if (r?.ok) setSemesters(await r.json());
    setSemLoading(false);
  }, []);

  const loadSubjects = useCallback(async (semNum: number) => {
    setSubLoading(true);
    const r = await fetch(`${API}/admin/subjects?sem=${semNum}`).catch(() => null);
    if (r?.ok) setSubjects(await r.json());
    setSubLoading(false);
  }, []);

  useEffect(() => { void loadSemesters(); }, [loadSemesters]);

  async function addSemester() {
    if (!addSemNum || !addSemLabel) return;
    setAddSemLoading(true);
    await fetch(`${API}/admin/semesters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num: Number(addSemNum), label: addSemLabel }),
    });
    setAddSemNum(""); setAddSemLabel("");
    setAddSemLoading(false);
    void loadSemesters();
  }

  async function saveSemLabel(id: number) {
    setActing(`sem-${id}`);
    await fetch(`${API}/admin/semesters/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editSemLabel }),
    });
    setEditSemId(null);
    setActing(null);
    void loadSemesters();
  }

  async function toggleSemActive(sem: Semester) {
    await fetch(`${API}/admin/semesters/${sem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !sem.isActive }),
    });
    void loadSemesters();
  }

  async function deleteSemester(id: number) {
    if (!confirm("Delete this semester? Subjects and questions under it will not be deleted.")) return;
    setActing(`sem-del-${id}`);
    await fetch(`${API}/admin/semesters/${id}`, { method: "DELETE" });
    setActing(null);
    void loadSemesters();
  }

  function drillIntoSem(sem: Semester) {
    setSelectedSem(sem);
    setLevel("subjects");
    void loadSubjects(sem.num);
  }

  async function addSubject() {
    if (!addSubName.trim() || !selectedSem) return;
    setAddSubLoading(true);
    await fetch(`${API}/admin/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sem: selectedSem.num, name: addSubName.trim(), icon: addSubIcon, color: addSubColor }),
    });
    setAddSubName(""); setAddSubIcon("📚"); setAddSubColor("#6366f1");
    setAddSubLoading(false);
    void loadSubjects(selectedSem.num);
  }

  async function saveSubjectEdit(sub: SubjectRow) {
    const updated = { ...sub, ...editSubField };
    setActing(`sub-${sub.id}`);
    await fetch(`${API}/admin/subjects/${sub.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: updated.name, icon: updated.icon, color: updated.color, isActive: updated.isActive }),
    });
    setEditSubId(null); setEditSubField({});
    setActing(null);
    if (selectedSem) void loadSubjects(selectedSem.num);
  }

  async function deleteSubject(id: number) {
    if (!confirm("Delete this subject? MCQs belonging to it will remain in the database.")) return;
    setActing(`sub-del-${id}`);
    await fetch(`${API}/admin/subjects/${id}`, { method: "DELETE" });
    setActing(null);
    if (selectedSem) void loadSubjects(selectedSem.num);
  }

  function drillIntoSubject(sub: SubjectRow) {
    setSelectedSubject(sub);
    setLevel("examtypes");
  }

  function getExamTypes(sub: SubjectRow | null) {
    if (!sub) return [];
    return parseExamTypes(sub.examTypes);
  }

  async function addExamType() {
    if (!newExamType.trim() || !selectedSubject) return;
    const current = getExamTypes(selectedSubject);
    const trimmed = newExamType.trim();
    if (current.map(e => e.toLowerCase()).includes(trimmed.toLowerCase())) { setNewExamType(""); return; }
    const updated = [...current, trimmed];
    setSavingET(true);
    const r = await fetch(`${API}/admin/subjects/${selectedSubject.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examTypes: updated }),
    });
    if (r.ok) {
      const saved = await r.json() as SubjectRow;
      setSelectedSubject(saved);
      setSubjects(prev => prev.map(s => s.id === saved.id ? saved : s));
    }
    setNewExamType(""); setSavingET(false);
  }

  async function removeExamType(et: string) {
    if (!selectedSubject) return;
    const updated = getExamTypes(selectedSubject).filter(e => e !== et);
    setSavingET(true);
    const r = await fetch(`${API}/admin/subjects/${selectedSubject.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examTypes: updated }),
    });
    if (r.ok) {
      const saved = await r.json() as SubjectRow;
      setSelectedSubject(saved);
      setSubjects(prev => prev.map(s => s.id === saved.id ? saved : s));
    }
    setSavingET(false);
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-5" style={{ color: "#64748b" }}>
          <button onClick={() => setLevel("semesters")} style={{ color: level === "semesters" ? "#e2e8f0" : "#64748b" }}>
            Semesters
          </button>
          {level !== "semesters" && <>
            <span>›</span>
            <button onClick={() => { setLevel("subjects"); if (selectedSem) void loadSubjects(selectedSem.num); }}
              style={{ color: level === "subjects" ? "#e2e8f0" : "#64748b" }}>
              {selectedSem?.label}
            </button>
          </>}
          {level === "examtypes" && <>
            <span>›</span>
            <span style={{ color: "#e2e8f0" }}>{selectedSubject?.name}</span>
          </>}
        </div>

        {/* ── Level: Semesters ── */}
        {level === "semesters" && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-xl font-black text-white">📁 Content Settings</h1>
                <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>Manage semesters, subjects, and exam types. Click a semester to drill in.</p>
              </div>
            </div>

            {/* Add semester */}
            <div className="rounded-xl p-4 mb-5 flex items-center gap-3"
              style={{ background: "#1e293b", border: "1px solid #334155" }}>
              <div className="flex-1 flex gap-3">
                <div style={{ flex: "0 0 100px" }}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Sem #</label>
                  <input type="number" value={addSemNum} onChange={e => {
                    setAddSemNum(e.target.value);
                    if (!addSemLabel) setAddSemLabel(ordinalLabel(Number(e.target.value)));
                  }}
                    placeholder="e.g. 3" style={{ ...IS, width: "100%" }} min={1} max={20} />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Label</label>
                  <input value={addSemLabel} onChange={e => setAddSemLabel(e.target.value)}
                    placeholder="e.g. 3rd Semester" style={{ ...IS, width: "100%" }} />
                </div>
              </div>
              <div style={{ paddingTop: 22 }}>
                <button onClick={addSemester} disabled={!addSemNum || !addSemLabel || addSemLoading}
                  className="px-5 py-2 rounded-lg text-sm font-bold"
                  style={{ background: !addSemNum || !addSemLabel ? "#334155" : "#6366f1", color: !addSemNum || !addSemLabel ? "#64748b" : "#fff" }}>
                  {addSemLoading ? "Adding…" : "+ Add"}
                </button>
              </div>
            </div>

            {semLoading ? (
              <div className="flex justify-center py-10"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>
            ) : semesters.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-3">🎓</p>
                <p style={{ color: "#475569" }}>No semesters yet. Add one above to get started.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {semesters.map(sem => (
                  <div key={sem.id} className="rounded-xl px-4 py-3 flex items-center gap-3 group"
                    style={{ background: "#1e293b", border: "1px solid #334155" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-black"
                      style={{ background: sem.isActive ? "rgba(99,102,241,0.15)" : "#0f172a", color: sem.isActive ? "#a5b4fc" : "#475569", border: `1px solid ${sem.isActive ? "rgba(99,102,241,0.3)" : "#334155"}` }}>
                      {sem.num}
                    </div>

                    {editSemId === sem.id ? (
                      <input value={editSemLabel} onChange={e => setEditSemLabel(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveSemLabel(sem.id)}
                        style={{ ...IS, flex: 1 }} autoFocus />
                    ) : (
                      <div className="flex-1 cursor-pointer" onClick={() => drillIntoSem(sem)}>
                        <p className="text-sm font-bold text-white">{sem.label}</p>
                        <p className="text-xs" style={{ color: "#64748b" }}>{sem.isActive ? "Visible to students" : "Hidden from students"}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSemActive(sem)}
                        className="px-2 py-1 rounded text-[10px] font-bold"
                        style={{ background: sem.isActive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: sem.isActive ? "#34d399" : "#f87171", border: `1px solid ${sem.isActive ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                        {sem.isActive ? "Active" : "Hidden"}
                      </button>
                      {editSemId === sem.id ? (
                        <button onClick={() => saveSemLabel(sem.id)} disabled={acting === `sem-${sem.id}`}
                          className="px-3 py-1 rounded text-xs font-bold"
                          style={{ background: "#16a34a", color: "#fff" }}>
                          Save
                        </button>
                      ) : (
                        <button onClick={() => { setEditSemId(sem.id); setEditSemLabel(sem.label); }}
                          className="px-3 py-1 rounded text-xs font-semibold"
                          style={{ background: "#334155", color: "#94a3b8" }}>
                          Rename
                        </button>
                      )}
                      <button onClick={() => drillIntoSem(sem)}
                        className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                        Subjects →
                      </button>
                      <button onClick={() => deleteSemester(sem.id)} disabled={acting === `sem-del-${sem.id}`}
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Level: Subjects ── */}
        {level === "subjects" && selectedSem && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-xl font-black text-white">📚 {selectedSem.label} — Subjects</h1>
                <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>Manage subjects in this semester. Click a subject to manage its exam types.</p>
              </div>
              <button onClick={() => setLevel("semesters")} className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#334155", color: "#94a3b8" }}>← Back</button>
            </div>

            {/* Add subject */}
            <div className="rounded-xl p-4 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#64748b" }}>Add New Subject</p>
              <div className="flex items-end gap-3">
                <input value={addSubIcon} onChange={e => setAddSubIcon(e.target.value)}
                  style={{ ...IS, width: 52, textAlign: "center", fontSize: 20, padding: "4px 6px" }} title="Icon emoji" />
                <div className="flex-1">
                  <input value={addSubName} onChange={e => setAddSubName(e.target.value)}
                    placeholder="Subject name e.g. Computer Science"
                    onKeyDown={e => e.key === "Enter" && addSubject()}
                    style={{ ...IS, width: "100%" }} />
                </div>
                <input type="color" value={addSubColor} onChange={e => setAddSubColor(e.target.value)}
                  style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid #334155", cursor: "pointer", padding: 2, background: "#0f172a" }} />
                <button onClick={addSubject} disabled={!addSubName.trim() || addSubLoading}
                  className="px-5 py-2 rounded-lg text-sm font-bold"
                  style={{ background: !addSubName.trim() ? "#334155" : "#6366f1", color: !addSubName.trim() ? "#64748b" : "#fff", whiteSpace: "nowrap" }}>
                  {addSubLoading ? "Adding…" : "+ Add Subject"}
                </button>
              </div>
            </div>

            {subLoading ? (
              <div className="flex justify-center py-10"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>
            ) : subjects.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-3">📭</p>
                <p style={{ color: "#475569" }}>No subjects for this semester. Add one above or import MCQs via AI Import.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {subjects.map(sub => (
                  <div key={sub.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: "#1e293b", border: "1px solid #334155", opacity: sub.isActive ? 1 : 0.65 }}>
                    {editSubId === sub.id ? (
                      <input value={editSubField.icon ?? sub.icon} onChange={e => setEditSubField(p => ({ ...p, icon: e.target.value }))}
                        style={{ ...IS, width: 52, textAlign: "center", fontSize: 20, padding: "4px 6px" }} />
                    ) : (
                      <span className="text-2xl w-8 text-center">{sub.icon}</span>
                    )}

                    {editSubId === sub.id ? (
                      <input value={editSubField.name ?? sub.name} onChange={e => setEditSubField(p => ({ ...p, name: e.target.value }))}
                        style={{ ...IS, flex: 1 }} autoFocus />
                    ) : (
                      <div className="flex-1 cursor-pointer" onClick={() => drillIntoSubject(sub)}>
                        <p className="text-sm font-bold text-white">{sub.name}</p>
                        <p className="text-xs" style={{ color: "#64748b" }}>
                          {parseExamTypes(sub.examTypes).length} exam type{parseExamTypes(sub.examTypes).length !== 1 ? "s" : ""}
                          {" · "}
                          <span style={{ color: sub.isActive ? "#34d399" : "#f87171" }}>{sub.isActive ? "Active" : "Hidden"}</span>
                        </p>
                      </div>
                    )}

                    {editSubId === sub.id ? (
                      <input type="color" value={editSubField.color ?? sub.color}
                        onChange={e => setEditSubField(p => ({ ...p, color: e.target.value }))}
                        style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid #334155", cursor: "pointer", padding: 2, background: "#0f172a" }} />
                    ) : (
                      <div className="w-4 h-4 rounded-full" style={{ background: sub.color }} />
                    )}

                    <div className="flex items-center gap-2">
                      {editSubId === sub.id ? (
                        <>
                          <button onClick={() => saveSubjectEdit(sub)} disabled={acting === `sub-${sub.id}`}
                            className="px-3 py-1 rounded text-xs font-bold"
                            style={{ background: "#16a34a", color: "#fff" }}>
                            {acting === `sub-${sub.id}` ? "…" : "Save"}
                          </button>
                          <button onClick={() => { setEditSubId(null); setEditSubField({}); }}
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: "#334155", color: "#94a3b8" }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditSubId(sub.id); setEditSubField({}); }}
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: "#334155", color: "#94a3b8" }}>Edit</button>
                          <button onClick={() => drillIntoSubject(sub)}
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                            Exam Types →
                          </button>
                          <button onClick={() => navigate(`/admin/import`)}
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
                            + MCQs
                          </button>
                          <button onClick={() => deleteSubject(sub.id)} disabled={acting === `sub-del-${sub.id}`}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}>🗑</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Level: Exam Types ── */}
        {level === "examtypes" && selectedSubject && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-xl font-black text-white">{selectedSubject.icon} {selectedSubject.name} — Exam Types</h1>
                <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>Define exam types for this subject. Each type can hold its own set of MCQs.</p>
              </div>
              <button onClick={() => setLevel("subjects")} className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#334155", color: "#94a3b8" }}>← Back</button>
            </div>

            {/* Add exam type */}
            <div className="rounded-xl p-4 mb-5 flex items-center gap-3"
              style={{ background: "#1e293b", border: "1px solid #334155" }}>
              <input value={newExamType} onChange={e => setNewExamType(e.target.value)}
                placeholder="e.g. Midterm, Final, Quiz, Assignment…"
                onKeyDown={e => e.key === "Enter" && addExamType()}
                style={{ ...IS, flex: 1 }} />
              <button onClick={addExamType} disabled={!newExamType.trim() || savingET}
                className="px-5 py-2 rounded-lg text-sm font-bold"
                style={{ background: !newExamType.trim() ? "#334155" : "#6366f1", color: !newExamType.trim() ? "#64748b" : "#fff", whiteSpace: "nowrap" }}>
                {savingET ? "…" : "+ Add Type"}
              </button>
            </div>

            {getExamTypes(selectedSubject).length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-3">📋</p>
                <p style={{ color: "#475569" }}>No exam types defined yet. Add one above.</p>
                <p className="text-xs mt-2" style={{ color: "#334155" }}>Exam types are also auto-created when you import MCQs via AI Import.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {getExamTypes(selectedSubject).map(et => (
                  <div key={et} className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: "#1e293b", border: "1px solid #334155" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📝</span>
                      <div>
                        <p className="text-sm font-bold text-white">{et}</p>
                        <p className="text-xs" style={{ color: "#64748b" }}>Exam type — students see this as quiz option</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/admin/import`)}
                        className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                        Add MCQs
                      </button>
                      <button
                        onClick={() => navigate(`/admin/mcq-bank?subject=${encodeURIComponent(selectedSubject.name)}&examType=${encodeURIComponent(et)}`)}
                        className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
                        View MCQs
                      </button>
                      <button onClick={() => removeExamType(et)} disabled={savingET}
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
