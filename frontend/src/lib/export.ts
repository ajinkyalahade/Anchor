import { loadInsightDashboard, type InsightSession, type WeeklyDigestEntry } from './insights.js';
import {
  loadBrainDumpEntries,
  loadCaptureInboxItems,
  loadTimeBlocks,
  loadTransitionAlertPreferences,
  type BrainDumpEntry,
  type CaptureInboxItem,
  type TimeBlock,
} from './planner.js';
import { loadQuestStore, type QuestLog } from './quests.js';
import { fetchUnlocks, type UnlocksResponse } from './rewards.js';

export interface AnchorExportBundle {
  exportedAt: string;
  user: {
    userId: string | null;
    activeTheme: string | null;
    activeSound: string | null;
    dyslexiaFont: boolean;
  };
  rewards: UnlocksResponse | null;
  insights: ReturnType<typeof loadInsightDashboard>;
  quests: ReturnType<typeof loadQuestStore>;
  planner: {
    timeBlocks: TimeBlock[];
    transitionAlerts: ReturnType<typeof loadTransitionAlertPreferences>;
    captureInbox: CaptureInboxItem[];
    brainDumps: BrainDumpEntry[];
  };
}

export interface ClinicianSummary {
  exportedAt: string;
  sessionsCount: number;
  averageSessionMinutes: number;
  averageFocusScore: number;
  averageMoodDelta: number;
  topQuest: string | null;
  topQuestMoodDelta: number | null;
  plannerBlocksCompleted: number;
  weeklyDigestTitles: string[];
  notes: string[];
}

export interface ReadOnlySharePacket {
  id: string;
  createdAt: string;
  label: string;
  summary: ClinicianSummary;
  rewards: UnlocksResponse | null;
  latestDigestSummary: string | null;
}

const SHARE_PACKETS_KEY = 'anchor_read_only_share_packets_v1';

export async function buildAnchorExportBundle(): Promise<AnchorExportBundle> {
  return {
    exportedAt: new Date().toISOString(),
    user: {
      userId: localStorage.getItem('anchor_user_id'),
      activeTheme: localStorage.getItem('anchor_active_theme'),
      activeSound: localStorage.getItem('anchor_active_sound'),
      dyslexiaFont: localStorage.getItem('anchor_dyslexia_font') === 'true',
    },
    rewards: await fetchUnlocks(),
    insights: loadInsightDashboard(),
    quests: loadQuestStore(),
    planner: {
      timeBlocks: loadTimeBlocks(),
      transitionAlerts: loadTransitionAlertPreferences(),
      captureInbox: loadCaptureInboxItems(),
      brainDumps: loadBrainDumpEntries(),
    },
  };
}

export function buildAnchorExportCsv(bundle: AnchorExportBundle) {
  const rows = [
    ['dataset', 'timestamp', 'label', 'value_1', 'value_2', 'value_3'],
    ...bundle.insights.sessions.map((session) => [
      'focus_session',
      session.startedAt,
      session.id,
      String(session.durationMinutes),
      String(session.focusScore),
      `${session.moodBefore}->${session.moodAfter}`,
    ]),
    ...bundle.quests.logs.map((quest) => [
      'quest',
      quest.completedAt,
      quest.questId,
      String(quest.durationSeconds),
      String(quest.moodBefore),
      String(quest.moodAfter),
    ]),
    ...bundle.planner.timeBlocks.map((block) => [
      'time_block',
      block.date,
      block.title,
      block.startTime,
      String(block.durationMinutes),
      block.completed ? 'completed' : 'planned',
    ]),
  ];

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function buildClinicianSummary(bundle: AnchorExportBundle): ClinicianSummary {
  const sessions = bundle.insights.sessions;
  const quests = bundle.quests.logs;
  const blocks = bundle.planner.timeBlocks;
  const topQuest = rankQuest(quests);

  return {
    exportedAt: bundle.exportedAt,
    sessionsCount: sessions.length,
    averageSessionMinutes: averageOf(sessions, (session) => session.durationMinutes),
    averageFocusScore: averageOf(sessions, (session) => session.focusScore),
    averageMoodDelta: roundOneDecimal(
      averageOf(sessions, (session) => session.moodAfter - session.moodBefore),
    ),
    topQuest: topQuest?.questId ?? null,
    topQuestMoodDelta: topQuest ? roundOneDecimal(topQuest.averageDelta) : null,
    plannerBlocksCompleted: blocks.filter((block) => block.completed).length,
    weeklyDigestTitles: bundle.insights.digests.map((digest) => digest.title),
    notes: buildClinicianNotes(
      sessions,
      quests,
      bundle.insights.digests,
      bundle.planner.captureInbox.length,
    ),
  };
}

export function buildClinicianSummaryText(summary: ClinicianSummary) {
  return [
    'Anchor Clinician Summary',
    `Exported: ${summary.exportedAt}`,
    '',
    `Focus sessions: ${summary.sessionsCount}`,
    `Average session length: ${summary.averageSessionMinutes} min`,
    `Average focus score: ${summary.averageFocusScore}/100`,
    `Average mood delta: ${summary.averageMoodDelta}`,
    `Top quest: ${summary.topQuest ?? 'None'}`,
    `Top quest mood delta: ${summary.topQuestMoodDelta ?? 'N/A'}`,
    `Planner blocks completed: ${summary.plannerBlocksCompleted}`,
    '',
    'Notes:',
    ...summary.notes.map((note) => `- ${note}`),
    '',
    'Weekly digest titles:',
    ...(summary.weeklyDigestTitles.length
      ? summary.weeklyDigestTitles.map((title) => `- ${title}`)
      : ['- None yet']),
  ].join('\n');
}

export function buildClinicianReportHtml(
  bundle: AnchorExportBundle,
  summary: ClinicianSummary,
) {
  const sessionRows = bundle.insights.sessions
    .slice(-10)
    .map(
      (session) => `
        <tr>
          <td>${session.startedAt}</td>
          <td>${session.durationMinutes} min</td>
          <td>${session.focusScore}</td>
          <td>${session.moodBefore} -> ${session.moodAfter}</td>
        </tr>`,
    )
    .join('');

  const questRows = bundle.quests.logs
    .slice(-10)
    .map(
      (quest) => `
        <tr>
          <td>${quest.completedAt}</td>
          <td>${quest.questId}</td>
          <td>${quest.durationSeconds}s</td>
          <td>${quest.moodBefore} -> ${quest.moodAfter}</td>
        </tr>`,
    )
    .join('');

  const notes = summary.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Anchor Clinician Report</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #111827; }
      h1, h2 { margin-bottom: 8px; }
      p, li, td, th { font-size: 14px; line-height: 1.5; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
      .panel { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px 6px; vertical-align: top; }
      th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
      ul { margin-top: 8px; }
    </style>
  </head>
  <body>
    <h1>Anchor Clinician Report</h1>
    <p>Exported ${escapeHtml(summary.exportedAt)}</p>

    <div class="grid">
      <div class="panel"><strong>Focus sessions</strong><br />${summary.sessionsCount}</div>
      <div class="panel"><strong>Avg session length</strong><br />${summary.averageSessionMinutes} min</div>
      <div class="panel"><strong>Avg focus score</strong><br />${summary.averageFocusScore}/100</div>
      <div class="panel"><strong>Avg mood delta</strong><br />${summary.averageMoodDelta}</div>
    </div>

    <h2>Observed notes</h2>
    <ul>${notes}</ul>

    <h2>Recent focus sessions</h2>
    <table>
      <thead>
        <tr><th>Started</th><th>Length</th><th>Focus</th><th>Mood</th></tr>
      </thead>
      <tbody>${sessionRows || '<tr><td colspan="4">No sessions logged.</td></tr>'}</tbody>
    </table>

    <h2>Recent quest runs</h2>
    <table>
      <thead>
        <tr><th>Completed</th><th>Quest</th><th>Length</th><th>Mood</th></tr>
      </thead>
      <tbody>${questRows || '<tr><td colspan="4">No quests logged.</td></tr>'}</tbody>
    </table>
  </body>
</html>`;
}

export function downloadTextFile(filename: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  downloadBlobFile(filename, blob);
}

export function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function clearLocalAnchorData() {
  const keys = [
    'anchor_user_id',
    'anchor_active_theme',
    'anchor_active_sound',
    'anchor_dyslexia_font',
    'anchor_energy_quests_v1',
    'anchor_insight_dashboard_v1',
    'anchor_time_blocks_v1',
    'anchor_transition_alerts_v1',
    'anchor_capture_inbox_v1',
    'anchor_brain_dump_v1',
    SHARE_PACKETS_KEY,
  ];

  for (const key of keys) {
    localStorage.removeItem(key);
  }
}

export function loadReadOnlySharePackets() {
  try {
    const raw = localStorage.getItem(SHARE_PACKETS_KEY);
    return raw ? (JSON.parse(raw) as ReadOnlySharePacket[]) : [];
  } catch {
    return [];
  }
}

export function saveReadOnlySharePackets(packets: ReadOnlySharePacket[]) {
  localStorage.setItem(SHARE_PACKETS_KEY, JSON.stringify(packets.slice(0, 10)));
}

export function createReadOnlySharePacket(
  bundle: AnchorExportBundle,
  summary: ClinicianSummary,
  label: string,
) {
  const packet: ReadOnlySharePacket = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    label: label.trim() || 'Caregiver share',
    summary,
    rewards: bundle.rewards,
    latestDigestSummary: bundle.insights.digests[0]?.summary ?? null,
  };

  const packets = loadReadOnlySharePackets();
  saveReadOnlySharePackets([packet, ...packets]);
  return packet;
}

export function getReadOnlySharePacket(packetId: string) {
  return loadReadOnlySharePackets().find((packet) => packet.id === packetId) ?? null;
}

export function revokeReadOnlySharePacket(packetId: string) {
  const next = loadReadOnlySharePackets().filter((packet) => packet.id !== packetId);
  saveReadOnlySharePackets(next);
  return next;
}

export async function buildClinicianPdfBlob(
  bundle: AnchorExportBundle,
  summary: ClinicianSummary,
) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (heightNeeded: number) => {
    if (y + heightNeeded <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  };

  const writeParagraph = (text: string, size = 11, color = 35) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lines = pdf.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * (size + 3) + 6);
    pdf.text(lines, margin, y);
    y += lines.length * (size + 3) + 6;
  };

  const writeSectionTitle = (text: string) => {
    ensureSpace(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(17, 24, 39);
    pdf.text(text, margin, y);
    y += 20;
  };

  const writeMetric = (label: string, value: string, x: number, width: number) => {
    pdf.setDrawColor(209, 213, 219);
    pdf.roundedRect(x, y, width, 54, 10, 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(107, 114, 128);
    pdf.text(label.toUpperCase(), x + 12, y + 18);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(17, 24, 39);
    pdf.text(value, x + 12, y + 38);
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(17, 24, 39);
  pdf.text('Anchor Clinician Report', margin, y);
  y += 24;

  writeParagraph(`Exported ${summary.exportedAt}`, 10, 107);
  writeParagraph(
    'Summary for clinician handoff. This packet reflects the data available on this device and does not infer diagnosis or treatment advice.',
    11,
    55,
  );

  ensureSpace(70);
  const columnGap = 12;
  const metricWidth = (contentWidth - columnGap) / 2;
  writeMetric('Focus sessions', String(summary.sessionsCount), margin, metricWidth);
  writeMetric('Avg session length', `${summary.averageSessionMinutes} min`, margin + metricWidth + columnGap, metricWidth);
  y += 66;
  writeMetric('Avg focus score', `${summary.averageFocusScore}/100`, margin, metricWidth);
  writeMetric('Avg mood delta', String(summary.averageMoodDelta), margin + metricWidth + columnGap, metricWidth);
  y += 72;

  writeSectionTitle('Observed notes');
  for (const note of summary.notes) {
    writeParagraph(`• ${note}`);
  }

  writeSectionTitle('Recent focus sessions');
  const recentSessions = bundle.insights.sessions.slice(-8);
  if (recentSessions.length === 0) {
    writeParagraph('No focus sessions logged.');
  } else {
    for (const session of recentSessions) {
      writeParagraph(
        `${session.startedAt}  |  ${session.durationMinutes} min  |  focus ${session.focusScore}  |  mood ${session.moodBefore} -> ${session.moodAfter}`,
        10,
        45,
      );
    }
  }

  writeSectionTitle('Recent quest runs');
  const recentQuests = bundle.quests.logs.slice(-8);
  if (recentQuests.length === 0) {
    writeParagraph('No quests logged.');
  } else {
    for (const quest of recentQuests) {
      writeParagraph(
        `${quest.completedAt}  |  ${quest.questId}  |  ${quest.durationSeconds}s  |  mood ${quest.moodBefore} -> ${quest.moodAfter}`,
        10,
        45,
      );
    }
  }

  writeSectionTitle('Weekly digests');
  if (summary.weeklyDigestTitles.length === 0) {
    writeParagraph('No weekly digests delivered yet.');
  } else {
    for (const title of summary.weeklyDigestTitles) {
      writeParagraph(`• ${title}`);
    }
  }

  return pdf.output('blob');
}

function averageOf<T>(items: T[], getValue: (item: T) => number) {
  if (items.length === 0) return 0;
  return Math.round(items.reduce((sum, item) => sum + getValue(item), 0) / items.length);
}

function roundOneDecimal(value: number) {
  return Number(value.toFixed(1));
}

function rankQuest(quests: QuestLog[]) {
  const grouped = new Map<string, number[]>();

  for (const quest of quests) {
    const deltas = grouped.get(quest.questId) ?? [];
    deltas.push(quest.moodAfter - quest.moodBefore);
    grouped.set(quest.questId, deltas);
  }

  return Array.from(grouped.entries())
    .map(([questId, deltas]) => ({
      questId,
      averageDelta: deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length,
    }))
    .sort((left, right) => right.averageDelta - left.averageDelta)[0];
}

function buildClinicianNotes(
  sessions: InsightSession[],
  quests: QuestLog[],
  digests: WeeklyDigestEntry[],
  inboxCount: number,
) {
  const notes: string[] = [];

  if (sessions.length > 0) {
    const morningSessions = sessions.filter((session) => new Date(session.startedAt).getHours() < 12);
    if (morningSessions.length >= Math.ceil(sessions.length / 2)) {
      notes.push('Most recorded focus sessions happened before noon.');
    }
  }

  if (quests.length > 0) {
    const topQuest = rankQuest(quests);
    if (topQuest) {
      notes.push(`The strongest quest pattern was ${topQuest.questId} with average mood lift ${roundOneDecimal(topQuest.averageDelta)}.`);
    }
  }

  if (digests.length > 0) {
    notes.push(`Weekly digest history is available for ${digests.length} week(s).`);
  }

  if (inboxCount > 0) {
    notes.push(`There are ${inboxCount} quick-capture item(s) parked in the inbox.`);
  }

  if (notes.length === 0) {
    notes.push('Not enough local data yet for stronger patterns.');
  }

  return notes;
}

function escapeCsv(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
