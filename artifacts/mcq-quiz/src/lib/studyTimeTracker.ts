/**
 * Real Study Time Tracker
 * Accurately measures actual active time spent learning and taking quizzes.
 * Scoped strictly per-user so that each student's profile displays only their own study time.
 */
import { useEffect, useState, useRef } from "react";

const STORAGE_KEY = "quizzy_real_study_time_by_day";
const OLD_STORAGE_KEY = "quizzy_study_time_by_day";

let isTrackerPaused = false;
const pauseListeners = new Set<(paused: boolean) => void>();

export function setStudyTrackerPaused(paused: boolean) {
  isTrackerPaused = paused;
  pauseListeners.forEach((fn) => fn(paused));
}

export function getStudyTrackerPaused(): boolean {
  if (typeof window !== "undefined") {
    const p = window.location.pathname;
    if (p.startsWith("/break") || p.startsWith("/quiz")) {
      return true;
    }
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

export function getClientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi";
  } catch {
    return "Asia/Karachi";
  }
}

export function getDateStringForTimezone(d: Date, tz = getClientTimeZone()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

interface DayData {
  [dateStr: string]: number; // date "YYYY-MM-DD" -> real minutes
}

function getTodayStr(): string {
  return getDateStringForTimezone(new Date());
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
 * Synchronizes verified past exam study time from PostgreSQL database for the specific user.
 * Reconciles server recorded exam time with local active browsing without blind destructive replacement.
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
    const tz = getClientTimeZone();
    const res = await fetch(
      `/api/quiz-reports/study-time?userName=${encodeURIComponent(userIdentifier.trim())}&timeZone=${encodeURIComponent(tz)}`
    );
    if (!res.ok) return null;
    const dbTimes = (await res.json()) as Record<string, number>;
    if (!dbTimes || typeof dbTimes !== "object") return null;

    const key = getUserStorageKey(userIdentifier);
    const existingLocal = getStudyTimeMap(userIdentifier);

    // Reconcile: merge server exam time with local browsing time safely
    const userMap: DayData = { ...existingLocal };
    for (const [dateStr, dbMins] of Object.entries(dbTimes)) {
      if (typeof dbMins === "number" && dbMins > 0) {
        userMap[dateStr] = Math.max(userMap[dateStr] || 0, dbMins);
      }
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
  const now = new Date();
  const tz = getClientTimeZone();

  // Last 7 days in chronological order up to Today in the user's timezone
  for (let i = 6; i >= 0; i--) {
    const target = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = getDateStringForTimezone(target, tz);
    const dayLabel = i === 0 ? "Today" : dayNames[target.getDay()];
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
 * Features:
 * 1. Automatically pauses when tab is hidden or backgrounded.
 * 2. 2-minute inactivity timeout (user activity resets idle timer).
 * 3. Excludes `/break` and `/quiz` routes (quiz time is measured directly on completion to prevent double counting).
 * 4. Multi-tab coordination via leader heartbeat so multiple open tabs do not inflate time.
 */
export function useRealStudyTracker(userIdentifier?: string) {
  const tabIdRef = useRef<string>("");
  if (!tabIdRef.current) {
    tabIdRef.current = "tab_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  useEffect(() => {
    const tabId = tabIdRef.current;
    let accumulatedSeconds = 0;
    let lastActivityTime = Date.now();

    const onUserActivity = () => {
      lastActivityTime = Date.now();
    };

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activityEvents.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));

    const LEADER_KEY = "quizzy_study_tracker_leader_tab";
    const HEARTBEAT_KEY = "quizzy_study_tracker_leader_ts";

    const interval = setInterval(() => {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      const isExcluded = pathname.startsWith("/break") || pathname.startsWith("/quiz");

      // Inactivity timeout: 2 minutes (120,000ms)
      const isIdle = Date.now() - lastActivityTime > 120_000;

      // Tab coordination: only 1 tab acts as leader to prevent multi-tab multiplication
      const now = Date.now();
      const currentLeader = localStorage.getItem(LEADER_KEY);
      const lastHeartbeat = Number(localStorage.getItem(HEARTBEAT_KEY) || 0);
      const isLeaderDead = now - lastHeartbeat > 25_000;
      const isLeader = currentLeader === tabId || isLeaderDead || !currentLeader;

      if (isLeader) {
        localStorage.setItem(LEADER_KEY, tabId);
        localStorage.setItem(HEARTBEAT_KEY, String(now));
      } else {
        // Another active tab is tracking time; do not double count in this tab
        return;
      }

      if (
        document.visibilityState === "visible" &&
        !isExcluded &&
        !isTrackerPaused &&
        !isIdle
      ) {
        accumulatedSeconds += 15;
        if (accumulatedSeconds >= 60) {
          addStudyMinutes(1, userIdentifier);
          accumulatedSeconds = 0;
        }
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      activityEvents.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      if (localStorage.getItem(LEADER_KEY) === tabId) {
        localStorage.removeItem(LEADER_KEY);
      }
    };
  }, [userIdentifier]);
}
