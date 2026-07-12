import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

function renderHomePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Route api.get by path: /auth/me resolves quietly, the suggestion call
 * gets the provided behavior. */
function mockApiGet(suggestion: Promise<unknown>, firstName: string | null = null) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/auth/me') return Promise.resolve({ first_name: firstName });
    return suggestion;
  });
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('falls back to a default suggestion when the suggestion API fails', async () => {
    mockApiGet(Promise.reject(new Error('suggestion unavailable')));

    renderHomePage();

    // On failure HomePage shows its built-in default focus suggestion.
    expect(await screen.findByText('A 20-minute focus block.')).toBeInTheDocument();
  });

  it('renders the personalized suggestion when the API succeeds', async () => {
    mockApiGet(
      Promise.resolve({
        action: 'calm',
        label: 'Reset in Calm Zone',
        route: '/calm',
        duration: '3 min',
        reason: 'A quick reset fits your recent pattern.',
        week_label: null,
      }),
    );

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText('Reset in Calm Zone')).toBeInTheDocument();
    });
    expect(screen.getByText('A quick reset fits your recent pattern.')).toBeInTheDocument();
  });

  it('greets with the name from the profile API, not localStorage', async () => {
    window.localStorage.setItem('anchor_first_name', 'StaleName');
    mockApiGet(Promise.reject(new Error('suggestion unavailable')), 'Alai');

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Alai');
    });
    // The fetched name replaces the stale cached copy.
    expect(window.localStorage.getItem('anchor_first_name')).toBe('Alai');
  });
});
