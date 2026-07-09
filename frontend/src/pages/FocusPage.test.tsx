import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

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

    render(<FocusPage />);

    fireEvent.change(
      screen.getByPlaceholderText('E.g., Write the first draft of the project proposal...'),
      { target: { value: 'Draft proposal' } },
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start focus/i }));
    });
    expect(apiPostMock).toHaveBeenCalledWith('/focus/decompose', { task_text: 'Draft proposal' });

    expect(await screen.findByText('25:00')).toBeInTheDocument();
    vi.useFakeTimers();

    const runningButtons = screen.getAllByRole('button');
    fireEvent.click(runningButtons[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('25:00')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button')[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText('24:59')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button')[1]);

    await waitFor(() => {
      expect(screen.getByText('Focus complete.')).toBeInTheDocument();
    });
    expect(recordFocusInsightSessionMock).toHaveBeenCalledTimes(1);
    expect(grantRewardMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));
    expect(grantRewardMock).toHaveBeenCalledTimes(1);
  });
});
