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

  it('falls back to a default suggestion when the suggestion API fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('suggestion unavailable'));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    // On failure HomePage shows its built-in default focus suggestion.
    expect(await screen.findByText('A 20-minute focus block.')).toBeInTheDocument();
  });

  it('renders the personalized suggestion when the API succeeds', async () => {
    apiGetMock.mockResolvedValueOnce({
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
      expect(screen.getByText('Reset in Calm Zone')).toBeInTheDocument();
    });
    expect(screen.getByText('A quick reset fits your recent pattern.')).toBeInTheDocument();
  });
});
