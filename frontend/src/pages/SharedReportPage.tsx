import * as React from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { Badge, Card } from '../components/ui/index.js';
import { getReadOnlySharePacket } from '../lib/export.js';

export default function SharedReportPage() {
  const { packetId = '' } = useParams();
  const packet = React.useMemo(() => getReadOnlySharePacket(packetId), [packetId]);

  if (!packet) {
    return (
      <div className="space-y-6">
        <Link
          to="/me"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] no-underline"
        >
          <ArrowLeft size={16} /> Me
        </Link>
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center gap-2 text-[var(--color-accent-warm)]">
            <Lock size={18} />
            <p className="font-medium text-[var(--color-text-primary)]">Share unavailable</p>
          </div>
          <p className="text-sm leading-6 text-[var(--color-text-muted)]">
            This read-only share link is missing or has been revoked on this device.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/me"
            className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] no-underline"
          >
            <ArrowLeft size={16} /> Me
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {packet.label}
          </h1>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Read-only share summary generated {new Date(packet.createdAt).toLocaleString()}.
          </p>
        </div>
        <Badge variant="focus">Read only</Badge>
      </div>

      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--color-accent-focus)]">
          <ShieldCheck size={18} />
          <p className="font-medium text-[var(--color-text-primary)]">
            Shared summary
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Focus sessions" value={String(packet.summary.sessionsCount)} />
          <Metric label="Avg session" value={`${packet.summary.averageSessionMinutes} min`} />
          <Metric label="Avg focus" value={`${packet.summary.averageFocusScore}/100`} />
          <Metric label="Top quest" value={packet.summary.topQuest ?? 'None'} />
        </div>
      </Card>

      <Card padding="md" className="space-y-3">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Observed notes</p>
        <div className="space-y-2">
          {packet.summary.notes.map((note) => (
            <div
              key={note}
              className="rounded-xl bg-[var(--color-bg-surface-2)] px-4 py-3 text-sm text-[var(--color-text-primary)]"
            >
              {note}
            </div>
          ))}
        </div>
      </Card>

      {packet.latestDigestSummary && (
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Latest digest</p>
          <p className="text-sm leading-6 text-[var(--color-text-primary)]">
            {packet.latestDigestSummary}
          </p>
        </Card>
      )}

      {packet.rewards && (
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Rewards snapshot</p>
          <p className="text-sm text-[var(--color-text-primary)]">
            {packet.rewards.total_xp} XP recorded on this device.
          </p>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}
