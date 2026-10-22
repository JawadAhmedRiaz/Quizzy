import { useState, useRef, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.BASE_URL + "api";

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const EXAM_TYPES = ["Midterm", "Final", "Quiz", "Assignment"];

interface SubjectOption {
  id: number;
  name: string;
}

interface ParsedQuestion {
  Question: string;
  Option_A: string;
  Option_B: string;
  Option_C: string;
  Option_D: string;
  Correct_Answer: string;
  Briefing: string;
  Topic: string;
  sem: number;
  subject: string;
  examType: string;
}

type Stage = "input" | "parsing" | "review" | "committing" | "done";

export function ImportPage() {
  const [sem, setSem] = useState(2);
  const [subject, setSubject] = useState("");
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [examType, setExamType] = useState("Midterm");
  const [rawText, setRawText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [mode, setMode] = useState<"extract" | "generate">("extract");
  const [generateCount, setGenerateCount] = useState(20);
  const [generateDifficulty, setGenerateDifficulty] = useState("balanced");
  const [stage, setStage] = useState<Stage>("input");
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [commitCount, setCommitCount] = useState(0);

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch subjects from DB whenever sem changes
  useEffect(() => {
    setSubjectsLoading(true);
    setSubject("");
    fetch(`${API}/subjects?sem=${sem}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: SubjectOption[]) => {
        setSubjectOptions(data);
        if (data.length > 0) setSubject(data[0].name);
      })
      .catch(() => setSubjectOptions([]))
      .finally(() => setSubjectsLoading(false));
  }, [sem]);

  const inputStyle = {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "8px 12px",
    fontSize: 13,
    width: "100%",
    outline: "none",
  };

  async function handleFile(file: File) {
    const allowed = [".pdf", ".docx", ".txt"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Unsupported file type. Please upload a .pdf, .docx, or .txt file.");
      return;
    }
    setFileName(file.name);
    setFileLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const r = await fetch(`${API}/admin/extract-file`, { method: "POST", body: formData });
      const data = await r.json();
      if (r.ok) {
        setRawText(data.text as string);
      } else {
        setError((data as { error?: string }).error ?? "File extraction failed");
        setFileName(null);
      }
    } catch {
      setError("Network error — file upload failed.");
      setFileName(null);
    } finally {
      setFileLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  async function handleParse() {
    if (!rawText.trim()) { setError("Please paste your MCQ text first."); return; }
    if (!subject) { setError("Please select a subject (or import questions first to populate subjects)."); return; }
    setError(null);
    setStage("parsing");
    try {
      const r = await fetch(`${API}/admin/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          customInstructions,
          sem,
          subject,
          examType,
          mode,
          generateCount,
          generateDifficulty,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError((data as { error?: string }).error ?? "Parse failed"); setStage("input"); return; }
      const tagged: ParsedQuestion[] = ((data as { questions: ParsedQuestion[] }).questions).map(q => ({
        ...q,
        Topic: q.Topic ?? "",
        sem,
        subject,
        examType,
      }));
      setQuestions(tagged);
      setStage("review");
    } catch {
      setError("Network error — please try again.");
      setStage("input");
    }
  }

  function updateQuestion(index: number, field: keyof ParsedQuestion, value: string | number) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  }

  async function handleCommit() {
    setStage("committing");
    try {
      const r = await fetch(`${API}/admin/questions/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      const data = await r.json();
      if (!r.ok) { setError((data as { error?: string }).error ?? "Commit failed"); setStage("review"); return; }
      setCommitCount((data as { inserted?: number }).inserted ?? questions.length);
      setStage("done");
    } catch {
      setError("Network error during commit.");
      setStage("review");
    }
  }

  function handleReset() {
    setStage("input");
    setRawText("");
    setCustomInstructions("");
    setQuestions([]);
    setError(null);
    setFileName(null);
  }

  const selectStyle = { ...inputStyle, cursor: "pointer" };

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-black text-white">🤖 AI Ingestion Engine</h1>
          <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
            Upload a document or paste raw MCQ text — Gemini 1.5 Flash parses and structures it.
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-6">
          {["input", "review", "done"].map((s, i) => {
            const labels = ["1. Input & Parse", "2. Review & Edit", "3. Committed"];
            const active = stage === s || (stage === "parsing" && s === "input") || (stage === "committing" && s === "review");
            const completed = (stage === "review" && i === 0) || (stage === "done" && i <= 1) || (stage === "committing" && i === 0);
            return (
              <div key={s} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: completed ? "rgba(16,185,129,0.15)" : active ? "rgba(99,102,241,0.15)" : "rgba(51,65,85,0.5)",
                    color: completed ? "#34d399" : active ? "#a5b4fc" : "#64748b",
                    border: `1px solid ${completed ? "rgba(16,185,129,0.3)" : active ? "rgba(99,102,241,0.3)" : "#334155"}`,
                  }}>
                  {completed ? "✓ " : ""}{labels[i]}
                </div>
                {i < 2 && <div style={{ width: 24, height: 1, background: "#334155" }} />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Stage: Input ── */}
          {(stage === "input" || stage === "parsing") && (
            <motion.div key="input" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Dropdowns — Semester + cascading Subject + Exam Type */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>Semester</label>
                  <select value={sem} onChange={e => setSem(Number(e.target.value))} style={selectStyle}>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s === 1 ? "1st" : s === 2 ? "2nd" : s === 3 ? "3rd" : `${s}th`} Semester</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                    Subject
                    {subjectsLoading && <span className="ml-1.5 text-[10px]" style={{ color: "#64748b" }}>loading…</span>}
                  </label>
                  {subjectOptions.length > 0 ? (
                    <select value={subject} onChange={e => setSubject(e.target.value)} style={selectStyle}>
                      {subjectOptions.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#0f172a", border: "1px solid #334155", color: "#475569" }}>
                      {subjectsLoading ? "Loading…" : "No subjects for this semester"}
                    </div>
                  )}
                  {!subjectsLoading && subjectOptions.length === 0 && (
                    <p className="text-[10px] mt-1" style={{ color: "#475569" }}>
                      Add questions first via manual import to create subjects, or type a name below.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>Exam Phase</label>
                  <select value={examType} onChange={e => setExamType(e.target.value)} style={selectStyle}>
                    {EXAM_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              {/* Subject override input when no DB subjects exist */}
              {!subjectsLoading && subjectOptions.length === 0 && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                    Subject Name <span style={{ color: "#ef4444" }}>*</span>
                    <span className="ml-1 font-normal" style={{ color: "#475569" }}>(no subjects exist yet for Sem {sem} — type to create one)</span>
                  </label>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Computer Science, English, Mathematics…"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* ── Mode Selector ── */}
              <div className="mb-5 p-4 rounded-xl" style={{ background: "#1e293b", border: "1px solid #334155" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "#94a3b8" }}>
                  Select AI Ingestion Mode
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("extract")}
                    className="p-3.5 rounded-xl text-left transition-all"
                    style={{
                      background: mode === "extract" ? "rgba(99,102,241,0.18)" : "#0f172a",
                      border: `2px solid ${mode === "extract" ? "#6366f1" : "#334155"}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📋</span>
                      <span className="text-sm font-bold text-white">Extract Existing MCQs</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                      Document already has MCQs with options. AI strips document headers, titles, page numbers, and teacher info.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("generate")}
                    className="p-3.5 rounded-xl text-left transition-all"
                    style={{
                      background: mode === "generate" ? "rgba(16,185,129,0.18)" : "#0f172a",
                      border: `2px solid ${mode === "generate" ? "#10b981" : "#334155"}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">✨</span>
                      <span className="text-sm font-bold text-white">Generate MCQs from Notes</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                      Upload lecture notes or textbook material. AI reads the concepts and creates brand new multiple choice questions.
                    </p>
                  </button>
                </div>

                {mode === "generate" && (
                  <div className="mt-4 pt-4 flex flex-wrap items-center gap-5" style={{ borderTop: "1px solid #334155" }}>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                        Questions to Generate:
                      </label>
                      <div className="flex items-center gap-2">
                        {[10, 20, 30, 50].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setGenerateCount(n)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={{
                              background: generateCount === n ? "#10b981" : "#0f172a",
                              color: generateCount === n ? "#fff" : "#94a3b8",
                              border: `1px solid ${generateCount === n ? "#10b981" : "#334155"}`,
                            }}
                          >
                            {n}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={generateCount}
                          onChange={(e) => setGenerateCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                          className="w-16 px-2 py-1.5 rounded-lg text-xs font-bold text-center outline-none"
                          style={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                        Question Style / Difficulty:
                      </label>
                      <select
                        value={generateDifficulty}
                        onChange={(e) => setGenerateDifficulty(e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold outline-none"
                        style={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                      >
                        <option value="balanced">Balanced (Direct & Conceptual)</option>
                        <option value="easy">Direct & Factual (Easy)</option>
                        <option value="hard">Application & Conceptual (Hard)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* ── File Upload Zone ── */}
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                  Upload Document <span style={{ color: "#475569" }}>(optional · .pdf, .docx, .txt)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileInput}
                  style={{ display: "none" }}
                />
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: `2px dashed ${isDragging ? "#6366f1" : "#334155"}`,
                    background: isDragging ? "rgba(99,102,241,0.06)" : "#0f172a",
                    padding: "20px 16px",
                    minHeight: 88,
                  }}>
                  {fileLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                      <span className="text-sm" style={{ color: "#94a3b8" }}>Extracting text…</span>
                    </div>
                  ) : fileName ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📄</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#a5b4fc" }}>{fileName}</p>
                        <p className="text-xs" style={{ color: "#64748b" }}>Text extracted — click to replace</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-2xl">📁</span>
                      <p className="text-sm font-semibold" style={{ color: isDragging ? "#a5b4fc" : "#64748b" }}>
                        Drag & drop a file here, or click to browse
                      </p>
                      <p className="text-xs" style={{ color: "#475569" }}>Supports PDF, DOCX, TXT — text auto-fills below</p>
                    </>
                  )}
                </div>
              </div>

              {/* Raw MCQ textarea */}
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                  Raw MCQ Text Dump <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  rows={12}
                  placeholder="Paste your raw MCQ text here, or upload a document above to auto-fill…"
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }}
                />
                <p className="text-xs mt-1" style={{ color: "#475569" }}>
                  {rawText.length} characters · Gemini will extract and structure all questions automatically
                </p>
              </div>

              {/* Custom instructions */}
              <div className="mb-5">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                  Custom AI Instructions <span style={{ color: "#475569" }}>(optional)</span>
                </label>
                <textarea
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g. 'Questions are numbered 1–40. Correct answer is marked with *. Ignore page headers.'"
                  style={{ ...inputStyle, resize: "vertical", fontSize: 12 }}
                />
              </div>

              <button
                onClick={handleParse}
                disabled={stage === "parsing" || !rawText.trim() || !subject.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: stage === "parsing" || !rawText.trim() || !subject.trim() ? "#334155" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  color: stage === "parsing" || !rawText.trim() || !subject.trim() ? "#64748b" : "#fff",
                  cursor: stage === "parsing" || !rawText.trim() || !subject.trim() ? "not-allowed" : "pointer",
                }}>
                {stage === "parsing" ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Gemini 3.5 Flash-Lite is processing…
                  </>
                ) : mode === "generate" ? (
                  `✨ Generate ${generateCount} MCQs from Notes`
                ) : (
                  "📋 Extract & Clean MCQs"
                )}
              </button>
            </motion.div>
          )}

          {/* ── Stage: Review ── */}
          {(stage === "review" || stage === "committing") && (
            <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-sm font-bold text-white">{questions.length} questions parsed</span>
                  <span className="text-xs ml-2" style={{ color: "#94a3b8" }}>· Click any field to edit · Remove bad questions</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleReset} className="px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: "#334155", color: "#94a3b8" }}>
                    ← Back
                  </button>
                  <button
                    onClick={handleCommit}
                    disabled={stage === "committing" || questions.length === 0}
                    className="px-5 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: stage === "committing" || questions.length === 0 ? "#334155" : "#16a34a",
                      color: stage === "committing" || questions.length === 0 ? "#64748b" : "#fff",
                    }}>
                    {stage === "committing" ? "Committing…" : `✅ Commit ${questions.length} to Database`}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {questions.map((q, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: "#1e293b", border: "1px solid #334155" }}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="text-xs font-black px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>Q{i + 1}</span>
                      <button onClick={() => removeQuestion(i)} className="text-xs px-2 py-0.5 rounded font-semibold"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>Remove</button>
                    </div>

                    <div className="mb-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#64748b" }}>Question</label>
                      <textarea
                        value={q.Question}
                        onChange={e => updateQuestion(i, "Question", e.target.value)}
                        rows={2}
                        style={{ ...inputStyle, resize: "vertical", fontSize: 13 }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {(["Option_A", "Option_B", "Option_C", "Option_D"] as const).map(opt => (
                        <div key={opt}>
                          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#64748b" }}>{opt.replace("_", " ")}</label>
                          <input
                            value={q[opt]}
                            onChange={e => updateQuestion(i, opt, e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#64748b" }}>Correct Answer</label>
                        <select value={q.Correct_Answer} onChange={e => updateQuestion(i, "Correct_Answer", e.target.value)} style={selectStyle}>
                          {["A", "B", "C", "D"].map(o => <option key={o} value={o}>Option {o} — {q[`Option_${o}` as keyof ParsedQuestion]?.toString().slice(0, 40)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#64748b" }}>Briefing / Explanation</label>
                        <input
                          value={q.Briefing}
                          onChange={e => updateQuestion(i, "Briefing", e.target.value)}
                          placeholder="Brief explanation…"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#64748b" }}>
                          🏷 Topic Tag
                        </label>
                        <input
                          value={q.Topic}
                          onChange={e => updateQuestion(i, "Topic", e.target.value)}
                          placeholder="e.g. Generations"
                          style={{ ...inputStyle, borderColor: q.Topic ? "#6366f1" : "#334155" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Stage: Done ── */}
          {stage === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-black text-white mb-2">{commitCount} Questions Committed!</h2>
              <p className="text-sm mb-1" style={{ color: "#94a3b8" }}>
                Successfully added to the database under <strong style={{ color: "#a5b4fc" }}>Sem {sem} · {subject} · {examType}</strong>
              </p>
              <p className="text-sm" style={{ color: "#64748b" }}>They are now available in the MCQ Bank and on the student home page.</p>
              <div className="flex gap-3 mt-8">
                <button onClick={handleReset} className="px-6 py-3 rounded-xl font-bold text-sm"
                  style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
                  ✨ Import More
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
