import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useSettings } from "@/context/SettingsContext";

const API = import.meta.env.BASE_URL + "api";

type Config = Record<string, string>;

const DEFAULTS: Config = {
  "brand.headerTitle": "Quizzy",
  "brand.slogan": "Ace your exams with confidence",
  "brand.footerLink": "",
  "maintenance.enabled": "false",
};

export function SiteSettingsPage() {
  const { refreshSettings } = useSettings();
  const [config, setConfig] = useState<Config>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/settings`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then((cfg: Config) => { setConfig({ ...DEFAULTS, ...cfg }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function set(key: string, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/settings/batch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: config }),
      });
      if (r.ok) {
        await refreshSettings();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert("Failed to save settings. Please try again.");
      }
    } catch {
      alert("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
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
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white">⚙️ Site Settings</h1>
            <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>Branding, display text, and maintenance mode.</p>
          </div>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm"
            style={{
              background: saved ? "#16a34a" : saving ? "#334155" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: saving ? "#64748b" : "#fff",
            }}>
            {saved ? "✅ Saved!" : saving ? "Saving…" : "Save All"}
          </button>
        </div>

        {isMaintenance && (
          <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-bold" style={{ color: "#f87171" }}>Maintenance Mode is ACTIVE</p>
              <p className="text-xs" style={{ color: "#fca5a5" }}>Students will see a maintenance overlay until you disable this.</p>
            </div>
          </div>
        )}

        {/* Branding */}
        <section className="rounded-xl p-5 mb-5" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h2 className="text-sm font-black text-white mb-4 flex items-center gap-2"><span>🎨</span> Branding & Display Text</h2>
          {[
            { key: "brand.headerTitle", label: "App Title", placeholder: "e.g. Quizzy" },
            { key: "brand.slogan", label: "Slogan / Tagline", placeholder: "e.g. Ace your exams with confidence" },
            { key: "brand.footerLink", label: "Footer Link URL", placeholder: "https://..." },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #0f172a" }}>
              <p className="text-sm font-semibold text-white mr-4">{label}</p>
              <input value={config[key] ?? ""} onChange={e => set(key, e.target.value)}
                placeholder={placeholder} style={{ ...inputStyle, width: 260 }} />
            </div>
          ))}
        </section>

        {/* Maintenance */}
        <section className="rounded-xl p-5" style={{ background: "#1e293b", border: `1px solid ${isMaintenance ? "rgba(239,68,68,0.4)" : "#334155"}` }}>
          <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2"><span>🛑</span> Maintenance Mode</h2>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-white">Enable Maintenance Mode</p>
              <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>Shows a full-screen overlay to all non-admin students.</p>
              {isMaintenance && (
                <p className="text-xs mt-2 font-medium" style={{ color: "#38bdf8" }}>
                  💡 <strong>Note:</strong> You can still see and use the site because you are logged in as an Admin. Open an <strong>Incognito / Private tab</strong> to verify what students see!
                </p>
              )}
            </div>
            <button onClick={() => set("maintenance.enabled", isMaintenance ? "false" : "true")}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{ background: isMaintenance ? "#ef4444" : "#334155" }}>
              <div className="absolute top-1 w-4 h-4 rounded-full transition-all"
                style={{ background: "#fff", left: isMaintenance ? "26px" : "4px" }} />
            </button>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
