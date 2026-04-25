import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { UserLayout } from './layouts/UserLayout';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminModulesPage } from './pages/admin/AdminModulesPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { ModuleViewerPage } from './pages/user/ModuleViewerPage';
import { QuizPage } from './pages/user/QuizPage';
import { UserDashboardPage } from './pages/user/UserDashboardPage';
import { UserModulesPage } from './pages/user/UserModulesPage';
import { UserProfilePage } from './pages/user/UserProfilePage';
import { UserProgressPage } from './pages/user/UserProgressPage';
import { clearTheme } from './lib/theme';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (!location.pathname.startsWith('/user')) {
      clearTheme();
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="modules" element={<AdminModulesPage />} />
        <Route path="trainees" element={<AdminUsersPage />} />
        <Route path="users" element={<Navigate to="/admin/trainees" replace />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      <Route
        path="/user"
        element={
          <ProtectedRoute allowedRole="user">
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<UserDashboardPage />} />
        <Route path="modules" element={<UserModulesPage />} />
        <Route path="modules/:moduleId" element={<ModuleViewerPage />} />
        <Route path="quizzes/:quizId" element={<QuizPage />} />
        <Route path="progress" element={<UserProgressPage />} />
        <Route path="profile" element={<UserProfilePage />} />
        <Route index element={<Navigate to="/user/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
