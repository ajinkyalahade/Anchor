import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import GamesPage from './GamesPage';

const { apiGetMock, apiPostMock, grantRewardMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
  grantRewardMock: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock('../lib/rewards', () => ({
  grantReward: grantRewardMock,
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

vi.mock('../components/EchoGame', () => ({ default: () => <div>Echo Game</div> }));
vi.mock('../components/LockstepGame', () => ({ default: () => <div>Lockstep Game</div> }));
vi.mock('../components/MirrorGame', () => ({ default: () => <div>Mirror Game</div> }));
vi.mock('../components/SpotterGame', () => ({ default: () => <div>Spotter Game</div> }));
vi.mock('../components/SwitchGame', () => ({ default: () => <div>Switch Game</div> }));
vi.mock('../components/TrackerGame', () => ({ default: () => <div>Tracker Game</div> }));

describe('GamesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the Word Gym start-submit-done flow', async () => {
    apiGetMock.mockResolvedValue({
      base_word: 'ocean',
      time_limit_seconds: 60,
    });
    apiPostMock.mockResolvedValue({
      valid: true,
      score: 7,
      reason: 'Strong association',
      next_word: 'wave',
    });

    render(
      <MemoryRouter initialEntries={['/games']}>
        <Routes>
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:gameId" element={<GamesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Word Gym'));
    fireEvent.click(screen.getByRole('button', { name: /play now/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/games/wordgym/start');
    });

    expect(await screen.findByText('ocean')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'wave' } });
    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      charCode: 13,
      which: 13,
    });

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/games/wordgym/evaluate', {
        base_word: 'ocean',
        user_word: 'wave',
      });
    });
    expect(await screen.findByText('wave')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();

    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61000);
    });

    expect(await screen.findByText(/Time's Up!/)).toBeInTheDocument();
    expect(grantRewardMock).toHaveBeenCalledTimes(1);
  });
});
