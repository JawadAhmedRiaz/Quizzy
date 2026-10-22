import { createContext, useContext, useState, type ReactNode } from "react";
import type { Question } from "@/data/questions";
import type { QuizMeta } from "@/data/curriculum";

export type QuizDifficulty = "easy" | "medium" | "hard";

export interface QuizAnswer {
  question: Question;
  selectedOptionIndex: number | null;
  isCorrect: boolean;
  skipped: boolean;
  pointsEarned: number;
}

export interface QuizSession {
  quizId: string;
  playerName: string;
  totalToAttempt: number;
  questions: Question[];
  answers: QuizAnswer[];
  score: number;
  correct: number;
  finished: boolean;
  timeTaken: number | null;
  timeAllowed: number | null;
  meta?: QuizMeta | null;
}

interface QuizContextValue {
  playerName: string;
  setPlayerName: (name: string) => void;
  totalToAttempt: number;
  setTotalToAttempt: (n: number) => void;
  shuffleEnabled: boolean;
  setShuffleEnabled: (v: boolean) => void;
  difficulty: QuizDifficulty;
  setDifficulty: (difficulty: QuizDifficulty) => void;
  session: QuizSession | null;
  startSession: (quizId: string, questions: Question[], totalOverride?: number, meta?: QuizMeta | null) => void;
  finalizeSession: (answers: QuizAnswer[], score: number, correct: number, timeTaken?: number | null, timeAllowed?: number | null) => void;
  resetSession: () => void;
}

const QuizContext = createContext<QuizContextValue | null>(null);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [playerName, setPlayerName] = useState("");
  const [totalToAttempt, setTotalToAttempt] = useState(40);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("easy");
  const [session, setSession] = useState<QuizSession | null>(null);

  function startSession(quizId: string, questions: Question[], totalOverride?: number, meta?: QuizMeta | null) {
    setSession({
      quizId,
      playerName,
      totalToAttempt: totalOverride ?? totalToAttempt,
      questions,
      answers: [],
      score: 0,
      correct: 0,
      finished: false,
      timeTaken: null,
      timeAllowed: null,
      meta: meta ?? null,
    });
  }

  function finalizeSession(answers: QuizAnswer[], score: number, correct: number, timeTaken?: number | null, timeAllowed?: number | null) {
    setSession((prev) =>
      prev ? { ...prev, answers, score, correct, finished: true, timeTaken: timeTaken ?? null, timeAllowed: timeAllowed ?? null } : prev
    );
  }

  function resetSession() {
    setSession(null);
  }

  return (
    <QuizContext.Provider
      value={{
        playerName,
        setPlayerName,
        totalToAttempt,
        setTotalToAttempt,
        shuffleEnabled,
        setShuffleEnabled,
        difficulty,
        setDifficulty,
        session,
        startSession,
        finalizeSession,
        resetSession,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuiz must be used inside QuizProvider");
  return ctx;
}
