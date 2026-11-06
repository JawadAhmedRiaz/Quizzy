import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { TopNavbar } from "@/components/TopNavbar";
import { useUser } from "@/context/UserContext";
import { Maximize2, Minimize2, ExternalLink } from "lucide-react";

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
  fileUrl?: string;
  fileName: string;
  fileSize?: string;
  mimeType?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  isLegacy?: boolean;
}

export function getDocumentKind(mimeType?: string, fileName?: string): "image" | "pdf" | "office" | "other" {
  const mime = (mimeType || "").trim().toLowerCase();
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";

  // 1. Decide strictly by mimeType if present
  if (mime) {
    if (mime.startsWith("image/")) return "image";
    if (mime === "application/pdf") return "pdf";
    if (
      mime.includes("wordprocessingml") ||
      mime.includes("presentationml") ||
      mime.includes("spreadsheetml") ||
      mime === "application/msword" ||
      mime === "application/vnd.ms-powerpoint" ||
      mime === "application/vnd.ms-excel"
    ) {
      return "office";
    }
  }

  // 2. Fallback to extension only if mimeType is empty or unknown
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["ppt", "pptx", "doc", "docx", "xls", "xlsx"].includes(ext)) return "office";

  return "other";
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
  const { isAdmin, profile } = useUser();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Vault Accessibility Status
  const [isVaultPublic, setIsVaultPublic] = useState<boolean | null>(null);

  // Filters (Semester defaults to user's profile semester or 1)
  const defaultSem = profile?.semester ?? (() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("quizzy_student_sem") : null;
    return saved ? Number(saved) : 1;
  })();
  const [selectedSem, setSelectedSem] = useState<number>(defaultSem);
  const [hasInitializedProfileSem, setHasInitializedProfileSem] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "">("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal & File Loading state
  const [previewDoc, setPreviewDoc] = useState<VaultDoc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState<{ url: string; title: string; googleUrl?: string } | null>(null);

  // Fetch signed URL whenever a document is selected for preview (Desktop modal)
  useEffect(() => {
    if (!previewDoc) {
      setPreviewUrl(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    if (previewDoc.fileUrl) {
      setPreviewUrl(previewDoc.fileUrl);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let isMounted = true;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);

    // Normal signed URL without ?download=1 for inline viewing
    fetch(`${API}/vault/${previewDoc.id}/file-url`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("Access restricted. Please sign in with an authorized student account.");
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load document link.");
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setPreviewUrl(data.url);
          setPreviewLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setPreviewError(err.message || "Network error loading document link.");
          setPreviewLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [previewDoc]);

  // Handle document card or preview click:
  // On narrow screens (phones, max-width: 768px): NO iframes.
  // Opens a new tab immediately and synchronously to prevent iOS Safari popup blocking.
  const handleCardClick = (item: VaultDoc) => {
    const isPhone = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
    if (isPhone) {
      const newTab = window.open("about:blank", "_blank");
      if (newTab) {
        try {
          newTab.document.write("<p style='font-family:system-ui,-apple-system,sans-serif;text-align:center;padding-top:40px;color:#64748b;font-size:14px;'>Loading document viewer...</p>");
        } catch {}
      }

      fetch(`${API}/vault/${item.id}/file-url`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              throw new Error("Access restricted. Please sign in with an authorized student account.");
            }
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to load document link.");
          }
          return res.json();
        })
        .then((data) => {
          const kind = getDocumentKind(data.mimeType || item.mimeType, data.fileName || item.fileName);
          let targetUrl = data.url;
          let googleUrl: string | undefined;

          if (kind === "office") {
            targetUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(data.url)}`;
            googleUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(data.url)}`;
          }

          if (newTab && !newTab.closed) {
            newTab.location.href = targetUrl;
          } else {
            // Popup was blocked by browser
            setFallbackOpen({ url: targetUrl, title: item.title, googleUrl });
          }
        })
        .catch((err) => {
          if (newTab && !newTab.closed) {
            try {
              newTab.document.write(`<p style='font-family:system-ui,-apple-system,sans-serif;text-align:center;padding-top:40px;color:#ef4444;font-size:14px;'>${err.message}</p>`);
            } catch {}
          }
          alert(err.message || "Failed to open document.");
        });
      return;
    }

    // Wide screens / Desktop: open modal with inline viewer
    setPreviewDoc(item);
  };

  // Open Office file in a new tab with view.aspx (same as phone flow, fresh normal signed URL)
  const handleOpenOfficeNewTab = (doc: VaultDoc) => {
    if (!doc) return;
    const newTab = window.open("about:blank", "_blank");
    if (newTab) {
      try {
        newTab.document.write("<p style='font-family:system-ui,-apple-system,sans-serif;text-align:center;padding-top:40px;color:#64748b;font-size:14px;'>Loading document viewer...</p>");
      } catch {}
    }

    fetch(`${API}/vault/${doc.id}/file-url`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("Access restricted. Please sign in with an authorized student account.");
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load document link.");
        }
        return res.json();
      })
      .then((data) => {
        const rawUrl = data.url;
        const targetUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(rawUrl)}`;
        const googleUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}`;

        if (newTab && !newTab.closed) {
          newTab.location.href = targetUrl;
        } else {
          setFallbackOpen({ url: targetUrl, title: doc.title, googleUrl });
        }
      })
      .catch((err) => {
        if (newTab && !newTab.closed) {
          try {
            newTab.document.write(`<p style='font-family:system-ui,-apple-system,sans-serif;text-align:center;padding-top:40px;color:#ef4444;font-size:14px;'>${err.message}</p>`);
          } catch {}
        }
        alert(err.message || "Failed to open document.");
      });
  };

  // Handle direct download: forces Content-Disposition attachment via ?download=1
  const handleDirectDownload = async (doc: VaultDoc, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (doc.fileUrl) {
      const a = document.createElement("a");
      a.href = doc.fileUrl;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    setDownloadingId(doc.id);
    try {
      const res = await fetch(`${API}/vault/${doc.id}/file-url?download=1`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert("This document is restricted. Please sign in with an authorized student account.");
        } else {
          alert("Unable to generate download link. Please try again.");
        }
        return;
      }
      const data = await res.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.fileName || doc.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      alert("Network error while preparing download.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Close or exit fullscreen on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else if (previewDoc) {
          setPreviewDoc(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, previewDoc]);

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
          const targetSem = profile?.semester ?? defaultSem;
          setSelectedSem(targetSem);
          const semSubs = data.filter((s) => s.sem === targetSem);
          if (semSubs.length > 0) {
            setSelectedSubjectId(semSubs[0].id);
          } else {
            setSelectedSubjectId(data[0].id);
            setSelectedSem(data[0].sem);
          }
        }
      })
      .catch(() => setSubjects([]));
  }, []);

  // Sync with profile semester when profile loads
  useEffect(() => {
    if (profile?.semester && !hasInitializedProfileSem) {
      setSelectedSem(profile.semester);
      setHasInitializedProfileSem(true);
      if (subjects.length > 0) {
        const semSubs = subjects.filter((s) => s.sem === profile.semester);
        if (semSubs.length > 0) {
          setSelectedSubjectId(semSubs[0].id);
        }
      }
    }
  }, [profile?.semester, subjects, hasInitializedProfileSem]);

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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-base sm:text-sm outline-none bg-muted/60 border border-border/80 text-foreground transition-all focus:border-blue-500 focus:bg-background"
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
                    onClick={() => handleCardClick(item)}
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
                            handleCardClick(item);
                          }}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title="Preview"
                        >
                          👁️
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDirectDownload(item, e)}
                          disabled={downloadingId === item.id}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          title="Download"
                        >
                          {downloadingId === item.id ? "⏳" : "⬇️"}
                        </button>
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
            <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? "p-0" : "p-4"}`}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-md"
                onClick={() => {
                  setPreviewDoc(null);
                  setIsFullscreen(false);
                }}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={
                  isFullscreen
                    ? "fixed inset-0 z-50 w-screen h-screen max-w-none max-h-none rounded-none p-4 md:p-6 shadow-2xl flex flex-col bg-card"
                    : "relative w-full max-w-4xl max-h-[90vh] rounded-3xl p-6 shadow-2xl z-10 flex flex-col vault-glass-card"
                }
                style={{
                  background: "hsl(var(--card))",
                  border: isFullscreen ? "none" : "1px solid hsl(var(--border))",
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
                      {isFullscreen && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                          Fullscreen Mode
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {previewDoc.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Fullscreen Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border shadow flex items-center gap-1.5 transition-all cursor-pointer ${
                        isFullscreen
                          ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                          : "bg-muted text-foreground border-border hover:bg-muted/80"
                      }`}
                      title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand to Fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                    </button>

                    {/* Open in new tab */}
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-foreground bg-muted hover:bg-muted/80 border border-border shadow flex items-center gap-1.5 transition-all"
                        title="Open in new window"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">New Tab</span>
                      </a>
                    )}

                    {/* Download button */}
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => handleDirectDownload(previewDoc)}
                        disabled={downloadingId === previewDoc.id}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span>⬇️</span>
                        <span className="hidden sm:inline">{downloadingId === previewDoc.id ? "Preparing..." : "Download"}</span>
                      </button>
                    )}

                    {/* Close button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewDoc(null);
                        setIsFullscreen(false);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground text-sm font-bold cursor-pointer"
                      title="Close (Esc)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Preview Viewport */}
                <div
                  className={`flex-1 my-3 overflow-hidden rounded-2xl bg-muted/40 border border-border/60 flex flex-col items-center justify-center ${
                    isFullscreen ? "h-[calc(100vh-140px)] h-[calc(100dvh-140px)] max-h-none p-2" : "max-h-[60vh] max-h-[60dvh] p-4 overflow-y-auto"
                  }`}
                >
                  {previewLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center">
                      <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-xs font-bold text-muted-foreground">Preparing secure document link...</p>
                    </div>
                  ) : previewError ? (
                    <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl mb-2">🔒</span>
                      <p className="text-sm font-bold text-foreground mb-1">Access Restricted</p>
                      <p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">{previewError}</p>
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ ...previewDoc })}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow transition-all hover:scale-105"
                      >
                        Retry
                      </button>
                    </div>
                  ) : previewUrl ? (
                    (() => {
                      const docKind = getDocumentKind(previewDoc.mimeType, previewDoc.fileName);
                      if (docKind === "image") {
                        return (
                          <img
                            src={previewUrl}
                            alt={previewDoc.title}
                            className={`${isFullscreen ? "max-h-full" : "max-h-[50vh]"} w-auto object-contain rounded-xl shadow`}
                          />
                        );
                      }
                      if (docKind === "pdf") {
                        return (
                          <iframe
                            src={previewUrl}
                            title={previewDoc.title}
                            className={`w-full rounded-xl border border-border ${isFullscreen ? "h-full" : "h-[50vh]"}`}
                          />
                        );
                      }
                      if (docKind === "office") {
                        return (
                          <div className="w-full h-full flex flex-col gap-2">
                            <div className="flex items-center justify-between px-3 py-2 bg-muted/70 rounded-xl text-xs border border-border">
                              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                                <span>📊</span>
                                <span>Office Online Viewer</span>
                              </span>
                              <div className="flex items-center gap-2.5 sm:gap-3">
                                <a
                                  href={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline font-bold flex items-center gap-1"
                                >
                                  Try Google viewer <ExternalLink className="w-3 h-3" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleOpenOfficeNewTab(previewDoc)}
                                  className="px-3 py-1 rounded-lg font-bold text-foreground bg-muted hover:bg-muted/80 border border-border shadow flex items-center gap-1.5 transition-colors"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Open in new tab</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDirectDownload(previewDoc)}
                                  disabled={downloadingId === previewDoc.id}
                                  className="px-3 py-1 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 shadow flex items-center gap-1 disabled:opacity-50"
                                >
                                  <span>⬇️</span>
                                  <span>Download</span>
                                </button>
                              </div>
                            </div>
                            <iframe
                              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                              title={previewDoc.title}
                              className={`w-full rounded-xl border border-border ${isFullscreen ? "h-[calc(100vh-210px)] h-[calc(100dvh-210px)]" : "h-[50vh] h-[50dvh]"}`}
                            />
                          </div>
                        );
                      }
                      return (
                        <div className="text-center p-8 flex flex-col items-center justify-center">
                          <span className="text-5xl block mb-3">📄</span>
                          <p className="text-sm font-bold text-foreground mb-1">{previewDoc.fileName}</p>
                          <p className="text-xs text-muted-foreground max-w-md mb-2">
                            Stored in Study Vault ({previewDoc.fileSize || "File available"})
                          </p>
                          <button
                            type="button"
                            onClick={() => handleDirectDownload(previewDoc)}
                            disabled={downloadingId === previewDoc.id}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow inline-flex items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-50"
                          >
                            <span>⬇️ Download & Open</span>
                          </button>
                        </div>
                      );
                    })()
                  ) : null}
                </div>

                {/* Footer notes */}
                {previewDoc.description && !isFullscreen && (
                  <div className="p-3 rounded-xl bg-muted/60 text-xs text-muted-foreground">
                    <strong className="text-foreground block mb-0.5">Notes:</strong>
                    {previewDoc.description}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Fallback open link for mobile users when popup was blocked */}
        {fallbackOpen && (
          <div
            className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-4 right-4 left-4 sm:left-auto z-50 p-4 rounded-2xl bg-card border border-border shadow-2xl flex items-center justify-between gap-3"
          >
            <div className="text-xs min-w-0">
              <p className="font-bold text-foreground">Document Ready</p>
              <p className="text-muted-foreground truncate max-w-[200px]">{fallbackOpen.title}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={fallbackOpen.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow"
                onClick={() => setFallbackOpen(null)}
              >
                Open Viewer
              </a>
              {fallbackOpen.googleUrl && (
                <a
                  href={fallbackOpen.googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 font-bold hover:underline"
                  onClick={() => setFallbackOpen(null)}
                >
                  Google
                </a>
              )}
              <button
                type="button"
                onClick={() => setFallbackOpen(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
