import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";

const API = import.meta.env.BASE_URL + "api";

interface FeedbackRow {
  id: number;
  userId: string | null;
  displayName: string | null;
  rollNumber: string | null;
  message: string;
  createdAt: string;
}

export function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`${API}/admin/feedbacks`).catch(() => null);
    if (r?.ok) setFeedbacks(await r.json());
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function deleteFeedback(id: number) {
    setDeleting(id);
    await fetch(`${API}/admin/feedbacks/${id}`, { method: "DELETE" });
    setFeedbacks(prev => prev.filter(f => f.id !== id));
    setDeleting(null);
    if (expanded === id) setExpanded(null);
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-black text-white">💬 Feedbacks</h1>
            <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
              {feedbacks.length} message{feedbacks.length !== 1 ? "s" : ""} from students — click to read
            </p>
          </div>
          <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#1e293b", color: "#64748b", border: "1px solid #334155" }}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="font-bold text-white">No feedbacks yet</p>
            <p className="text-sm mt-1" style={{ color: "#64748b" }}>Student feedbacks will appear here once submitted via the app.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {feedbacks.map(fb => (
              <div key={fb.id} className="rounded-xl overflow-hidden"
                style={{ background: "#1e293b", border: `1px solid ${expanded === fb.id ? "rgba(99,102,241,0.4)" : "#334155"}` }}>
                {/* Header row */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(expanded === fb.id ? null : fb.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                      style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                      {(fb.displayName ?? fb.userId ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{fb.displayName ?? fb.userId ?? "Anonymous"}</p>
                      <div className="flex items-center gap-2">
                        {fb.rollNumber && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                            {fb.rollNumber}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: "#475569" }}>
                          {new Date(fb.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs max-w-[200px] truncate" style={{ color: "#64748b" }}>{fb.message}</p>
                    <span style={{ color: "#475569", fontSize: 12 }}>{expanded === fb.id ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded message */}
                {expanded === fb.id && (
                  <div className="px-4 pb-4">
                    <div className="rounded-lg p-3 mb-3" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: "#64748b" }}>Full Message</p>
                      <p className="text-sm" style={{ color: "#e2e8f0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{fb.message}</p>
                    </div>
                    {fb.userId && (
                      <p className="text-xs mb-3" style={{ color: "#475569" }}>
                        User ID: <span className="font-mono" style={{ color: "#334155" }}>{fb.userId}</span>
                      </p>
                    )}
                    <button onClick={() => deleteFeedback(fb.id)} disabled={deleting === fb.id}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                      {deleting === fb.id ? "Deleting…" : "🗑 Delete Feedback"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
