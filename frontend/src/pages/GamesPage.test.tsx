import { act, fireEvent, render, screen } from '@testing-library/react';
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

    // Fake timers throughout so the 60s countdown is driven deterministically;
    // advanceTimersByTimeAsync(0) flushes the mocked API promises.
    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={['/games']}>
        <Routes>
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:gameId" element={<GamesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /word gym/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fireEvent.click(screen.getByRole('button', { name: /play now/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(apiGetMock).toHaveBeenCalledWith('/games/wordgym/start');
    expect(screen.getByText('ocean')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'wave' } });
    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      charCode: 13,
      which: 13,
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(apiPostMock).toHaveBeenCalledWith('/games/wordgym/evaluate', {
      base_word: 'ocean',
      user_word: 'wave',
    });
    // "wave" now shows in both the current-word display and the chain history.
    expect(screen.getAllByText('wave').length).toBeGreaterThan(0);
    // The accepted word scores +7 in the chain history.
    expect(screen.getByText('+7')).toBeInTheDocument();

    // Run out the 60s clock → game ends and grants the reward once.
    // The countdown reschedules itself via an effect, so effects must flush
    // between each second — advance one tick at a time.
    for (let i = 0; i < 61; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }

    expect(screen.getByText(/Time's up\./)).toBeInTheDocument();
    expect(grantRewardMock).toHaveBeenCalledTimes(1);
  });
});
