import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import HomePage from './HomePage';

const { navigateMock, apiGetMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  apiGetMock: vi.fn(),
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
    get: apiGetMock,
  },
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));

vi.mock('../lib/insights', () => ({
  loadInsightDashboard: () => ({ sessions: [] }),
}));

vi.mock('../lib/personalization', () => ({
  computeModalityPreferences: () => ({}),
  personalizeSuggestion: (suggestion: unknown) => suggestion,
}));

vi.mock('../lib/quests', () => ({
  loadQuestStore: () => ({ logs: [] }),
  questCountToday: () => 0,
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders with empty rewards fallback', async () => {
    apiGetMock
      .mockRejectedValueOnce(new Error('rewards unavailable'))
      .mockResolvedValueOnce({
        action: 'focus',
        label: 'Start a focus sprint',
        route: '/focus',
        duration: '25 min',
        reason: 'You have momentum available.',
        week_label: null,
      });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('0 XP')).toBeInTheDocument();
    expect(screen.getByText('Start a focus sprint')).toBeInTheDocument();
  });

  it('renders the personalized suggestion when APIs succeed', async () => {
    apiGetMock
      .mockResolvedValueOnce({
        total_xp: 42,
        current_streak: 3,
        streak_state: 'steady',
        comeback_bonus_active: false,
      })
      .mockResolvedValueOnce({
        action: 'calm',
        label: 'Reset in Calm Zone',
        route: '/calm',
        duration: '3 min',
        reason: 'A quick reset fits your recent pattern.',
        week_label: null,
      });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('42 XP')).toBeInTheDocument();
    });
    expect(screen.getByText('Reset in Calm Zone')).toBeInTheDocument();
    expect(screen.getByText('A quick reset fits your recent pattern.')).toBeInTheDocument();
  });
});
