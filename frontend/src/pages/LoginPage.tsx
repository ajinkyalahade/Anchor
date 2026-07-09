import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Eye, EyeOff } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { api, ApiError } from '../lib/api';

type Mode = 'login' | 'register';

interface AuthResponse {
  status: string;
  user_id: string;
  access_token: string;
  first_name?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const body =
        mode === 'register'
          ? { email, first_name: firstName, last_name: lastName, password }
          : { email, password };
      const response = await api.post<AuthResponse>(endpoint, body);

      api.setAuthToken(response.access_token);
      localStorage.setItem('anchor_user_id', response.user_id);
      if (response.first_name) localStorage.setItem('anchor_first_name', response.first_name);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail);
      } else {
        setErrorMessage('We hit a snag. Please try again in a moment.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isValid =
    email.includes('@') &&
    password.length >= 6 &&
    (mode === 'login' || (firstName.trim().length > 0 && lastName.trim().length > 0));

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent-focus) 20%, var(--color-bg-surface)), var(--color-bg-surface))',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid color-mix(in srgb, var(--color-accent-focus) 16%, transparent)',
            }}
          >
            <Anchor size={28} strokeWidth={2} style={{ color: 'var(--color-accent-focus)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {mode === 'login' ? 'Sign in to your Anchor' : 'Start your journey with Anchor'}
            </p>
          </div>
        </div>

        <Card padding="lg" variant="surface" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label htmlFor="login-first-name" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      First name
                    </label>
                    <input
                      id="login-first-name"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First"
                      autoComplete="given-name"
                      className="w-full bg-[var(--color-bg-surface-2)] border border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-focus)] transition-all text-[var(--color-text-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="login-last-name" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      Last name
                    </label>
                    <input
                      id="login-last-name"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last"
                      autoComplete="family-name"
                      className="w-full bg-[var(--color-bg-surface-2)] border border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-focus)] transition-all text-[var(--color-text-primary)]"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-[var(--color-bg-surface-2)] border border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-focus)] transition-all text-[var(--color-text-primary)]"
                required
              />
            </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full bg-[var(--color-bg-surface-2)] border border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-focus)] transition-all text-[var(--color-text-primary)]"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode === 'register' && password.length > 0 && password.length < 6 && (
                <p className="text-xs text-[var(--color-accent-warm)] mt-1.5">
                  Password must be at least 6 characters
                </p>
              )}
            </div>

            {errorMessage && (
              <div className="text-red-500 text-sm p-3 bg-red-500/10 rounded-lg">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              disabled={!isValid}
              className="mt-2"
            >
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setErrorMessage('');
                }}
                className="font-medium text-[var(--color-accent-focus)] hover:underline"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
