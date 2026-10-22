import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@workspace/replit-auth-web";

const API = import.meta.env.BASE_URL + "api";

export interface UserProfile {
  userId: string;
  displayName: string | null;
  rollNumber: string | null;
  department: string | null;
  section: string | null;
  gender: string | null;
  xp: number;
  streakCount: number;
  streakLastDate: string | null;
  freezesAvailable: number;
  notificationsEnabled: boolean;
  isGuest: boolean;
}

interface GamificationData {
  xp: number;
  level: string;
  levelNext: number;
  levelCurrent: number;
  streakCount: number;
  badges: { badgeId: string; earnedAt: string }[];
  allBadges: { id: string; name: string; emoji: string; hint: string }[];
  recentXp: { amount: number; reason: string; createdAt: string }[];
}

interface UserContextValue {
  effectiveUserId: string | null;
  isGuest: boolean;
  isAdmin: boolean;
  profile: UserProfile | null;
  gamification: GamificationData | null;
  refreshProfile: () => Promise<void>;
  refreshGamification: () => Promise<void>;
  saveProfile: (data: Partial<UserProfile>) => Promise<void>;
  displayName: string;
  profileComplete: boolean;
}

function generateGuestId(): string {
  const existing = localStorage.getItem("quizzy_guest_id");
  if (existing) return existing;
  const id = "guest_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem("quizzy_guest_id", id);
  return id;
}

function getGuestDisplayName(): string | null {
  const first = localStorage.getItem("quizzy_guest_firstname");
  const surname = localStorage.getItem("quizzy_guest_surname");
  if (first && surname) return `${first} ${surname}`;
  if (first) return first;
  return null;
}

function getGuestGender(): string | null {
  return localStorage.getItem("quizzy_guest_gender");
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [guestId] = useState<string>(() => generateGuestId());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const effectiveUserId: string | null = isLoading ? null :
    isAuthenticated && user ? (user.id ?? user.email ?? null) :
    guestId;
  const isGuest = !isAuthenticated;

  useEffect(() => {
    if (!isAuthenticated || isLoading) { setIsAdmin(false); return; }
    fetch(`${API}/admin/check`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { isAdmin: false })
      .then(d => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [isAuthenticated, isLoading]);

  const refreshProfile = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const r = await fetch(`${API}/profile/${effectiveUserId}`);
      if (r.ok) {
        const data = await r.json();
        if (data) {
          setProfile(data);
        } else {
          const guestName = isGuest ? getGuestDisplayName() : null;
          const guestGender = isGuest ? getGuestGender() : null;
          const authName = isAuthenticated && user ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null : null;
          const created = await fetch(`${API}/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: effectiveUserId,
              displayName: guestName ?? authName,
              gender: guestGender,
              isGuest: !isAuthenticated,
            }),
          });
          if (created.ok) setProfile(await created.json());
        }
      }
    } catch {}
    setProfileLoaded(true);
  }, [effectiveUserId, isAuthenticated, user]);

  const refreshGamification = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const r = await fetch(`${API}/gamification/${effectiveUserId}`);
      if (r.ok) setGamification(await r.json());
    } catch {}
  }, [effectiveUserId]);

  const saveProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!effectiveUserId) return;
    try {
      const r = await fetch(`${API}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: effectiveUserId, ...data }),
      });
      if (r.ok) setProfile(await r.json());
    } catch {}
  }, [effectiveUserId]);

  const [guestVersion, setGuestVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setGuestVersion((v) => v + 1);
      refreshProfile();
    };
    window.addEventListener("quizzy_profile_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("quizzy_profile_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [refreshProfile]);

  useEffect(() => {
    if (effectiveUserId) {
      refreshProfile();
      refreshGamification();
    }
  }, [effectiveUserId, guestVersion]);

  const authDisplayName = isAuthenticated && user
    ? ([user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null)
    : null;

  const currentGuestName = isGuest ? getGuestDisplayName() : null;

  const displayName =
    authDisplayName ||
    (profile?.displayName && profile.displayName !== "Guest" ? profile.displayName : null) ||
    currentGuestName ||
    (isGuest ? "Guest Scholar" : "User");

  const profileComplete = !!(
    profile?.displayName && profile?.rollNumber && profile?.department && profile?.section && profile?.gender
  );

  return (
    <UserContext.Provider value={{ effectiveUserId, isGuest, isAdmin, profile, gamification, refreshProfile, refreshGamification, saveProfile, displayName, profileComplete }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
