import React, { Suspense, lazy } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SemesterProvider } from './contexts/SemesterContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './contexts/ConfirmContext';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './index.css';

// Hooks
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useHaptics } from './hooks/useHaptics';

// Layout
import AppLayout from './components/layout/AppLayout';
import PageTransition from './components/ui/PageTransition';

// Lazy Load All Pages for optimal code splitting
const Landing     = lazy(() => import('./pages/Landing'));
const Login       = lazy(() => import('./pages/Login'));
const Dashboard   = lazy(() => import('./pages/Dashboard'));
const Settings    = lazy(() => import('./pages/Settings'));
const Analytics   = lazy(() => import('./pages/Analytics.tsx'));
const Calendar    = lazy(() => import('./pages/Calendar.tsx'));
const TimeTable   = lazy(() => import('./pages/TimeTable.tsx'));
const Courses     = lazy(() => import('./pages/Courses.tsx'));
const Practicals  = lazy(() => import('./pages/Practicals.tsx'));
const Notes       = lazy(() => import('./pages/Notes.tsx'));
const Results     = lazy(() => import('./pages/Results.tsx'));
const PrivacyPolicy  = lazy(() => import('./pages/PrivacyPolicy.tsx'));
const TermsOfService = lazy(() => import('./pages/TermsOfService.tsx'));
const NotFound       = lazy(() => import('./pages/NotFound.tsx'));
const SkillTracker   = lazy(() => import('./pages/SkillTracker.tsx'));
const Notifications  = lazy(() => import('./pages/Notifications.tsx'));

// ── Route Guards ─────────────────────────────────────────────────────────────

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

// Suspense fallback used for every lazily-loaded page
const PageFallback = <LoadingSpinner fullScreen />;

// ── Main App Routes ───────────────────────────────────────────────────────────

const AppRoutes: React.FC = () => {
  return (
    <Routes>

      {/* ── Public Routes ──────────────────────────────────── */}
      <Route
        path="/"
        element={
          <Suspense fallback={PageFallback}>
            <PageTransition>
              <Landing />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Suspense fallback={PageFallback}>
              <PageTransition>
                <Login />
              </PageTransition>
            </Suspense>
          </PublicRoute>
        }
      />

      {/* ── Legal Pages ────────────────────────────────────── */}
      <Route
        path="/privacy"
        element={
          <Suspense fallback={PageFallback}>
            <PageTransition>
              <PrivacyPolicy />
            </PageTransition>
          </Suspense>
        }
      />
      <Route
        path="/terms"
        element={
          <Suspense fallback={PageFallback}>
            <PageTransition>
              <TermsOfService />
            </PageTransition>
          </Suspense>
        }
      />

      {/* ── 404 (outside AppLayout) ────────────────────────── */}
      <Route
        path="/404"
        element={
          <Suspense fallback={PageFallback}>
            <PageTransition>
              <NotFound />
            </PageTransition>
          </Suspense>
        }
      />

      {/* ── Protected Routes inside App Shell ──────────────── */}
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Dashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Analytics />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/timetable"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <TimeTable />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Calendar />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Courses />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practicals"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Practicals />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Settings />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Notes />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Results />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/skills"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <SkillTracker />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Suspense fallback={PageFallback}>
                <Notifications />
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Route>

      {/* ── Catch-all → 404 ────────────────────────────────── */}
      <Route
        path="*"
        element={
          <Suspense fallback={PageFallback}>
            <PageTransition>
              <NotFound />
            </PageTransition>
          </Suspense>
        }
      />

    </Routes>
  );
};

// ── Keyboard Shortcuts (needs BrowserRouter context) ─────────────────────────

const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useKeyboardShortcuts();
  return <>{children}</>;
};

// ── App Content ───────────────────────────────────────────────────────────────

const AppContent: React.FC = () => {
  useAutoUpdate();
  useHaptics();

  return (
    <div className="min-h-screen bg-background text-on-background font-sans transition-colors duration-300 selection:bg-primary-container selection:text-primary">
      <AppRoutes />
      {import.meta.env.PROD && !['localhost', '127.0.0.1'].includes(window.location.hostname) && <VercelAnalytics />}
    </div>
  );
};

// ── Root App ──────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'missing-client-id';

const App: React.FC = () => {
  if (GOOGLE_CLIENT_ID === 'missing-client-id') {
    console.warn('Missing VITE_GOOGLE_CLIENT_ID. Google Login will not work. Please configure the frontend environment before starting the app.');
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <SemesterProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    <ErrorBoundary>
                      <KeyboardShortcutsProvider>
                        <AppContent />
                      </KeyboardShortcutsProvider>
                    </ErrorBoundary>
                  </ConfirmProvider>
                </ToastProvider>
              </SemesterProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
