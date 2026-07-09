import { Navigate, Outlet } from 'react-router-dom';

export default function AuthGuard() {
  const token = localStorage.getItem('anchor_jwt');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Ideally, we'd also decode the JWT here to check expiration,
  // but if it's expired, the API will return 401 and redirect to /login anyway.

  return <Outlet />;
}
