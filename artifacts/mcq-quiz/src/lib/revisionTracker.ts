import { useState, useEffect } from "react";
import type { Question } from "@/data/questions";
import type { QuizAnswer } from "@/context/QuizContext";

const STORAGE_KEY = "quizzy_revision_mistakes_v1";
const DELETED_STORAGE_KEY = "quizzy_revision_deleted_v1";

export function getDeletedMistakeKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDeletedMistakeKey(key: string) {
  if (typeof window === "undefined" || !key) return;
  try {
    const current = getDeletedMistakeKeys();
    current.add(key.trim().toLowerCase());
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export function unmarkDeletedMistakeKey(key: string) {
  if (typeof window === "undefined" || !key) return;
  try {
    const current = getDeletedMistakeKeys();
    current.delete(key.trim().toLowerCase());
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

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
      unmarkDeletedMistakeKey(ans.question.q);
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
  const toUpdate = current.find((m) => m.id === id);
  if (toUpdate && toUpdate.id.startsWith("card_")) {
    fetch(`/api/revision-cards/${toUpdate.id}/master`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mastered }),
    }).catch(() => {});
  }
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
  const toDelete = current.find((m) => m.id === id);
  if (toDelete) {
    if (toDelete.question?.q) {
      saveDeletedMistakeKey(toDelete.question.q);
    }
    const endpoint = toDelete.id.startsWith("card_")
      ? `/api/revision-cards/${toDelete.id}`
      : `/api/revision-cards/${id}`;

    fetch(endpoint, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
  }
  const updated = current.filter((m) => m.id !== id);
  saveMistakes(updated);
}

export function clearAllMasteredMistakes() {
  const current = getAllMistakes();
  fetch("/api/revision-cards", {
    method: "DELETE",
    credentials: "include",
  }).catch(() => {});
  const updated = current.filter((m) => !m.mastered);
  saveMistakes(updated);
}

/**
 * Synchronizes revision cards directly from PostgreSQL database
 */
export async function syncMistakesFromDatabase(userName?: string): Promise<MistakeRecord[]> {
  if (
    typeof window === "undefined" ||
    !userName ||
    !userName.trim() ||
    userName.trim().toLowerCase().startsWith("guest")
  ) {
    return getAllMistakes();
  }
  try {
    const query = userName ? `?userName=${encodeURIComponent(userName)}` : "";
    const res = await fetch(`/api/revision-cards${query}`, { credentials: "include" });
    if (res.ok) {
      const dbCards = await res.json();
      if (Array.isArray(dbCards) && dbCards.length > 0) {
        saveMistakes(dbCards);
        return dbCards;
      }
    }

    // Fallback to legacy endpoint if transition in progress
    const legacyRes = await fetch(`/api/quiz-reports/mistakes${query}`);
    if (legacyRes.ok) {
      const dbMistakes: MistakeRecord[] = await legacyRes.json();
      if (Array.isArray(dbMistakes) && dbMistakes.length > 0) {
        saveMistakes(dbMistakes);
        return dbMistakes;
      }
    }

    return getAllMistakes();
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
