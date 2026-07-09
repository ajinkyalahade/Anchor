import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bell,
  Bot,
  Check,
  Copy,
  Download,
  Eye,
  Lock,
  Music,
  Palette,
  Share2,
  Trash2,
  Type,
  Settings,
} from 'lucide-react';
import { Card, Skeleton } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { requestAccountDeletion } from '../lib/account';
import type { ReadOnlySharePacket } from '../lib/export';
import {
  type UnlockCatalogItem,
  type UnlocksResponse,
  activateItem,
  fetchUnlocks,
} from '../lib/rewards';

function UnlockCard({
  item,
  isActive,
  onActivate,
  activating,
}: {
  item: UnlockCatalogItem;
  isActive: boolean;
  onActivate: (id: string) => void;
  activating: boolean;
}) {
  const icon =
    item.type === 'theme' ? (
      <Palette size={20} className={item.unlocked ? 'text-[var(--color-accent-focus)]' : 'text-[var(--color-text-muted)]'} />
    ) : (
      <Music size={20} className={item.unlocked ? 'text-[var(--color-accent-calm)]' : 'text-[var(--color-text-muted)]'} />
    );

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card
        padding="md"
        className={`transition-all ${
          isActive
            ? 'border-[var(--color-accent-focus)] ring-1 ring-[var(--color-accent-focus)]'
            : item.unlocked
            ? 'cursor-pointer hover:border-[var(--color-text-muted)]'
            : 'opacity-60'
        }`}
        onClick={item.unlocked && !isActive ? () => onActivate(item.id) : undefined}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {item.unlocked ? icon : <Lock size={20} className="text-[var(--color-text-muted)]" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-sm ${item.unlocked ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-accent-focus)] bg-[color-mix(in_srgb,var(--color-accent-focus)_10%,transparent)] px-1.5 py-0.5 rounded-full">
                  <Check size={10} /> Active
                </span>
              )}
              {!item.unlocked && (
                <span className="text-[10px] text-[var(--color-text-muted)]">{item.xp_required} XP</span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{item.description}</p>
          </div>
          {activating && (
            <div className="w-4 h-4 border-2 border-[var(--color-accent-focus)] border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function useDyslexiaFont() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('anchor_dyslexia_font') === 'true');
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem('anchor_dyslexia_font', String(next));
    document.documentElement.classList.toggle('font-dyslexia', next);
  };
  return { enabled, toggle };
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<UnlocksResponse | null>(null);
  const [loadingUnlocks, setLoadingUnlocks] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareLabel, setShareLabel] = useState('Caregiver share');
  const [sharePackets, setSharePackets] = useState<ReadOnlySharePacket[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletionBusy, setDeletionBusy] = useState<'scheduled' | 'immediate' | null>(null);
  const [deletionMessage, setDeletionMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const { enabled: dyslexiaFont, toggle: toggleDyslexia } = useDyslexiaFont();

  // AI & nudge prefs
  const [nudgeFreq, setNudgeFreq] = useState<string>('normal');
  const [aiEngine, setAiEngine] = useState<string>('anthropic');
  const [engineStatus, setEngineStatus] = useState<Record<string, { available: boolean; models: string[] }> | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [shareAiContext, setShareAiContext] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);

  useEffect(() => {
    void import('../lib/export.js').then(({ loadReadOnlySharePackets }) => {
      setSharePackets(loadReadOnlySharePackets());
    });
    void fetchUnlocks().then((next) => {
      setData(next);
      if (!next) setPageError('Themes and sounds are temporarily unavailable.');
      setLoadingUnlocks(false);
    });
    // Load preferences + engine status + consent
    void api.get<Record<string, string>>('/account/preferences')
      .then((prefs) => {
        if (prefs.nudge_frequency) setNudgeFreq(prefs.nudge_frequency);
        if (prefs.ai_engine) setAiEngine(prefs.ai_engine);
      }).catch(() => {});
    void api.get<{ share_ai_context: boolean }>('/ai/user-state')
      .then((state) => { if (typeof state.share_ai_context === 'boolean') setShareAiContext(state.share_ai_context); })
      .catch(() => {});
    void api.get<Record<string, { available: boolean; models: string[] }>>('/ai/engines')
      .then(setEngineStatus).catch(() => {});
  }, []);

  const savePrefs = async (patch: Record<string, string>) => {
    setPrefsSaving(true);
    try { await api.patch('/account/preferences', patch); } catch { /* silent */ }
    finally { setPrefsSaving(false); }
  };

  const themes = data?.catalog.filter((c) => c.type === 'theme') ?? [];
  const sounds = data?.catalog.filter((c) => c.type === 'sound') ?? [];

  const handleActivate = async (itemId: string) => {
    setActivatingId(itemId);
    setPageError(null);
    const ok = await activateItem(itemId);
    if (ok && data) {
      setData({
        ...data,
        active_theme: itemId.startsWith('theme_') ? itemId : data.active_theme,
        active_sound: itemId.startsWith('sound_') ? itemId : data.active_sound,
      });
    } else {
      setPageError('We could not activate that unlock right now.');
    }
    setActivatingId(null);
  };

  const exportJson = async () => {
    const { buildAnchorExportBundle, downloadTextFile } = await import('../lib/export.js');
    const bundle = await buildAnchorExportBundle();
    downloadTextFile('anchor-export.json', JSON.stringify(bundle, null, 2), 'application/json');
  };

  const exportCsv = async () => {
    const { buildAnchorExportBundle, buildAnchorExportCsv, downloadTextFile } = await import('../lib/export.js');
    const bundle = await buildAnchorExportBundle();
    downloadTextFile('anchor-export.csv', buildAnchorExportCsv(bundle), 'text/csv;charset=utf-8');
  };

  const exportClinicianJson = async () => {
    const { buildAnchorExportBundle, buildClinicianSummary, downloadTextFile } = await import('../lib/export.js');
    const bundle = await buildAnchorExportBundle();
    downloadTextFile('anchor-clinician-summary.json', JSON.stringify(buildClinicianSummary(bundle), null, 2), 'application/json');
  };

  const exportClinicianText = async () => {
    const { buildAnchorExportBundle, buildClinicianSummary, buildClinicianSummaryText, downloadTextFile } = await import('../lib/export.js');
    const bundle = await buildAnchorExportBundle();
    downloadTextFile('anchor-clinician-summary.txt', buildClinicianSummaryText(buildClinicianSummary(bundle)), 'text/plain;charset=utf-8');
  };

  const exportClinicianHtml = async () => {
    const { buildAnchorExportBundle, buildClinicianSummary, buildClinicianReportHtml, downloadTextFile } = await import('../lib/export.js');
    const bundle = await buildAnchorExportBundle();
    const summary = buildClinicianSummary(bundle);
    downloadTextFile('anchor-clinician-report.html', buildClinicianReportHtml(bundle, summary), 'text/html;charset=utf-8');
  };

  const exportClinicianPdf = async () => {
    const { buildAnchorExportBundle, buildClinicianSummary, buildClinicianPdfBlob, downloadBlobFile } = await import('../lib/export.js');
    const bundle = await buildAnchorExportBundle();
    const summary = buildClinicianSummary(bundle);
    downloadBlobFile('anchor-clinician-report.pdf', await buildClinicianPdfBlob(bundle, summary));
  };

  const clearLocalData = () => {
    void import('../lib/export.js').then(({ clearLocalAnchorData }) => {
      clearLocalAnchorData();
    });
    window.location.reload();
  };

  const handleAccountDeletion = async (mode: 'scheduled' | 'immediate') => {
    setDeletionBusy(mode);
    setDeletionMessage(null);
    try {
      const response = await requestAccountDeletion(mode);
      setDeletionMessage(response.message);
      if (response.deleted_now) {
        clearLocalData();
        navigate('/onboarding');
        window.location.reload();
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setDeletionMessage(error.detail);
      } else if (error instanceof Error) {
        setDeletionMessage(error.message);
      } else {
        setDeletionMessage('We could not finish that account update right now.');
      }
    } finally {
      setDeletionBusy(null);
    }
  };

  const createSharePacket = async () => {
    if (!shareEnabled) return;
    const { buildAnchorExportBundle, buildClinicianSummary, createReadOnlySharePacket, loadReadOnlySharePackets } =
      await import('../lib/export.js');
    const bundle = await buildAnchorExportBundle();
    const summary = buildClinicianSummary(bundle);
    createReadOnlySharePacket(bundle, summary, shareLabel);
    const packets = loadReadOnlySharePackets();
    setSharePackets(packets);
    const latest = packets[0];
    if (latest && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${window.location.origin}/shared/${latest.id}`);
    }
  };

  const copyShareLink = async (packetId: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${window.location.origin}/shared/${packetId}`);
    }
  };

  const revokeShareLink = (packetId: string) => {
    void import('../lib/export.js').then(({ revokeReadOnlySharePacket }) => {
      setSharePackets(revokeReadOnlySharePacket(packetId));
    });
  };

  return (
    <div className="space-y-8 px-8 py-8 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/me')}
          className="p-2 rounded-xl hover:bg-[var(--color-bg-surface-2)] text-[var(--color-text-muted)] transition-colors -ml-2"
          aria-label="Back to Profile"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-[var(--color-accent-lilac)]" />
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Settings</h1>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Appearance, accessibility, data</p>
        </div>
      </div>

      {pageError && (
        <Card padding="md" className="border-[var(--color-accent-warm)]/20 bg-[color-mix(in_srgb,var(--color-accent-warm)_10%,transparent)]">
          <p className="text-sm text-[var(--color-text-primary)]">{pageError}</p>
        </Card>
      )}

      {/* AI Engine */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">AI Engine</h2>
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <Bot size={18} className="text-[var(--color-accent-lilac)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Processing engine</p>
              <p className="text-xs text-[var(--color-text-muted)]">Cloud uses Anthropic. Local runs fully on your device via Ollama.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'anthropic', label: 'Cloud', desc: 'Anthropic' },
              { value: 'ollama', label: 'Local', desc: 'Ollama' },
              { value: 'auto', label: 'Auto', desc: 'Local first' },
            ].map(({ value, label, desc }) => {
              const status = engineStatus?.[value === 'auto' ? 'ollama' : value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setAiEngine(value); void savePrefs({ ai_engine: value }); }}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    aiEngine === value
                      ? 'border-[var(--color-accent-lilac)] bg-[color-mix(in_srgb,var(--color-accent-lilac)_10%,transparent)]'
                      : 'border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] hover:border-[var(--color-text-muted)]'
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{desc}</p>
                  {value !== 'auto' && status && (
                    <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${status.available ? 'bg-green-500' : 'bg-red-400'}`} />
                  )}
                </button>
              );
            })}
          </div>
          {prefsSaving && <p className="text-xs text-[var(--color-text-muted)]">Saving…</p>}
        </Card>
      </section>

      {/* AI Context Consent */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">AI Context Sharing</h2>
        <Card padding="md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Share session context with AI</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Allows Claude to personalise suggestions based on your recent sessions. Off by default. Your text is pseudonymised before sending.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const next = !shareAiContext;
                setShareAiContext(next);
                setConsentSaving(true);
                try { await api.patch('/ai/consent', { share_ai_context: next }); }
                catch { setShareAiContext(!next); }
                finally { setConsentSaving(false); }
              }}
              className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${shareAiContext ? 'bg-[var(--color-accent-lilac)]' : 'bg-[var(--color-bg-surface-2)]'}`}
              aria-pressed={shareAiContext}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${shareAiContext ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {consentSaving && <p className="text-xs text-[var(--color-text-muted)] mt-2">Saving…</p>}
        </Card>
      </section>

      {/* Nudge Frequency */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Proactive Nudges</h2>
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-[var(--color-accent-spark)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">How often Anchor checks in</p>
              <p className="text-xs text-[var(--color-text-muted)]">Push notifications for streak risk, crash windows, and idle gaps.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { value: 'none', label: 'Off' },
              { value: 'gentle', label: 'Gentle', sub: 'Max 2/day' },
              { value: 'normal', label: 'Normal', sub: 'Max 4/day' },
              { value: 'proactive', label: 'Proactive', sub: 'Up to 8/day' },
            ].map(({ value, label, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setNudgeFreq(value); void savePrefs({ nudge_frequency: value }); }}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  nudgeFreq === value
                    ? 'border-[var(--color-accent-spark)] bg-[color-mix(in_srgb,var(--color-accent-spark)_10%,transparent)]'
                    : 'border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
                {sub && <p className="text-[10px] text-[var(--color-text-muted)]">{sub}</p>}
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* Accessibility */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Accessibility</h2>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Type size={18} className="text-[var(--color-text-muted)]" />
              <div>
                <p className="font-medium text-sm text-[var(--color-text-primary)]">Dyslexia-friendly font</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Uses Lexend — wider spacing, easier to read</p>
              </div>
            </div>
            <button
              onClick={toggleDyslexia}
              role="switch"
              aria-checked={dyslexiaFont}
              className={`w-11 h-6 rounded-full transition-colors relative ${dyslexiaFont ? 'bg-[var(--color-accent-focus)]' : 'bg-[var(--color-bg-surface-2)]'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${dyslexiaFont ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </Card>
      </section>

      {/* Visual Themes */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Visual Themes</h2>
        {loadingUnlocks ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {themes.map((item) => (
              <UnlockCard
                key={item.id}
                item={item}
                isActive={data?.active_theme === item.id}
                onActivate={handleActivate}
                activating={activatingId === item.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Ambient Sounds */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Ambient Sounds</h2>
        {loadingUnlocks ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {sounds.map((item) => (
              <UnlockCard
                key={item.id}
                item={item}
                isActive={data?.active_sound === item.id}
                onActivate={handleActivate}
                activating={activatingId === item.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Export */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Export Your Data</h2>
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-focus)_12%,transparent)] p-3 text-[var(--color-accent-focus)]">
              <Download size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Your local data</p>
              <p className="text-xs text-[var(--color-text-muted)]">Focus, quests, planner, and digest data from this device.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Export JSON', desc: 'Structured bundle with local state and rewards.', fn: exportJson },
              { label: 'Export CSV', desc: 'Flat rows for session, quest, and planner analysis.', fn: exportCsv },
              { label: 'Clinician JSON', desc: 'Condensed summary for sharing patterns.', fn: exportClinicianJson },
              { label: 'Clinician PDF', desc: 'Printable clinician handoff in PDF format.', fn: exportClinicianPdf },
              { label: 'Clinician text', desc: 'Readable handoff for notes or intake docs.', fn: exportClinicianText },
            ].map(({ label, desc, fn }) => (
              <button
                key={label}
                type="button"
                onClick={() => { void fn(); }}
                className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-4 text-left transition-colors hover:bg-[var(--color-bg-surface)]"
              >
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{desc}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { void exportClinicianHtml(); }}
              className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-4 text-left transition-colors hover:bg-[var(--color-bg-surface)] sm:col-span-2"
            >
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Clinician report HTML</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Printable packet. Suitable for browser print-to-PDF.</p>
            </button>
          </div>
        </Card>
      </section>

      {/* Read-only share */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Read-Only Share</h2>
        <Card padding="md" className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Caregiver or partner view</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Explicit opt-in only. Generates a read-only summary link on this device.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={shareEnabled}
              onClick={() => setShareEnabled((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${shareEnabled ? 'bg-[var(--color-accent-focus)]' : 'bg-[var(--color-bg-surface-2)]'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${shareEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {shareEnabled ? (
            <div className="space-y-4">
              <input
                value={shareLabel}
                onChange={(e) => setShareLabel(e.target.value)}
                className="w-full rounded-xl bg-[var(--color-bg-surface-2)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => { void createSharePacket(); }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent-focus)] px-4 py-3 text-sm font-medium text-white"
              >
                <Share2 size={16} /> Generate share link
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-4 text-sm text-[var(--color-text-muted)]">
              Sharing stays off unless you enable it here.
            </div>
          )}

          {sharePackets.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Active shares</p>
              {sharePackets.map((packet) => (
                <div key={packet.id} className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{packet.label}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{new Date(packet.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => { void copyShareLink(packet.id); }} className="rounded-xl bg-[var(--color-bg-surface)] p-2 text-[var(--color-text-primary)]">
                        <Copy size={16} />
                      </button>
                      <a href={`/shared/${packet.id}`} className="rounded-xl bg-[var(--color-bg-surface)] p-2 text-[var(--color-text-primary)]">
                        <Eye size={16} />
                      </a>
                      <button type="button" onClick={() => revokeShareLink(packet.id)} className="rounded-xl bg-[var(--color-bg-surface)] p-2 text-[var(--color-text-primary)]">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Data controls */}
      <section className="space-y-3 pb-8">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Data Controls</h2>
        <Card padding="md" className="space-y-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Delete account or clear this device</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Account deletion removes backend data. Local reset only clears this browser.
            </p>
          </div>

          {deletionMessage && (
            <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-calm)_12%,transparent)] px-4 py-4 text-sm text-[var(--color-text-primary)]">
              {deletionMessage}
            </div>
          )}

          {showDeleteConfirm ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-warm)_12%,transparent)] px-4 py-4 text-sm text-[var(--color-text-primary)]">
                Scheduled deletion keeps a 30-day recovery window. Immediate deletion removes the backend account now.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={deletionBusy !== null}
                  onClick={() => { void handleAccountDeletion('scheduled'); }}
                  className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  {deletionBusy === 'scheduled' ? 'Scheduling...' : 'Schedule (30 days)'}
                </button>
                <button
                  type="button"
                  disabled={deletionBusy !== null}
                  onClick={() => { void handleAccountDeletion('immediate'); }}
                  className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 disabled:opacity-50"
                >
                  {deletionBusy === 'immediate' ? 'Deleting...' : 'Delete now'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full text-sm text-[var(--color-text-muted)] py-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-accent-warm)]"
              >
                Delete account
              </button>
              <button
                type="button"
                onClick={clearLocalData}
                className="rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-text-muted)]"
              >
                Reset this device
              </button>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
