'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Download, Sparkles, Check, Target } from 'lucide-react';
import type { PracticeQuestion } from './bbplus';

interface PlanConfig {
  examDate: string;
  targetScore: number;
  dailyMinutes: number;
  studyDays: number[]; // 0=Sun..6=Sat
  focusDomains: string[];
  autoAdapt: boolean;
}

const PLAN_STORAGE = 'redbookprep-study-plan-v2';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DOMAINS = [
  'Algebra',
  'Advanced Math',
  'Problem-Solving and Data Analysis',
  'Geometry and Trigonometry',
  'Information and Ideas',
  'Craft and Structure',
  'Expression of Ideas',
  'Standard English Conventions',
];

export function AdaptivePlanner({
  questions,
  attempts,
  onStartTopic,
}: {
  questions: PracticeQuestion[];
  attempts: { id: string; choice: number; isCorrect?: boolean }[];
  onStartTopic: (index: number) => void;
}) {
  const [config, setConfig] = useState<PlanConfig>({
    examDate: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    targetScore: 1450,
    dailyMinutes: 30,
    studyDays: [1, 2, 3, 4, 5, 6],
    focusDomains: ['Algebra', 'Advanced Math', 'Craft and Structure'],
    autoAdapt: true,
  });
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'week' | 'wizard'>('week');
  const [aiAdvice, setAiAdvice] = useState('');
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAN_STORAGE) || 'null');
      if (saved?.config) setConfig((prev) => ({ ...prev, ...saved.config }));
      if (Array.isArray(saved?.completed)) setCompletedTaskIds(saved.completed);
    } catch {}
  }, []);

  const persist = (nextConfig: PlanConfig, nextCompleted = completedTaskIds) => {
    setConfig(nextConfig);
    setCompletedTaskIds(nextCompleted);
    try {
      localStorage.setItem(PLAN_STORAGE, JSON.stringify({ config: nextConfig, completed: nextCompleted }));
    } catch {}
  };

  const toggleDay = (dayIdx: number) => {
    const exists = config.studyDays.includes(dayIdx);
    const nextDays = exists
      ? config.studyDays.filter((d) => d !== dayIdx)
      : [...config.studyDays, dayIdx].sort();
    persist({ ...config, studyDays: nextDays });
  };

  const toggleDomain = (domain: string) => {
    const exists = config.focusDomains.includes(domain);
    const next = exists
      ? config.focusDomains.filter((d) => d !== domain)
      : [...config.focusDomains, domain];
    persist({ ...config, focusDomains: next.length ? next : [domain] });
  };

  // Auto-prioritize weak domains from attempt history
  const domainAccuracy = ALL_DOMAINS.map((dom) => {
    const domQs = questions.filter((q) => q.domain === dom);
    const domIds = new Set(domQs.map((q) => q.id));
    const domAtt = attempts.filter((a) => domIds.has(a.id));
    const ok = domAtt.filter((a) => a.isCorrect !== false).length;
    const acc = domAtt.length ? Math.round((ok / domAtt.length) * 100) : null;
    return { domain: dom, acc, count: domAtt.length, firstIndex: questions.findIndex((q) => q.domain === dom) };
  });

  const weekSchedule = DAY_LABELS.map((label, dayIdx) => {
    const enabled = config.studyDays.includes(dayIdx);
    const focus = config.focusDomains[dayIdx % Math.max(1, config.focusDomains.length)] || 'Algebra';
    const taskId = `day-${dayIdx}-${focus}`;
    return {
      dayIdx,
      label,
      enabled,
      focus,
      taskId,
      minutes: enabled ? config.dailyMinutes : 0,
      done: completedTaskIds.includes(taskId),
    };
  });

  const exportIcsCalendar = () => {
    const todayStr = new Date().toISOString().replace(/[-:]/g, '').slice(0, 8);
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RedBookPrep//SAT Study Planner//EN',
      ...weekSchedule
        .filter((d) => d.enabled)
        .map(
          (d, i) => `BEGIN:VEVENT
UID:redbookprep-day-${d.dayIdx}@redbookprep.site
DTSTAMP:${todayStr}T090000Z
DTSTART;VALUE=DATE:${new Date(Date.now() + i * 86400000).toISOString().slice(0, 10).replace(/-/g, '')}
SUMMARY:RedBookPrep SAT Study (${d.minutes}m · ${d.focus})
DESCRIPTION:Focused Digital SAT drill scheduled on RedBookPrep.
END:VEVENT`
        ),
      'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redbookprep-sat-plan.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const askPlannerCoach = async () => {
    setLoadingAdvice(true);
    setAiAdvice('');
    try {
      const summary = domainAccuracy
        .filter((d) => d.acc !== null)
        .map((d) => `${d.domain}: ${d.acc}% (${d.count} Qs)`)
        .join(', ');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Gemini 3.5 Flash',
          effort: 'Low',
          message: `Build a tight 1-week SAT focus adjustment for target score ${config.targetScore}, exam date ${config.examDate}, ${config.dailyMinutes} min/day on ${config.studyDays
            .map((i) => DAY_LABELS[i])
            .join('/')}. Observed accuracy: ${summary || 'New student starting baseline'}. Keep it under 140 words.`,
        }),
      });
      const data = await res.json();
      setAiAdvice(data.reply || data.error || 'Could not generate plan recommendation.');
    } catch {
      setAiAdvice('Unable to reach redCoach planner assistant.');
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <section className="rb-planner-v2">
      <div className="rb-page-heading">
        <div>
          <span className="eyebrow">ADAPTIVE STUDY PLANNER 2.0</span>
          <h1>Weekly Study Schedule</h1>
          <p>
            Target <strong>{config.targetScore}</strong> · Exam <strong>{config.examDate}</strong> ·{' '}
            {config.dailyMinutes} min/study day
          </p>
        </div>
        <div className="rb-actions">
          <div className="segmented">
            <button type="button" aria-pressed={viewMode === 'week'} onClick={() => setViewMode('week')}>
              <Calendar size={14} /> Week View
            </button>
            <button type="button" aria-pressed={viewMode === 'wizard'} onClick={() => setViewMode('wizard')}>
              <Target size={14} /> Configure Plan
            </button>
          </div>
          <button type="button" onClick={exportIcsCalendar}>
            <Download size={14} /> Export .ics
          </button>
          <button type="button" className="primary" onClick={askPlannerCoach} disabled={loadingAdvice}>
            <Sparkles size={14} /> {loadingAdvice ? 'Tuning…' : 'AI Tune Plan'}
          </button>
        </div>
      </div>

      {aiAdvice && (
        <section className="card" style={{ marginBottom: '20px' }}>
          <span className="eyebrow">REDCOACH ADAPTIVE RECOMMENDATION</span>
          <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{aiAdvice}</p>
        </section>
      )}

      {viewMode === 'wizard' ? (
        <section className="card rb-planner-wizard">
          <span className="eyebrow">5-STEP PLAN CALIBRATION</span>
          <div className="rb-rush-setup-grid" style={{ marginTop: '12px' }}>
            <label>
              Target SAT Score (400–1600)
              <input
                type="number"
                min={400}
                max={1600}
                step={10}
                value={config.targetScore}
                onChange={(e) => persist({ ...config, targetScore: Math.max(400, Math.min(1600, Number(e.target.value) || 1400)) })}
              />
            </label>
            <label>
              Target Exam Date
              <input
                type="date"
                value={config.examDate}
                onChange={(e) => persist({ ...config, examDate: e.target.value })}
              />
            </label>
            <label>
              Daily Time Budget (minutes)
              <select
                value={config.dailyMinutes}
                onChange={(e) => persist({ ...config, dailyMinutes: Number(e.target.value) })}
              >
                <option value={15}>15 min / day (Light)</option>
                <option value={30}>30 min / day (Standard)</option>
                <option value={45}>45 min / day (Intensive)</option>
                <option value={60}>60 min / day (Bootcamp)</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: '18px' }}>
            <span className="eyebrow">CLICK DAYS YOU CAN STUDY</span>
            <div className="rb-day-paint-row">
              {DAY_LABELS.map((lbl, idx) => {
                const active = config.studyDays.includes(idx);
                return (
                  <button
                    key={lbl}
                    type="button"
                    aria-pressed={active}
                    className={active ? 'primary' : ''}
                    onClick={() => toggleDay(idx)}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '18px' }}>
            <span className="eyebrow">PRIORITY DOMAINS</span>
            <div className="rb-domain-chips">
              {ALL_DOMAINS.map((dom) => {
                const active = config.focusDomains.includes(dom);
                return (
                  <button
                    key={dom}
                    type="button"
                    aria-pressed={active}
                    className={active ? 'primary' : ''}
                    onClick={() => toggleDomain(dom)}
                  >
                    {dom}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <div className="rb-week-grid">
          {weekSchedule.map((day) => {
            const matchIdx = questions.findIndex((q) => q.domain === day.focus);
            return (
              <article key={day.label} className={`card rb-week-card ${!day.enabled ? 'is-rest' : ''}`}>
                <div className="rb-week-card-head">
                  <strong>{day.label}</strong>
                  <small>
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {day.enabled ? `${day.minutes}m` : 'Rest'}
                  </small>
                </div>
                {day.enabled ? (
                  <>
                    <p style={{ margin: '8px 0 14px', fontSize: '.9rem' }}>{day.focus}</p>
                    <div className="rb-actions">
                      <button
                        type="button"
                        className={day.done ? 'primary' : ''}
                        onClick={() => {
                          const exists = completedTaskIds.includes(day.taskId);
                          const next = exists
                            ? completedTaskIds.filter((id) => id !== day.taskId)
                            : [...completedTaskIds, day.taskId];
                          persist(config, next);
                        }}
                      >
                        <Check size={14} /> {day.done ? 'Done' : 'Complete'}
                      </button>
                      {matchIdx >= 0 && (
                        <button type="button" onClick={() => onStartTopic(matchIdx)}>
                          Practise →
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p style={{ margin: '8px 0 0', opacity: 0.65, fontSize: '.85rem' }}>Recovery &amp; light vocab review</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
