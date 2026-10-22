import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch, useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import { useAuth, AuthProvider } from "@workspace/replit-auth-web";
import { ThemeProvider } from "@/context/ThemeContext";
import { QuizProvider } from "@/context/QuizContext";
import { UserProvider, useUser } from "@/context/UserContext";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { WelcomeModal } from "@/components/WelcomeModal";
import { ProfileCompletionPrompt } from "@/components/ProfileCompletionPrompt";
import { SplashScreen } from "@/components/SplashScreen";
import { TopProgressBar } from "@/components/TopProgressBar";
import { useRealStudyTracker } from "@/lib/studyTimeTracker";
import { HomePage } from "@/pages/HomePage";
import { QuizSetupPage } from "@/pages/QuizSetupPage";
import { QuizPage } from "@/pages/QuizPage";
import { ResultPage } from "@/pages/ResultPage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { VaultPage } from "@/pages/VaultPage";
import { ComparisonPage } from "@/pages/ComparisonPage";
import { BreakPage } from "@/pages/BreakPage";
import { RevisionPage } from "@/pages/RevisionPage";
import { FlaggedQuestionsPage } from "@/pages/FlaggedQuestionsPage";
import { ImportPage } from "@/pages/admin/ImportPage";
import { MCQBankPage } from "@/pages/admin/MCQBankPage";
import { AuditPage } from "@/pages/admin/AuditPage";
import { AdminFlagsPage } from "@/pages/admin/AdminFlagsPage";
import { SiteSettingsPage } from "@/pages/admin/SiteSettingsPage";
import { ContentSettingsPage } from "@/pages/admin/ContentSettingsPage";
import { AdminVaultPage } from "@/pages/admin/AdminVaultPage";
import { QuizConfigPage } from "@/pages/admin/QuizConfigPage";
import { FeedbacksPage } from "@/pages/admin/FeedbacksPage";

const API = import.meta.env.BASE_URL + "api";
const queryClient = new QueryClient();

function MaintenanceOverlay() {
  const { isAdmin } = useUser();
  const { isAuthenticated, openAuthModal, logout } = useAuth();
  const settings = useSettings();

  // Maintenance screen only blocks non-admin users AFTER they have logged in!
  // Logged-out users must be able to log in (especially admins).
  if (!settings.maintenanceEnabled || isAdmin || !isAuthenticated) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 text-center"
      style={{ background: "rgba(15,23,42,0.98)", backdropFilter: "blur(8px)" }}
    >
      <div className="text-6xl mb-6 animate-pulse">🔧</div>
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
        {settings.headerTitle} is Undergoing Maintenance
      </h1>
      <p className="text-sm max-w-md mb-6" style={{ color: "#94a3b8" }}>
        {settings.slogan || "We'll be back shortly. Thank you for your patience."}
      </p>

      <button
        onClick={async () => {
          await logout();
          openAuthModal();
        }}
        className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
        style={{
          background: "linear-gradient(135deg, #007aff, #2563eb)",
        }}
      >
        🔐 Log In as Admin / Switch Account
      </button>
    </div>
  );
}

function AppInner() {
  useRealStudyTracker();
  const [location] = useLocation();
  const { isAuthenticated, isLoading: authLoading, isAuthModalOpen, closeAuthModal } = useAuth();
  const { refreshProfile } = useUser();
  const [splashVisible, setSplashVisible] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [guestContinued, setGuestContinued] = useState(() => !!localStorage.getItem("quizzy_guest_continued"));

  // Track the last non-admin page so returning from admin restores the exact page
  useEffect(() => {
    if (location && !location.startsWith("/admin")) {
      sessionStorage.setItem("quizzy_last_student_page", location);
    }
  }, [location]);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) { setShowWelcome(false); return; }
    if (guestContinued) { setShowWelcome(false); return; }
    const dismissed = localStorage.getItem("welcomeDismissed");
    if (!dismissed) setShowWelcome(true);
  }, [authLoading, isAuthenticated, guestContinued]);

  function handleDismiss() {
    localStorage.setItem("welcomeDismissed", "1");
    setShowWelcome(false);
    closeAuthModal();
  }

  async function handleContinueAsGuest(firstName: string, surname: string, gender: string) {
    localStorage.setItem("quizzy_guest_firstname", firstName);
    localStorage.setItem("quizzy_guest_surname", surname);
    localStorage.setItem("quizzy_guest_gender", gender);
    localStorage.setItem("quizzy_guest_continued", "1");
    localStorage.setItem("welcomeDismissed", "1");
    setShowWelcome(false);
    closeAuthModal();
    setGuestContinued(true);

    const guestId = localStorage.getItem("quizzy_guest_id");
    if (guestId) {
      try {
        await fetch(`${API}/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: guestId, displayName: `${firstName} ${surname}`, gender, isGuest: true }),
        });
      } catch {}
    }
    await refreshProfile();
    window.dispatchEvent(new Event("quizzy_profile_updated"));
  }

  return (
    <>
      <AnimatePresence>
        {splashVisible && (
          <SplashScreen
            minDurationMs={1200}
            onFinish={() => setSplashVisible(false)}
          />
        )}
      </AnimatePresence>

      <div
        className="w-full min-h-screen transition-opacity duration-300"
        style={{
          opacity: splashVisible ? 0 : 1,
          visibility: splashVisible ? "hidden" : "visible",
        }}
      >
        <TopProgressBar />
        <MaintenanceOverlay />
        <div className="quiz-bg" />
        <Switch>
          {/* Admin routes */}
          <Route path="/admin/site-settings" component={SiteSettingsPage} />
          <Route path="/admin/settings"      component={SiteSettingsPage} />
          <Route path="/admin/content"       component={ContentSettingsPage} />
          <Route path="/admin/vault"         component={AdminVaultPage} />
          <Route path="/admin/import"        component={ImportPage} />
          <Route path="/admin/mcq-bank"      component={MCQBankPage} />
          <Route path="/admin/quiz-config"   component={QuizConfigPage} />
          <Route path="/admin/flags"         component={AdminFlagsPage} />
          <Route path="/admin/feedbacks"     component={FeedbacksPage} />
          <Route path="/admin/audit"         component={AuditPage} />
          {/* Student routes */}
          <Route path="/"                         component={DashboardPage} />
          <Route path="/dashboard"                component={DashboardPage} />
          <Route path="/study"                    component={HomePage} />
          <Route path="/quiz/:quizId/setup"       component={QuizSetupPage} />
          <Route path="/quiz/:quizId/play"        component={QuizPage} />
          <Route path="/quiz/:quizId/result"      component={ResultPage} />
          <Route path="/quiz/:quizId/leaderboard" component={LeaderboardPage} />
          <Route path="/analytics"  component={AnalyticsPage} />
          <Route path="/profile"    component={ProfilePage} />
          <Route path="/vault"      component={VaultPage} />
          <Route path="/revision"   component={RevisionPage} />
          <Route path="/comparison" component={ComparisonPage} />
          <Route path="/break"      component={BreakPage} />
          <Route path="/flagged"    component={FlaggedQuestionsPage} />
          <Route component={DashboardPage} />
        </Switch>
        <WelcomeModal
          show={(!splashVisible && showWelcome) || isAuthModalOpen}
          onDismiss={handleDismiss}
          onLogin={() => {
            setShowWelcome(false);
            closeAuthModal();
          }}
          onContinueAsGuest={handleContinueAsGuest}
        />
        <ProfileCompletionPrompt />
      </div>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <UserProvider>
            <SettingsProvider>
              <QuizProvider>
                <Router>
                  <AppInner />
                </Router>
              </QuizProvider>
            </SettingsProvider>
          </UserProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
