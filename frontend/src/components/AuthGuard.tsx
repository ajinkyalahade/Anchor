import { Navigate, Outlet } from 'react-router-dom';
import { api } from '../lib/api';

export default function AuthGuard() {
  // Routing signal only — the session itself is an httpOnly cookie the
  // server validates. A stale flag just means one 401 → in-app redirect.
  if (!api.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
