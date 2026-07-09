import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  // This page is no longer needed with email/password auth.
  // Redirect to login if someone lands here.
  useEffect(() => {
    const jwt = localStorage.getItem('anchor_jwt');
    if (jwt) {
      navigate('/');
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="flex flex-col min-h-[80vh] items-center justify-center p-6">
      <Card padding="lg" variant="surface" className="w-full max-w-md text-center py-12">
        <p className="text-[var(--color-text-muted)]">Redirecting...</p>
      </Card>
    </div>
  );
}
