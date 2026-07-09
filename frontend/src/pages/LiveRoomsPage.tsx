import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Flag,
  LoaderCircle,
  Mic,
  MicOff,
  ShieldAlert,
  Video,
  VideoOff,
  Waves,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card, AIBadge } from '../components/ui/index.js';
import { api, ApiError } from '../lib/api.js';
import { liveRoomsEnabled } from '../lib/bodyDouble.js';

interface RoomParticipant {
  id: string;
  firstName: string;
  status: 'joined' | 'connecting' | 'open';
  commitment?: string;
  isLocal?: boolean;
}

interface RoomTokenPayload {
  server_url: string;
  participant_token: string;
  room_name: string;
  room_policy: {
    max_participants: number;
    chat_enabled: boolean;
    recordings_enabled: boolean;
    first_names_only: boolean;
    mute_default: boolean;
  };
}

const LOCAL_PARTICIPANT: RoomParticipant = {
  id: 'you',
  firstName: 'You',
  status: 'open',
  isLocal: true,
};

export default function LiveRoomsPage() {
  const navigate = useNavigate();
  const roomRef = useRef<unknown>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [commitment, setCommitment] = useState("I'm working on...");
  const [reportOpen, setReportOpen] = useState(false);
  const [waveSent, setWaveSent] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [roomSession, setRoomSession] = useState<RoomTokenPayload | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RoomParticipant[]>([]);
  const [connectionLabel, setConnectionLabel] = useState('Ready');

  const enabled = liveRoomsEnabled();
  const participants = useMemo(() => {
    const localParticipant: RoomParticipant = {
      ...LOCAL_PARTICIPANT,
      status: joined ? 'joined' : joining ? 'connecting' : 'open',
      commitment: joined || joining ? commitment : undefined,
    };

    const allParticipants = [localParticipant, ...remoteParticipants];
    while (allParticipants.length < 4) {
      allParticipants.push({
        id: `open-${allParticipants.length}`,
        firstName: 'Open',
        status: 'open',
      });
    }
    return allParticipants.slice(0, 4);
  }, [commitment, joined, joining, remoteParticipants]);

  useEffect(
    () => () => {
      void disconnectRoom(roomRef.current);
    },
    [],
  );

  const syncRemoteParticipants = (room: RoomLike) => {
    const nextParticipants = Array.from(room.remoteParticipants.values())
      .slice(0, 3)
      .map((participant) => ({
        id: participant.identity,
        firstName: participant.name || participant.identity.split('-')[0] || 'Guest',
        status: 'joined' as const,
        commitment: participant.attributes.commitment || parseCommitment(participant.metadata),
      }));

    setRemoteParticipants(nextParticipants);
  };

  const attachTrackToVideo = (
    track: TrackLike,
    participant: RemoteParticipantLike,
  ) => {
    if (track.kind !== 'video') return;
    const element = remoteVideoRefs.current[participant.identity];
    if (!element) return;
    track.attach(element);
  };

  const joinRoom = async () => {
    setJoining(true);
    setMediaError(null);

    try {
      const { Room, RoomEvent } = await import('livekit-client');
      const tokenPayload = await api.post<RoomTokenPayload>('/rooms/token', {
        participant_name: 'You',
        participant_metadata: JSON.stringify({ commitment }),
        participant_attributes: { commitment },
      });
      setRoomSession(tokenPayload);

      const room = new Room();
      roomRef.current = room;

      room
        .on(RoomEvent.Connected, () => {
          setConnectionLabel('Connected');
          syncRemoteParticipants(room);
        })
        .on(RoomEvent.ConnectionStateChanged, (state) => {
          setConnectionLabel(String(state));
        })
        .on(RoomEvent.ParticipantConnected, () => {
          syncRemoteParticipants(room);
        })
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          delete remoteVideoRefs.current[participant.identity];
          syncRemoteParticipants(room);
        })
        .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          attachTrackToVideo(track, participant);
        })
        .on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
          const element = remoteVideoRefs.current[participant.identity];
          if (track.kind === 'video' && element) {
            track.detach(element);
          }
        })
        .on(RoomEvent.Disconnected, () => {
          setConnectionLabel('Disconnected');
          setJoined(false);
          setRemoteParticipants([]);
        });

      await room.connect(tokenPayload.server_url, tokenPayload.participant_token);
      await room.localParticipant.setMicrophoneEnabled(false);
      const localPublication = await room.localParticipant.setCameraEnabled(true);
      if (
        localVideoRef.current &&
        localPublication?.track &&
        'attach' in localPublication.track
      ) {
        localPublication.track.attach(localVideoRef.current);
      }

      setMuted(true);
      setCameraOn(true);
      setJoined(true);
      syncRemoteParticipants(room);
    } catch (error) {
      if (error instanceof ApiError) {
        setMediaError(error.detail);
      } else if (error instanceof Error) {
        setMediaError(error.message || 'Live room transport is not ready yet, but the room shell is available.');
      } else {
        setMediaError('Live room transport is not ready yet, but the room shell is available.');
      }

      await disconnectRoom(roomRef.current);
      roomRef.current = null;
      setRoomSession(null);
    } finally {
      setJoining(false);
    }
  };

  const leaveRoom = async () => {
    await disconnectRoom(roomRef.current);
    roomRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setJoined(false);
    setRoomSession(null);
    setRemoteParticipants([]);
    setConnectionLabel('Ready');
    setWaveSent(false);
  };

  const toggleMute = async () => {
    const nextMuted = !muted;
    await getRoom(roomRef.current)?.localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  };

  const toggleCamera = async () => {
    const nextCameraOn = !cameraOn;
    await getRoom(roomRef.current)?.localParticipant.setCameraEnabled(nextCameraOn);
    setCameraOn(nextCameraOn);
  };

  if (!enabled) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/calm')}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={16} /> Calm
        </button>
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center gap-2 text-[var(--color-accent-lilac)]">
            <ShieldAlert size={18} />
            <p className="font-medium text-[var(--color-text-primary)]">Live rooms are off</p>
          </div>
          <AIBadge variant="coming-soon" />
          <p className="text-sm leading-6 text-[var(--color-text-muted)]">
            Turn on <code>VITE_ENABLE_LIVE_BODY_DOUBLE_ROOMS=true</code> to test the room shell.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/calm')}
            className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]"
          >
            <ArrowLeft size={16} /> Calm
          </button>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            Live body double room
          </h1>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Silent video, four seats max, first names only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="lilac">Feature flag</Badge>
          <AIBadge variant="coming-soon" />
        </div>
      </div>

      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Commitment caption
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Optional. Visible to the room, no chat.
            </p>
          </div>
          <Badge variant="muted">4 seats</Badge>
        </div>
        <input
          value={commitment}
          onChange={(event) => setCommitment(event.target.value)}
          className="w-full rounded-xl bg-[var(--color-bg-surface-2)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none"
        />
        <div className="flex gap-3">
          {!joined ? (
            <Button fullWidth variant="lilac" onClick={() => void joinRoom()} disabled={joining}>
              {joining ? <LoaderCircle size={16} className="animate-spin" /> : null}
              {joining ? 'Joining...' : 'Join room'}
            </Button>
          ) : (
            <Button fullWidth variant="secondary" onClick={() => void leaveRoom()}>
              Leave room
            </Button>
          )}
        </div>
        {mediaError && (
          <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-accent-warm)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-text-primary)]">
            {mediaError}
          </div>
        )}
        {roomSession && (
          <div className="rounded-xl bg-[var(--color-bg-surface-2)] px-4 py-3 text-sm text-[var(--color-text-primary)]">
            Connected policy: room <strong>{roomSession.room_name}</strong>,{' '}
            {roomSession.room_policy.max_participants} seats, chat off, recordings off. Status:{' '}
            {connectionLabel}.
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {participants.map((participant) => (
          <Card key={participant.id} padding="md" className="min-h-[180px] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {participant.firstName}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {participant.status === 'joined'
                    ? 'In room'
                    : participant.status === 'connecting'
                      ? 'Connecting'
                      : 'Open seat'}
                </p>
              </div>
              <Badge variant={participant.status === 'joined' ? 'focus' : 'muted'}>
                {participant.status === 'joined' ? 'Live' : 'Idle'}
              </Badge>
            </div>

            {participant.isLocal && (joined || joining) ? (
              <div className="overflow-hidden rounded-2xl bg-[var(--color-bg-surface-2)]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full object-cover"
                />
              </div>
            ) : participant.status === 'joined' ? (
              <div className="overflow-hidden rounded-2xl bg-[var(--color-bg-surface-2)]">
                <video
                  ref={(element) => {
                    remoteVideoRefs.current[participant.id] = element;
                  }}
                  autoPlay
                  playsInline
                  className="aspect-video w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-2xl bg-[var(--color-bg-surface-2)] text-[var(--color-text-muted)]">
                <VideoOff size={28} />
              </div>
            )}

            <p className="text-sm text-[var(--color-text-muted)]">
              {participant.commitment ?? 'No commitment caption set.'}
            </p>
          </Card>
        ))}
      </div>

      {joined && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Room controls
            </p>
            <Button variant="ghost" size="sm" onClick={() => setReportOpen((open) => !open)}>
              <Flag size={16} />
              Report
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => void toggleMute()}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
              {muted ? 'Muted' : 'Mic on'}
            </Button>
            <Button variant="secondary" onClick={() => void toggleCamera()}>
              {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
              {cameraOn ? 'Camera on' : 'Camera off'}
            </Button>
          </div>

          {reportOpen && (
            <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--color-accent-warm)_30%,transparent)] px-4 py-4 text-sm text-[var(--color-text-primary)]">
              Report flow is ready for room moderation follow-up. It keeps first-name-only
              context and excludes chat history because chat is disabled.
            </div>
          )}

          <div className="rounded-xl bg-[var(--color-bg-surface-2)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  End-of-session wave
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Optional. No chat transcript, no reaction history.
                </p>
              </div>
              <Button
                variant={waveSent ? 'focus' : 'secondary'}
                size="sm"
                onClick={() => setWaveSent(true)}
              >
                <Waves size={16} />
                {waveSent ? 'Wave sent' : 'Send wave'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function parseCommitment(metadata: string | undefined) {
  if (!metadata) return undefined;

  try {
    const parsed = JSON.parse(metadata) as { commitment?: string };
    return parsed.commitment;
  } catch {
    return undefined;
  }
}

type RemoteParticipantLike = {
  identity: string;
  name?: string;
  metadata?: string;
  attributes: Record<string, string>;
};

type TrackLike = {
  kind: string;
  attach: (element: HTMLVideoElement) => void;
  detach: (element: HTMLVideoElement) => void;
};

type RoomLike = {
  remoteParticipants: Map<string, RemoteParticipantLike>;
  localParticipant: {
    setMicrophoneEnabled: (enabled: boolean) => Promise<unknown>;
    setCameraEnabled: (enabled: boolean) => Promise<{ track?: { attach?: (element: HTMLVideoElement) => void } } | undefined>;
  };
  connect: (serverUrl: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
};

function getRoom(room: unknown): RoomLike | null {
  return room && typeof room === 'object' ? (room as RoomLike) : null;
}

async function disconnectRoom(room: unknown) {
  await getRoom(room)?.disconnect();
}
