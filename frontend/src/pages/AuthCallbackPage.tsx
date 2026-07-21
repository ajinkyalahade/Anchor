import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';
import { api } from '../lib/api';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  // This page is no longer needed with email/password auth.
  // Redirect to login if someone lands here.
  useEffect(() => {
    navigate(api.isAuthenticated() ? '/' : '/login');
  }, [navigate]);

  return (
    <div className="flex flex-col min-h-[80vh] items-center justify-center p-6">
      <Card padding="lg" variant="surface" className="w-full max-w-md text-center py-12">
        <p className="text-[var(--color-text-muted)]">Redirecting...</p>
      </Card>
    </div>
  );
}
