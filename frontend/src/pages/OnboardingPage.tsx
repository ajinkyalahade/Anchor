import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  CloudRain,
  Crosshair,
  ArrowRight,
  Clock,
  CheckCircle,
  Brain,
  Menu,
  Sparkles,
} from 'lucide-react';
import { Button, Card } from '../components/ui';
import AnchorWordmark from '../components/AnchorWordmark';
import { api, ApiError } from '../lib/api';
import confetti from 'canvas-confetti';

type Step = 'welcome' | 'tags' | 'crash' | 'email' | 'tour' | 'done' | 'nav';
const ALL_STEPS: Step[] = ['welcome', 'tags', 'crash', 'email', 'tour', 'done', 'nav'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OnboardingResponse {
  user_id: string;
  profile_id: string;
  access_token: string;
  status: string;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(() => (localStorage.getItem('anchor_onboarding_step') as Step) || 'welcome');
  const [tags, setTags] = useState<string[]>(() => JSON.parse(localStorage.getItem('anchor_onboarding_tags') || '[]'));
  const [crashWindow, setCrashWindow] = useState<string>(() => localStorage.getItem('anchor_onboarding_crash') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('anchor_onboarding_email') || '');
  const [firstName, setFirstName] = useState(() => localStorage.getItem('anchor_onboarding_first_name') || '');
  const [lastName, setLastName] = useState(() => localStorage.getItem('anchor_onboarding_last_name') || '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const stepIndex = ALL_STEPS.indexOf(step);
  const zoneCards = [
    {
      title: 'Focus Zone',
      body: 'Decompose tasks. Block your time.',
      icon: Crosshair,
      color: 'var(--color-accent-focus)',
    },
    {
      title: 'Recharge Zone',
      body: 'Breathe. Ground. Reset when you crash.',
      icon: CloudRain,
      color: 'var(--color-accent-calm)',
    },
    {
      title: 'Brain Train',
      body: '7 games to sharpen your focus.',
      icon: Brain,
      color: 'var(--color-accent-spark)',
    },
    {
      title: 'My Space',
      body: 'Track your XP. Talk to your coach.',
      icon: Bot,
      color: 'var(--color-accent-lilac)',
    },
  ] as const;
  const navSections = [
    { label: 'TODAY', body: 'One place to begin.', color: 'var(--color-accent-focus)' },
    { label: 'FOCUS', body: 'Tasks and structure.', color: 'var(--color-accent-focus)' },
    { label: 'RECHARGE', body: 'Calm tools and quests.', color: 'var(--color-accent-calm)' },
    { label: 'BRAIN TRAIN', body: 'All seven games.', color: 'var(--color-accent-spark)' },
    { label: 'MY SPACE', body: 'Progress, coach, settings.', color: 'var(--color-accent-lilac)' },
  ] as const;

  // Persistence
  useEffect(() => {
    if (step !== 'done') {
      localStorage.setItem('anchor_onboarding_step', step);
      localStorage.setItem('anchor_onboarding_tags', JSON.stringify(tags));
      localStorage.setItem('anchor_onboarding_crash', crashWindow);
      localStorage.setItem('anchor_onboarding_email', email);
      localStorage.setItem('anchor_onboarding_first_name', firstName);
      localStorage.setItem('anchor_onboarding_last_name', lastName);
    } else {
      // Clear persistence when finished
      localStorage.removeItem('anchor_onboarding_step');
      localStorage.removeItem('anchor_onboarding_tags');
      localStorage.removeItem('anchor_onboarding_crash');
      localStorage.removeItem('anchor_onboarding_email');
      localStorage.removeItem('anchor_onboarding_first_name');
      localStorage.removeItem('anchor_onboarding_last_name');
    }
  }, [step, tags, crashWindow, email, firstName, lastName]);

  useEffect(() => {
    if (step === 'done') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: [
          'rgb(156 138 194)',
          'rgb(127 179 163)',
          'rgb(224 164 88)',
        ],
      });
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'done') {
      return undefined;
    }

    const timeout = window.setTimeout(() => setStep('nav'), 1200);
    return () => window.clearTimeout(timeout);
  }, [step]);

  useEffect(() => {
    if (step !== 'nav') {
      return undefined;
    }

    const timeout = window.setTimeout(() => navigate('/'), 4000);
    return () => window.clearTimeout(timeout);
  }, [navigate, step]);

  // Check if already logged in -> skip onboarding
  useEffect(() => {
    if (api.isAuthenticated()) {
      navigate('/');
    }
  }, [navigate]);



  const toggleTag = (tag: string) => {
    setTags((prev) => 
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const emailIsValid = EMAIL_PATTERN.test(email.trim());
  const showEmailError = email.length > 0 && !emailIsValid;

  const submitOnboarding = async (skipEmail = false) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const body: Record<string, unknown> = {
        deficit_tags: tags,
        crash_window: crashWindow,
        vibe_pref: 'gentle',
      };

      if (!skipEmail && email && password) {
        body.first_name = firstName;
        body.last_name = lastName;
        body.email = email;
        body.password = password;
      }

      const response = await api.post<OnboardingResponse>('/onboarding', body);
      window.localStorage.setItem('anchor_user_id', response.user_id);
      api.setAuthToken(response.access_token);

      setStep('tour');
    } catch (e) {
      const detail = e instanceof ApiError ? e.detail : null;
      if (detail) {
        setSubmitError(detail);
      } else {
        console.error(e);
        setStep('tour');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const finishTour = () => {
    setStep('done');
  };

  const renderDots = () => {
    if (step === 'welcome' || step === 'done') return null;
    return (
      <div
        className="flex justify-center gap-2 mb-8"
        role="img"
        aria-label={`Step ${Math.min(stepIndex, 4)} of 4`}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              stepIndex >= i ? 'bg-[var(--color-accent-focus)] scale-110' : 'bg-[var(--color-text-muted)] opacity-30'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg-canvas)] px-5 pt-12 pb-8 max-w-lg mx-auto w-full">
      {renderDots()}
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
          >
            <AnchorWordmark className="w-full max-w-[280px]" />
            <div>
              <p className="text-[var(--color-text-muted)] text-lg">
                Your brain's starting block.
              </p>
            </div>
            <div className="w-full pt-8">
              <Button size="lg" fullWidth onClick={() => setStep('tags')}>
                Start <ArrowRight size={20} />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'tags' && (
          <motion.div
            key="tags"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col pt-2"
          >
            <h2 className="text-2xl font-bold mb-6 text-[var(--color-text-primary)]">What's loud right now?</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'EF', label: "Can't start things" },
                { id: 'TB', label: 'Time slips away' },
                { id: 'ED', label: 'Emotions hit hard' },
                { id: 'DO', label: 'Lose focus' },
                { id: 'WM', label: 'Forget words / blank' },
                { id: 'Anxious', label: 'Anxious / overwhelmed' }
              ].map((t) => {
                const isActive = tags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTag(t.id)}
                    className={`
                      px-4 py-3 rounded-xl border font-medium text-left transition-colors
                      ${isActive 
                        ? 'border-[var(--color-accent-focus)] bg-[color-mix(in_srgb,var(--color-accent-focus)_10%,transparent)] text-[var(--color-accent-focus)]' 
                        : 'border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]'}
                    `}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto pt-8">
              <Button size="lg" fullWidth onClick={() => setStep('crash')} disabled={tags.length === 0}>
                Next
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'crash' && (
          <motion.div
            key="crash"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col pt-2"
          >
            <h2 className="text-2xl font-bold mb-6 text-[var(--color-text-primary)]">When do you usually crash?</h2>
            <div className="space-y-3">
              {['Morning', 'Midday', 'Afternoon', 'Evening', 'Late night'].map((time) => (
                <Card 
                  key={time}
                  padding="md"
                  className={`cursor-pointer transition-colors ${crashWindow === time ? 'border-[var(--color-accent-focus)]' : ''}`}
                  onClick={() => setCrashWindow(time)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--color-text-primary)]">{time}</span>
                    <Clock size={18} className="text-[var(--color-text-muted)]" />
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-auto pt-8">
              <Button size="lg" fullWidth onClick={() => setStep('email')} disabled={!crashWindow}>
                Next
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col pt-2"
          >
            <h2 className="text-2xl font-bold mb-2 text-[var(--color-text-primary)]">Create your account</h2>
            <p className="text-[var(--color-text-muted)] mb-8">Saves your progress across devices.</p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                  className="w-full bg-[var(--color-bg-surface-2)] border border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-focus)] transition-all text-[var(--color-text-primary)]"
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                  className="w-full bg-[var(--color-bg-surface-2)] border border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-focus)] transition-all text-[var(--color-text-primary)]"
                />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-[var(--color-bg-surface-2)] border border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-focus)] transition-all text-[var(--color-text-primary)]"
              />
              {showEmailError && (
                <p className="text-xs text-[var(--color-accent-warm)] -mt-1">
                  Enter a valid email address.
                </p>
              )}
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (at least 6 characters)"
                  autoComplete="new-password"
                  className="w-full bg-[var(--color-bg-surface-2)] border border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-focus)] transition-all text-[var(--color-text-primary)]"
                />
                {password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-[var(--color-accent-warm)] mt-1.5">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>
            </div>

            {submitError && (
              <div className="mt-4 text-red-500 text-sm p-3 bg-red-500/10 rounded-lg">
                {submitError}
              </div>
            )}
            
            <div className="mt-auto pt-8 space-y-3">
              <Button size="lg" fullWidth loading={submitting} onClick={() => submitOnboarding(false)} disabled={!firstName.trim() || !lastName.trim() || !emailIsValid || password.length < 6}>
                Create Account
              </Button>
              <Button size="lg" variant="secondary" fullWidth loading={submitting} onClick={() => submitOnboarding(true)}>
                Skip for now
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'tour' && (
          <motion.div
            key="tour"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col pt-2"
          >
            <h2 className="mb-3 text-center text-2xl font-bold text-[var(--color-text-primary)]">
              Here&apos;s how Anchor is organized
            </h2>
            <p className="mb-8 text-center text-sm text-[var(--color-text-muted)]">
              Every tool has a zone, so you always know where to look next.
            </p>

            <div className="grid gap-3">
              {zoneCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <Card padding="md" className="border-[color-mix(in_srgb,var(--color-text-muted)_10%,transparent)]">
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 rounded-2xl p-2.5"
                          style={{
                            backgroundColor: `color-mix(in_srgb, ${card.color} 12%, transparent)`,
                            color: card.color,
                          }}
                        >
                          <Icon size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                            {card.title}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            {card.body}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-auto w-full">
              <Button size="lg" fullWidth onClick={finishTour}>
                Show me how to navigate
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              <CheckCircle size={64} className="text-[var(--color-accent-focus)]" />
            </motion.div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">You're in!</h2>
          </motion.div>
        )}

        {step === 'nav' && (
          <motion.div
            key="nav"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col justify-center space-y-6"
          >
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-focus)]">
                Navigation
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                Tap the menu any time.
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                The drawer groups tools by zone so nothing stays hidden.
              </p>
            </div>

            <Card padding="lg" className="space-y-4 border-[color-mix(in_srgb,var(--color-text-muted)_10%,transparent)]">
              <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--color-text-muted)_10%,transparent)] pb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-[var(--color-bg-surface-2)] p-2 text-[var(--color-text-primary)]">
                    <Menu size={18} />
                  </div>
                  <AnchorWordmark className="h-5 w-auto" />
                </div>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--color-accent-spark)_12%,transparent)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-accent-spark)]">
                  <Sparkles size={11} className="mr-1 inline fill-current" />
                  XP
                </span>
              </div>

              <div className="space-y-3">
                {navSections.map((section, index) => (
                  <motion.div
                    key={section.label}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.12 }}
                    className="rounded-2xl px-4 py-3"
                    style={{
                      backgroundColor: `color-mix(in_srgb, ${section.color} 10%, transparent)`,
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: section.color }}
                    >
                      {section.label}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                      {section.body}
                    </p>
                  </motion.div>
                ))}
              </div>
            </Card>

            <Button size="lg" fullWidth onClick={() => navigate('/')}>
              Got it
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
