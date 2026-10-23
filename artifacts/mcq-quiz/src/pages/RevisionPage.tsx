import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { TopNavbar } from "@/components/TopNavbar";
import { useQuiz } from "@/context/QuizContext";
import { useUser } from "@/context/UserContext";
import {
  getAllMistakes,
  markMistakeMastered,
  deleteMistake,
  useRevisionStats,
  syncMistakesFromDatabase,
  type MistakeRecord,
} from "@/lib/revisionTracker";
import {
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Shuffle,
  Zap,
  Layers,
  ListFilter,
  Check,
  AlertCircle,
  Trash2,
} from "lucide-react";

export function RevisionPage() {
  const [location, navigate] = useLocation();
  const { startSession } = useQuiz();
  const { displayName } = useUser();
  const stats = useRevisionStats();
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync mistakes from database on mount (e.g. from past exams)
  useEffect(() => {
    setIsSyncing(true);
    syncMistakesFromDatabase(displayName || undefined).then((synced) => {
      setMistakes(synced);
      setIsSyncing(false);
    });
  }, [displayName]);

  // Read URL query params for subject filter (e.g. /revision?subject=Cyber%20Security)
  const urlSubject = useMemo(() => {
    if (typeof window === "undefined") return "All";
    const params = new URLSearchParams(window.location.search);
    return params.get("subject") || "All";
  }, [location]);

  const [selectedSubject, setSelectedSubject] = useState<string>(urlSubject);
  const [viewMode, setViewMode] = useState<"flashcards" | "list">("flashcards");
  const [activeTab, setActiveTab] = useState<"pending" | "mastered">("pending");
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>(() => getAllMistakes());
  const [attemptedSelections, setAttemptedSelections] = useState<Record<string, number>>({});

  const handleCardAttempt = (cardId: string, optIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setAttemptedSelections((prev) => ({ ...prev, [cardId]: optIndex }));
  };

  // Refresh mistakes when stats change
  useEffect(() => {
    setMistakes(getAllMistakes());
  }, [stats]);

  // Keep selectedSubject in sync with URL if URL changes
  useEffect(() => {
    if (urlSubject && urlSubject !== "All") {
      setSelectedSubject(urlSubject);
    }
  }, [urlSubject]);

  // Available subjects
  const subjects = useMemo(() => {
    const set = new Set<string>();
    mistakes.forEach((m) => {
      if (m.subject) set.add(m.subject);
    });
    return ["All", ...Array.from(set)];
  }, [mistakes]);

  // Filtered mistake list
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      const matchesSubject = selectedSubject === "All" || m.subject === selectedSubject;
      const matchesMastered = activeTab === "mastered" ? m.mastered : !m.mastered;
      return matchesSubject && matchesMastered;
    });
  }, [mistakes, selectedSubject, activeTab]);

  // Reset card index & flip state when filters change
  useEffect(() => {
    setCardIndex(0);
    setIsFlipped(false);
  }, [selectedSubject, activeTab]);

  const currentCard = filteredMistakes[cardIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCardIndex((prev) => (prev + 1 < filteredMistakes.length ? prev + 1 : 0));
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCardIndex((prev) => (prev > 0 ? prev - 1 : filteredMistakes.length - 1));
    }, 150);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    const shuffled = [...mistakes].sort(() => Math.random() - 0.5);
    setMistakes(shuffled);
    setCardIndex(0);
  };

  const handleToggleMastered = (id: string, currentState: boolean) => {
    markMistakeMastered(id, !currentState);
    setMistakes(getAllMistakes());
    // Auto-advance if marking as mastered in flashcard mode
    if (!currentState && activeTab === "pending") {
      setIsFlipped(false);
    }
  };

  // Keyboard navigation for flashcards
  useEffect(() => {
    if (viewMode !== "flashcards" || filteredMistakes.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, filteredMistakes.length, cardIndex]);

  // Launch a live practice test using the student's mistakes
  const handleLaunchWipeoutQuiz = () => {
    if (filteredMistakes.length === 0) return;
    const questionsToQuiz = filteredMistakes.map((m) => m.question);
    const quizTitle = selectedSubject === "All" ? "Revision Wipeout Quiz" : `${selectedSubject} Revision Quiz`;

    startSession("revision-wipeout", questionsToQuiz, questionsToQuiz.length, {
      quizId: "revision-wipeout",
      sem: 0,
      subject: quizTitle,
      examType: "Revision",
      title: quizTitle,
    });
    navigate("/quiz/revision-wipeout");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      <TopNavbar />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex flex-col items-center">
        {/* ─── HEADER BANNER ─── */}
        <div className="text-center mb-6 w-full">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-3 shadow-xs">
            <Zap className="w-4 h-4" />
            <span>Targeted Mistake Vault & Active Recall</span>
          </div>

          <h1
            className="text-3xl md:text-4xl font-black tracking-tight mb-2"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Revision Hub
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Questions you missed during quizzes are automatically organized here. Flip through flashcards or run a wipeout quiz to master your blind spots.
          </p>
        </div>

        {/* ─── STATS SUMMARY CARD ─── */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To Master</p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {stats.unmastered}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mastered</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {stats.mastered}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mastery Rate</p>
              <h3 className="text-2xl font-black text-foreground mt-0.5">
                {stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 100}%
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ─── CONTROLS & FILTER ROW ─── */}
        <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
          {/* Active Tab Toggle: Pending vs Mastered */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/60 self-start">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "pending"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Needs Practice ({stats.unmastered})
            </button>
            <button
              onClick={() => setActiveTab("mastered")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "mastered"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mastered Archive ({stats.mastered})
            </button>
          </div>

          {/* View Mode Toggle & Quiz Launch */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/60">
              <button
                onClick={() => setViewMode("flashcards")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "flashcards"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Flashcards</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>

            {filteredMistakes.length > 0 && activeTab === "pending" && (
              <button
                onClick={handleLaunchWipeoutQuiz}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #ea580c)",
                }}
                title="Attempt these questions in an interactive quiz"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Test as Quiz ({filteredMistakes.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── SUBJECT PILLS FILTER ─── */}
        {subjects.length > 1 && (
          <div className="w-full flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
            {subjects.map((subj) => {
              const isSelected = selectedSubject === subj;
              const count =
                subj === "All"
                  ? activeTab === "pending"
                    ? stats.unmastered
                    : stats.mastered
                  : mistakes.filter(
                      (m) => m.subject === subj && (activeTab === "mastered" ? m.mastered : !m.mastered)
                    ).length;

              return (
                <button
                  key={subj}
                  onClick={() => setSelectedSubject(subj)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-xs"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/80 border border-transparent"
                  }`}
                >
                  <span>{subj}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isSelected
                        ? "bg-amber-500 text-slate-950"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── EMPTY STATE ─── */}
        {filteredMistakes.length === 0 && (
          <div className="w-full p-12 rounded-3xl border border-dashed border-border bg-card/60 flex flex-col items-center justify-center text-center my-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mb-4 shadow-xs">
              {activeTab === "pending" ? "🏆" : "📭"}
            </div>
            <h3
              className="text-xl font-black mb-1.5 text-foreground"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {activeTab === "pending" ? "All Caught Up!" : "No Mastered Questions Yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-6">
              {activeTab === "pending"
                ? `You have no unmastered mistakes ${
                    selectedSubject !== "All" ? `for ${selectedSubject}` : "across any subject"
                  }! Keep challenging yourself in Study mode.`
                : "Questions marked as mastered will appear here for archival and future review."}
            </p>
            <button
              onClick={() => navigate("/study")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              style={{ background: "linear-gradient(135deg, #007aff, #2563eb)" }}
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore Subjects & Quizzes</span>
            </button>
          </div>
        )}

        {/* ─── FLASHCARD MODE ─── */}
        {viewMode === "flashcards" && filteredMistakes.length > 0 && currentCard && (
          <div className="w-full flex flex-col items-center">
            {/* Flashcard Header Controls */}
            <div className="w-full max-w-2xl flex items-center justify-between mb-3 px-1 text-xs text-muted-foreground">
              <span className="font-bold">
                Card {cardIndex + 1} of {filteredMistakes.length}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleShuffle}
                  className="flex items-center gap-1 hover:text-foreground font-semibold cursor-pointer"
                  title="Shuffle deck"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Shuffle</span>
                </button>
                <span className="hidden sm:inline opacity-60">•</span>
                <span className="hidden sm:inline opacity-75">
                  Hint: Space to flip, Arrow keys to switch
                </span>
              </div>
            </div>

            {/* 3D Flip Flashcard */}
            <div
              className="w-full max-w-2xl min-h-[440px] perspective-[1000px] cursor-pointer relative"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <motion.div
                className="w-full h-full relative"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* ── CARD FRONT (Question & Interactive Options) ── */}
                <div
                  className="rounded-3xl p-6 sm:p-8 bg-card border border-border/80 shadow-lg flex flex-col justify-between backface-hidden overflow-y-auto max-h-[560px]"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                >
                  <div>
                    {/* Tags */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {currentCard.subject}
                        </span>
                        {currentCard.question.c && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                            {currentCard.question.c}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Interactive Revision Card</span>
                      </span>
                    </div>

                    {/* Question Text */}
                    <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug mb-3">
                      {currentCard.question.q}
                    </h3>

                    {/* Interactive MCQ Options */}
                    <div className="flex flex-col gap-2 my-2" onClick={(e) => e.stopPropagation()}>
                      {currentCard.question.o.map((opt, i) => {
                        const isAttempted = attemptedSelections[currentCard.id] !== undefined;
                        const isSelected = attemptedSelections[currentCard.id] === i;
                        const isCorrect = i === currentCard.question.a;

                        let btnClass = "bg-muted/40 border-border/80 text-foreground hover:bg-muted/70 hover:border-blue-500/50";
                        if (isAttempted) {
                          if (isCorrect) {
                            btnClass = "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold";
                          } else if (isSelected) {
                            btnClass = "bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400 font-bold";
                          } else {
                            btnClass = "bg-muted/20 border-border/30 text-muted-foreground/50 opacity-60";
                          }
                        }

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => handleCardAttempt(currentCard.id, i, e)}
                            disabled={isAttempted}
                            className={`w-full text-left p-3 rounded-xl text-xs sm:text-sm border transition-all flex items-start gap-2.5 ${btnClass} ${
                              isAttempted ? "cursor-default" : "cursor-pointer"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                isAttempted && isCorrect
                                  ? "bg-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                  : isAttempted && isSelected
                                  ? "bg-red-500/30 text-red-600 dark:text-red-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className="flex-1 leading-snug">{opt}</span>
                            {isAttempted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                            {isAttempted && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Feedback on Attempt */}
                    {attemptedSelections[currentCard.id] !== undefined && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3.5 rounded-2xl border text-xs leading-relaxed my-2 shadow-xs ${
                          attemptedSelections[currentCard.id] === currentCard.question.a
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                            : "bg-red-500/10 border-red-500/30 text-red-950 dark:text-red-100"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 font-bold">
                          <span className="flex items-center gap-1.5">
                            {attemptedSelections[currentCard.id] === currentCard.question.a
                              ? "✅ Correct Answer!"
                              : "❌ Incorrect Attempt"}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            Correct: Option ({String.fromCharCode(65 + currentCard.question.a)})
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-card border border-border/80 text-foreground">
                          <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">
                            💡 Concept Breakdown:
                          </span>
                          <p className="text-muted-foreground leading-relaxed text-xs font-medium">
                            {currentCard.question.e && currentCard.question.e.trim().length > 0
                              ? currentCard.question.e
                              : `Option (${String.fromCharCode(65 + currentCard.question.a)}) "${
                                  currentCard.question.o[currentCard.question.a]
                                }" is the verified conceptual answer for ${currentCard.subject}.`}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Option Peek / What they answered in past exam */}
                    {attemptedSelections[currentCard.id] === undefined && currentCard.selectedOptionIndex !== null && (
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-xs mb-2">
                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-red-600 dark:text-red-400">
                            Your previous quiz mistake was:
                          </span>
                          <p className="text-foreground/90 font-medium mt-0.5">
                            {currentCard.question.o[currentCard.selectedOptionIndex] || "None selected"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tap prompt */}
                  <div className="pt-3 mt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {attemptedSelections[currentCard.id] !== undefined
                        ? "Attempt recorded. Flip for full notes."
                        : "Click an option above to attempt question"}
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span>Flip Card</span>
                      <RotateCcw className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* ── CARD BACK (Correct Answer & Explanation) ── */}
                <div
                  className="rounded-3xl p-6 sm:p-8 bg-card border border-emerald-500/40 shadow-xl flex flex-col justify-between backface-hidden overflow-y-auto max-h-[560px]"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                  onClick={(e) => e.stopPropagation()} // allow clicking buttons without flipping
                >
                  <div className="overflow-y-auto pr-1">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified Answer & Concept</span>
                      </span>

                      <button
                        onClick={() => setIsFlipped(false)}
                        className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Flip Back</span>
                      </button>
                    </div>

                    {/* Correct Option Highlight */}
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 mb-3">
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        Option ({String.fromCharCode(65 + currentCard.question.a)})
                      </div>
                      <p className="text-sm sm:text-base font-extrabold text-foreground">
                        {currentCard.question.o[currentCard.question.a]}
                      </p>
                    </div>

                    {/* Detailed Explanation / Why It Is Correct */}
                    <div className="rounded-2xl p-3.5 bg-muted/40 border border-border/80 text-xs mb-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">
                        💡 Concept Breakdown & Why This Is Correct:
                      </span>
                      <p className="text-muted-foreground leading-relaxed font-medium">
                        {currentCard.question.e && currentCard.question.e.trim().length > 0
                          ? currentCard.question.e
                          : `Option (${String.fromCharCode(65 + currentCard.question.a)}) "${
                              currentCard.question.o[currentCard.question.a]
                            }" directly defines this concept in ${currentCard.subject}${
                              currentCard.question.c ? ` (${currentCard.question.c})` : ""
                            }.`}
                      </p>
                    </div>
                  </div>

                  {/* Actions on Back */}
                  <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                    <button
                      onClick={handleNext}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-border bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer"
                    >
                      Keep Reviewing
                    </button>

                    <button
                      onClick={() => handleToggleMastered(currentCard.id, currentCard.mastered)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                      style={{
                        background: currentCard.mastered
                          ? "linear-gradient(135deg, #64748b, #475569)"
                          : "linear-gradient(135deg, #22c55e, #16a34a)",
                      }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{currentCard.mastered ? "Unmark Mastered" : "Mark as Mastered"}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Navigation Carousel Buttons */}
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={handlePrev}
                className="p-3 rounded-2xl border border-border bg-card hover:bg-muted text-foreground transition-transform active:scale-95 shadow-xs cursor-pointer"
                title="Previous Card (Left Arrow)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="w-48 bg-muted h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{
                    width: `${((cardIndex + 1) / filteredMistakes.length) * 100}%`,
                  }}
                />
              </div>

              <button
                onClick={handleNext}
                className="p-3 rounded-2xl border border-border bg-card hover:bg-muted text-foreground transition-transform active:scale-95 shadow-xs cursor-pointer"
                title="Next Card (Right Arrow)"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ─── LIST VIEW MODE ─── */}
        {viewMode === "list" && filteredMistakes.length > 0 && (
          <div className="w-full flex flex-col gap-3">
            {filteredMistakes.map((record, index) => (
              <div
                key={record.id}
                className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {record.subject}
                    </span>
                    {record.question.c && (
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {record.question.c}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">•</span>
                    <span className="text-[10px] text-muted-foreground">
                      #{index + 1}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-foreground mb-2">
                    {record.question.q}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                        ✓ Correct Answer:
                      </span>
                      <p className="text-foreground font-medium">
                        {record.question.o[record.question.a]}
                      </p>
                    </div>

                    {record.selectedOptionIndex !== null && (
                      <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                        <span className="font-bold text-red-600 dark:text-red-400 block mb-0.5">
                          ✕ Your Mistake:
                        </span>
                        <p className="text-foreground font-medium">
                          {record.question.o[record.selectedOptionIndex] || "None selected"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 rounded-xl p-3 bg-muted/40 border border-border/70 text-xs">
                    <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-1">
                      <span>💡</span>
                      <span>Why this is correct:</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed font-medium">
                      {record.question.e && record.question.e.trim().length > 0
                        ? record.question.e
                        : `Option (${String.fromCharCode(65 + record.question.a)}) "${record.question.o[record.question.a]}" is the verified answer for ${record.subject}.`}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleToggleMastered(record.id, record.mastered)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      record.mastered
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                    }`}
                  >
                    {record.mastered ? "✓ Mastered" : "Mark Mastered"}
                  </button>

                  <button
                    onClick={() => deleteMistake(record.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Remove from Revision"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
