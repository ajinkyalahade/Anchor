import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SESSION_EXPIRED_EVENT, refreshSession } from './lib/api';
import { applyTheme } from './lib/rewards';

import AuthGuard from './components/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import { Card } from './components/ui';

const HomePage = lazy(() => import('./pages/HomePage'));
const FocusPage = lazy(() => import('./pages/FocusPage'));
const GamesPage = lazy(() => import('./pages/GamesPage'));
const CalmPage = lazy(() => import('./pages/CalmPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const SharedReportPage = lazy(() => import('./pages/SharedReportPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const StructureHubPage = lazy(() => import('./pages/StructureHubPage'));
const EnergyQuestsPage = lazy(() => import('./pages/EnergyQuestsPage'));
const CoachPage = lazy(() => import('./pages/CoachPage'));
const BriefingPage = lazy(() => import('./pages/BriefingPage'));
const WeeklyInsightsPage = lazy(() => import('./pages/WeeklyInsightsPage'));
const LiveRoomsPage = lazy(() => import('./pages/LiveRoomsPage'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const NO_SIDEBAR_PATHS = ['/onboarding', '/login', '/auth/callback'];

function RouteBoundary({ children, pathname }: { children: ReactNode; pathname: string }) {
  return (
    <ErrorBoundary
      resetKey={pathname}
      title="That section hit a snag."
      body="Go back home and try another tool. Your other pages are still available."
    >
      {children}
    </ErrorBoundary>
  );
}

function RouteLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Card variant="glass" padding="lg" className="text-center max-w-xs">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-focus)]">Loading</p>
        <h2 className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">Pulling this into view…</h2>
      </Card>
    </div>
  );
}

function wrap(el: ReactNode, pathname: string) {
  return (
    <RouteBoundary pathname={pathname}>
      <Suspense fallback={<RouteLoader />}>{el}</Suspense>
    </RouteBoundary>
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  // Session expiry redirects in-app (no reload) so local state survives.
  useEffect(() => {
    const onExpired = () => navigate('/login', { replace: true, state: { sessionExpired: true } });
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate]);

  // Rotate the session token once per app load (SEC-5) — active users
  // slide forward; a stolen token dies at the owner's next visit.
  useEffect(() => {
    void refreshSession();
  }, []);

  const showSidebar =
    !NO_SIDEBAR_PATHS.includes(location.pathname) &&
    !location.pathname.startsWith('/shared');

  useEffect(() => {
    applyTheme(localStorage.getItem('anchor_active_theme'));
    if (localStorage.getItem('anchor_dyslexia_font') === 'true') {
      document.documentElement.classList.add('font-dyslexia');
    }
  }, []);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showSidebar ? '232px 1fr' : '1fr',
        minHeight: '100vh',
        maxWidth: '1440px',
        margin: '0 auto',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-[var(--paper)] focus:px-4 focus:py-3 focus:text-sm"
      >
        Skip to main content
      </a>

      {showSidebar && <Sidebar />}

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {isOffline && (
          <div style={{ padding: '8px 24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-3)', background: 'var(--bone-soft)', borderBottom: '1px solid var(--hairline)' }}>
            You're offline. Local tools still work.
          </div>
        )}

        <main
          id="main-content"
          style={{ flex: 1, overflowY: 'auto' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
              transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.4, 0, 0.2, 1] }}
              style={{ minHeight: '100%' }}
            >
              <Routes location={location}>
                <Route path="/login" element={wrap(<LoginPage />, location.pathname)} />
                <Route path="/auth/callback" element={wrap(<AuthCallbackPage />, location.pathname)} />
                <Route path="/onboarding" element={wrap(<OnboardingPage />, location.pathname)} />
                <Route path="/shared/:packetId" element={wrap(<SharedReportPage />, location.pathname)} />

                <Route element={<AuthGuard />}>
                  <Route path="/" element={wrap(<HomePage />, location.pathname)} />
                  <Route path="/focus" element={wrap(<FocusPage />, location.pathname)} />
                  <Route path="/games" element={wrap(<GamesPage />, location.pathname)} />
                  <Route path="/games/:gameId" element={wrap(<GamesPage />, location.pathname)} />
                  <Route path="/calm" element={wrap(<CalmPage />, location.pathname)} />
                  <Route path="/calm/:tool" element={wrap(<CalmPage />, location.pathname)} />
                  <Route path="/rooms" element={wrap(<LiveRoomsPage />, location.pathname)} />
                  <Route path="/structure" element={wrap(<StructureHubPage />, location.pathname)} />
                  <Route path="/structure/:section" element={wrap(<StructureHubPage />, location.pathname)} />
                  <Route path="/quests" element={wrap(<EnergyQuestsPage />, location.pathname)} />
                  <Route path="/coach" element={wrap(<CoachPage />, location.pathname)} />
                  <Route path="/ai/briefing" element={wrap(<BriefingPage />, location.pathname)} />
                  <Route path="/ai/insights" element={wrap(<WeeklyInsightsPage />, location.pathname)} />
                  <Route path="/me" element={wrap(<ProfilePage />, location.pathname)} />
                  <Route path="/me/settings" element={wrap(<SettingsPage />, location.pathname)} />
                </Route>
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary
          title="Anchor needs a quick reset."
          body="The app shell hit an unexpected error. Reload the page."
        >
          <AppLayout />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
