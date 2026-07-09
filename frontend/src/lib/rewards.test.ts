import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();

vi.mock('./api', () => ({
  api: {
    post,
  },
}));

describe('rewards idempotency', () => {
  beforeEach(() => {
    post.mockReset();
    window.localStorage.clear();
    window.localStorage.setItem('anchor_user_id', 'user-123');
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'uuid-123' },
      configurable: true,
    });
  });

  it('attaches an idempotency key when granting rewards', async () => {
    post.mockResolvedValue({ xp_granted: 10, total_xp: 10, message: 'ok', newly_unlocked: [] });
    const { grantReward } = await import('./rewards');

    await grantReward('focus', 10, 'completed focus session');

    expect(post).toHaveBeenCalledWith(
      '/rewards/grant',
      {
        source: 'focus',
        base_xp: 10,
        reason: 'completed focus session',
      },
      { idempotencyKey: 'reward-focus-uuid-123' },
    );
  });
});
