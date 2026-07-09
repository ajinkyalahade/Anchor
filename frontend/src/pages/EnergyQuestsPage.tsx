import { useEffect, useMemo, useState } from 'react';
import { Droplets, Dumbbell, GlassWater, PartyPopper, SunMedium, TimerReset } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { grantReward } from '../lib/rewards';
import {
  bestQuestInsight, computeQuestHeatmap, loadQuestStore, QUEST_CATALOG,
  questCountToday, recordQuestCompletion, type QuestDefinition,
} from '../lib/quests';

function questIcon(questId: string) {
  switch (questId) {
    case 'desk-reset': return TimerReset;
    case 'cold-splash': return Droplets;
    case 'dance-break': return PartyPopper;
    case 'step-outside': return SunMedium;
    case 'hydrate': return GlassWater;
    default: return Dumbbell;
  }
}

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function deltaTone(delta: number | null): string {
  if (delta === null) return 'var(--ink-4)';
  if (delta >= 1.5) return 'var(--calm-ink)';
  if (delta >= 0.5) return 'var(--ink-2)';
  if (delta >= 0) return 'var(--ink-3)';
  return 'var(--rsd-ink)';
}

export default function EnergyQuestsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState(() => loadQuestStore().logs);
  const [activeQuest, setActiveQuest] = useState<QuestDefinition | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [moodBefore, setMoodBefore] = useState(3);
  const [moodAfter, setMoodAfter] = useState(4);
  const [needsCheckin, setNeedsCheckin] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [weeklyPreview, setWeeklyPreview] = useState(() => ({
    title: 'What is actually shifting your state',
    summary: 'Start with a short reset and let the app learn which quest changes your mood fastest.',
    recommendation: 'Use the easiest quest first, then repeat the ones that actually lift mood.',
  }));

  const questsToday = questCountToday(logs);
  const bestQuest = bestQuestInsight(logs);
  const heatmap = computeQuestHeatmap(logs);
  const suggestedQuest = bestQuest?.quest ?? QUEST_CATALOG[0];

  useEffect(() => {
    if (!activeQuest || needsCheckin || timeLeft <= 0) return undefined;
    const id = window.setTimeout(() => {
      if (timeLeft <= 1) { setTimeLeft(0); setNeedsCheckin(true); return; }
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [activeQuest, needsCheckin, timeLeft]);

  useEffect(() => {
    const fallback = bestQuest
      ? { title: 'What is actually shifting your state', summary: `${bestQuest.quest.label} is moving your mood by ${bestQuest.averageDelta} on average across ${bestQuest.runs} runs.`, recommendation: `Lean on ${bestQuest.quest.label} first when activation is stuck.` }
      : { title: 'What is actually shifting your state', summary: 'Start with a short reset and let the app learn what actually shifts your state.', recommendation: 'Use the easiest quest first, then repeat the ones that actually lift mood.' };

    api.post<typeof fallback>('/ai/quests/weekly-preview', {
      best_quest_label: bestQuest?.quest.label ?? 'None yet',
      best_average_delta: bestQuest?.averageDelta ?? 0,
      total_runs: bestQuest?.runs ?? 0,
    }).then(setWeeklyPreview).catch(() => setWeeklyPreview(fallback));
  }, [bestQuest]);

  const groupedHeatmap = useMemo(
    () => QUEST_CATALOG.map((quest) => ({ quest, cells: heatmap.filter((c) => c.questLabel === quest.label) })),
    [heatmap],
  );

  const startQuest = (quest: QuestDefinition) => {
    setActiveQuest(quest); setTimeLeft(quest.durationSeconds);
    setMoodBefore(3); setMoodAfter(4); setNeedsCheckin(false); setRewardMessage(null);
  };

  const finishQuest = async () => {
    if (!activeQuest) return;
    recordQuestCompletion(activeQuest.id, moodBefore, moodAfter, activeQuest.durationSeconds);
    setLogs(loadQuestStore().logs);
    const reward = await grantReward('quests', Math.max(8, Math.round(activeQuest.durationSeconds / 18)), `completed ${activeQuest.label.toLowerCase()} quest`);
    setRewardMessage(reward?.message ?? 'Quest logged. Keep going.');
    setActiveQuest(null); setNeedsCheckin(false); setTimeLeft(0);
  };

  const pct = activeQuest ? ((1 - timeLeft / activeQuest.durationSeconds) * 100) : 0;

  return (
    <div className="screen" style={{ padding: '40px 56px 96px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--ink-3)', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
            >
              <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', margin: 0 }}>Energy Quests</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Fast state shifts. 90 seconds to 3 minutes.</div>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--reward-ink)', background: 'var(--reward-wash)', padding: '6px 14px', borderRadius: 999 }}>
          {questsToday}/3 today
        </div>
      </div>

      {/* Active quest */}
      {activeQuest && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 28, marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--reward-ink)' }}>Active quest</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 26, letterSpacing: '-0.015em', marginBottom: 4 }}>{activeQuest.label}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>{activeQuest.description}</div>

          <div className="timebar" style={{ height: 12, marginBottom: 8 }}>
            <div className="timebar-fill" style={{ width: pct + '%', background: 'var(--reward)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', marginBottom: 20 }}>
            <span>{formatSeconds(timeLeft)} left</span>
            <span>{formatSeconds(activeQuest.durationSeconds)}</span>
          </div>

          {needsCheckin ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="eyebrow">How did it land</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[{ label: 'Before', value: moodBefore, set: setMoodBefore, color: 'var(--focus)' }, { label: 'After', value: moodAfter, set: setMoodAfter, color: 'var(--calm)' }].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>{item.label}: <b style={{ color: 'var(--ink)', fontFamily: 'var(--mono)' }}>{item.value}/5</b></div>
                    <input type="range" min="1" max="5" value={item.value} onChange={(e) => item.set(Number(e.target.value))} style={{ width: '100%', accentColor: item.color }} />
                  </div>
                ))}
              </div>
              <button
                onClick={finishQuest}
                style={{ padding: '12px 20px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bone)', fontSize: 14, fontWeight: 500 }}
              >
                Log quest
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>
              Stay with it. This only needs to shift your state a little.
            </div>
          )}
        </div>
      )}

      {rewardMessage && (
        <div style={{ background: 'var(--reward-wash)', border: '1px solid var(--hairline)', borderRadius: 'var(--r)', padding: '14px 18px', fontSize: 13, color: 'var(--reward-ink)', marginBottom: 20 }}>
          {rewardMessage}
        </div>
      )}

      {/* Suggested + catalog */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* Left: suggested + catalog */}
        <div>
          <h2 style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 14px' }}>Suggested now</h2>
          <button
            onClick={() => startQuest(suggestedQuest)}
            style={{
              width: '100%', background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)',
              padding: '22px 24px', textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 24,
              transition: 'box-shadow 140ms ease, transform 140ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 1px 0 rgba(42,38,32,0.04), 0 8px 24px -8px rgba(42,38,32,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
          >
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, letterSpacing: '-0.01em', marginBottom: 4 }}>{suggestedQuest.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                {bestQuest ? `Moved your mood ${bestQuest.averageDelta > 0 ? '+' : ''}${bestQuest.averageDelta} on average` : 'Start here — good all-rounder'}
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, background: 'var(--reward-wash)', color: 'var(--reward-ink)', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
              <svg viewBox="0 0 16 16" fill="none" width="12" height="12"><path d="M5 3.5v9l8-4.5-8-4.5Z" fill="currentColor"/></svg>
              One tap
            </div>
          </button>

          <h2 style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 14px' }}>All quests</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {QUEST_CATALOG.map((quest) => {
              const Icon = questIcon(quest.id);
              return (
                <div key={quest.id} style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r)', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--reward-wash)', color: 'var(--reward-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, letterSpacing: '-0.005em' }}>{quest.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{Math.round(quest.durationSeconds / 60)} min · {quest.description}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => startQuest(quest)}
                    style={{ padding: '7px 14px', borderRadius: 999, background: 'var(--bone-soft)', color: 'var(--ink-2)', fontSize: 12.5, fontFamily: 'var(--mono)', cursor: 'pointer', flexShrink: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bone-deep)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bone-soft)')}
                  >
                    start
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: AI insight + heatmap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '24px 26px' }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>What's actually working</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, letterSpacing: '-0.01em', lineHeight: 1.45, marginBottom: 12 }}>
              {weeklyPreview.summary}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '12px 14px', background: 'var(--bone-soft)', borderRadius: 'var(--r-sm)', lineHeight: 1.5 }}>
              {weeklyPreview.recommendation}
            </div>
          </div>

          {/* Mood delta heatmap */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '24px 26px' }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Mood delta this week</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                <div />
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)', textAlign: 'center' }}>{d}</div>
                ))}
              </div>
              {groupedHeatmap.map(({ quest, cells }) => (
                <div key={quest.id} style={{ display: 'grid', gridTemplateColumns: '90px repeat(7, 1fr)', gap: 4, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quest.label}</div>
                  {cells.map((cell) => (
                    <div key={cell.dayLabel} style={{ height: 28, borderRadius: 4, background: 'var(--bone-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'var(--mono)', color: deltaTone(cell.delta) }}>
                      {cell.delta === null ? '—' : `${cell.delta > 0 ? '+' : ''}${cell.delta}`}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
