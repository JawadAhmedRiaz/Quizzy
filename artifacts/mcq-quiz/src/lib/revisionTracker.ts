import { useState, useEffect } from "react";
import type { Question } from "@/data/questions";
import type { QuizAnswer } from "@/context/QuizContext";

const STORAGE_KEY = "quizzy_revision_mistakes_v1";

export interface MistakeRecord {
  id: string;
  quizId: string;
  subject: string;
  semester?: string | number;
  examType?: string;
  question: Question;
  selectedOptionIndex: number | null;
  wrongAt: string;
  mastered: boolean;
  masteredAt?: string;
  reviewCount: number;
}

export interface RevisionStats {
  total: number;
  unmastered: number;
  mastered: number;
  bySubject: Record<string, number>;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function generateId(quizId: string, qText: string): string {
  // Simple stable string hash
  let hash = 0;
  const str = `${quizId}::${qText.trim()}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `mistake_${Math.abs(hash)}`;
}

export function getAllMistakes(): MistakeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMistakes(mistakes: MistakeRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mistakes));
    notifyListeners();
  } catch {}
}

/**
 * Automatically extracts and persists wrong answers from a completed quiz
 */
export function recordMistakesFromQuiz(
  quizId: string,
  subject: string,
  answers: QuizAnswer[],
  semester?: string | number,
  examType?: string
) {
  if (!answers || answers.length === 0) return;

  const current = getAllMistakes();
  const currentMap = new Map(current.map((m) => [m.id, m]));
  let hasChanges = false;

  answers.forEach((ans) => {
    // Only capture incorrect answers (exclude skipped or correct)
    if (!ans.isCorrect && !ans.skipped && ans.question) {
      const id = generateId(quizId, ans.question.q);
      const existing = currentMap.get(id);

      if (existing) {
        // Already exists: update timestamp and un-master if answered wrong again
        existing.wrongAt = new Date().toISOString();
        existing.selectedOptionIndex = ans.selectedOptionIndex;
        existing.mastered = false; // re-challenge student
        existing.reviewCount = (existing.reviewCount || 0) + 1;
        currentMap.set(id, existing);
      } else {
        // Brand new mistake
        const newRecord: MistakeRecord = {
          id,
          quizId,
          subject: subject || "General",
          semester,
          examType,
          question: ans.question,
          selectedOptionIndex: ans.selectedOptionIndex,
          wrongAt: new Date().toISOString(),
          mastered: false,
          reviewCount: 0,
        };
        currentMap.set(id, newRecord);
      }
      hasChanges = true;
    }
  });

  if (hasChanges) {
    saveMistakes(Array.from(currentMap.values()));
  }
}

export function markMistakeMastered(id: string, mastered: boolean = true) {
  const current = getAllMistakes();
  const updated = current.map((m) => {
    if (m.id === id) {
      return {
        ...m,
        mastered,
        masteredAt: mastered ? new Date().toISOString() : undefined,
        reviewCount: (m.reviewCount || 0) + 1,
      };
    }
    return m;
  });
  saveMistakes(updated);
}

export function deleteMistake(id: string) {
  const current = getAllMistakes();
  const updated = current.filter((m) => m.id !== id);
  saveMistakes(updated);
}

export function clearAllMasteredMistakes() {
  const current = getAllMistakes();
  const updated = current.filter((m) => !m.mastered);
  saveMistakes(updated);
}

/**
 * Synchronizes previous exam mistakes from PostgreSQL database quiz reports
 */
export async function syncMistakesFromDatabase(userName?: string): Promise<MistakeRecord[]> {
  if (
    typeof window === "undefined" ||
    !userName ||
    !userName.trim() ||
    userName.trim().toLowerCase() === "guest" ||
    userName.trim().toLowerCase() === "guest scholar"
  ) {
    return getAllMistakes();
  }
  try {
    const query = userName ? `?userName=${encodeURIComponent(userName)}` : "";
    const res = await fetch(`/api/quiz-reports/mistakes${query}`);
    if (!res.ok) return getAllMistakes();
    const dbMistakes: MistakeRecord[] = await res.json();
    if (!Array.isArray(dbMistakes) || dbMistakes.length === 0) return getAllMistakes();

    const localMistakes = getAllMistakes();
    const localMap = new Map(localMistakes.map((m) => [m.question?.q?.trim().toLowerCase(), m]));

    const merged: MistakeRecord[] = [];

    // Process all DB mistakes
    dbMistakes.forEach((dbM) => {
      const qKey = dbM.question?.q?.trim().toLowerCase();
      const localMatch = localMap.get(qKey);

      if (localMatch) {
        // Keep local mastery state, but ensure complete question data from DB
        merged.push({
          ...dbM,
          mastered: localMatch.mastered,
          masteredAt: localMatch.masteredAt,
          reviewCount: Math.max(dbM.reviewCount || 0, localMatch.reviewCount || 0),
        });
        localMap.delete(qKey);
      } else {
        merged.push(dbM);
      }
    });

    // Add any remaining local mistakes
    localMap.forEach((localM) => {
      merged.push(localM);
    });

    saveMistakes(merged);
    return merged;
  } catch (err) {
    console.error("Failed to sync mistakes with DB:", err);
    return getAllMistakes();
  }
}

export function getRevisionStats(): RevisionStats {
  const all = getAllMistakes();
  const unmastered = all.filter((m) => !m.mastered);
  const mastered = all.filter((m) => m.mastered);

  const bySubject: Record<string, number> = {};
  unmastered.forEach((m) => {
    const s = m.subject || "Other";
    bySubject[s] = (bySubject[s] || 0) + 1;
  });

  return {
    total: all.length,
    unmastered: unmastered.length,
    mastered: mastered.length,
    bySubject,
  };
}

/**
 * Reactive hook to subscribe to mistake deck stats anywhere in the app
 */
export function useRevisionStats(): RevisionStats {
  const [stats, setStats] = useState<RevisionStats>(() => getRevisionStats());

  useEffect(() => {
    const update = () => setStats(getRevisionStats());
    listeners.add(update);
    // Also listen to storage events from other tabs
    window.addEventListener("storage", update);

    return () => {
      listeners.delete(update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return stats;
}
