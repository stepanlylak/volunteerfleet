import { Navigate } from 'react-router-dom';
import type { Role } from '@volunteerfleet/shared';
import { useAuth } from '../../stores/auth.store';

export function RoleGuard({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const user = useAuth((s) => s.user);

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.userRole)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
