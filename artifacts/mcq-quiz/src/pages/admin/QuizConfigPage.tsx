import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";

const API = import.meta.env.BASE_URL + "api";

type Config = Record<string, string>;

const DEFAULTS: Config = {
  "timer.globalLimit": "60",
  "timer.questionInterval": "30",
  "timer.breakWindow": "300",
  "mcq.defaultCount": "40",
  "mcq.easyTime": "30",
  "mcq.mediumTime": "15",
  "mcq.hardTime": "10",
  ...Object.fromEntries([1,2,3,4,5,6,7,8].map(s => [`sem.lock.${s}`, "false"])),
};

export function QuizConfigPage() {
  const [config, setConfig] = useState<Config>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/settings`)
      .then(r => r.ok ? r.json() : {})
      .then((cfg: Config) => { setConfig({ ...DEFAULTS, ...cfg }); setLoading(false); })
      .catch(() => setLoading(false));
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

  const inputStyle = {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
    color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none",
  };

  const stepper = (key: string, label: string, desc: string, min: number, max: number) => (
    <div key={key} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #0f172a" }}>
      <div><p className="text-sm font-semibold text-white">{label}</p><p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{desc}</p></div>
      <div className="flex items-center gap-2">
        <button onClick={() => set(key, String(Math.max(min, parseInt(config[key] ?? "0") - 1)))}
          className="w-8 h-8 rounded-lg font-bold text-lg flex items-center justify-center"
          style={{ background: "#334155", color: "#e2e8f0" }}>−</button>
        <input type="number" value={config[key] ?? ""} min={min} max={max}
          onChange={e => set(key, e.target.value)}
          style={{ ...inputStyle, width: 76, textAlign: "center" }} />
        <button onClick={() => set(key, String(Math.min(max, parseInt(config[key] ?? "0") + 1)))}
          className="w-8 h-8 rounded-lg font-bold text-lg flex items-center justify-center"
          style={{ background: "#334155", color: "#e2e8f0" }}>+</button>
      </div>
    </div>
  );

  if (loading) return (
    <AdminLayout>
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white">🔧 Quiz Configuration</h1>
            <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>Timer rules, difficulty timings, and semester access locks.</p>
          </div>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: saved ? "#16a34a" : saving ? "#334155" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: saving ? "#64748b" : "#fff" }}>
            {saved ? "✅ Saved!" : saving ? "Saving…" : "Save All"}
          </button>
        </div>

        {/* Timers */}
        <section className="rounded-xl p-5 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-1 flex items-center gap-2"><span>⏱</span> Quiz Timers</h2>
          <p className="text-xs mb-3" style={{ color: "#64748b" }}>These values apply globally across all quizzes.</p>
          {stepper("timer.globalLimit", "Global Quiz Timer", "Minutes — total time for entire quiz session", 5, 300)}
          {stepper("timer.questionInterval", "Per-Question Countdown", "Seconds — countdown per individual question", 5, 120)}
          <div className="pb-0">{stepper("timer.breakWindow", "Max Break Duration", "Seconds — longest allowed break during quiz", 30, 3600)}</div>
        </section>

        {/* Per-difficulty timings */}
        <section className="rounded-xl p-5 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-1 flex items-center gap-2"><span>🎯</span> Difficulty Timings</h2>
          <p className="text-xs mb-3" style={{ color: "#64748b" }}>Seconds allowed per question at each difficulty level.</p>
          {stepper("mcq.easyTime", "Easy Questions", "Seconds per easy question", 5, 120)}
          {stepper("mcq.mediumTime", "Medium Questions", "Seconds per medium question", 5, 120)}
          <div className="pb-0">{stepper("mcq.hardTime", "Hard Questions", "Seconds per hard question", 5, 120)}</div>
        </section>

        {/* MCQ defaults */}
        <section className="rounded-xl p-5 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-1 flex items-center gap-2"><span>📋</span> Quiz Defaults</h2>
          <p className="text-xs mb-3" style={{ color: "#64748b" }}>Default values shown in the quiz setup screen.</p>
          <div className="pb-0">{stepper("mcq.defaultCount", "Default MCQ Count", "Number of questions pre-selected in setup", 5, 200)}</div>
        </section>

        {/* Semester locks */}
        <section className="rounded-xl p-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-1 flex items-center gap-2"><span>🔒</span> Semester Access Locks</h2>
          <p className="text-xs mb-3" style={{ color: "#64748b" }}>Locking a semester hides all its quizzes from students.</p>
          <div className="grid grid-cols-2 gap-x-6">
            {[1,2,3,4,5,6,7,8].map(s => {
              const key = `sem.lock.${s}`;
              const locked = config[key] === "true";
              return (
                <div key={s} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid #0f172a" }}>
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
      </div>
    </AdminLayout>
  );
}
