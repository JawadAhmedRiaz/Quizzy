import { useState, useEffect } from "react";
import type { Question } from "@/data/questions";
import type { QuizAnswer } from "@/context/QuizContext";

const STORAGE_KEY = "quizzy_revision_mistakes_v1";
const DELETED_STORAGE_KEY = "quizzy_revision_deleted_v1";
const CLEANUP_KEY = "quizzy_revision_cleanup_v2";

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
  dbId?: number;
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
  mistakeCount?: number;
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
    if (!ans.isCorrect && !ans.skipped && ans.question) {
      unmarkDeletedMistakeKey(ans.question.q);
      const id = generateId(quizId, ans.question.q);
      const existing = currentMap.get(id);

      if (existing) {
        existing.wrongAt = new Date().toISOString();
        existing.selectedOptionIndex = ans.selectedOptionIndex;
        existing.mastered = false;
        existing.reviewCount = (existing.reviewCount || 0) + 1;
        currentMap.set(id, existing);
      } else {
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

/**
 * Updates mastery status directly in PostgreSQL and local cache
 */
export async function markMistakeMastered(id: string, mastered: boolean = true): Promise<void> {
  const current = getAllMistakes();
  const toUpdate = current.find((m) => m.id === id);

  const res = await fetch(`/api/revision-cards/${encodeURIComponent(id)}/master`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mastered }),
  });

  if (!res.ok) {
    let errorMsg = `Server returned ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
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

/**
 * Deletes a revision card from PostgreSQL by ID, awaiting server confirmation
 */
export async function deleteMistake(id: string): Promise<void> {
  const current = getAllMistakes();
  const toDelete = current.find((m) => m.id === id);

  const res = await fetch(`/api/revision-cards/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    let errorMsg = `Failed to delete revision card (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }

  if (toDelete?.question?.q) {
    saveDeletedMistakeKey(toDelete.question.q);
  }

  const updated = current.filter((m) => m.id !== id);
  saveMistakes(updated);
}

/**
 * Bulk clear all mastered cards from PostgreSQL and local cache
 */
export async function clearAllMasteredMistakes(): Promise<void> {
  const res = await fetch("/api/revision-cards", {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    let errorMsg = `Failed to clear mastered cards (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const current = getAllMistakes();
  const updated = current.filter((m) => !m.mastered);
  saveMistakes(updated);
}

/**
 * One-time cleanup of legacy derived keys and local mistakes cache
 */
function ensureOneTimeCleanup(): void {
  if (typeof window === "undefined") return;
  try {
    if (!localStorage.getItem(CLEANUP_KEY)) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DELETED_STORAGE_KEY);
      localStorage.setItem(CLEANUP_KEY, "true");
      saveMistakes([]);
    }
  } catch {}
}

/**
 * Synchronizes revision cards directly from PostgreSQL database for session user
 */
export async function syncMistakesFromDatabase(_ignoredUserName?: string): Promise<MistakeRecord[]> {
  if (typeof window === "undefined") return getAllMistakes();

  ensureOneTimeCleanup();

  try {
    const res = await fetch("/api/revision-cards", { credentials: "include" });
    if (res.ok) {
      const dbCards = await res.json();
      if (Array.isArray(dbCards)) {
        // Database is the absolute authority: update cache with genuine server cards
        saveMistakes(dbCards);
        return dbCards;
      }
    } else if (res.status === 401) {
      // Unauthenticated / guest session: keep local state
      return getAllMistakes();
    }
  } catch (err) {
    console.error("Failed to sync revision cards from DB:", err);
  }

  return getAllMistakes();
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
    window.addEventListener("storage", update);

    return () => {
      listeners.delete(update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return stats;
}
