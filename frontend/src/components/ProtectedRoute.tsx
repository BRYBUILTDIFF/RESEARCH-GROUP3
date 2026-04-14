import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser, getToken } from '../lib/auth';
import type { Role } from '../types/auth';

interface ProtectedRouteProps {
  allowedRole: Role;
  children: ReactElement;
}

export function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}
