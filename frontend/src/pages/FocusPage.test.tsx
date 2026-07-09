import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import FocusPage from './FocusPage';
import React from 'react';

const { apiPostMock, recordFocusInsightSessionMock, grantRewardMock } = vi.hoisted(() => ({
  apiPostMock: vi.fn(),
  recordFocusInsightSessionMock: vi.fn(),
  grantRewardMock: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    post: apiPostMock,
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
  recordFocusInsightSession: recordFocusInsightSessionMock,
}));

vi.mock('../lib/rewards', () => ({
  grantReward: grantRewardMock,
}));

vi.mock('../components/DistractionPark', () => ({
  default: () => <div>Distraction Park</div>,
}));

vi.mock('../components/TaskDecomposer', () => ({
  default: ({ steps }: { steps: Array<{ label: string }> }) => (
    <div>Task steps: {steps.map((step) => step.label).join(', ')}</div>
  ),
}));

vi.mock('../components/VoiceInput', () => ({
  default: () => <div>Voice Input</div>,
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: Record<string, unknown>) => {
          const {
            initial,
            animate,
            exit,
            transition,
            whileTap,
            whileHover,
            ...domProps
          } = props;
          void initial;
          void animate;
          void exit;
          void transition;
          void whileTap;
          void whileHover;
          return React.createElement(tag, domProps, children as React.ReactNode);
        },
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('FocusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts, pauses, resumes, and grants reward once when the session ends', async () => {
    apiPostMock.mockResolvedValue({
      steps: [{ label: 'Open the file', est_minutes: 1, first: true }],
      why_first_step_matters: 'Starting counts.',
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <FocusPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Enter a task and break it into micro-steps (calls /focus/decompose).
    fireEvent.change(
      screen.getByPlaceholderText('Type it the way it lives in your head…'),
      { target: { value: 'Draft proposal' } },
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /break into micro-steps/i }));
    });
    expect(apiPostMock).toHaveBeenCalledWith('/focus/decompose', { task_text: 'Draft proposal' });
    expect(await screen.findByText('Open the file')).toBeInTheDocument();

    // Start the session (creates a server-side session), then pause and resume.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start session/i }));
    });
    expect(apiPostMock).toHaveBeenCalledWith('/focus/sessions', expect.objectContaining({
      duration_planned: 20 * 60,
      task_text: 'Draft proposal',
    }));

    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    // Paused: the primary button returns to a start/resume state and the
    // "done early" affordance is hidden until running again.
    const resumeButton = screen.getByRole('button', { name: /start session|resume/i });
    await act(async () => {
      fireEvent.click(resumeButton);
    });

    // Finish early → reward is granted exactly once.
    fireEvent.click(screen.getByRole('button', { name: /done early/i }));
    await waitFor(() => {
      expect(screen.getByText('Focus complete.')).toBeInTheDocument();
    });
    expect(recordFocusInsightSessionMock).toHaveBeenCalledTimes(1);
    expect(grantRewardMock).toHaveBeenCalledTimes(1);

    // Starting a new session does not re-grant the previous reward.
    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));
    expect(grantRewardMock).toHaveBeenCalledTimes(1);
  });
});
