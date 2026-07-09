import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CalendarRange,
  Check,
  Clock3,
  Gauge,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { Badge, Button, Card } from '../components/ui';
import EndOfDayBrainDump from '../components/EndOfDayBrainDump';
import QuickCaptureInbox from '../components/QuickCaptureInbox';
import {
  computeCalibrationStats,
  type PlannerQuadrant,
  type TimeBlock,
  blockStartTimestamp,
  defaultPlannerStartTime,
  formatBlockTime,
  getDueTransitionAlert,
  getNextUpcomingBlock,
  getPlannerDates,
  loadTimeBlocks,
  loadTransitionAlertPreferences,
  plannerDayLabel,
  saveTimeBlocks,
  saveTransitionAlertPreferences,
  timeToMinutes,
  transitionAlertKey,
} from '../lib/planner';

type PlannerDay = 'today' | 'tomorrow';
type StructureSection = 'overview' | 'capture' | 'blocks';

interface PlannerDraft {
  title: string;
  startTime: string;
  durationMinutes: number;
  quadrant: PlannerQuadrant;
  notes: string;
}

const ACTUAL_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

const TIMELINE_START = 8 * 60;
const TIMELINE_END = 20 * 60;
const TIMELINE_HOURS = Array.from({ length: 13 }, (_, index) => 8 + index);
const MIN_VISIBLE_BLOCK_PCT = 8;
const ALERT_POLL_MS = 15_000;

type AudioContextWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

interface PositionedBlock {
  block: TimeBlock;
  lane: number;
  laneCount: number;
  top: number;
  height: number;
}

const QUADRANTS: Array<{
  id: PlannerQuadrant;
  label: string;
  description: string;
  badge: 'warm' | 'focus' | 'spark' | 'calm';
}> = [
  { id: 'do', label: 'Do now', description: 'Urgent + important', badge: 'warm' },
  { id: 'decide', label: 'Plan', description: 'Important, not urgent', badge: 'focus' },
  { id: 'delegate', label: 'Hand off', description: 'Urgent, lower leverage', badge: 'spark' },
  { id: 'lighten', label: 'Reduce', description: 'Neither urgent nor important', badge: 'calm' },
];

const STRUCTURE_SECTIONS: Array<{
  id: StructureSection;
  label: string;
  description: string;
  to: string;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'See the shape of your day and what needs attention next.',
    to: '/structure',
  },
  {
    id: 'capture',
    label: 'Capture & dump',
    description: 'Drop loose tasks and end-of-day residue into one calm place.',
    to: '/structure/capture',
  },
  {
    id: 'blocks',
    label: 'Time blocks',
    description: 'Plan today and tomorrow without digging through the rest.',
    to: '/structure/blocks',
  },
];

function quadrantMeta(quadrant: PlannerQuadrant) {
  return QUADRANTS.find((option) => option.id === quadrant) ?? QUADRANTS[0];
}

function blockEndMinutes(block: TimeBlock) {
  return timeToMinutes(block.startTime) + block.durationMinutes;
}

function formatTransitionCountdown(minutesUntil: number) {
  if (minutesUntil <= 1) return 'Starts in under a minute';
  if (minutesUntil < 60) return `Starts in ${minutesUntil} min`;

  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;
  if (minutes === 0) return `Starts in ${hours}h`;
  return `Starts in ${hours}h ${minutes}m`;
}

function calibrationLabel(coefficient: number | null) {
  if (coefficient === null) return 'Need a few completed blocks first';
  if (coefficient > 1.15) return 'You tend to under-estimate';
  if (coefficient < 0.9) return 'You tend to over-estimate';
  return 'Your estimates are landing close';
}

function calibrationDeltaText(coefficient: number | null) {
  if (coefficient === null) return 'Log actual time on completed blocks to build the coefficient.';
  const delta = Math.round((coefficient - 1) * 100);
  if (delta === 0) return 'Actual time is matching the planned estimate.';
  return delta > 0
    ? `Actual time is running about ${delta}% above estimate.`
    : `Actual time is running about ${Math.abs(delta)}% below estimate.`;
}

function nextPendingAlertLabel(block: TimeBlock | undefined, firedAlertKeys: string[]) {
  if (!block) return 'No pending alerts';
  if (!firedAlertKeys.includes(transitionAlertKey(block.id, 5))) return '5 min warning pending';
  if (!firedAlertKeys.includes(transitionAlertKey(block.id, 1))) return '1 min warning pending';
  return 'All warnings sent';
}

function ensureAudioContext(audioContextRef: MutableRefObject<AudioContext | null>) {
  const AudioContextCtor =
    window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
  if (!AudioContextCtor) return;

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextCtor();
  }

  void audioContextRef.current.resume().catch(() => undefined);
}

function playSoftChime(audioContextRef: MutableRefObject<AudioContext | null>) {
  ensureAudioContext(audioContextRef);

  const context = audioContextRef.current;
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(520, context.currentTime + 0.32);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.36);
}

function buildPositionedBlocks(blocks: TimeBlock[]): PositionedBlock[] {
  const laneEnds: number[] = [];
  const withLanes = blocks.map((block) => {
    const start = timeToMinutes(block.startTime);
    const end = blockEndMinutes(block);

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }

    return {
      block,
      lane,
      laneCount: 1,
      start,
      end,
    };
  });

  let clusterStart = 0;
  while (clusterStart < withLanes.length) {
    let clusterEnd = clusterStart;
    let furthestEnd = withLanes[clusterStart].end;
    let maxLane = withLanes[clusterStart].lane;

    while (clusterEnd + 1 < withLanes.length && withLanes[clusterEnd + 1].start < furthestEnd) {
      clusterEnd += 1;
      furthestEnd = Math.max(furthestEnd, withLanes[clusterEnd].end);
      maxLane = Math.max(maxLane, withLanes[clusterEnd].lane);
    }

    for (let index = clusterStart; index <= clusterEnd; index += 1) {
      withLanes[index].laneCount = maxLane + 1;
    }

    clusterStart = clusterEnd + 1;
  }

  return withLanes.map(({ block, lane, laneCount, start }) => ({
    block,
    lane,
    laneCount,
    top: Math.max(0, ((start - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100),
    height: Math.max(
      (block.durationMinutes / (TIMELINE_END - TIMELINE_START)) * 100,
      MIN_VISIBLE_BLOCK_PCT,
    ),
  }));
}

export default function StructureHubPage() {
  const { section: routeSection } = useParams<{ section?: string }>();
  const [activeDay, setActiveDay] = useState<PlannerDay>('today');
  const [blocks, setBlocks] = useState<TimeBlock[]>(() => loadTimeBlocks());
  const [alertPreferences, setAlertPreferences] = useState(() => loadTransitionAlertPreferences());
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [draft, setDraft] = useState<PlannerDraft>({
    title: '',
    startTime: defaultPlannerStartTime(),
    durationMinutes: 45,
    quadrant: 'decide',
    notes: '',
  });
  const [completionTargetId, setCompletionTargetId] = useState<string | null>(null);
  const [actualDurationDraft, setActualDurationDraft] = useState(45);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastAlertCheckRef = useRef<number | null>(null);

  const plannerDates = getPlannerDates();
  const activeSection: StructureSection =
    routeSection === 'capture' || routeSection === 'blocks' ? routeSection : 'overview';
  const activeSectionMeta =
    STRUCTURE_SECTIONS.find((section) => section.id === activeSection) ?? STRUCTURE_SECTIONS[0];
  const activeDate = plannerDates[activeDay];
  const activeBlocks = blocks
    .filter((block) => block.date === activeDate)
    .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
  const positionedBlocks = buildPositionedBlocks(activeBlocks);
  const todayBlocks = blocks
    .filter((block) => block.date === plannerDates.today)
    .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
  const tomorrowBlocks = blocks
    .filter((block) => block.date === plannerDates.tomorrow)
    .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
  const nextUpcomingBlock = getNextUpcomingBlock(todayBlocks, currentTimeMs);
  const minutesUntilNextBlock = nextUpcomingBlock
    ? Math.max(0, Math.ceil((blockStartTimestamp(nextUpcomingBlock) - currentTimeMs) / 60_000))
    : null;
  const pendingAlertLabel = nextPendingAlertLabel(nextUpcomingBlock, alertPreferences.firedAlertKeys);
  const calibrationStats = useMemo(() => computeCalibrationStats(blocks), [blocks]);
  const completionTarget = completionTargetId
    ? blocks.find((block) => block.id === completionTargetId) ?? null
    : null;

  useEffect(() => {
    saveTimeBlocks(blocks);
  }, [blocks]);

  useEffect(() => {
    saveTransitionAlertPreferences(alertPreferences);
  }, [alertPreferences]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTimeMs(Date.now()), ALERT_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!alertPreferences.enabled) {
      lastAlertCheckRef.current = currentTimeMs;
      return undefined;
    }

    const checkAlerts = () => {
      const nowTimeMs = Date.now();
      const currentUpcomingBlock = getNextUpcomingBlock(todayBlocks, nowTimeMs);
      const dueCheckpoint = getDueTransitionAlert(
        currentUpcomingBlock,
        lastAlertCheckRef.current,
        nowTimeMs,
        alertPreferences.firedAlertKeys,
      );

      if (dueCheckpoint && currentUpcomingBlock) {
        if (navigator.vibrate) {
          navigator.vibrate(dueCheckpoint === 1 ? [40, 60, 40] : 40);
        }
        playSoftChime(audioContextRef);
        setAlertPreferences((current) => ({
          ...current,
          firedAlertKeys: Array.from(
            new Set([
              ...current.firedAlertKeys,
              transitionAlertKey(currentUpcomingBlock.id, dueCheckpoint),
            ]),
          ),
        }));
      }

      lastAlertCheckRef.current = nowTimeMs;
    };

    checkAlerts();
    const intervalId = window.setInterval(checkAlerts, ALERT_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [
    alertPreferences.enabled,
    alertPreferences.firedAlertKeys,
    currentTimeMs,
    nextUpcomingBlock,
    todayBlocks,
  ]);

  useEffect(
    () => () => {
      void audioContextRef.current?.close().catch(() => undefined);
    },
    [],
  );

  const addBlock = () => {
    if (!draft.title.trim()) return;

    setBlocks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        date: activeDate,
        title: draft.title.trim(),
        startTime: draft.startTime,
        durationMinutes: draft.durationMinutes,
        quadrant: draft.quadrant,
        notes: draft.notes.trim() || undefined,
        completed: false,
      },
    ]);

    setDraft((current) => ({
      ...current,
      title: '',
      notes: '',
    }));
  };

  const toggleBlock = (id: string) => {
    const target = blocks.find((block) => block.id === id);
    if (!target) return;

    if (target.completed) {
      setBlocks((current) =>
        current.map((block) =>
          block.id === id
            ? {
                ...block,
                completed: false,
                actualDurationMinutes: undefined,
                completedAt: undefined,
              }
            : block,
        ),
      );
      return;
    }

    setActualDurationDraft(target.durationMinutes);
    setCompletionTargetId(id);
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id));
  };

  const toggleTransitionAlerts = () => {
    setAlertPreferences((current) => {
      const nextEnabled = !current.enabled;
      if (nextEnabled) {
        ensureAudioContext(audioContextRef);
      }
      return { ...current, enabled: nextEnabled };
    });
  };

  const closeCompletionModal = () => {
    setCompletionTargetId(null);
  };

  const saveCompletionActual = () => {
    if (!completionTarget) return;

    setBlocks((current) =>
      current.map((block) =>
        block.id === completionTarget.id
          ? {
              ...block,
              completed: true,
              actualDurationMinutes: actualDurationDraft,
              completedAt: new Date().toISOString(),
            }
          : block,
      ),
    );
    setCompletionTargetId(null);
  };

  const plannedMinutes = activeBlocks.reduce((total, block) => total + block.durationMinutes, 0);
  const doNowCount = activeBlocks.filter((block) => block.quadrant === 'do').length;
  const completedCount = activeBlocks.filter((block) => block.completed).length;
  const todayPlannedMinutes = todayBlocks.reduce((total, block) => total + block.durationMinutes, 0);
  const todayDoNowCount = todayBlocks.filter((block) => block.quadrant === 'do').length;
  const todayCompletedCount = todayBlocks.filter((block) => block.completed).length;

  return (
    <div className="space-y-6 px-8 py-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent-focus)]">
            Structure Hub
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[var(--color-text-primary)]">
            {activeSectionMeta.label}
          </h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            {activeSectionMeta.description}
          </p>
        </div>
        <div className="rounded-3xl bg-[color-mix(in_srgb,var(--color-accent-focus)_14%,transparent)] p-4 text-[var(--color-accent-focus)]">
          <CalendarRange size={28} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {STRUCTURE_SECTIONS.map((section) => (
          <NavLink key={section.id} to={section.to} end={section.id === 'overview'} className="no-underline">
            {({ isActive }) => (
              <div
                className={`rounded-2xl border p-4 transition-colors ${
                  isActive
                    ? 'border-transparent bg-[color-mix(in_srgb,var(--color-accent-focus)_12%,transparent)]'
                    : 'border-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)] bg-[var(--color-bg-surface)]'
                }`}
              >
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{section.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {section.description}
                </p>
              </div>
            )}
          </NavLink>
        ))}
      </div>

      {activeSection === 'overview' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card padding="sm">
              <p className="text-xs text-[var(--color-text-muted)]">Planned today</p>
              <p className="text-xl font-bold">{Math.round(todayPlannedMinutes / 60)}h</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-[var(--color-text-muted)]">Do now</p>
              <p className="text-xl font-bold">{todayDoNowCount}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-[var(--color-text-muted)]">Closed loops</p>
              <p className="text-xl font-bold">{todayCompletedCount}</p>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card padding="md" className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Capture first
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Empty the mental tabs before you try to plan the day.
                  </p>
                </div>
                <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-spark)_14%,transparent)] p-3 text-[var(--color-accent-spark)]">
                  <Plus size={18} />
                </div>
              </div>
              <NavLink
                to="/structure/capture"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-bg-surface-2)] px-5 py-2.5 text-base font-medium text-[var(--color-text-primary)] no-underline transition-colors hover:brightness-95"
              >
                Open capture & dump
              </NavLink>
            </Card>

            <Card padding="md" className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Shape the day
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Move straight into today&apos;s timeline and block the work that matters.
                  </p>
                </div>
                <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-focus)_14%,transparent)] p-3 text-[var(--color-accent-focus)]">
                  <Clock3 size={18} />
                </div>
              </div>
              <NavLink
                to="/structure/blocks"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-accent-focus)] px-5 py-2.5 text-base font-medium text-white no-underline transition-colors hover:brightness-110"
              >
                Open time blocks
              </NavLink>
            </Card>
          </div>

          <Card padding="md" className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Daily rhythm
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Keep the next block visible so the day stops sneaking up on you.
                </p>
              </div>
              <Badge variant="focus">{todayBlocks.length} today</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Next transition
                </p>
                {nextUpcomingBlock ? (
                  <>
                    <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                      {nextUpcomingBlock.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {formatBlockTime(nextUpcomingBlock.startTime, nextUpcomingBlock.durationMinutes)}
                    </p>
                    <p className="mt-3 text-sm text-[var(--color-accent-focus)]">
                      {minutesUntilNextBlock === null
                        ? 'No active countdown'
                        : formatTransitionCountdown(minutesUntilNextBlock)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    Nothing else is scheduled for the rest of today.
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Tomorrow
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                  {tomorrowBlocks.length} blocks drafted
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {plannerDayLabel(plannerDates.tomorrow)}
                </p>
                <NavLink
                  to="/structure/blocks"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] no-underline transition-colors hover:brightness-95"
                >
                  Review tomorrow
                </NavLink>
              </div>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Time-reality calibration
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Use completed blocks to tune future estimates.
                </p>
              </div>
              <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-warm)_12%,transparent)] p-3 text-[var(--color-accent-warm)]">
                <Gauge size={18} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Coefficient
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
                  {calibrationStats.coefficient === null ? '—' : `${calibrationStats.coefficient.toFixed(2)}x`}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Completed logs
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
                  {calibrationStats.completedCount}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Actual vs plan
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                  {Math.round(calibrationStats.actualMinutes / 60)}h / {Math.round(calibrationStats.estimatedMinutes / 60)}h
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-warm)_8%,transparent)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    calibrationStats.coefficient === null
                      ? 'muted'
                      : calibrationStats.coefficient > 1.15
                        ? 'warm'
                        : calibrationStats.coefficient < 0.9
                          ? 'spark'
                          : 'calm'
                  }
                >
                  {calibrationLabel(calibrationStats.coefficient)}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                {calibrationDeltaText(calibrationStats.coefficient)}
              </p>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Transition alerts</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Keep the next block loud enough to notice, not loud enough to derail you.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={alertPreferences.enabled ? 'focus' : 'secondary'}
                onClick={toggleTransitionAlerts}
                role="switch"
                aria-checked={alertPreferences.enabled}
              >
                {alertPreferences.enabled ? <BellRing size={16} /> : <Bell size={16} />}
                {alertPreferences.enabled ? 'On' : 'Off'}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Alert state
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={alertPreferences.enabled ? 'focus' : 'muted'}>
                    {alertPreferences.enabled ? 'Alerts armed' : 'Alerts paused'}
                  </Badge>
                  <Badge variant="calm">5 min</Badge>
                  <Badge variant="spark">1 min</Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">{pendingAlertLabel}</p>
              </div>

              <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Fast route
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  If you already know what matters, skip straight into the timeline.
                </p>
                <NavLink
                  to="/structure/blocks"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] no-underline transition-colors hover:brightness-95"
                >
                  Open time blocks
                </NavLink>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeSection === 'capture' && (
        <>
          <QuickCaptureInbox />
          <EndOfDayBrainDump />
        </>
      )}

      {activeSection === 'blocks' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card padding="sm">
              <p className="text-xs text-[var(--color-text-muted)]">Planned</p>
              <p className="text-xl font-bold">{Math.round(plannedMinutes / 60)}h</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-[var(--color-text-muted)]">Do now</p>
              <p className="text-xl font-bold">{doNowCount}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-[var(--color-text-muted)]">Closed loops</p>
              <p className="text-xl font-bold">{completedCount}</p>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--color-bg-surface-2)] p-1">
            {([
              { id: 'today', label: 'Today' },
              { id: 'tomorrow', label: 'Tomorrow' },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveDay(option.id)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  activeDay === option.id
                    ? 'bg-[var(--color-bg-surface)] text-[var(--color-accent-focus)] shadow-sm'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {option.label}
                <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                  {plannerDayLabel(plannerDates[option.id])}
                </span>
              </button>
            ))}
          </div>

          <Card padding="md" className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Add a block</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Choose the slot, then force the block into the right quadrant.
                </p>
              </div>
              <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-spark)_14%,transparent)] p-3 text-[var(--color-accent-spark)]">
                <Clock3 size={18} />
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Deep work, calls, admin, recovery..."
                className="w-full rounded-2xl border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] bg-[var(--color-bg-surface)] px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent-focus)] focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm text-[var(--color-text-muted)]">
                  <span>Start</span>
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                    className="w-full rounded-2xl border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] bg-[var(--color-bg-surface)] px-4 py-3 text-[var(--color-text-primary)] focus:border-[var(--color-accent-focus)] focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-sm text-[var(--color-text-muted)]">
                  <span>Duration</span>
                  <select
                    value={draft.durationMinutes}
                    onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })}
                    className="w-full rounded-2xl border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] bg-[var(--color-bg-surface)] px-4 py-3 text-[var(--color-text-primary)] focus:border-[var(--color-accent-focus)] focus:outline-none"
                  >
                    {[30, 45, 60, 90, 120].map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} min
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-2">
                {QUADRANTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, quadrant: option.id })}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      draft.quadrant === option.id
                        ? 'border-transparent bg-[var(--color-bg-surface-2)]'
                        : 'border-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)] bg-[var(--color-bg-surface)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={option.badge}>{option.label}</Badge>
                      <span className="text-sm text-[var(--color-text-muted)]">{option.description}</span>
                    </div>
                  </button>
                ))}
              </div>

              <textarea
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                placeholder="Why this block belongs here, or what ‘done’ means..."
                className="h-24 w-full rounded-2xl border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] bg-[var(--color-bg-surface)] px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent-focus)] focus:outline-none resize-none"
              />
            </div>

            <Button size="lg" fullWidth variant="focus" onClick={addBlock} disabled={!draft.title.trim()}>
              <Plus size={18} /> Add to {activeDay}
            </Button>
          </Card>

          <Card padding="md">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {activeDay === 'today' ? 'Today' : 'Tomorrow'}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {plannerDayLabel(activeDate)}
                </p>
              </div>
              <Badge variant="focus">{activeBlocks.length} blocks</Badge>
            </div>

            {activeBlocks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--color-text-muted)_18%,transparent)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                Nothing is blocked yet. Add the first anchor before the day starts freelancing.
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl bg-[color-mix(in_srgb,var(--color-bg-surface-2)_55%,transparent)] p-4">
                <div className="relative h-[34rem] sm:h-[39rem]">
                  {TIMELINE_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0 flex items-start gap-3"
                      style={{ top: `${((hour * 60 - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100}%` }}
                    >
                      <div className="w-12 text-xs font-medium text-[var(--color-text-muted)]">
                        {hour === 12 ? '12p' : hour < 12 ? `${hour}a` : `${hour - 12}p`}
                      </div>
                      <div className="mt-2 h-px flex-1 bg-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)]" />
                    </div>
                  ))}

                  <div className="absolute inset-y-0 left-14 right-0">
                    {positionedBlocks.map(({ block, lane, laneCount, top, height }) => {
                      const meta = quadrantMeta(block.quadrant);
                      const isCompact = height < 12;
                      const laneGapPx = 8;
                      const laneWidthPct = 100 / laneCount;
                      const laneWidth = `calc(${laneWidthPct}% - ${((laneCount - 1) * laneGapPx) / laneCount}px)`;
                      const laneLeft = `calc(${lane * laneWidthPct}% + ${lane * laneGapPx}px)`;

                      return (
                        <div
                          key={block.id}
                          className="absolute"
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                            width: laneWidth,
                            left: laneLeft,
                          }}
                        >
                          <div
                            className={`h-full overflow-hidden rounded-2xl border bg-[var(--color-bg-surface)] shadow-sm ${block.completed ? 'opacity-60' : ''} ${
                              isCompact ? 'p-2' : 'p-3'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={`flex flex-wrap items-center gap-2 ${isCompact ? 'mb-1' : ''}`}>
                                  <Badge variant={meta.badge}>{meta.label}</Badge>
                                  <span className="text-xs text-[var(--color-text-muted)]">
                                    {formatBlockTime(block.startTime, block.durationMinutes)}
                                  </span>
                                </div>
                                <p
                                  className={`text-sm font-semibold text-[var(--color-text-primary)] ${block.completed ? 'line-through' : ''} ${
                                    isCompact ? 'mt-1 line-clamp-2' : 'mt-2'
                                  }`}
                                >
                                  {block.title}
                                </p>
                                {block.completed && block.actualDurationMinutes && !isCompact && (
                                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                    Actual: {block.actualDurationMinutes} min vs planned {block.durationMinutes} min
                                  </p>
                                )}
                                {!isCompact && block.notes && (
                                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                                    {block.notes}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleBlock(block.id)}
                                  className={`rounded-xl p-2 transition-colors ${
                                    block.completed
                                      ? 'bg-[color-mix(in_srgb,var(--color-accent-calm)_18%,transparent)] text-[var(--color-accent-calm)]'
                                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-2)]'
                                  }`}
                                  aria-label={block.completed ? 'Mark block incomplete' : 'Mark block complete'}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeBlock(block.id)}
                                  className="rounded-xl p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-surface-2)]"
                                  aria-label="Delete block"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {completionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-bg-canvas)_80%,transparent)] p-5 backdrop-blur-sm">
          <Card padding="lg" variant="glass" className="w-full max-w-md space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  Log actual time
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  How long did <span className="font-medium text-[var(--color-text-primary)]">{completionTarget.title}</span> actually take?
                </p>
              </div>
              <button
                type="button"
                onClick={closeCompletionModal}
                className="rounded-xl p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-surface-2)]"
                aria-label="Close actual time logger"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([completionTarget.durationMinutes, ...ACTUAL_DURATION_OPTIONS]))
                .sort((left, right) => left - right)
                .map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    onClick={() => setActualDurationDraft(duration)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      actualDurationDraft === duration
                        ? 'bg-[var(--color-accent-focus)] text-white'
                        : 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)]'
                    }`}
                  >
                    {duration} min
                  </button>
                ))}
            </div>

            <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4 text-sm text-[var(--color-text-muted)]">
              Planned: {completionTarget.durationMinutes} min
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeCompletionModal}>
                Cancel
              </Button>
              <Button variant="focus" size="sm" onClick={saveCompletionActual}>
                Save actual time
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
