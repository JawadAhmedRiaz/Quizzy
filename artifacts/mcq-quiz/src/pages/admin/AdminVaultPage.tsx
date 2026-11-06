import { useState, useEffect, useMemo, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Maximize2, Minimize2, ExternalLink } from "lucide-react";

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
  fileUrl?: string;
  fileName: string;
  fileSize?: string;
  mimeType?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  isLegacy?: boolean;
}

const ALLOWED_VAULT_EXTS = new Set(["pdf", "ppt", "pptx", "doc", "docx", "png", "jpg", "jpeg"]);
const MAX_VAULT_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export interface UploadQueueItem {
  id: string;
  file: File;
  title: string;
  category: VaultDoc["category"];
  status: "waiting" | "uploading" | "done" | "failed";
  errorMessage?: string;
  isDuplicateWarn?: boolean;
}

export interface RejectedFile {
  name: string;
  size: number;
  reason: string;
}

export function guessVaultCategory(ext: string, mime?: string): VaultDoc["category"] {
  if (ext === "pdf" || ext === "ppt" || ext === "pptx") return "pdf";
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) return "handwritten";
  if (ext === "doc" || ext === "docx") return "notes";
  return "pdf";
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

  // Upload Form states (Batch & Multi-File Support)
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadSubjectId, setUploadSubjectId] = useState<number | "">("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<RejectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const uploadDragCounter = useRef(0);
  const [previewDoc, setPreviewDoc] = useState<VaultDoc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState<{ url: string; title: string; googleUrl?: string } | null>(null);

  // Fetch signed URL whenever a document is selected for preview
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

    // Normal signed URL without ?download=1
    fetch(`${API}/vault/${previewDoc.id}/file-url`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
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
        newTab.document.write("<p style='font-family:system-ui,-apple-system,sans-serif;text-align:center;padding-top:40px;color:#94a3b8;font-size:14px;'>Loading document viewer...</p>");
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
        alert("Unable to generate download link.");
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit Document Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultDoc | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState<number | "">("");
  const [editCategory, setEditCategory] = useState<VaultDoc["category"]>("pdf");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [replaceFile, setReplaceFile] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editNotice, setEditNotice] = useState("");
  const [isEditDragging, setIsEditDragging] = useState(false);
  const editDragCounter = useRef(0);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingItem(null);
    setEditTitle("");
    setEditSubjectId("");
    setEditDescription("");
    setEditFile(null);
    setReplaceFile(false);
    setEditError("");
    setEditNotice("");
    setIsEditDragging(false);
    editDragCounter.current = 0;
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  };

  // Prevent browser default file open behavior when upload or edit modal is open
  useEffect(() => {
    if (!uploadModalOpen && !editModalOpen) return;

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [uploadModalOpen, editModalOpen]);

  // Shared file validation logic for Vault uploads and edits
  const processSelectedFile = (file: File): { valid: boolean; reason?: string } => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_VAULT_EXTS.has(ext)) {
      return {
        valid: false,
        reason: `Invalid format ".${ext}". Allowed: PDF, PPT, PPTX, DOC, DOCX, PNG, JPG, JPEG`,
      };
    }
    if (file.size > MAX_VAULT_FILE_SIZE) {
      return {
        valid: false,
        reason: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Limit is 50 MB`,
      };
    }
    return { valid: true };
  };

  const handleOpenEdit = (doc: VaultDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(doc);
    setEditTitle(doc.title);
    setEditSubjectId(doc.subjectId);
    setEditCategory(doc.category);
    setEditDescription(doc.description || "");
    setEditFile(null);
    setReplaceFile(false);
    setEditError("");
    setEditNotice("");
    setIsEditDragging(false);
    editDragCounter.current = 0;
    setEditModalOpen(true);
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditError("");
    setEditNotice("");
    const file = e.target.files?.[0];
    if (!file) {
      setEditFile(null);
      return;
    }
    const check = processSelectedFile(file);
    if (!check.valid) {
      setEditError(check.reason || "Invalid file");
      setEditFile(null);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
      return;
    }
    setEditFile(file);
    e.target.value = "";
  };

  const handleEditDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (savingEdit) return;
    editDragCounter.current += 1;
    setIsEditDragging(true);
  };

  const handleEditDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (savingEdit) return;
    e.dataTransfer.dropEffect = "copy";
    setIsEditDragging(true);
  };

  const handleEditDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editDragCounter.current = Math.max(0, editDragCounter.current - 1);
    if (editDragCounter.current === 0 || (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node))) {
      editDragCounter.current = 0;
      setIsEditDragging(false);
    }
  };

  const handleEditDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editDragCounter.current = 0;
    setIsEditDragging(false);
    if (savingEdit) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setEditError("");
    setEditNotice("");
    const file = files[0];
    if (files.length > 1) {
      setEditNotice(`Only one file at a time, using "${file.name}"`);
    }

    const check = processSelectedFile(file);
    if (!check.valid) {
      setEditError(check.reason || "Invalid file");
      setEditFile(null);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
      return;
    }

    setReplaceFile(true);
    setEditFile(file);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditError("");

    if (!editTitle.trim()) {
      setEditError("Please provide a title for the document.");
      return;
    }
    if (!editSubjectId) {
      setEditError("Please select a subject.");
      return;
    }
    if (replaceFile && !editFile) {
      setEditError("Please select a replacement file or uncheck 'Replace file'.");
      return;
    }

    setSavingEdit(true);

    const formData = new FormData();
    formData.append("title", editTitle.trim());
    formData.append("subjectId", String(editSubjectId));
    formData.append("category", editCategory);
    if (editDescription.trim()) {
      formData.append("description", editDescription.trim());
    }
    if (replaceFile && editFile) {
      formData.append("file", editFile);
    }

    try {
      const res = await fetch(`${API}/vault/${editingItem.id}`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        const updated: VaultDoc = await res.json();
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        if (previewDoc?.id === updated.id) {
          setPreviewDoc(updated);
        }
        closeEditModal();
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 413) {
          setEditError(errData.error || "File size exceeds the 50 MB server limit.");
        } else {
          setEditError(errData.error || `Update failed (Status ${res.status}).`);
        }
      }
    } catch {
      setEditError("Network error while updating document.");
    } finally {
      setSavingEdit(false);
    }
  };

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

  const handleUploadFiles = (files: FileList | File[]) => {
    if (uploading) return;
    setUploadError("");
    setUploadNotice("");

    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const maxQueue = 20;
    const currentCount = uploadQueue.length;
    const availableSlots = Math.max(0, maxQueue - currentCount);

    if (availableSlots === 0) {
      setUploadNotice("Queue limit reached (20 files maximum per batch). Please upload or remove existing files.");
      return;
    }

    const toProcess = fileList.slice(0, availableSlots);
    if (fileList.length > availableSlots) {
      setUploadNotice(`Queue capped at 20 files. ${fileList.length - availableSlots} file(s) omitted.`);
    }

    const newRejected: RejectedFile[] = [];
    const newItems: UploadQueueItem[] = [];

    for (const file of toProcess) {
      const check = processSelectedFile(file);
      if (!check.valid) {
        newRejected.push({
          name: file.name,
          size: file.size,
          reason: check.reason || "Validation failed",
        });
        continue;
      }

      // Check duplicate against vault items and other queued files
      const normName = file.name.trim().toLowerCase();
      const inVault = items.some((item) => {
        if (item.fileName.trim().toLowerCase() !== normName) return false;
        if (item.fileSize) {
          const sizeStr =
            file.size > 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : `${(file.size / 1024).toFixed(1)} KB`;
          return item.fileSize === sizeStr;
        }
        return true;
      });
      const inQueue = [...uploadQueue, ...newItems].some(
        (q) => q.file.name.trim().toLowerCase() === normName && q.file.size === file.size
      );

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
      const defaultCat = guessVaultCategory(ext, file.type);

      newItems.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        title: defaultTitle,
        category: defaultCat,
        status: "waiting",
        isDuplicateWarn: inVault || inQueue,
      });
    }

    if (newRejected.length > 0) {
      setRejectedFiles((prev) => [...newRejected, ...prev]);
    }
    if (newItems.length > 0) {
      setUploadQueue((prev) => [...prev, ...newItems]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUploadFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleUploadDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    uploadDragCounter.current += 1;
    setIsUploadDragging(true);
  };

  const handleUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    e.dataTransfer.dropEffect = "copy";
    setIsUploadDragging(true);
  };

  const handleUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDragCounter.current = Math.max(0, uploadDragCounter.current - 1);
    if (uploadDragCounter.current === 0 || (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node))) {
      uploadDragCounter.current = 0;
      setIsUploadDragging(false);
    }
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDragCounter.current = 0;
    setIsUploadDragging(false);
    if (uploading) return;

    if (e.dataTransfer.files) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const updateQueueItem = (id: string, updates: Partial<UploadQueueItem>) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeQueueItem = (id: string) => {
    if (uploading) return;
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Handle batch upload sequentially (one file at a time, Render-safe)
  const handleStartBatchUpload = async (onlyFailed = false) => {
    if (!uploadSubjectId) {
      setUploadError("Please select a target subject before uploading.");
      return;
    }

    const itemsToUpload = uploadQueue.filter((item) =>
      onlyFailed ? item.status === "failed" : item.status !== "done"
    );

    if (itemsToUpload.length === 0) {
      setUploadError("No pending files in the queue to upload.");
      return;
    }

    setUploadError("");
    setUploading(true);

    for (let i = 0; i < itemsToUpload.length; i++) {
      const item = itemsToUpload[i];

      // Mark this item as uploading
      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", errorMessage: undefined } : q))
      );

      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("title", item.title.trim() || item.file.name.replace(/\.[^/.]+$/, ""));
      formData.append("subjectId", String(uploadSubjectId));
      formData.append("category", item.category);
      if (uploadDescription.trim()) {
        formData.append("description", uploadDescription.trim());
      }

      try {
        const res = await fetch(`${API}/vault`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (res.ok) {
          const created: VaultDoc = await res.json();
          // Add successfully uploaded item immediately to items list state without page reload
          setItems((prev) => [created, ...prev]);
          setUploadQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: "done" } : q))
          );
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg =
            res.status === 413
              ? (errData.error || "File size exceeds 50 MB server limit.")
              : (errData.error || `Upload failed (${res.status}).`);
          setUploadQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: "failed", errorMessage: errMsg } : q))
          );
        }
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "failed", errorMessage: "Network error during upload." } : q))
        );
      }
    }

    setUploading(false);
  };

  const closeUploadModal = () => {
    if (uploading) {
      if (!confirm("An upload is currently in progress. Are you sure you want to stop and close?")) {
        return;
      }
    }
    setUploadModalOpen(false);
    setUploadQueue([]);
    setRejectedFiles([]);
    setUploadSubjectId("");
    setUploadDescription("");
    setUploadError("");
    setUploadNotice("");
    setIsUploadDragging(false);
    uploadDragCounter.current = 0;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const totalQueueBytes = useMemo(() => {
    return uploadQueue.reduce((acc, item) => acc + item.file.size, 0);
  }, [uploadQueue]);

  const totalQueueSizeFormatted = useMemo(() => {
    if (totalQueueBytes > 1024 * 1024) {
      return `${(totalQueueBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(totalQueueBytes / 1024)} KB`;
  }, [totalQueueBytes]);

  const doneCount = useMemo(() => {
    return uploadQueue.filter((q) => q.status === "done").length;
  }, [uploadQueue]);

  const failedCount = useMemo(() => {
    return uploadQueue.filter((q) => q.status === "failed").length;
  }, [uploadQueue]);

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
                        onClick={() => handleCardClick(item)}
                        className="px-2 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 font-semibold"
                        title="Preview"
                      >
                        Preview
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(item, e)}
                        className="px-2 py-1 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 font-semibold"
                        title="Edit Document"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDirectDownload(item, e)}
                        disabled={downloadingId === item.id}
                        className="px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 font-semibold disabled:opacity-50"
                        title="Download"
                      >
                        {downloadingId === item.id ? "..." : "Download"}
                      </button>

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

        {/* ─── UPLOAD MODAL (BATCH MULTI-FILE SUPPORT) ─── */}
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl relative overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📤</span>
                  <div>
                    <h3 className="text-base font-bold text-white">Upload to Vault (Batch Admin)</h3>
                    <p className="text-[11px] text-slate-400">Queue up to 20 files for sequential upload to Supabase Storage</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeUploadModal}
                  disabled={uploading}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {/* Global Error Notice */}
                {uploadError && (
                  <div className="p-3 rounded-xl text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-start gap-2">
                    <span>⚠️</span>
                    <span className="flex-1">{uploadError}</span>
                  </div>
                )}

                {/* Queue Notice / Advisory */}
                {uploadNotice && (
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2">
                    <span>ℹ️</span>
                    <span className="flex-1">{uploadNotice}</span>
                  </div>
                )}

                {/* Batch Status Summary: Failed Retry */}
                {failedCount > 0 && !uploading && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span>❌</span>
                      <span><strong>{failedCount}</strong> of {uploadQueue.length} file(s) failed to upload.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartBatchUpload(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow transition-all"
                    >
                      Retry Failed ({failedCount})
                    </button>
                  </div>
                )}

                {/* Batch Status Summary: All Done */}
                {doneCount > 0 && doneCount === uploadQueue.length && !uploading && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>✅</span>
                      <span>All <strong>{doneCount}</strong> files successfully uploaded and published to the Vault!</span>
                    </div>
                    <button
                      type="button"
                      onClick={closeUploadModal}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                    >
                      Done
                    </button>
                  </div>
                )}

                {/* Batch Common Metadata Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Target Subject <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={uploadSubjectId}
                      onChange={(e) => setUploadSubjectId(e.target.value ? Number(e.target.value) : "")}
                      disabled={uploading}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500 disabled:opacity-50"
                    >
                      <option value="">Select subject for batch…</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Sem {s.sem})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Description / Key Notes <span className="text-slate-500 text-[10px] font-normal">(applies to batch)</span>
                    </label>
                    <input
                      type="text"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      disabled={uploading}
                      placeholder="Optional notes, covered topics, exam pointers..."
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Dropzone & File Input */}
                <div>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx"
                    disabled={uploading || uploadQueue.length >= 20}
                    className="hidden"
                  />

                  {uploadQueue.length === 0 ? (
                    <div
                      onDragEnter={handleUploadDragEnter}
                      onDragOver={handleUploadDragOver}
                      onDragLeave={handleUploadDragLeave}
                      onDrop={handleUploadDrop}
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className={`p-7 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        isUploadDragging
                          ? "border-indigo-400 bg-indigo-500/20 scale-[1.01]"
                          : "border-slate-700 hover:border-indigo-500 bg-slate-800/40"
                      }`}
                    >
                      <span className="text-3xl block mb-1.5">{isUploadDragging ? "📥" : "☁️"}</span>
                      <p className="text-xs font-bold text-white">
                        {isUploadDragging ? "Drop files here to queue" : "Click to browse or drop files here"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-sm">
                        Select multiple files (up to 20 per batch). Supports PDF documents, slides (.ppt, .pptx), Word notes, and images (up to 50 MB each).
                      </p>
                    </div>
                  ) : (
                    uploadQueue.length < 20 && (
                      <div
                        onDragEnter={handleUploadDragEnter}
                        onDragOver={handleUploadDragOver}
                        onDragLeave={handleUploadDragLeave}
                        onDrop={handleUploadDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`p-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all text-xs font-semibold ${
                          isUploadDragging
                            ? "border-indigo-400 bg-indigo-500/20 text-indigo-300"
                            : "border-slate-700 hover:border-indigo-500 bg-slate-800/30 text-slate-300 hover:text-white"
                        }`}
                      >
                        <span>{isUploadDragging ? "📥" : "➕"}</span>
                        <span>
                          {isUploadDragging
                            ? "Drop more files here"
                            : `Click or drop more files to add (${uploadQueue.length}/20 queued)`}
                        </span>
                      </div>
                    )
                  )}
                </div>

                {/* Rejected Files Card (if any file failed validation) */}
                {rejectedFiles.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                    <div className="flex items-center justify-between mb-1.5 font-bold">
                      <span className="flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>{rejectedFiles.length} file(s) skipped (validation failed):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRejectedFiles([])}
                        className="text-[10px] text-amber-400 hover:text-amber-200 underline font-normal"
                      >
                        Dismiss
                      </button>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {rejectedFiles.map((rf, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-900/60 px-2 py-1 rounded">
                          <span className="truncate max-w-[240px] font-mono text-slate-300">{rf.name}</span>
                          <span className="text-amber-400 text-[10px]">{rf.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Queued Files List */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-0.5">
                      <span>Files in Queue ({uploadQueue.length})</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Total: <strong className="text-indigo-400 font-semibold">{totalQueueSizeFormatted}</strong>
                        {doneCount > 0 && ` • ${doneCount} uploaded`}
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {uploadQueue.map((item) => {
                        const sizeStr =
                          item.file.size > 1024 * 1024
                            ? `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`
                            : `${Math.round(item.file.size / 1024)} KB`;

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border transition-all ${
                              item.status === "uploading"
                                ? "border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/50"
                                : item.status === "done"
                                ? "border-emerald-500/50 bg-emerald-950/20"
                                : item.status === "failed"
                                ? "border-rose-500/50 bg-rose-950/20"
                                : "border-slate-800 bg-slate-800/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">
                                  {item.status === "done"
                                    ? "✅"
                                    : item.status === "failed"
                                    ? "❌"
                                    : item.status === "uploading"
                                    ? "⏳"
                                    : "📄"}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white truncate max-w-[280px]" title={item.file.name}>
                                    {item.file.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400">{sizeStr}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {/* Status Badge */}
                                {item.status === "waiting" && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                                    Waiting
                                  </span>
                                )}
                                {item.status === "uploading" && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                                    Uploading…
                                  </span>
                                )}
                                {item.status === "done" && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                                    Uploaded ✓
                                  </span>
                                )}
                                {item.status === "failed" && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                                    Failed
                                  </span>
                                )}

                                {/* Remove Button */}
                                <button
                                  type="button"
                                  onClick={() => removeQueueItem(item.id)}
                                  disabled={uploading && item.status === "uploading"}
                                  className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-slate-700 disabled:opacity-30 transition-colors text-xs"
                                  title="Remove from queue"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            {/* Duplicate warning */}
                            {item.isDuplicateWarn && (
                              <div className="mb-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md flex items-center gap-1">
                                <span>⚠️</span>
                                <span>Duplicate notice: A file with this name & size already exists in the Vault or queue.</span>
                              </div>
                            )}

                            {/* Error message */}
                            {item.status === "failed" && item.errorMessage && (
                              <div className="mb-2 text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-md">
                                Error: {item.errorMessage}
                              </div>
                            )}

                            {/* Editable inputs row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                              <div className="sm:col-span-2">
                                <input
                                  type="text"
                                  value={item.title}
                                  onChange={(e) => updateQueueItem(item.id, { title: e.target.value })}
                                  disabled={uploading || item.status === "done"}
                                  placeholder="Document title"
                                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <select
                                  value={item.category}
                                  onChange={(e) => updateQueueItem(item.id, { category: e.target.value as any })}
                                  disabled={uploading || item.status === "done"}
                                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 disabled:opacity-50"
                                >
                                  <option value="pdf">📑 PDF / Slides</option>
                                  <option value="handwritten">✍️ Handwritten Notes</option>
                                  <option value="notes">📝 Lecture Notes</option>
                                  <option value="summary">⚡ Exam Summary</option>
                                  <option value="other">📂 Other</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 shrink-0">
                <div className="text-xs text-slate-400">
                  {uploadQueue.length > 0 ? (
                    <span>
                      <strong className="text-white">{uploadQueue.length}</strong> {uploadQueue.length === 1 ? "file" : "files"}
                      {" "}(<strong className="text-white">{totalQueueSizeFormatted}</strong>)
                      {doneCount > 0 && (
                        <span className="text-emerald-400 font-semibold ml-1.5">• {doneCount} of {uploadQueue.length} uploaded</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-500">Queue is empty (max 20 files)</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeUploadModal}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    {doneCount === uploadQueue.length && uploadQueue.length > 0 ? "Close" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartBatchUpload(false)}
                    disabled={uploading || uploadQueue.length === 0 || !uploadSubjectId || doneCount === uploadQueue.length}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow transition-all flex items-center gap-1.5"
                  >
                    {uploading ? (
                      <>
                        <span className="text-xs">⏳</span>
                        <span>Uploading ({doneCount + 1}/{uploadQueue.length})…</span>
                      </>
                    ) : doneCount === uploadQueue.length && uploadQueue.length > 0 ? (
                      <span>All Uploaded ✓</span>
                    ) : (
                      <span>
                        Upload {uploadQueue.length > 0 ? (uploadQueue.length === 1 ? "1 File" : `All (${uploadQueue.length - doneCount} Files)`) : "Files"}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── EDIT MODAL ─── */}
        {editModalOpen && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✏️</span>
                  <h3 className="text-base font-bold text-white">Edit Study Document</h3>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="flex flex-col gap-3.5 mt-4">
                {editError && (
                  <div className="p-2.5 rounded-xl text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                    {editError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Document Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={200}
                    required
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Subject</label>
                    <select
                      value={editSubjectId}
                      onChange={(e) => setEditSubjectId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500"
                    >
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
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as any)}
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
                  <label className="text-xs font-bold text-slate-300 block mb-1">Description / Notes</label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-slate-800 border border-slate-700 text-white focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* File Replacement Section */}
                <div
                  onDragEnter={handleEditDragEnter}
                  onDragOver={handleEditDragOver}
                  onDragLeave={handleEditDragLeave}
                  onDrop={handleEditDrop}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isEditDragging
                      ? "border-indigo-400 bg-indigo-500/20"
                      : "bg-slate-800/80 border-slate-700/80"
                  } flex flex-col gap-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Current File</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[280px]">
                        {editingItem.fileName} ({editingItem.fileSize || "Stored"})
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-400">
                      <input
                        type="checkbox"
                        checked={replaceFile}
                        onChange={(e) => {
                          setReplaceFile(e.target.checked);
                          if (!e.target.checked) {
                            setEditFile(null);
                            setEditNotice("");
                            if (editFileInputRef.current) editFileInputRef.current.value = "";
                          }
                        }}
                        className="rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-0"
                      />
                      <span>Replace file</span>
                    </label>
                  </div>

                  {replaceFile && (
                    <div className="pt-2 border-t border-slate-700/60 flex flex-col gap-2">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        onChange={handleEditFileChange}
                        accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg"
                        className="hidden"
                      />
                      <div
                        onClick={() => editFileInputRef.current?.click()}
                        className={`w-full py-3 px-3 rounded-xl border-2 border-dashed cursor-pointer text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                          isEditDragging
                            ? "border-indigo-400 bg-indigo-500/25 text-white scale-[1.01]"
                            : "border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{isEditDragging ? "📥" : "📁"}</span>
                          <span>
                            {editFile
                              ? editFile.name
                              : isEditDragging
                              ? "Drop replacement file here"
                              : "Click to browse or drop replacement file"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {editFile
                            ? `${(editFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drop to choose different file`
                            : "Supports PDF, PPT, PPTX, DOC, DOCX, PNG, JPG (up to 50 MB)"}
                        </p>
                      </div>
                      {editNotice && (
                        <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
                          <span>ℹ️</span>
                          <span>{editNotice}</span>
                        </div>
                      )}
                      {editFile && (
                        <p className="text-[10px] text-emerald-400 text-center font-bold">
                          ✓ Ready to upload: {editFile.name} ({(editFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={savingEdit}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingEdit ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving Changes…</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
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
          <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? "p-0" : "p-4"} bg-black/80 backdrop-blur-sm`}>
            <div className={
              isFullscreen
                ? "w-screen h-screen max-w-none max-h-none rounded-none bg-slate-900 border-none p-4 md:p-6 shadow-2xl flex flex-col"
                : "w-full max-w-3xl max-h-[90vh] rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl flex flex-col"
            }>
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {previewDoc.category}
                    </span>
                    {isFullscreen && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Fullscreen Mode
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1 truncate">{previewDoc.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border shadow flex items-center gap-1.5 transition-all cursor-pointer ${
                      isFullscreen
                        ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                    title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand to Fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                  </button>

                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow flex items-center gap-1.5 transition-all"
                      title="Open in new window"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">New Tab</span>
                    </a>
                  )}

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => handleDirectDownload(previewDoc)}
                      disabled={downloadingId === previewDoc.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow disabled:opacity-50"
                    >
                      {downloadingId === previewDoc.id ? "Preparing..." : "Download"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewDoc(null);
                      setIsFullscreen(false);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold cursor-pointer"
                    title="Close (Esc)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className={`flex-1 my-3 overflow-hidden rounded-xl bg-slate-950 flex flex-col items-center justify-center ${
                isFullscreen ? "h-[calc(100vh-140px)] max-h-none p-2" : "max-h-[60vh] p-4 overflow-y-auto"
              }`}>
                {previewLoading ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs font-bold text-slate-400">Preparing secure document link...</p>
                  </div>
                ) : previewError ? (
                  <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl mb-2">⚠️</span>
                    <p className="text-sm font-bold text-white mb-1">Unable to Load Preview</p>
                    <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{previewError}</p>
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ ...previewDoc })}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow"
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
                          className={`${isFullscreen ? "max-h-full" : "max-h-[50vh]"} w-auto object-contain rounded-lg shadow`}
                        />
                      );
                    }
                    if (docKind === "pdf") {
                      return (
                        <iframe
                          src={previewUrl}
                          title={previewDoc.title}
                          className={`w-full rounded-lg border border-slate-800 ${isFullscreen ? "h-full" : "h-[50vh]"}`}
                        />
                      );
                    }
                    if (docKind === "office") {
                      return (
                        <div className="w-full h-full flex flex-col gap-2">
                          <div className="flex items-center justify-between px-3 py-2 bg-slate-900 rounded-xl text-xs border border-slate-800">
                            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                              <span>📊</span>
                              <span>Office Online Viewer</span>
                            </span>
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <a
                                href={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 hover:underline font-bold flex items-center gap-1"
                              >
                                Try Google viewer <ExternalLink className="w-3 h-3" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleOpenOfficeNewTab(previewDoc)}
                                className="px-3 py-1 rounded-lg font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow flex items-center gap-1.5 transition-colors"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open in new tab</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDirectDownload(previewDoc)}
                                disabled={downloadingId === previewDoc.id}
                                className="px-3 py-1 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow flex items-center gap-1 disabled:opacity-50"
                              >
                                <span>⬇️</span>
                                <span>Download</span>
                              </button>
                            </div>
                          </div>
                          <iframe
                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                            title={previewDoc.title}
                            className={`w-full rounded-lg border border-slate-800 ${isFullscreen ? "h-[calc(100vh-210px)]" : "h-[50vh]"}`}
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="text-center p-8 flex flex-col items-center justify-center">
                        <span className="text-5xl block mb-2">📄</span>
                        <p className="text-xs font-bold text-white mb-1">{previewDoc.fileName}</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mb-3">
                          Stored in Study Vault ({previewDoc.fileSize || "File ready"})
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDirectDownload(previewDoc)}
                          disabled={downloadingId === previewDoc.id}
                          className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow disabled:opacity-50"
                        >
                          Download & Open
                        </button>
                      </div>
                    );
                  })()
                ) : null}
              </div>

              {previewDoc.description && !isFullscreen && (
                <div className="p-3 rounded-xl bg-slate-800/80 text-xs text-slate-300 border border-slate-700/60">
                  <strong className="text-white block mb-0.5">Notes:</strong>
                  {previewDoc.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fallback open link for mobile users when popup was blocked */}
        {fallbackOpen && (
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex items-center justify-between gap-3 text-white">
            <div className="text-xs min-w-0">
              <p className="font-bold">Document Ready</p>
              <p className="text-slate-400 truncate max-w-[200px]">{fallbackOpen.title}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={fallbackOpen.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow"
                onClick={() => setFallbackOpen(null)}
              >
                Open Viewer
              </a>
              {fallbackOpen.googleUrl && (
                <a
                  href={fallbackOpen.googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 font-bold hover:underline"
                  onClick={() => setFallbackOpen(null)}
                >
                  Google
                </a>
              )}
              <button
                type="button"
                onClick={() => setFallbackOpen(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
