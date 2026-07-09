export type LayerKey = 'rain' | 'brown' | 'fan' | 'cafe';

export type MixState = Record<LayerKey, number>;

export interface AmbientPack {
  id: string;
  label: string;
  description: string;
  mix: MixState;
}

export interface PresenceSnapshot {
  activeNow: number;
  joinedLastHour: number;
  checkedInToday: number;
  currentPackLabel: string;
  updatedAtLabel: string;
}

export const DEFAULT_MIX: MixState = {
  rain: 0.45,
  brown: 0.35,
  fan: 0.2,
  cafe: 0.1,
};

export const AMBIENT_PACKS: AmbientPack[] = [
  {
    id: 'rain-study',
    label: 'Rain Study',
    description: 'Soft rain with a low focus bed.',
    mix: { rain: 0.7, brown: 0.3, fan: 0.1, cafe: 0 },
  },
  {
    id: 'deep-focus',
    label: 'Deep Focus',
    description: 'Brown noise forward, minimal distractions.',
    mix: { rain: 0.15, brown: 0.8, fan: 0.35, cafe: 0 },
  },
  {
    id: 'soft-cafe',
    label: 'Soft Cafe',
    description: 'Light room energy without sharp edges.',
    mix: { rain: 0.05, brown: 0.2, fan: 0.15, cafe: 0.6 },
  },
  {
    id: 'night-shift',
    label: 'Night Shift',
    description: 'Low mechanical hum with gentle weather.',
    mix: { rain: 0.35, brown: 0.4, fan: 0.45, cafe: 0.05 },
  },
  {
    id: 'library-air',
    label: 'Library Air',
    description: 'Quiet ventilation with a restrained room bed.',
    mix: { rain: 0, brown: 0.25, fan: 0.55, cafe: 0.2 },
  },
  {
    id: 'shoreline-drift',
    label: 'Shoreline Drift',
    description: 'Weather-forward focus with very light room motion.',
    mix: { rain: 0.55, brown: 0.15, fan: 0.05, cafe: 0.25 },
  },
  {
    id: 'late-cafe-close',
    label: 'Late Cafe Close',
    description: 'A quieter social bed for end-of-day work.',
    mix: { rain: 0.1, brown: 0.15, fan: 0.1, cafe: 0.75 },
  },
];

export const AMBIENT_LAYERS: Array<{ key: LayerKey; label: string }> = [
  { key: 'rain', label: 'Rain' },
  { key: 'brown', label: 'Brown noise' },
  { key: 'fan', label: 'Fan hum' },
  { key: 'cafe', label: 'Cafe bed' },
];

function sumMix(mix: MixState) {
  return Object.values(mix).reduce((total, value) => total + value, 0);
}

export function resolveAmbientPack(packId: string) {
  return AMBIENT_PACKS.find((pack) => pack.id === packId) ?? AMBIENT_PACKS[0];
}

export function createPresenceSnapshot(
  packId: string,
  now = new Date(),
): PresenceSnapshot {
  const pack = resolveAmbientPack(packId);
  const hour = now.getHours();
  const weekday = now.getDay();
  const density = Math.round(sumMix(pack.mix) * 10);
  const weatherBias = Math.round((pack.mix.rain - pack.mix.cafe) * 10);
  const socialBias = Math.round((pack.mix.cafe - pack.mix.brown) * 12);
  const steadyBias = Math.round(pack.mix.fan * 8);
  const dayBias = weekday === 0 || weekday === 6 ? -4 : 6;
  const hourBias = hour >= 19 ? 9 : hour >= 12 ? 6 : hour >= 8 ? 4 : 1;

  return {
    activeNow: Math.max(7, density + hourBias + dayBias + socialBias),
    joinedLastHour: Math.max(3, Math.round(density / 2) + steadyBias + (hour >= 17 ? 4 : 2)),
    checkedInToday: Math.max(18, density * 2 + dayBias + weatherBias + socialBias + 14),
    currentPackLabel: pack.label,
    updatedAtLabel: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

export function liveRoomsEnabled() {
  return import.meta.env.VITE_ENABLE_LIVE_BODY_DOUBLE_ROOMS === 'true';
}
