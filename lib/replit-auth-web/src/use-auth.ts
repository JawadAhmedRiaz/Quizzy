import { createElement, createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error?: string; requireVerification?: boolean; email?: string }>;
  verifyEmail: (email: string, code: string) => Promise<{ error?: string; user?: AuthUser }>;
  resendVerificationCode: (email: string) => Promise<{ error?: string; message?: string }>;
  loginWithGoogle: (payload: { credential?: string; email?: string; firstName?: string; lastName?: string; profileImageUrl?: string }) => Promise<{ error?: string; user?: AuthUser }>;
  loginWithApple: (payload: { email: string; firstName?: string; lastName?: string }) => Promise<{ error?: string; user?: AuthUser }>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { user: AuthUser | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const loginWithEmail = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) return { error: data.error ?? "Login failed" };
      setUser(data.user ?? null);
      setIsAuthModalOpen(false);
      return {};
    } catch {
      return { error: "Network error. Please try again." };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string): Promise<{ error?: string; requireVerification?: boolean; email?: string }> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      const data = await res.json() as { user?: AuthUser; error?: string; requireVerification?: boolean; email?: string };
      if (!res.ok) return { error: data.error ?? "Registration failed" };
      if (data.requireVerification) {
        return { requireVerification: true, email: data.email || email };
      }
      setUser(data.user ?? null);
      setIsAuthModalOpen(false);
      return {};
    } catch {
      return { error: "Network error. Please try again." };
    }
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string): Promise<{ error?: string; user?: AuthUser }> => {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) return { error: data.error ?? "Verification failed" };
      setUser(data.user ?? null);
      setIsAuthModalOpen(false);
      return { user: data.user };
    } catch {
      return { error: "Network error. Please try again." };
    }
  }, []);

  const resendVerificationCode = useCallback(async (email: string): Promise<{ error?: string; message?: string }> => {
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) return { error: data.error ?? "Failed to resend code" };
      return { message: data.message };
    } catch {
      return { error: "Network error. Please try again." };
    }
  }, []);

  const loginWithGoogle = useCallback(async (payload: { credential?: string; email?: string; firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<{ error?: string; user?: AuthUser }> => {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) return { error: data.error ?? "Google sign-in failed" };
      setUser(data.user ?? null);
      setIsAuthModalOpen(false);
      return { user: data.user };
    } catch {
      return { error: "Network error during Google sign-in." };
    }
  }, []);

  const loginWithApple = useCallback(async (payload: { email: string; firstName?: string; lastName?: string }): Promise<{ error?: string; user?: AuthUser }> => {
    try {
      const res = await fetch("/api/auth/apple", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) return { error: data.error ?? "Apple sign-in failed" };
      setUser(data.user ?? null);
      setIsAuthModalOpen(false);
      return { user: data.user };
    } catch {
      return { error: "Network error during Apple sign-in." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}

    // Clear all guest session & dismissal flags so it asks to log in again
    try {
      localStorage.removeItem("quizzy_guest_continued");
      localStorage.removeItem("welcomeDismissed");
      localStorage.removeItem("quizzy_guest_id");
      localStorage.removeItem("quizzy_guest_firstname");
      localStorage.removeItem("quizzy_guest_surname");
      localStorage.removeItem("quizzy_guest_gender");
      sessionStorage.clear();
    } catch {}

    setUser(null);
    setIsAuthModalOpen(true);
    window.location.href = "/";
  }, []);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  return createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        isLoading,
        isAuthenticated: !!user,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        login: openAuthModal,
        logout,
        loginWithEmail,
        register,
        verifyEmail,
        resendVerificationCode,
        loginWithGoogle,
        loginWithApple,
        refresh: fetchUser,
      },
    },
    children
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAuthModalOpen: false,
      openAuthModal: () => {},
      closeAuthModal: () => {},
      login: () => {},
      logout: async () => {},
      loginWithEmail: async () => ({ error: "AuthProvider missing" }),
      register: async () => ({ error: "AuthProvider missing" }),
      verifyEmail: async () => ({ error: "AuthProvider missing" }),
      resendVerificationCode: async () => ({ error: "AuthProvider missing" }),
      loginWithGoogle: async () => ({ error: "AuthProvider missing" }),
      loginWithApple: async () => ({ error: "AuthProvider missing" }),
      refresh: async () => {},
    };
  }
  return ctx;
}
