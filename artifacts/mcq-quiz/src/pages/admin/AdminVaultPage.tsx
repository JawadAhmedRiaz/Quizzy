import { useState, useEffect, useMemo, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";

const API = import.meta.env.BASE_URL + "api";

interface Subject {
  id: number;
  sem: number;
  name: string;
  icon?: string;
  color?: string;
}

interface VaultDoc {
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
}

const CATEGORIES = [
  { id: "all", label: "All Items", icon: "✨" },
  { id: "pdf", label: "PDFs & Slides", icon: "📑" },
  { id: "handwritten", label: "Handwritten", icon: "✍️" },
  { id: "notes", label: "Lecture Notes", icon: "📝" },
  { id: "summary", label: "Exam Summaries", icon: "⚡" },
];

export function AdminVaultPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Vault Accessibility (controlled only inside this admin dashboard)
  const [isVaultPublic, setIsVaultPublic] = useState<boolean>(true);
  const [savingAccessibility, setSavingAccessibility] = useState(false);

  // Filters
  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Upload Form states
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubjectId, setUploadSubjectId] = useState<number | "">("");
  const [uploadCategory, setUploadCategory] = useState<VaultDoc["category"]>("pdf");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFilePreview, setUploadFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewDoc, setPreviewDoc] = useState<VaultDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Add Semester Modal
  const [addSemModalOpen, setAddSemModalOpen] = useState(false);
  const [newSemNum, setNewSemNum] = useState<number | "">("");
  const [newSemLabel, setNewSemLabel] = useState("");
  const [savingSem, setSavingSem] = useState(false);
  const [semError, setSemError] = useState("");

  // Add Subject Modal
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectIcon, setNewSubjectIcon] = useState("📚");
  const [newSubjectColor, setNewSubjectColor] = useState("#6366f1");
  const [savingSubject, setSavingSubject] = useState(false);
  const [subjectError, setSubjectError] = useState("");

  // Load accessibility settings
  const loadVaultSettings = () => {
    fetch(`${API}/vault/settings`)
      .then((res) => (res.ok ? res.json() : { isPublic: true }))
      .then((data) => setIsVaultPublic(data.isPublic ?? true))
      .catch(() => setIsVaultPublic(true));
  };

  // Toggle accessibility
  const toggleVaultAccessibility = async () => {
    setSavingAccessibility(true);
    const newStatus = !isVaultPublic;
    try {
      const res = await fetch(`${API}/vault/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newStatus }),
      });
      if (res.ok) {
        setIsVaultPublic(newStatus);
      } else {
        alert("Failed to update vault accessibility.");
      }
    } catch {
      alert("Network error updating vault accessibility.");
    } finally {
      setSavingAccessibility(false);
    }
  };

  // Load subjects
  const loadSubjects = () => {
    fetch(`${API}/subjects`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Subject[]) => {
        setSubjects(data);
      })
      .catch(() => setSubjects([]));
  };

  // Load vault items
  const loadItems = () => {
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
    loadSubjects();
    loadItems();
    loadVaultSettings();
  }, []);

  // Handle semester change
  const handleSemChange = (sem: number) => {
    setSelectedSem(sem);
    // Keep "all" or reset to "all" so admin immediately sees all subjects for this semester
    setSelectedSubjectId("all");
  };

  // Available semesters
  const availableSemesters = useMemo(() => {
    const set = new Set(subjects.map((s) => s.sem));
    if (set.size === 0) set.add(1);
    return Array.from(set).sort((a, b) => a - b);
  }, [subjects]);

  // Subjects for currently selected semester
  const currentSemesterSubjects = useMemo(() => {
    return subjects.filter((s) => s.sem === selectedSem);
  }, [subjects, selectedSem]);

  // Handle add semester
  const handleAddSemesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSemError("");

    if (!newSemNum || Number(newSemNum) < 1) {
      setSemError("Please provide a valid semester number (e.g. 3)");
      return;
    }
    const label = newSemLabel.trim() || `Semester ${newSemNum}`;

    setSavingSem(true);
    try {
      const res = await fetch(`${API}/admin/semesters`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num: Number(newSemNum), label, isActive: true }),
      });

      if (res.ok) {
        setAddSemModalOpen(false);
        setNewSemNum("");
        setNewSemLabel("");
        setSelectedSem(Number(newSemNum));
        setSelectedSubjectId("all");
        loadSubjects();
      } else {
        const err = await res.json().catch(() => ({}));
        setSemError(err.error || "Failed to create semester.");
      }
    } catch {
      setSemError("Network error while creating semester.");
    } finally {
      setSavingSem(false);
    }
  };

  // Handle add subject
  const handleAddSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubjectError("");

    if (!newSubjectName.trim()) {
      setSubjectError("Please provide a subject name.");
      return;
    }

    setSavingSubject(true);
    try {
      const res = await fetch(`${API}/admin/subjects`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sem: selectedSem,
          name: newSubjectName.trim(),
          icon: newSubjectIcon || "📚",
          color: newSubjectColor || "#6366f1",
          gradient: `linear-gradient(135deg, ${newSubjectColor}, #3b82f6)`,
          examTypes: ["Midterm", "Final"],
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setAddSubjectModalOpen(false);
        setNewSubjectName("");
        setNewSubjectIcon("📚");
        setNewSubjectColor("#6366f1");
        loadSubjects();
        if (created?.id) {
          setSelectedSubjectId(created.id);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setSubjectError(err.error || "Failed to create subject.");
      }
    } catch {
      setSubjectError("Network error while creating subject.");
    } finally {
      setSavingSubject(false);
    }
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    if (!uploadTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(cleanName);
    }
    if (file.name.toLowerCase().endsWith(".pdf")) {
      setUploadCategory("pdf");
    } else if (file.type.startsWith("image/")) {
      setUploadCategory("handwritten");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadFilePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle upload submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");

    if (!uploadTitle.trim()) {
      setUploadError("Please provide a title for the study document.");
      return;
    }
    if (!uploadSubjectId) {
      setUploadError("Please select a subject.");
      return;
    }
    if (!uploadFile && !uploadFilePreview) {
      setUploadError("Please choose a file to upload.");
      return;
    }

    setUploading(true);

    const sizeFormatted = uploadFile
      ? uploadFile.size > 1024 * 1024
        ? `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(uploadFile.size / 1024)} KB`
      : "1.2 MB";

    const payload = {
      subjectId: Number(uploadSubjectId),
      title: uploadTitle.trim(),
      category: uploadCategory,
      description: uploadDescription.trim() || undefined,
      fileUrl: uploadFilePreview || "",
      fileName: uploadFile?.name || "document.pdf",
      fileSize: sizeFormatted,
      mimeType: uploadFile?.type || "application/pdf",
      tags: [uploadCategory, subjects.find((s) => s.id === Number(uploadSubjectId))?.name || "Study"],
    };

    try {
      const res = await fetch(`${API}/vault`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        setItems((prev) => [created, ...prev]);
        closeUploadModal();
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadError(errData.error || "Failed to upload document. Admin authorization required.");
      }
    } catch {
      setUploadError("Network error while uploading.");
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setUploadTitle("");
    setUploadCategory("pdf");
    setUploadDescription("");
    setUploadFile(null);
    setUploadFilePreview(null);
    setUploadError("");
  };

  // Delete item
  const handleDeleteItem = async (id: number | string) => {
    if (!confirm("Are you sure you want to delete this study note from the Vault?")) return;

    try {
      const res = await fetch(`${API}/vault/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (previewDoc?.id === id) setPreviewDoc(null);
      } else {
        alert("Failed to delete item.");
      }
    } catch {
      alert("Network error.");
    }
  };

  // Filtered documents
  const filteredItems = useMemo(() => {
    return items.filter((doc) => {
      // Must match semester
      const docSubj = subjects.find((s) => s.id === doc.subjectId);
      if (docSubj && docSubj.sem !== selectedSem) return false;

      // Subject filter: if "all", show all in this semester
      if (selectedSubjectId !== "all" && doc.subjectId !== selectedSubjectId) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "all" && doc.category !== selectedCategory) {
        return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchDesc = (doc.description || "").toLowerCase().includes(q);
        const matchFile = doc.fileName.toLowerCase().includes(q);
        const matchSubj = (docSubj?.name || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchFile && !matchSubj) return false;
      }
      return true;
    });
  }, [items, subjects, selectedSem, selectedSubjectId, selectedCategory, searchQuery]);

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>🏛️</span>
              <span>Vault Materials Management</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Independent study repository. Upload and manage official course PDFs, handwritten notes, lecture slides, and summaries.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const defaultSubj =
                selectedSubjectId !== "all"
                  ? selectedSubjectId
                  : currentSemesterSubjects[0]?.id || "";
              setUploadSubjectId(defaultSubj);
              setUploadModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>+</span>
            <span>Upload New Material</span>
          </button>
        </div>

        {/* ─── VAULT ACCESSIBILITY CONTROL (Admin-Only Independent Control) ─── */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                isVaultPublic ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              }`}
            >
              {isVaultPublic ? "🌐" : "🔒"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Vault Accessibility Control</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isVaultPublic
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {isVaultPublic ? "Live for Students" : "Admin Only (Restricted)"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isVaultPublic
                  ? "Students have full access to view, search, and download approved Vault notes."
                  : "Student access to the Vault is locked. Only administrators can view and manage materials."}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={savingAccessibility}
            onClick={toggleVaultAccessibility}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow flex items-center gap-2 whitespace-nowrap self-start sm:self-auto ${
              isVaultPublic
                ? "bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30"
                : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
            }`}
          >
            <span>{isVaultPublic ? "🔒 Lock Student Access" : "🔓 Unlock for Students"}</span>
            {savingAccessibility && <span className="animate-spin text-xs">⏳</span>}
          </button>
        </div>

        {/* ─── STEP 1: SEMESTER SELECTION + ADD SEMESTER BUTTON ─── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              1. Select Semester:
            </label>
            <button
              type="button"
              onClick={() => setAddSemModalOpen(true)}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <span>+</span>
              <span>Add Semester</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {availableSemesters.map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => handleSemChange(sem)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedSem === sem
                    ? "bg-indigo-600 text-white shadow-md scale-[1.02]"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                Semester {sem}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setAddSemModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 whitespace-nowrap"
            >
              <span>+</span>
              <span>Add Semester</span>
            </button>
          </div>
        </div>

        {/* ─── STEP 2: SUBJECT SELECTION (WITH "ALL SUBJECTS" & "ADD SUBJECT") ─── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              2. Subjects for Semester {selectedSem}:
            </label>
            <button
              type="button"
              onClick={() => setAddSubjectModalOpen(true)}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <span>+</span>
              <span>Add Subject to Sem {selectedSem}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* "All Subjects" Button */}
            <button
              type="button"
              onClick={() => setSelectedSubjectId("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedSubjectId === "all"
                  ? "bg-indigo-600 text-white shadow-md border-2 border-indigo-400 scale-[1.02]"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <span>✨</span>
              <span>All Subjects ({currentSemesterSubjects.length})</span>
            </button>

            {/* Individual Subject Pills */}
            {currentSemesterSubjects.map((subj) => (
              <button
                key={subj.id}
                type="button"
                onClick={() => setSelectedSubjectId(subj.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedSubjectId === subj.id
                    ? "bg-blue-600 text-white shadow-md border-2 border-blue-400 scale-[1.02]"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                <span>{subj.icon || "📚"}</span>
                <span>{subj.name}</span>
              </button>
            ))}

            {/* Quick Add Subject button */}
            <button
              type="button"
              onClick={() => setAddSubjectModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-dashed border-slate-600 whitespace-nowrap"
            >
              <span>+</span>
              <span>New Subject</span>
            </button>
          </div>
        </div>

        {/* ─── CONTROLS: SEARCH & CATEGORY FILTER ─── */}
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/80 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title..."
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  selectedCategory === cat.id
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-700"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── CURRENT VIEW BANNER ─── */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-4 px-1">
          <div>
            Showing materials for:{" "}
            <strong className="text-white">
              Semester {selectedSem} •{" "}
              {selectedSubjectId === "all" ? "All Subjects" : activeSubject?.name || "Selected Subject"}
            </strong>
          </div>
          <div>{filteredItems.length} {filteredItems.length === 1 ? "document" : "documents"} found</div>
        </div>

        {/* ─── DOCUMENT TILES GRID ─── */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">Loading materials...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-800/40 border border-slate-700 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-3xl mb-3">
              📁
            </div>
            <h4 className="text-sm font-bold text-white mb-1">No Materials Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              {searchQuery || selectedCategory !== "all"
                ? "No documents match your search or category filters."
                : `No notes have been uploaded for Semester ${selectedSem} ${
                    selectedSubjectId === "all" ? "" : `• ${activeSubject?.name || ""}`
                  } yet.`}
            </p>
            <button
              type="button"
              onClick={() => {
                const defaultSubj =
                  selectedSubjectId !== "all"
                    ? selectedSubjectId
                    : currentSemesterSubjects[0]?.id || "";
                setUploadSubjectId(defaultSubj);
                setUploadModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow"
            >
              + Upload First Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const subj = subjects.find((s) => s.id === item.subjectId);
              const isPdf = item.category === "pdf";
              const isHandwritten = item.category === "handwritten";

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700 hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Subject & Category */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20 truncate max-w-[150px]">
                        {subj ? `${subj.icon || "📚"} ${subj.name}` : "Subject"}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          isPdf
                            ? "bg-red-500/20 text-red-300"
                            : isHandwritten
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {item.category}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="text-xl shrink-0 mt-0.5">
                        {isPdf ? "📄" : isHandwritten ? "✍️" : "📝"}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                          {item.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.fileName}</p>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 leading-relaxed bg-slate-900/50 p-2 rounded-lg">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{item.fileSize || "File"}</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(item)}
                        className="px-2 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 font-semibold"
                        title="Preview"
                      >
                        Preview
                      </button>

                      <a
                        href={item.fileUrl}
                        download={item.fileName}
                        className="px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 font-semibold"
                        title="Download"
                      >
                        Download
                      </a>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── UPLOAD MODAL ─── */}
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📤</span>
                  <h3 className="text-base font-bold text-white">Upload to Vault (Admin)</h3>
                </div>
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3.5 mt-4">
                {uploadError && (
                  <div className="p-2.5 rounded-xl text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                    {uploadError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Document Title</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g., Chapter 4 Cryptography Lecture Slides"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Target Subject</label>
                    <select
                      value={uploadSubjectId}
                      onChange={(e) => setUploadSubjectId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500"
                    >
                      <option value="">Select subject…</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Sem {s.sem})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500"
                    >
                      <option value="pdf">📑 PDF / Slides</option>
                      <option value="handwritten">✍️ Handwritten Notes</option>
                      <option value="notes">📝 Lecture Notes</option>
                      <option value="summary">⚡ Exam Summary</option>
                      <option value="other">📂 Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Description / Key Notes</label>
                  <textarea
                    rows={2}
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Optional tips, covered topics, exam pointers..."
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Select File (PDF or Image)</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-800/40"
                  >
                    {uploadFile ? (
                      <div>
                        <span className="text-xl block mb-0.5">📄</span>
                        <p className="text-xs font-bold text-white">{uploadFile.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {(uploadFile.size / 1024).toFixed(1)} KB • Click to choose a different file
                        </p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xl block mb-0.5">☁️</span>
                        <p className="text-xs font-bold text-white">Click to browse or drop file</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Supports PDF documents and camera images</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={closeUploadModal}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow"
                  >
                    {uploading ? "Publishing to Vault…" : "Publish Material"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── ADD SEMESTER MODAL ─── */}
        {addSemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <h3 className="text-base font-bold text-white">Add New Semester</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAddSemModalOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddSemesterSubmit} className="flex flex-col gap-3.5 mt-4">
                {semError && (
                  <div className="p-2.5 rounded-xl text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                    {semError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Semester Number</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newSemNum}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : "";
                      setNewSemNum(val);
                      if (val && !newSemLabel) setNewSemLabel(`Semester ${val}`);
                    }}
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Display Label</label>
                  <input
                    type="text"
                    value={newSemLabel}
                    onChange={(e) => setNewSemLabel(e.target.value)}
                    placeholder="e.g. Semester 3"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAddSemModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSem}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow"
                  >
                    {savingSem ? "Creating…" : "Create Semester"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── ADD SUBJECT MODAL (INDEPENDENT VAULT SUBJECTS) ─── */}
        {addSubjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📚</span>
                  <h3 className="text-base font-bold text-white">Add Subject to Sem {selectedSem}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAddSubjectModalOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddSubjectSubmit} className="flex flex-col gap-3.5 mt-4">
                {subjectError && (
                  <div className="p-2.5 rounded-xl text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                    {subjectError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Subject Name</label>
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="e.g. Operating Systems"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Icon / Emoji</label>
                    <input
                      type="text"
                      value={newSubjectIcon}
                      onChange={(e) => setNewSubjectIcon(e.target.value)}
                      placeholder="📚"
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500 text-center text-base"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newSubjectColor}
                        onChange={(e) => setNewSubjectColor(e.target.value)}
                        className="w-9 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <span className="text-xs text-slate-400 font-mono">{newSubjectColor}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAddSubjectModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSubject}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow"
                  >
                    {savingSubject ? "Adding…" : "Add Subject"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── PREVIEW MODAL ─── */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl flex flex-col">
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div className="min-w-0 pr-4">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {previewDoc.category}
                  </span>
                  <h3 className="text-base font-bold text-white mt-1 truncate">{previewDoc.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.fileUrl}
                    download={previewDoc.fileName}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 my-4 overflow-y-auto max-h-[60vh] rounded-xl bg-slate-950 p-4 flex flex-col items-center justify-center">
                {previewDoc.fileUrl.startsWith("data:image/") || previewDoc.mimeType?.startsWith("image/") ? (
                  <img
                    src={previewDoc.fileUrl}
                    alt={previewDoc.title}
                    className="max-h-[50vh] w-auto object-contain rounded-lg shadow"
                  />
                ) : previewDoc.fileUrl.startsWith("data:application/pdf") || previewDoc.fileName.endsWith(".pdf") ? (
                  <iframe
                    src={previewDoc.fileUrl}
                    title={previewDoc.title}
                    className="w-full h-[50vh] rounded-lg border border-slate-800"
                  />
                ) : (
                  <div className="text-center p-8">
                    <span className="text-5xl block mb-2">📄</span>
                    <p className="text-xs font-bold text-white">{previewDoc.fileName}</p>
                    <a
                      href={previewDoc.fileUrl}
                      download={previewDoc.fileName}
                      className="mt-3 inline-block px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600"
                    >
                      Download & Open
                    </a>
                  </div>
                )}
              </div>

              {previewDoc.description && (
                <div className="p-3 rounded-xl bg-slate-800/80 text-xs text-slate-300 border border-slate-700/60">
                  <strong className="text-white block mb-0.5">Notes:</strong>
                  {previewDoc.description}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
