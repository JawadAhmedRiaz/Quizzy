import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { TopNavbar } from "@/components/TopNavbar";
import { useUser } from "@/context/UserContext";

const API = import.meta.env.BASE_URL + "api";

interface Subject {
  id: number;
  sem: number;
  name: string;
  icon?: string;
  color?: string;
  gradient?: string;
  isActive?: boolean;
}

export interface VaultDoc {
  id: number | string;
  userId: string;
  subjectId: number;
  title: string;
  category: "pdf" | "handwritten" | "notes" | "summary" | "other";
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: string;
  mimeType?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

const CATEGORIES = [
  { id: "all", label: "All Items", icon: "✨", color: "#007aff" },
  { id: "pdf", label: "PDFs & Slides", icon: "📑", color: "#ef4444" },
  { id: "handwritten", label: "Handwritten", icon: "✍️", color: "#f59e0b" },
  { id: "notes", label: "Lecture Notes", icon: "📝", color: "#10b981" },
  { id: "summary", label: "Exam Summaries", icon: "⚡", color: "#8b5cf6" },
];

export function VaultPage() {
  const [, navigate] = useLocation();
  const { isAdmin } = useUser();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Vault Accessibility Status
  const [isVaultPublic, setIsVaultPublic] = useState<boolean | null>(null);

  // Filters (Semester defaults to 1, subject defaults to first subject of semester 1)
  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "">("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state (Only preview allowed here; all upload options removed outside admin dashboard)
  const [previewDoc, setPreviewDoc] = useState<VaultDoc | null>(null);

  // 1. Fetch vault accessibility settings
  useEffect(() => {
    fetch(`${API}/vault/settings`)
      .then((res) => (res.ok ? res.json() : { isPublic: true }))
      .then((data) => setIsVaultPublic(data.isPublic ?? true))
      .catch(() => setIsVaultPublic(true));
  }, []);

  // 2. Fetch subjects
  useEffect(() => {
    fetch(`${API}/subjects`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Subject[]) => {
        setSubjects(data);
        if (data.length > 0) {
          const sem1Subs = data.filter((s) => s.sem === 1);
          if (sem1Subs.length > 0) {
            setSelectedSubjectId(sem1Subs[0].id);
          } else {
            setSelectedSubjectId(data[0].id);
            setSelectedSem(data[0].sem);
          }
        }
      })
      .catch(() => setSubjects([]));
  }, []);

  // 3. Fetch all published vault items
  const fetchVaultItems = () => {
    setLoading(true);
    fetch(`${API}/vault`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: VaultDoc[]) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchVaultItems();
  }, []);

  // Handle semester change - automatically sets first subject of selected semester
  const handleSemChange = (sem: number) => {
    setSelectedSem(sem);
    const semSubs = subjects.filter((s) => s.sem === sem);
    if (semSubs.length > 0) {
      setSelectedSubjectId(semSubs[0].id);
    } else {
      setSelectedSubjectId("");
    }
  };

  // Available semesters list
  const availableSemesters = useMemo(() => {
    const set = new Set(subjects.map((s) => s.sem));
    if (set.size === 0) set.add(1);
    return Array.from(set).sort((a, b) => a - b);
  }, [subjects]);

  // Current semester subjects
  const currentSemesterSubjects = useMemo(() => {
    return subjects.filter((s) => s.sem === selectedSem);
  }, [subjects, selectedSem]);

  // Filtered documents
  const filteredItems = useMemo(() => {
    return items.filter((doc) => {
      // Must match selected semester & subject
      const docSubj = subjects.find((s) => s.id === doc.subjectId);
      if (docSubj && docSubj.sem !== selectedSem) return false;

      if (selectedSubjectId !== "" && doc.subjectId !== selectedSubjectId) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "all" && doc.category !== selectedCategory) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchDesc = (doc.description || "").toLowerCase().includes(q);
        const matchSubj = (docSubj?.name || "").toLowerCase().includes(q);
        const matchFile = doc.fileName.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSubj && !matchFile) return false;
      }

      return true;
    });
  }, [items, selectedSem, selectedSubjectId, selectedCategory, searchQuery, subjects]);

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  // If Vault is locked to students and current user is not an admin, show Restricted screen
  if (isVaultPublic === false && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
        <TopNavbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-3xl text-center vault-glass-card border border-border shadow-2xl">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center text-4xl mx-auto mb-4">
              🔒
            </div>
            <h2 className="text-xl font-black" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Study Vault Access Restricted
            </h2>
            <p className="text-xs text-muted-foreground mt-2 mb-6 leading-relaxed">
              The Study Vault is currently locked by administrators for curriculum updates and document review. Please check back later!
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow transition-all hover:scale-105"
            >
              Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      <TopNavbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Admin Maintenance Banner */}
        {isVaultPublic === false && isAdmin && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>
                <strong>Admin Notice:</strong> The Study Vault is currently in <strong>Admin-Only mode</strong>. Students cannot see this page.
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/vault")}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-bold transition-colors whitespace-nowrap"
            >
              Manage in Admin Vault →
            </button>
          </div>
        )}

        {/* ─── VAULT HERO HEADER ─── */}
        <section
          className="rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl vault-glass-card"
          style={{
            background: "linear-gradient(135deg, hsl(var(--card)/0.85) 0%, hsl(var(--muted)/0.4) 100%)",
          }}
        >
          {/* Ambient luminous glow */}
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-25"
            style={{ background: "radial-gradient(circle, #007AFF 0%, transparent 70%)" }}
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-3xl">🏛️</span>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Study Vault
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                  Semester {selectedSem} {activeSubject ? `• ${activeSubject.name}` : ""}
                </span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Official repository of lecture notes, handwritten sheets, slides, and exam summaries curated by instructors.
              </p>
            </div>

            {/* Quick Admin Dashboard Link (No upload form here — additions strictly in Admin Dashboard) */}
            {isAdmin && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate("/admin/vault")}
                  className="px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-lg flex items-center gap-2 transition-all hover:scale-105"
                  style={{
                    background: "linear-gradient(135deg, #007aff, #2563eb)",
                    boxShadow: "0 6px 20px rgba(0, 122, 255, 0.35)",
                  }}
                >
                  <span>⚙️</span>
                  <span>Manage in Admin Vault</span>
                </button>
              </div>
            )}
          </div>

          {/* ─── SEARCH & CATEGORY FILTER BAR ─── */}
          <div className="mt-6 pt-6 border-t border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${activeSubject?.name || "current subject"}...`}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm outline-none bg-muted/60 border border-border/80 text-foreground transition-all focus:border-blue-500 focus:bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md scale-[1.03]"
                        : "vault-glass-pill text-foreground hover:text-blue-500"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SEMESTER TABS (No "All Semesters") ─── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">Semester:</span>
            {availableSemesters.map((sem) => {
              const isSelected = selectedSem === sem;
              return (
                <button
                  key={sem}
                  type="button"
                  onClick={() => handleSemChange(sem)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md scale-[1.02]"
                      : "bg-muted/70 text-foreground hover:bg-muted border border-border/50"
                  }`}
                >
                  Semester {sem}
                </button>
              );
            })}
          </div>

          {/* ─── SUBJECT PILLS FOR CHOSEN SEMESTER (No "All Subjects") ─── */}
          {currentSemesterSubjects.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {currentSemesterSubjects.map((subj) => {
                const isSelected = selectedSubjectId === subj.id;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => setSelectedSubjectId(subj.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                      isSelected
                        ? "border-2 border-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-sm scale-[1.02]"
                        : "vault-glass-pill text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{subj.icon || "📚"}</span>
                    <span>{subj.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── VAULT GLASS TILES GRID ─── */}
        <section>
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-muted-foreground">Loading Vault materials...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              className="py-16 px-6 rounded-3xl text-center flex flex-col items-center justify-center vault-glass-card"
              style={{
                background: "hsl(var(--card)/0.4)",
              }}
            >
              <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-4xl mb-4">
                📁
              </div>
              <h3 className="text-lg font-black tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                No Documents in this Section
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-2">
                {searchQuery || selectedCategory !== "all"
                  ? "No files match your current filters or search query."
                  : `No materials have been published for ${activeSubject?.name || "this subject"} yet. Official study notes and slides will appear here once uploaded by instructors.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map((item) => {
                const subj = subjects.find((s) => s.id === item.subjectId);
                const isPdf = item.category === "pdf";
                const isHandwritten = item.category === "handwritten";

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="vault-glass-card p-5 flex flex-col justify-between group cursor-pointer"
                    onClick={() => setPreviewDoc(item)}
                  >
                    <div>
                      {/* Top Row: Subject pill + category badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold truncate max-w-[170px]"
                          style={{
                            background: `${subj?.color || "#007aff"}18`,
                            color: subj?.color || "#007aff",
                            border: `1px solid ${subj?.color || "#007aff"}30`,
                          }}
                        >
                          {subj ? `${subj.icon || "📚"} ${subj.name}` : "General"}
                        </span>

                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isPdf
                              ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25"
                              : isHandwritten
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>

                      {/* Document Icon & Title */}
                      <div className="flex items-start gap-3 mb-2">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
                          style={{
                            background: isPdf
                              ? "rgba(239, 68, 68, 0.12)"
                              : isHandwritten
                              ? "rgba(245, 158, 11, 0.12)"
                              : "rgba(16, 185, 129, 0.12)",
                            border: `1px solid ${
                              isPdf
                                ? "rgba(239, 68, 68, 0.25)"
                                : isHandwritten
                                ? "rgba(245, 158, 11, 0.25)"
                                : "rgba(16, 185, 129, 0.25)"
                            }`,
                          }}
                        >
                          {isPdf ? "📄" : isHandwritten ? "✍️" : "📝"}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-snug group-hover:text-blue-500 transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {item.fileName}
                          </p>
                        </div>
                      </div>

                      {/* Description / Summary if present */}
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Metadata & Actions */}
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {item.fileSize && <span>{item.fileSize}</span>}
                        <span>•</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewDoc(item);
                          }}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title="Preview"
                        >
                          👁️
                        </button>

                        <a
                          href={item.fileUrl}
                          download={item.fileName}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title="Download"
                        >
                          ⬇️
                        </a>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── PREVIEW MODAL ─── */}
        <AnimatePresence>
          {previewDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-md"
                onClick={() => setPreviewDoc(null)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-3xl max-h-[90vh] rounded-3xl p-6 shadow-2xl z-10 flex flex-col vault-glass-card"
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-border/60">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">
                        {previewDoc.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {subjects.find((s) => s.id === previewDoc.subjectId)?.name || "Subject"}
                      </span>
                    </div>
                    <h3 className="text-lg font-black truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {previewDoc.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={previewDoc.fileUrl}
                      download={previewDoc.fileName}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow flex items-center gap-1.5"
                    >
                      <span>⬇️</span>
                      <span>Download</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(null)}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Preview Viewport */}
                <div className="flex-1 my-4 overflow-y-auto max-h-[60vh] rounded-2xl bg-muted/40 border border-border/60 p-4 flex flex-col items-center justify-center">
                  {previewDoc.fileUrl.startsWith("data:image/") || previewDoc.mimeType?.startsWith("image/") ? (
                    <img
                      src={previewDoc.fileUrl}
                      alt={previewDoc.title}
                      className="max-h-[50vh] w-auto object-contain rounded-xl shadow"
                    />
                  ) : previewDoc.fileUrl.startsWith("data:application/pdf") || previewDoc.fileName.endsWith(".pdf") ? (
                    <iframe
                      src={previewDoc.fileUrl}
                      title={previewDoc.title}
                      className="w-full h-[50vh] rounded-xl border border-border"
                    />
                  ) : (
                    <div className="text-center p-8">
                      <span className="text-5xl block mb-3">📄</span>
                      <p className="text-sm font-bold text-foreground mb-1">{previewDoc.fileName}</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Stored in Study Vault ({previewDoc.fileSize || "File available"})
                      </p>
                      <a
                        href={previewDoc.fileUrl}
                        download={previewDoc.fileName}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow inline-flex items-center gap-1.5"
                      >
                        <span>⬇️ Download & Open</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Footer notes */}
                {previewDoc.description && (
                  <div className="p-3 rounded-xl bg-muted/60 text-xs text-muted-foreground">
                    <strong className="text-foreground block mb-0.5">Notes:</strong>
                    {previewDoc.description}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
