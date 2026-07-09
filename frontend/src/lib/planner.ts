export type PlannerQuadrant = 'do' | 'decide' | 'delegate' | 'lighten';

export interface TimeBlock {
  id: string;
  date: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  quadrant: PlannerQuadrant;
  notes?: string;
  completed: boolean;
  actualDurationMinutes?: number;
  completedAt?: string;
}

export interface CaptureInboxItem {
  id: string;
  text: string;
  createdAt: string;
  source: 'text' | 'voice';
}

export interface BrainDumpEntry {
  id: string;
  text: string;
  createdAt: string;
  source: 'text' | 'voice';
  status: 'queued';
}

const STORAGE_KEY = 'anchor_time_blocks_v1';
const TRANSITION_ALERTS_KEY = 'anchor_transition_alerts_v1';
const CAPTURE_INBOX_KEY = 'anchor_capture_inbox_v1';
const BRAIN_DUMP_KEY = 'anchor_brain_dump_v1';
const PLANNER_START_HOUR = 8;
const PLANNER_END_HOUR = 20;
const ALERT_CHECKPOINTS = [1, 5] as const;

export type TransitionAlertCheckpoint = (typeof ALERT_CHECKPOINTS)[number];

export interface TransitionAlertPreferences {
  enabled: boolean;
  firedAlertKeys: string[];
}

export interface CalibrationStats {
  completedCount: number;
  estimatedMinutes: number;
  actualMinutes: number;
  coefficient: number | null;
}

function isoDate(offsetDays = 0) {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function boundedHour(value: number) {
  if (value < PLANNER_START_HOUR) return PLANNER_START_HOUR;
  if (value >= PLANNER_END_HOUR) return PLANNER_END_HOUR - 1;
  return value;
}

function clampMinutes(value: number) {
  const min = PLANNER_START_HOUR * 60;
  const max = PLANNER_END_HOUR * 60;
  return Math.min(Math.max(value, min), max);
}

function isPlannerQuadrant(value: unknown): value is PlannerQuadrant {
  return value === 'do' || value === 'decide' || value === 'delegate' || value === 'lighten';
}

function sanitizeBlock(block: TimeBlock): TimeBlock {
  const start = clampMinutes(timeToMinutes(block.startTime));
  const end = clampMinutes(start + Math.max(30, block.durationMinutes));
  const durationMinutes = Math.max(30, end - start);
  const hours = Math.floor(start / 60);
  const minutes = start % 60;
  const actualDurationMinutes =
    typeof block.actualDurationMinutes === 'number' && Number.isFinite(block.actualDurationMinutes)
      ? Math.max(15, Math.round(block.actualDurationMinutes / 15) * 15)
      : undefined;

  return {
    id: block.id,
    date: block.date,
    title: block.title,
    startTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    durationMinutes,
    quadrant: isPlannerQuadrant(block.quadrant) ? block.quadrant : 'decide',
    notes: block.notes,
    completed: Boolean(block.completed),
    actualDurationMinutes,
    completedAt: typeof block.completedAt === 'string' ? block.completedAt : undefined,
  };
}


export function getPlannerDates() {
  return {
    today: isoDate(0),
    tomorrow: isoDate(1),
  };
}

export function loadTimeBlocks() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as TimeBlock[];
    if (Array.isArray(parsed)) {
      return parsed.map(sanitizeBlock);
    }
  } catch {
    // Ignore malformed local data.
  }

  return [];
}

export function saveTimeBlocks(blocks: TimeBlock[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

export function loadTransitionAlertPreferences(): TransitionAlertPreferences {
  const raw = window.localStorage.getItem(TRANSITION_ALERTS_KEY);
  if (!raw) {
    return {
      enabled: false,
      firedAlertKeys: [],
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TransitionAlertPreferences>;
    return {
      enabled: Boolean(parsed.enabled),
      firedAlertKeys: Array.isArray(parsed.firedAlertKeys)
        ? parsed.firedAlertKeys.filter((value): value is string => typeof value === 'string')
        : [],
    };
  } catch {
    return {
      enabled: false,
      firedAlertKeys: [],
    };
  }
}

export function saveTransitionAlertPreferences(preferences: TransitionAlertPreferences) {
  window.localStorage.setItem(TRANSITION_ALERTS_KEY, JSON.stringify(preferences));
}

export function loadCaptureInboxItems(): CaptureInboxItem[] {
  const raw = window.localStorage.getItem(CAPTURE_INBOX_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CaptureInboxItem[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is CaptureInboxItem =>
        typeof item?.id === 'string' &&
        typeof item?.text === 'string' &&
        typeof item?.createdAt === 'string' &&
        (item?.source === 'text' || item?.source === 'voice'),
    );
  } catch {
    return [];
  }
}

export function saveCaptureInboxItems(items: CaptureInboxItem[]) {
  window.localStorage.setItem(CAPTURE_INBOX_KEY, JSON.stringify(items));
}

export function loadBrainDumpEntries(): BrainDumpEntry[] {
  const raw = window.localStorage.getItem(BRAIN_DUMP_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as BrainDumpEntry[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is BrainDumpEntry =>
        typeof entry?.id === 'string' &&
        typeof entry?.text === 'string' &&
        typeof entry?.createdAt === 'string' &&
        entry?.status === 'queued' &&
        (entry?.source === 'text' || entry?.source === 'voice'),
    );
  } catch {
    return [];
  }
}

export function saveBrainDumpEntries(entries: BrainDumpEntry[]) {
  window.localStorage.setItem(BRAIN_DUMP_KEY, JSON.stringify(entries));
}

export function computeCalibrationStats(blocks: TimeBlock[]): CalibrationStats {
  const completedBlocks = blocks.filter(
    (block) => block.completed && typeof block.actualDurationMinutes === 'number',
  );
  const estimatedMinutes = completedBlocks.reduce((total, block) => total + block.durationMinutes, 0);
  const actualMinutes = completedBlocks.reduce(
    (total, block) => total + (block.actualDurationMinutes ?? 0),
    0,
  );

  return {
    completedCount: completedBlocks.length,
    estimatedMinutes,
    actualMinutes,
    coefficient:
      completedBlocks.length > 0 && estimatedMinutes > 0 ? actualMinutes / estimatedMinutes : null,
  };
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function blockStartTimestamp(block: TimeBlock) {
  return new Date(`${block.date}T${block.startTime}:00`).getTime();
}

export function getNextUpcomingBlock(blocks: TimeBlock[], nowTimeMs = Date.now()) {
  return [...blocks]
    .filter((block) => !block.completed && blockStartTimestamp(block) > nowTimeMs)
    .sort((left, right) => blockStartTimestamp(left) - blockStartTimestamp(right))[0];
}

export function transitionAlertKey(blockId: string, checkpoint: TransitionAlertCheckpoint) {
  return `${blockId}:${checkpoint}`;
}

export function getDueTransitionAlert(
  block: TimeBlock | undefined,
  previousTimeMs: number | null,
  nowTimeMs: number,
  firedAlertKeys: string[],
): TransitionAlertCheckpoint | null {
  if (!block) return null;

  const startTimeMs = blockStartTimestamp(block);
  if (startTimeMs <= nowTimeMs) return null;

  for (const checkpoint of ALERT_CHECKPOINTS) {
    if (firedAlertKeys.includes(transitionAlertKey(block.id, checkpoint))) continue;

    const checkpointTimeMs = startTimeMs - checkpoint * 60_000;
    if (previousTimeMs === null) {
      if (nowTimeMs >= checkpointTimeMs) return checkpoint;
      continue;
    }

    if (previousTimeMs < checkpointTimeMs && nowTimeMs >= checkpointTimeMs) {
      return checkpoint;
    }
  }

  return null;
}

export function formatBlockTime(startTime: string, durationMinutes: number) {
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  const endHours = Math.floor(end / 60);
  const endMinutes = end % 60;
  return `${startTime} - ${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

export function plannerDayLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function defaultPlannerStartTime() {
  const now = new Date();
  const nextHour = boundedHour(now.getHours() + 1);
  return `${String(nextHour).padStart(2, '0')}:00`;
}
