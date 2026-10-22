import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

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
}

const REASON_LABELS: Record<string, string> = {
  incorrect_answer: "Incorrect Answer",
  confusing: "Confusing Wording",
  duplicate: "Duplicate Question",
  other: "Other",
};

function groupByQuestion(flags: Flag[]): { questionId: string; questionText: string; quizId: string; flags: Flag[] }[] {
  const map = new Map<string, Flag[]>();
  flags.forEach(f => {
    if (!map.has(f.questionId)) map.set(f.questionId, []);
    map.get(f.questionId)!.push(f);
  });
  return Array.from(map.entries()).map(([qid, fls]) => ({
    questionId: qid,
    questionText: fls[0].questionText,
    quizId: fls[0].quizId,
    flags: fls,
  })).sort((a, b) => b.flags.length - a.flags.length);
}

export function FlaggedQuestionsPage() {
  const [, navigate] = useLocation();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState("all");

  useEffect(() => {
    fetch(`${API}/flags`)
      .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then(data => { setFlags(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const filtered = flags.filter(f => filterReason === "all" || f.reason === filterReason);
  const groups = groupByQuestion(filtered);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")}
            className="p-2 rounded-lg transition-all hover:scale-[1.02]"
            style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-black" style={{ fontFamily: "'Poppins',sans-serif" }}>🚩 Flagged Questions</h1>
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{flags.length} flag{flags.length !== 1 ? "s" : ""} submitted by users</p>
          </div>
        </div>

        {/* Banner */}
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          Help us improve! Flag any question that seems wrong or confusing.
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {["all", ...Object.keys(REASON_LABELS)].map(r => (
            <button key={r} onClick={() => setFilterReason(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filterReason === r ? "rgba(239,68,68,0.2)" : "hsl(var(--muted))",
                color: filterReason === r ? "#f87171" : "hsl(var(--muted-foreground))",
                border: `1px solid ${filterReason === r ? "rgba(239,68,68,0.4)" : "hsl(var(--border))"}`,
              }}>
              {r === "all" ? "All Flags" : REASON_LABELS[r]}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="glow-card p-10 text-center">
            <div className="w-6 h-6 rounded-full border-2 border-red-400 border-t-transparent animate-spin mx-auto" />
          </div>
        ) : error ? (
          <div className="glow-card p-10 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-semibold">Failed to load flagged questions</p>
            <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Please check your connection and try again.</p>
            <button onClick={() => { setError(false); setLoading(true); fetch(`${API}/flags`).then(r => r.ok ? r.json() : Promise.reject()).then(d => { setFlags(d); setLoading(false); }).catch(() => { setError(true); setLoading(false); }); }}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              Retry
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="glow-card p-10 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-semibold">No flagged questions</p>
            <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>All questions look good!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <motion.div key={group.questionId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glow-card overflow-hidden"
                style={{ borderColor: group.flags.some(f => !f.reviewed) ? "rgba(239,68,68,0.25)" : "hsl(var(--border))" }}>
                <button onClick={() => setExpandedId(expandedId === group.questionId ? null : group.questionId)}
                  className="w-full p-4 text-left flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">🚩</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">{group.questionText}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                        {group.flags.length} flag{group.flags.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                        {group.quizId}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {expandedId === group.questionId ? "▲" : "▼"}
                  </span>
                </button>

                <AnimatePresence>
                  {expandedId === group.questionId && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden">
                      <div className="px-4 pb-4 flex flex-col gap-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                        <p className="text-xs font-semibold uppercase tracking-wide pt-3" style={{ color: "hsl(var(--muted-foreground))" }}>Individual Flags</p>
                        {group.flags.map((f) => (
                          <div key={f.id} className="rounded-xl p-3 flex flex-col gap-1"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid hsl(var(--border))" }}>
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="text-xs font-bold" style={{ color: "#f87171" }}>
                                {REASON_LABELS[f.reason] ?? f.reason}
                              </span>
                              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                                {f.displayName || "Guest"} · {new Date(f.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {f.note && <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>"{f.note}"</p>}
                            {f.reviewed && <p className="text-xs font-semibold" style={{ color: "#34d399" }}>✓ Reviewed</p>}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
