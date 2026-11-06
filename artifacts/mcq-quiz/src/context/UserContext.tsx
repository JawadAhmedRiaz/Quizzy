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
  semester?: number | null;
  xp: number;
  streakCount: number;
  streakLastDate: string | null;
  freezesAvailable: number;
  notificationsEnabled: boolean;
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
  isAdmin: boolean;
  profile: UserProfile | null;
  gamification: GamificationData | null;
  refreshProfile: () => Promise<void>;
  refreshGamification: () => Promise<void>;
  saveProfile: (data: Partial<UserProfile>) => Promise<{ ok: boolean; error?: string }>;
  displayName: string;
  profileComplete: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const effectiveUserId: string | null = isLoading
    ? null
    : isAuthenticated && user
    ? (user.id ?? user.email ?? null)
    : null;

  useEffect(() => {
    if (!isAuthenticated || isLoading) {
      setIsAdmin(false);
      return;
    }
    fetch(`${API}/admin/check`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((d) => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [isAuthenticated, isLoading]);

  const refreshProfile = useCallback(async () => {
    if (!effectiveUserId) {
      setProfile(null);
      setProfileLoaded(true);
      return;
    }
    try {
      const r = await fetch(`${API}/profile/${effectiveUserId}`);
      if (r.ok) {
        const data = await r.json();
        if (data) {
          setProfile(data);
        }
      }
    } catch {}
    setProfileLoaded(true);
  }, [effectiveUserId]);

  const refreshGamification = useCallback(async () => {
    if (!effectiveUserId) {
      setGamification(null);
      return;
    }
    try {
      const r = await fetch(`${API}/gamification/${effectiveUserId}`);
      if (r.ok) setGamification(await r.json());
    } catch {}
  }, [effectiveUserId]);

  const saveProfile = useCallback(
    async (data: Partial<UserProfile>): Promise<{ ok: boolean; error?: string }> => {
      if (!effectiveUserId) return { ok: false, error: "No user session" };
      try {
        const r = await fetch(`${API}/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: effectiveUserId, ...data }),
        });
        if (r.ok) {
          setProfile(await r.json());
          return { ok: true };
        } else {
          const errJson = await r.json().catch(() => ({}));
          return { ok: false, error: errJson.error || "Failed to save profile" };
        }
      } catch (e: any) {
        return { ok: false, error: e?.message || "Failed to save profile" };
      }
    },
    [effectiveUserId],
  );

  useEffect(() => {
    const handleUpdate = () => {
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
    } else {
      setProfile(null);
      setGamification(null);
    }
  }, [effectiveUserId, refreshProfile, refreshGamification]);

  const authDisplayName =
    isAuthenticated && user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null
      : null;

  const profileDisplayName =
    profile?.displayName && profile.displayName.trim() && profile.displayName !== "Guest"
      ? profile.displayName.trim()
      : null;

  const displayName =
    profileDisplayName ||
    authDisplayName ||
    (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Student");

  const profileComplete = !!(
    profile?.displayName &&
    profile?.rollNumber &&
    profile?.department &&
    profile?.section &&
    profile?.gender
  );

  return (
    <UserContext.Provider
      value={{
        effectiveUserId,
        isAdmin,
        profile,
        gamification,
        refreshProfile,
        refreshGamification,
        saveProfile,
        displayName,
        profileComplete,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
