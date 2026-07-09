import { api } from './api.js';

export type RewardSource = 'focus' | 'wordgym' | 'calm' | 'games' | 'quests';

export interface RewardGrantResponse {
  xp_granted: number;
  total_xp: number;
  message: string;
  newly_unlocked: string[];
}

export interface UnlockCatalogItem {
  id: string;
  type: 'theme' | 'sound';
  label: string;
  xp_required: number;
  description: string;
  unlocked: boolean;
}

export interface UnlocksResponse {
  total_xp: number;
  catalog: UnlockCatalogItem[];
  active_theme: string | null;
  active_sound: string | null;
}

const THEME_CLASSES = ['theme-focus-blue', 'theme-forest-calm', 'theme-dusk-warm'];

function createIdempotencyKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function applyTheme(themeId: string | null) {
  THEME_CLASSES.forEach((cls) => document.documentElement.classList.remove(cls));
  if (themeId) {
    const cls = themeId.replace(/_/g, '-');
    document.documentElement.classList.add(cls);
  }
}

export async function grantReward(
  source: RewardSource,
  baseXp: number,
  reason: string,
): Promise<RewardGrantResponse | null> {
  const userId = window.localStorage.getItem('anchor_user_id');
  if (!userId) return null;

  try {
    return await api.post<RewardGrantResponse>('/rewards/grant', {
      source,
      base_xp: baseXp,
      reason,
    }, { idempotencyKey: createIdempotencyKey(`reward-${source}`) });
  } catch (error) {
    console.error('Reward grant failed', error);
    return null;
  }
}

export async function fetchUnlocks(): Promise<UnlocksResponse | null> {
  const userId = window.localStorage.getItem('anchor_user_id');
  try {
    const params = userId ? `?user_id=${userId}` : '';
    return await api.get<UnlocksResponse>(`/rewards/unlocks${params}`);
  } catch (error) {
    console.error('Unlock fetch failed', error);
    return null;
  }
}

export async function activateItem(itemId: string): Promise<boolean> {
  const userId = window.localStorage.getItem('anchor_user_id');
  if (!userId) return false;
  try {
    await api.post(
      '/rewards/unlocks/activate',
      { item_id: itemId },
      { idempotencyKey: createIdempotencyKey(`unlock-${itemId}`) },
    );
    if (itemId.startsWith('theme_')) {
      localStorage.setItem('anchor_active_theme', itemId);
      applyTheme(itemId);
    } else {
      localStorage.setItem('anchor_active_sound', itemId);
    }
    return true;
  } catch (error) {
    console.error('Unlock activation failed', error);
    return false;
  }
}
