import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Headphones,
  Play,
  Pause,
  Radio,
  RefreshCcw,
  SlidersHorizontal,
  Users,
  Video,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card } from './ui';
import {
  AMBIENT_LAYERS,
  AMBIENT_PACKS,
  createPresenceSnapshot,
  DEFAULT_MIX,
  liveRoomsEnabled,
  type LayerKey,
  type MixState,
} from '../lib/bodyDouble';

interface LayerNodes {
  source: AudioNode;
  gain: GainNode;
}

function createNoiseBuffer(
  context: AudioContext,
  kind: 'white' | 'brown',
  durationSeconds = 2,
) {
  const length = context.sampleRate * durationSeconds;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);

  if (kind === 'white') {
    for (let index = 0; index < length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  let last = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    channel[index] = last * 3.5;
  }
  return buffer;
}

function createLoopingNoiseSource(
  context: AudioContext,
  kind: 'white' | 'brown',
) {
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, kind);
  source.loop = true;
  return source;
}

function setGain(gainNode: GainNode, value: number) {
  gainNode.gain.linearRampToValueAtTime(value, gainNode.context.currentTime + 0.12);
}

export default function AmbientMixer() {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePackId, setActivePackId] = useState(AMBIENT_PACKS[0].id);
  const [mix, setMix] = useState<MixState>(DEFAULT_MIX);
  const [presenceBaseMs] = useState(() => Date.now());
  const [presenceVersion, setPresenceVersion] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const layerNodesRef = useRef<Partial<Record<LayerKey, LayerNodes>>>({});

  const activePack = useMemo(
    () => AMBIENT_PACKS.find((pack) => pack.id === activePackId) ?? AMBIENT_PACKS[0],
    [activePackId],
  );
  const presence = useMemo(
    () => createPresenceSnapshot(activePackId, new Date(presenceBaseMs + presenceVersion * 60000)),
    [activePackId, presenceBaseMs, presenceVersion],
  );
  const isLiveRoomsEnabled = liveRoomsEnabled();

  const ensureAudioGraph = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const context = audioContextRef.current;

    if (Object.keys(layerNodesRef.current).length > 0) return context;

    const rainSource = createLoopingNoiseSource(context, 'white');
    const rainFilter = context.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 2200;
    rainFilter.Q.value = 0.6;
    const rainGain = context.createGain();
    rainGain.gain.value = 0;
    rainSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(context.destination);
    rainSource.start();
    layerNodesRef.current.rain = { source: rainSource, gain: rainGain };

    const brownSource = createLoopingNoiseSource(context, 'brown');
    const brownGain = context.createGain();
    brownGain.gain.value = 0;
    brownSource.connect(brownGain);
    brownGain.connect(context.destination);
    brownSource.start();
    layerNodesRef.current.brown = { source: brownSource, gain: brownGain };

    const fanOscillator = context.createOscillator();
    fanOscillator.type = 'triangle';
    fanOscillator.frequency.value = 72;
    const fanFilter = context.createBiquadFilter();
    fanFilter.type = 'lowpass';
    fanFilter.frequency.value = 180;
    const fanGain = context.createGain();
    fanGain.gain.value = 0;
    fanOscillator.connect(fanFilter);
    fanFilter.connect(fanGain);
    fanGain.connect(context.destination);
    fanOscillator.start();
    layerNodesRef.current.fan = { source: fanOscillator, gain: fanGain };

    const cafeSource = createLoopingNoiseSource(context, 'white');
    const cafeFilter = context.createBiquadFilter();
    cafeFilter.type = 'bandpass';
    cafeFilter.frequency.value = 800;
    cafeFilter.Q.value = 0.35;
    const cafeGain = context.createGain();
    cafeGain.gain.value = 0;
    cafeSource.connect(cafeFilter);
    cafeFilter.connect(cafeGain);
    cafeGain.connect(context.destination);
    cafeSource.start();
    layerNodesRef.current.cafe = { source: cafeSource, gain: cafeGain };

    return context;
  };

  useEffect(() => {
    const context = audioContextRef.current;
    if (!context) return;

    if (isPlaying) {
      void context.resume().catch(() => undefined);
    } else {
      void context.suspend().catch(() => undefined);
    }
  }, [isPlaying]);

  useEffect(() => {
    for (const layer of AMBIENT_LAYERS) {
      const layerNode = layerNodesRef.current[layer.key];
      if (!layerNode) continue;
      setGain(layerNode.gain, mix[layer.key] * 0.18);
    }
  }, [mix]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPresenceVersion((version) => version + 1);
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(
    () => () => {
      for (const layer of Object.values(layerNodesRef.current)) {
        if (layer?.source instanceof AudioBufferSourceNode) {
          layer.source.stop();
        }
        if (layer?.source instanceof OscillatorNode) {
          layer.source.stop();
        }
      }
      void audioContextRef.current?.close().catch(() => undefined);
    },
    [],
  );

  const togglePlayback = () => {
    ensureAudioGraph();
    setIsPlaying((playing) => !playing);
  };

  const applyPack = (packId: string) => {
    const nextPack = AMBIENT_PACKS.find((pack) => pack.id === packId);
    if (!nextPack) return;
    ensureAudioGraph();
    setActivePackId(packId);
    setMix(nextPack.mix);
  };

  return (
    <div className="space-y-5">
      <Card padding="lg" className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent-calm)]">
              Body Double Mode
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
              Ambient mixer
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Blend sound layers that keep a room around you without asking for attention.
            </p>
          </div>
          <Button variant={isPlaying ? 'calm' : 'secondary'} size="sm" onClick={togglePlayback}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? 'Pause mix' : 'Start mix'}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {AMBIENT_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => applyPack(pack.id)}
              className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                activePackId === pack.id
                  ? 'border-transparent bg-[var(--color-bg-surface-2)]'
                  : 'border-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)] bg-[var(--color-bg-surface)]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{pack.label}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{pack.description}</p>
                </div>
                {activePackId === pack.id && <Badge variant="calm">Active</Badge>}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Layer balance
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Fine-tune the room after picking a pack.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-focus)_10%,transparent)] px-3 py-2 text-sm text-[var(--color-accent-focus)]">
            <SlidersHorizontal size={16} /> Live mix
          </div>
        </div>

        <div className="space-y-4">
          {AMBIENT_LAYERS.map((layer) => (
            <label key={layer.key} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {layer.label}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {Math.round(mix[layer.key] * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(mix[layer.key] * 100)}
                onChange={(event) =>
                  setMix((current) => ({
                    ...current,
                    [layer.key]: Number(event.target.value) / 100,
                  }))
                }
                className="w-full accent-[var(--color-accent-calm)]"
              />
            </label>
          ))}
        </div>
      </Card>

      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <Headphones size={18} className="text-[var(--color-accent-calm)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Current scene
          </h3>
        </div>
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          {activePack.label} is active. {activePack.description} The mix runs entirely on-device, so
          it starts fast and keeps working without fetching audio files.
        </p>
      </Card>

      <Card padding="md" className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[var(--color-accent-focus)]" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Working with others
              </h3>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Async room activity, refreshed on demand. No live presence yet.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPresenceVersion((version) => version + 1)}
            icon={<RefreshCcw size={16} />}
          >
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Active now
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
              {presence.activeNow}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Joined last hour
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
              {presence.joinedLastHour}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Checked in today
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
              {presence.checkedInToday}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Badge variant="focus">
            <Radio size={12} className="mr-1" />
            Snapshot
          </Badge>
          <span>{presence.currentPackLabel} listeners are included.</span>
          <span>Updated {presence.updatedAtLabel}</span>
        </div>
      </Card>

      <Card padding="md" className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Video size={18} className="text-[var(--color-accent-lilac)]" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Live rooms
              </h3>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Silent rooms, four people max, with optional commitment captions.
            </p>
          </div>
          <Badge variant={isLiveRoomsEnabled ? 'lilac' : 'muted'}>
            {isLiveRoomsEnabled ? 'Flag on' : 'Flag off'}
          </Badge>
        </div>

        {isLiveRoomsEnabled ? (
          <div className="space-y-4 rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-lilac)_12%,transparent)] px-4 py-4 text-sm leading-6 text-[var(--color-text-primary)]">
            <p>
              Silent rooms are available in this environment. Join a four-seat room with mute on by
              default, first-name-only identity, and no chat.
            </p>
            <Button variant="lilac" fullWidth onClick={() => navigate('/rooms')}>
              <Video size={16} />
              Enter live room
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--color-text-muted)_20%,transparent)] px-4 py-4 text-sm leading-6 text-[var(--color-text-muted)]">
            Live rooms stay hidden until <code>VITE_ENABLE_LIVE_BODY_DOUBLE_ROOMS=true</code> is set.
            This keeps the prep work in place without exposing unfinished realtime behavior.
          </div>
        )}
      </Card>
    </div>
  );
}
