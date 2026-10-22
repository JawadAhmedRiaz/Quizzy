/**
 * Real Study Time Tracker
 * Accurately measures actual active time spent learning and taking quizzes.
 * Zero mock or dummy data.
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

export function getStudyTimeMap(): DayData {
  if (typeof window === "undefined") return {};
  try {
    // Clear legacy mock seed key if it exists
    if (localStorage.getItem(OLD_STORAGE_KEY)) {
      localStorage.removeItem(OLD_STORAGE_KEY);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    const map: DayData = raw ? JSON.parse(raw) : {};
    return map;
  } catch {
    return {};
  }
}

export function addStudyMinutes(minutes: number) {
  if (typeof window === "undefined" || minutes <= 0) return;
  try {
    const map = getStudyTimeMap();
    const today = getTodayStr();
    map[today] = Math.round((map[today] || 0) + minutes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function recordQuizSeconds(seconds: number) {
  if (seconds <= 0) return;
  // Convert seconds to minutes, minimum 1 minute if at least 20 seconds were spent
  const minutes = Math.max(seconds >= 20 ? 1 : 0, Math.round(seconds / 60));
  addStudyMinutes(minutes);
}

export function getWeeklyStudyTime(): { day: string; fullDate: string; minutes: number; hours: number }[] {
  const map = getStudyTimeMap();
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

export function getTotalStudyMinutes(): number {
  const map = getStudyTimeMap();
  return Object.values(map).reduce((sum, m) => sum + (Number(m) || 0), 0);
}

/**
 * Hook to automatically track real active engagement time while the student is browsing/studying.
 * Pauses automatically when tab is hidden, backgrounded, or when the user enters the Break Zone.
 */
export function useRealStudyTracker() {
  useEffect(() => {
    let accumulatedSeconds = 0;
    const interval = setInterval(() => {
      // Check if user is currently in the Break Zone
      const isBreak =
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/break") ||
          window.location.hash.includes("/break"));

      // Only count if active, tab is visible, not on Break page, and tracker is not paused
      if (
        document.visibilityState === "visible" &&
        !isBreak &&
        !isTrackerPaused
      ) {
        accumulatedSeconds += 15;
        // Save every 60 seconds (1 real minute)
        if (accumulatedSeconds >= 60) {
          addStudyMinutes(1);
          accumulatedSeconds = 0;
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);
}
