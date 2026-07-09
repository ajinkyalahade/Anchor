import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import OnboardingPage from './OnboardingPage';

const { navigateMock, postMock, setAuthTokenMock, confettiMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  postMock: vi.fn(),
  setAuthTokenMock: vi.fn(),
  confettiMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../lib/api', () => ({
  api: {
    post: postMock,
    setAuthToken: setAuthTokenMock,
  },
}));

vi.mock('canvas-confetti', () => ({
  default: confettiMock,
}));

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders the welcome step first', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Your brain's starting block.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('completes the signup flow and calls the backend', async () => {
    postMock.mockResolvedValue({
      user_id: 'user-123',
      profile_id: 'profile-123',
      access_token: 'jwt-token',
      status: 'success',
    });

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(await screen.findByText("What's loud right now?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "Can't start things" }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('When do you usually crash?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Afternoon'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Create your account')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('First name'), {
      target: { value: 'Alex' },
    });
    fireEvent.change(screen.getByPlaceholderText('Last name'), {
      target: { value: 'Morgan' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password (at least 6 characters)'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/onboarding', {
        deficit_tags: ['EF'],
        crash_window: 'Afternoon',
        vibe_pref: 'gentle',
        first_name: 'Alex',
        last_name: 'Morgan',
        email: 'alex@example.com',
        password: 'secret123',
      });
    });
    expect(setAuthTokenMock).toHaveBeenCalledWith('jwt-token');
    expect(window.localStorage.getItem('anchor_user_id')).toBe('user-123');
  });
});
