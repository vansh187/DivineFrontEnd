import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../services/authApi';

const roleHome: Record<Role, string> = {
  customer: '/customer',
  broker: '/broker',
};

/** Redirects to "/" if signed out, or to the visitor's own role page if signed in under a different role. */
export function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { session } = useAuth();

  if (!session) return <Navigate to="/" replace />;
  if (session.role !== role) return <Navigate to={roleHome[session.role]} replace />;

  return <>{children}</>;
}
