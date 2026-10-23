/**
 * Real Study Time Tracker
 * Accurately measures actual active time spent learning and taking quizzes.
 * Scoped strictly per-user so that each student's profile displays only their own study time.
 */
import { useEffect, useState } from "react";

const STORAGE_KEY = "quizzy_real_study_time_by_day";
const OLD_STORAGE_KEY = "quizzy_study_time_by_day";

let isTrackerPaused = false;
const pauseListeners = new Set<(paused: boolean) => void>();

export function setStudyTrackerPaused(paused: boolean) {
  isTrackerPaused = paused;
  pauseListeners.forEach((fn) => fn(paused));
}

export function getStudyTrackerPaused(): boolean {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/break")) {
    return true;
  }
  return isTrackerPaused;
}

export function useStudyTrackerPaused(): boolean {
  const [paused, setPaused] = useState(() => getStudyTrackerPaused());
  useEffect(() => {
    const handler = (p: boolean) => setPaused(p);
    pauseListeners.add(handler);
    return () => {
      pauseListeners.delete(handler);
    };
  }, []);
  return paused;
}

interface DayData {
  [dateStr: string]: number; // date "YYYY-MM-DD" -> real minutes
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getUserStorageKey(userIdentifier?: string): string {
  if (!userIdentifier || !userIdentifier.trim()) {
    const guestId = typeof window !== "undefined" ? localStorage.getItem("quizzy_guest_id") : null;
    return guestId ? `quizzy_study_time_${guestId}` : "quizzy_study_time_guest";
  }
  const clean = userIdentifier.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `quizzy_study_time_${clean}`;
}

export function getStudyTimeMap(userIdentifier?: string): DayData {
  if (typeof window === "undefined") return {};
  try {
    // Purge legacy un-namespaced shared keys so they never leak between users
    if (localStorage.getItem(STORAGE_KEY)) localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem(OLD_STORAGE_KEY)) localStorage.removeItem(OLD_STORAGE_KEY);

    const key = getUserStorageKey(userIdentifier);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const timeListeners = new Set<() => void>();

export function subscribeStudyTime(fn: () => void) {
  timeListeners.add(fn);
  return () => {
    timeListeners.delete(fn);
  };
}

function notifyTimeListeners() {
  timeListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export function addStudyMinutes(minutes: number, userIdentifier?: string) {
  if (typeof window === "undefined" || minutes <= 0) return;
  try {
    const key = getUserStorageKey(userIdentifier);
    const map = getStudyTimeMap(userIdentifier);
    const today = getTodayStr();
    map[today] = Math.round((map[today] || 0) + minutes);
    localStorage.setItem(key, JSON.stringify(map));
    notifyTimeListeners();
    window.dispatchEvent(new Event("quizzy_study_time_updated"));
  } catch {}
}

/**
 * Synchronizes past exam study time from PostgreSQL database for the specific user.
 * Replaces any polluted state with the authoritative database record.
 */
export async function syncStudyTimeFromDatabase(userIdentifier?: string): Promise<DayData | null> {
  if (
    typeof window === "undefined" ||
    !userIdentifier ||
    !userIdentifier.trim() ||
    userIdentifier.trim().toLowerCase() === "guest scholar" ||
    userIdentifier.trim().toLowerCase() === "user"
  ) {
    return null;
  }
  try {
    const res = await fetch(`/api/quiz-reports/study-time?userName=${encodeURIComponent(userIdentifier.trim())}`);
    if (!res.ok) return null;
    const dbTimes = (await res.json()) as Record<string, number>;
    if (!dbTimes || typeof dbTimes !== "object") return null;

    const key = getUserStorageKey(userIdentifier);
    // Ground truth from database for this specific user
    const userMap: DayData = { ...dbTimes };

    // If this student accumulated active session minutes today, preserve the maximum for today
    const existingLocal = getStudyTimeMap(userIdentifier);
    const today = getTodayStr();
    if (existingLocal[today] && existingLocal[today] > (userMap[today] || 0)) {
      userMap[today] = existingLocal[today];
    }

    localStorage.setItem(key, JSON.stringify(userMap));
    notifyTimeListeners();
    window.dispatchEvent(new Event("quizzy_study_time_updated"));
    return userMap;
  } catch {
    return null;
  }
}

export function recordQuizSeconds(seconds: number, userIdentifier?: string) {
  if (seconds <= 0) return;
  // Convert seconds to minutes, minimum 1 minute if at least 20 seconds were spent
  const minutes = Math.max(seconds >= 20 ? 1 : 0, Math.round(seconds / 60));
  addStudyMinutes(minutes, userIdentifier);
}

export function useWeeklyStudyTimeData(userIdentifier?: string) {
  const [data, setData] = useState(() => ({
    weekly: getWeeklyStudyTime(userIdentifier),
    total: getTotalStudyMinutes(userIdentifier),
  }));

  // When userIdentifier changes or loads, immediately switch to their dataset and sync
  useEffect(() => {
    setData({
      weekly: getWeeklyStudyTime(userIdentifier),
      total: getTotalStudyMinutes(userIdentifier),
    });

    if (
      userIdentifier &&
      userIdentifier.trim().toLowerCase() !== "guest scholar" &&
      userIdentifier.trim().toLowerCase() !== "user"
    ) {
      syncStudyTimeFromDatabase(userIdentifier).then((syncedMap) => {
        if (syncedMap) {
          setData({
            weekly: getWeeklyStudyTime(userIdentifier),
            total: getTotalStudyMinutes(userIdentifier),
          });
        }
      });
    }
  }, [userIdentifier]);

  useEffect(() => {
    const update = () => {
      setData({
        weekly: getWeeklyStudyTime(userIdentifier),
        total: getTotalStudyMinutes(userIdentifier),
      });
    };
    const unsubscribe = subscribeStudyTime(update);
    window.addEventListener("storage", update);
    window.addEventListener("quizzy_study_time_updated", update);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", update);
      window.removeEventListener("quizzy_study_time_updated", update);
    };
  }, [userIdentifier]);

  return data;
}

export function getWeeklyStudyTime(userIdentifier?: string): { day: string; fullDate: string; minutes: number; hours: number }[] {
  const map = getStudyTimeMap(userIdentifier);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result = [];
  const today = new Date();

  // Last 7 days in chronological order
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayLabel = i === 0 ? "Today" : dayNames[d.getDay()];
    const mins = map[dateStr] || 0;
    result.push({
      day: dayLabel,
      fullDate: dateStr,
      minutes: mins,
      hours: Math.round((mins / 60) * 10) / 10,
    });
  }

  return result;
}

export function getTotalStudyMinutes(userIdentifier?: string): number {
  const map = getStudyTimeMap(userIdentifier);
  return Object.values(map).reduce((sum, m) => sum + (Number(m) || 0), 0);
}

/**
 * Hook to automatically track real active engagement time while the student is browsing/studying.
 * Pauses automatically when tab is hidden, backgrounded, or when the user enters the Break Zone.
 */
export function useRealStudyTracker(userIdentifier?: string) {
  useEffect(() => {
    let accumulatedSeconds = 0;
    const interval = setInterval(() => {
      const isBreak =
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/break") ||
          window.location.hash.includes("/break"));

      if (
        document.visibilityState === "visible" &&
        !isBreak &&
        !isTrackerPaused
      ) {
        accumulatedSeconds += 15;
        if (accumulatedSeconds >= 60) {
          addStudyMinutes(1, userIdentifier);
          accumulatedSeconds = 0;
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [userIdentifier]);
}
