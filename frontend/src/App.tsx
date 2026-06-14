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

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

// Layout
import AppLayout from './components/layout/AppLayout';

// Lazy Load Heavy Pages
const Analytics = lazy(() => import('./pages/Analytics.tsx'));
const Calendar = lazy(() => import('./pages/Calendar.tsx'));
const TimeTable = lazy(() => import('./pages/TimeTable.tsx'));
const Courses = lazy(() => import('./pages/Courses.tsx'));
const Practicals = lazy(() => import('./pages/Practicals.tsx'));
const Notes = lazy(() => import('./pages/Notes.tsx'));
const Results = lazy(() => import('./pages/Results.tsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.tsx'));
const TermsOfService = lazy(() => import('./pages/TermsOfService.tsx'));
const NotFound = lazy(() => import('./pages/NotFound.tsx'));

const SkillTracker = lazy(() => import('./pages/SkillTracker.tsx'));
const Notifications = lazy(() => import('./pages/Notifications.tsx'));


// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirect if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return !isAuthenticated ? children : <Navigate to="/" replace />;
};

// Main App Routes
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Public Legal Pages */}
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <PrivacyPolicy />
          </Suspense>
        }
      />
      <Route
        path="/terms"
        element={
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <TermsOfService />
          </Suspense>
        }
      />

      {/* Protected Routes (Wrapped in App Layout) */}
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      <Route
        path="/404"
        element={
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <NotFound />
          </Suspense>
        }
      />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <Analytics />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/timetable"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <TimeTable />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <Calendar />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <Courses />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practicals"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <Practicals />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <Notes />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <Results />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/skills"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <SkillTracker />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <Notifications />
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Default redirect */}
      <Route
        path="*"
        element={
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
  );
};

// Keyboard shortcuts wrapper - must be inside BrowserRouter
const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useKeyboardShortcuts();
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  useAutoUpdate(); // Automatically check for updates and reload if needed
  useHaptics(); // Add haptic feedback to every click and interaction

  return (
    <div className="min-h-screen bg-background text-on-background font-sans transition-colors duration-300 selection:bg-primary-container selection:text-primary">
      <AppRoutes />
      {import.meta.env.PROD && !['localhost', '127.0.0.1'].includes(window.location.hostname) && <VercelAnalytics />}
    </div>
  );
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'missing-client-id'

const App: React.FC = () => {
  if (GOOGLE_CLIENT_ID === 'missing-client-id') {
    console.warn('Missing VITE_GOOGLE_CLIENT_ID. Google Login will not work. Please configure the frontend environment before starting the app.')
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
