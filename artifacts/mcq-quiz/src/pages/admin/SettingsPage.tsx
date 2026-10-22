import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";

const API = import.meta.env.BASE_URL + "api";

type Config = Record<string, string>;

const DEFAULTS: Config = {
  "timer.globalLimit": "60",
  "timer.questionInterval": "30",
  "timer.breakWindow": "300",
  "sem.lock.1": "false",
  "sem.lock.2": "false",
  "sem.lock.3": "false",
  "sem.lock.4": "false",
  "sem.lock.5": "false",
  "sem.lock.6": "false",
  "sem.lock.7": "false",
  "sem.lock.8": "false",
  "brand.headerTitle": "Quizzy",
  "brand.slogan": "Ace your exams with confidence",
  "brand.footerLink": "",
  "maintenance.enabled": "false",
};

interface SubjectRow {
  id: number;
  sem: number;
  name: string;
  icon: string;
  color: string;
  gradient: string;
  isActive: boolean;
}

export function SettingsPage() {
  const [config, setConfig] = useState<Config>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectEdits, setSubjectEdits] = useState<Record<number, Partial<SubjectRow>>>({});
  const [savingSubjectId, setSavingSubjectId] = useState<number | null>(null);
  const [savedSubjectId, setSavedSubjectId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/admin/settings`).then(r => r.ok ? r.json() : {}),
      fetch(`${API}/subjects`).then(r => r.ok ? r.json() : []),
    ]).then(([cfg, subs]) => {
      setConfig({ ...DEFAULTS, ...(cfg as Config) });
      setSubjects(subs as SubjectRow[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function set(key: string, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  async function saveAll() {
    setSaving(true);
    await fetch(`${API}/admin/settings/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: config }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function editSubject(id: number, field: keyof SubjectRow, value: string | boolean) {
    setSubjectEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  async function saveSubject(id: number) {
    setSavingSubjectId(id);
    const s = subjects.find(s => s.id === id);
    if (!s) { setSavingSubjectId(null); return; }
    await fetch(`${API}/admin/subjects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: s.name, icon: s.icon, color: s.color, gradient: s.gradient, isActive: s.isActive }),
    });
    setSavingSubjectId(null);
    setSavedSubjectId(id);
    setSubjectEdits(prev => { const next = { ...prev }; delete next[id]; return next; });
    setTimeout(() => setSavedSubjectId(null), 2500);
  }

  const inputStyle = {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "8px 12px",
    fontSize: 13,
    outline: "none",
  };

  const numberInput = (key: string, label: string, suffix: string, min = 0, max = 9999) => (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #1e293b" }}>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{suffix}</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => set(key, String(Math.max(min, parseInt(config[key] ?? "0") - 1)))}
          className="w-8 h-8 rounded-lg font-bold text-lg flex items-center justify-center"
          style={{ background: "#334155", color: "#e2e8f0" }}>−</button>
        <input type="number" value={config[key] ?? ""} min={min} max={max}
          onChange={e => set(key, e.target.value)}
          style={{ ...inputStyle, width: 80, textAlign: "center" }} />
        <button onClick={() => set(key, String(Math.min(max, parseInt(config[key] ?? "0") + 1)))}
          className="w-8 h-8 rounded-lg font-bold text-lg flex items-center justify-center"
          style={{ background: "#334155", color: "#e2e8f0" }}>+</button>
      </div>
    </div>
  );

  const toggle = (key: string, label: string, description: string, danger = false) => {
    const on = config[key] === "true";
    return (
      <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #1e293b" }}>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{description}</p>
        </div>
        <button onClick={() => set(key, on ? "false" : "true")}
          className="relative w-12 h-6 rounded-full transition-all"
          style={{ background: on ? (danger ? "#ef4444" : "#6366f1") : "#334155" }}>
          <div className="absolute top-1 w-4 h-4 rounded-full transition-all"
            style={{ background: "#fff", left: on ? "26px" : "4px" }} />
        </button>
      </div>
    );
  };

  const textInput = (key: string, label: string, placeholder: string) => (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #1e293b" }}>
      <p className="text-sm font-semibold text-white mr-4">{label}</p>
      <input value={config[key] ?? ""} onChange={e => set(key, e.target.value)}
        placeholder={placeholder} style={{ ...inputStyle, width: 280 }} />
    </div>
  );

  if (loading) return (
    <AdminLayout>
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    </AdminLayout>
  );

  const isMaintenance = config["maintenance.enabled"] === "true";

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white">⚙️ System Settings</h1>
            <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>Global platform configuration — changes apply immediately after saving.</p>
          </div>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
            style={{
              background: saved ? "#16a34a" : saving ? "#334155" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: saving ? "#64748b" : "#fff",
            }}>
            {saved ? "✅ Saved!" : saving ? "Saving…" : "Save All Changes"}
          </button>
        </div>

        {isMaintenance && (
          <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-bold" style={{ color: "#f87171" }}>Maintenance Mode is ACTIVE</p>
              <p className="text-xs" style={{ color: "#fca5a5" }}>Students will see a maintenance overlay on the app until you disable this.</p>
            </div>
          </div>
        )}

        {/* ─── Section: Timers ─── */}
        <section className="rounded-xl p-5 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2">
            <span>⏱</span> Clocks & Timers
          </h2>
          {numberInput("timer.globalLimit", "Global Quiz Timer Limit", "Minutes · total time per quiz session", 5, 300)}
          {numberInput("timer.questionInterval", "Question Countdown", "Seconds · per-question timer", 5, 120)}
          <div className="pb-0">
            {numberInput("timer.breakWindow", "Break / Intermission Window", "Seconds · maximum break duration", 30, 3600)}
          </div>
        </section>

        {/* ─── Section: Semester Locks ─── */}
        <section className="rounded-xl p-5 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2">
            <span>🔒</span> Semester Access Control
          </h2>
          <p className="text-xs mb-3" style={{ color: "#64748b" }}>Locking a semester hides all its quizzes from students.</p>
          <div className="grid grid-cols-2 gap-x-6">
            {[1,2,3,4,5,6,7,8].map(s => {
              const key = `sem.lock.${s}`;
              const locked = config[key] === "true";
              return (
                <div key={s} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                  <p className="text-sm font-semibold text-white">
                    Semester {s}
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: locked ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", color: locked ? "#f87171" : "#34d399" }}>
                      {locked ? "Locked" : "Open"}
                    </span>
                  </p>
                  <button onClick={() => set(key, locked ? "false" : "true")}
                    className="relative w-11 h-5 rounded-full transition-all"
                    style={{ background: locked ? "#ef4444" : "#6366f1" }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                      style={{ background: "#fff", left: locked ? "23px" : "2px" }} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Section: Academic Structure ─── */}
        <section className="rounded-xl p-5 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-1 flex items-center gap-2">
            <span>🏛</span> Academic Structure
          </h2>
          <p className="text-xs mb-4" style={{ color: "#64748b" }}>
            Subjects are grouped by semester. Edit any name or display metadata and click Save Changes to persist the update.
          </p>
          {subjects.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "#475569" }}>No subjects yet — import questions via AI Ingestion to populate subjects automatically.</p>
          ) : (
            (() => {
              const bySem: Record<number, SubjectRow[]> = {};
              for (const s of subjects) {
                if (!bySem[s.sem]) bySem[s.sem] = [];
                bySem[s.sem].push(s);
              }
              return Object.entries(bySem)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([semNum, semSubjects]) => (
                  <div key={semNum} className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                        style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)" }}>
                        Semester {semNum}
                      </span>
                      <div style={{ flex: 1, height: 1, background: "#334155" }} />
                    </div>
                    <div className="flex flex-col gap-0">
                      {semSubjects.map((s) => {
                        const isDirty = !!subjectEdits[s.id];
                        const isSavingThis = savingSubjectId === s.id;
                        const isSavedThis = savedSubjectId === s.id;
                        return (
                          <div key={s.id} className="flex items-center gap-3 py-3"
                            style={{ borderBottom: "1px solid #0f172a" }}>
                            {/* Emoji icon input */}
                            <input
                              value={s.icon}
                              onChange={e => editSubject(s.id, "icon", e.target.value)}
                              style={{ ...inputStyle, width: 52, textAlign: "center", fontSize: 20, padding: "4px 6px" }}
                              title="Icon (emoji)"
                            />
                            {/* Editable subject name */}
                            <input
                              value={s.name}
                              onChange={e => editSubject(s.id, "name", e.target.value)}
                              style={{ ...inputStyle, flex: 1, fontWeight: 600 }}
                              placeholder="Subject name…"
                              title="Subject name — will update all linked questions"
                            />
                            {/* Color picker */}
                            <input
                              type="color"
                              value={s.color}
                              onChange={e => {
                                const c = e.target.value;
                                editSubject(s.id, "color", c);
                                editSubject(s.id, "gradient", `linear-gradient(135deg,${c}cc,${c})`);
                              }}
                              style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid #334155", cursor: "pointer", padding: 2, background: "#0f172a" }}
                              title="Subject color"
                            />
                            {/* Active toggle */}
                            <button
                              onClick={() => editSubject(s.id, "isActive", !s.isActive)}
                              className="px-2 py-1 rounded text-xs font-bold transition-all"
                              style={{
                                background: s.isActive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                                color: s.isActive ? "#34d399" : "#f87171",
                                border: `1px solid ${s.isActive ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                                minWidth: 62,
                              }}>
                              {s.isActive ? "Active" : "Hidden"}
                            </button>
                            {/* Save button */}
                            <button
                              onClick={() => saveSubject(s.id)}
                              disabled={!isDirty || isSavingThis}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                              style={{
                                background: isSavedThis ? "#16a34a" : isDirty ? "#6366f1" : "#1e293b",
                                color: isDirty || isSavedThis ? "#fff" : "#475569",
                                border: `1px solid ${isDirty ? "#6366f1" : "#334155"}`,
                                minWidth: 80,
                                cursor: isDirty && !isSavingThis ? "pointer" : "default",
                              }}>
                              {isSavedThis ? "✓ Saved" : isSavingThis ? "Saving…" : "Save Changes"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
            })()
          )}
        </section>

        {/* ─── Section: Branding ─── */}
        <section className="rounded-xl p-5 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2">
            <span>🎨</span> Branding & Text
          </h2>
          {textInput("brand.headerTitle", "App Title", "e.g. Quizzy")}
          {textInput("brand.slogan", "Slogan / Tagline", "e.g. Ace your exams with confidence")}
          <div className="pt-0">
            {textInput("brand.footerLink", "Footer Link URL", "https://...")}
          </div>
        </section>

        {/* ─── Section: Maintenance ─── */}
        <section className="rounded-xl p-5" style={{ background: "#1e293b", border: `1px solid ${isMaintenance ? "rgba(239,68,68,0.4)" : "#334155"}` }}>
          <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2">
            <span>🛑</span> Maintenance Mode
          </h2>
          <div className="pb-0">
            {toggle("maintenance.enabled", "Enable Maintenance Mode", "Shows a full-screen overlay to all non-admin students", true)}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
