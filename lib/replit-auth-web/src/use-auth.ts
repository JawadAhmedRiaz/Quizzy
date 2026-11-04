import {
  createElement,
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useUser as useClerkUser, useClerk } from "@clerk/clerk-react";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: () => void;
  logout: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<{ error?: string; requireVerification?: boolean; email?: string }>;
  verifyEmail: (email: string, code: string) => Promise<{ error?: string; user?: AuthUser }>;
  resendVerificationCode: (email: string) => Promise<{ error?: string; message?: string }>;
  loginWithGoogle: (payload: any) => Promise<{ error?: string; user?: AuthUser }>;
  loginWithApple: (payload: any) => Promise<{ error?: string; user?: AuthUser }>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useClerkUser();
  const { openSignIn, signOut } = useClerk();

  const [backendUser, setBackendUser] = useState<AuthUser | null>(null);
  const [backendLoading, setBackendLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Sync session with backend to get the mapped internal UUID/ID
  const syncWithBackend = useCallback(async () => {
    if (!isSignedIn) {
      setBackendUser(null);
      setBackendLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { user: AuthUser | null };
        if (data.user) {
          setBackendUser(data.user);
          setBackendLoading(false);
          return;
        }
      }
    } catch {
      // Ignore
    }

    if (clerkUser) {
      setBackendUser({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || null,
        firstName: clerkUser.firstName || null,
        lastName: clerkUser.lastName || null,
        profileImageUrl: clerkUser.imageUrl || null,
      });
    } else {
      setBackendUser(null);
    }
    setBackendLoading(false);
  }, [clerkUser, isSignedIn]);

  useEffect(() => {
    if (clerkLoaded) {
      syncWithBackend();
    }
  }, [clerkLoaded, isSignedIn, syncWithBackend]);

  const openAuthModal = useCallback(() => {
    if (openSignIn) {
      openSignIn();
    } else {
      setIsAuthModalOpen(true);
    }
  }, [openSignIn]);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const login = useCallback(() => {
    openAuthModal();
  }, [openAuthModal]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}

    // Clear guest persistence markers so logout strictly returns to login state
    try {
      localStorage.removeItem("quizzy_guest_continued");
      localStorage.removeItem("quizzy_guest_id");
      localStorage.removeItem("quizzy_guest_firstname");
      localStorage.removeItem("quizzy_guest_surname");
      localStorage.removeItem("quizzy_guest_gender");
      localStorage.removeItem("welcomeDismissed");
    } catch {}

    if (signOut) {
      await signOut();
    }
    setBackendUser(null);
    window.dispatchEvent(new Event("quizzy_profile_updated"));
  }, [signOut]);

  const refresh = useCallback(async () => {
    await syncWithBackend();
  }, [syncWithBackend]);

  const value: AuthContextType = {
    user: backendUser,
    isLoading: !clerkLoaded || backendLoading,
    isAuthenticated: !!isSignedIn,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    login,
    logout,
    loginWithEmail: async () => {
      openAuthModal();
      return {};
    },
    register: async () => {
      openAuthModal();
      return {};
    },
    verifyEmail: async () => ({ error: "Verification handled through Clerk" }),
    resendVerificationCode: async () => ({ error: "Handled through Clerk" }),
    loginWithGoogle: async () => {
      openAuthModal();
      return {};
    },
    loginWithApple: async () => {
      openAuthModal();
      return {};
    },
    refresh,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
