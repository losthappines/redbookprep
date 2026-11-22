'use client';

import React, { useMemo } from 'react';
import { Calendar, Flame, Target, Award } from 'lucide-react';
import type { PracticeQuestion } from './bbplus';
import { evaluateSprResponse } from '@/lib/sat-spr';

export function ActivityHeatmapAnalytics({
  questions,
  attempts,
}: {
  questions: PracticeQuestion[];
  attempts: { id: string; choice: number; sprResponse?: string; isCorrect?: boolean; seconds: number; date: string }[];
}) {
  const isOk = (a: (typeof attempts)[number], q?: PracticeQuestion) => {
    if (typeof a.isCorrect === 'boolean') return a.isCorrect;
    if (!q) return false;
    return q.questionType === 'spr'
      ? evaluateSprResponse(a.sprResponse || '', q.sprAnswers || [])
      : a.choice === q.answer;
  };

  // Build 52-week contribution heatmap cells
  const heatmap = useMemo(() => {
    const countsByDay = new Map<string, number>();
    for (const a of attempts) {
      if (!a.date) continue;
      const dayKey = a.date.slice(0, 10);
      countsByDay.set(dayKey, (countsByDay.get(dayKey) || 0) + 1);
    }

    const totalDays = 52 * 7;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (totalDays - 1));

    const days: { date: string; count: number; level: number }[] = [];
    for (let i = 0; i < totalDays; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const count = countsByDay.get(key) || 0;
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 6 ? 2 : count <= 14 ? 3 : 4;
      days.push({ date: key, count, level });
    }
    return days;
  }, [attempts]);

  // Clean-solved metric (correct on FIRST attempt without retries)
  const cleanSolvedCount = useMemo(() => {
    const firstByQ = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) {
      if (!firstByQ.has(a.id)) firstByQ.set(a.id, a);
    }
    let clean = 0;
    for (const [id, first] of firstByQ.entries()) {
      const q = questions.find((item) => item.id === id);
      if (isOk(first, q)) clean += 1;
    }
    return clean;
  }, [attempts, questions]);

  const challengeReadyCount = useMemo(() => {
    const solvedIds = new Set(
      attempts
        .filter((a) => isOk(a, questions.find((q) => q.id === a.id)))
        .map((a) => a.id)
    );
    return questions.filter((q) => q.isChallenge && solvedIds.has(q.id)).length;
  }, [attempts, questions]);

  const activeDaysTotal = heatmap.filter((d) => d.count > 0).length;

  return (
    <section className="card rb-heatmap-card">
      <div className="rb-heatmap-head">
        <div>
          <span className="eyebrow">365-DAY CONSISTENCY · CLEAN SOLVES</span>
          <h2>Study Activity Heatmap</h2>
        </div>
        <div className="rb-heatmap-kpis">
          <span>
            <Calendar size={14} /> {activeDaysTotal} active days
          </span>
          <span>
            <Target size={14} /> {cleanSolvedCount} clean-solved
          </span>
          <span>
            <Award size={14} /> {challengeReadyCount} 1500+ solved
          </span>
        </div>
      </div>

      <div className="rb-heatmap-scroll">
        <div className="rb-heatmap-grid" role="img" aria-label="Full-year daily practice activity heatmap">
          {heatmap.map((cell) => (
            <span
              key={cell.date}
              className={`rb-heat-cell level-${cell.level}`}
              title={`${cell.date}: ${cell.count} question${cell.count === 1 ? '' : 's'} solved`}
            />
          ))}
        </div>
      </div>

      <div className="rb-heatmap-legend">
        <small>Less</small>
        <span className="rb-heat-cell level-0" />
        <span className="rb-heat-cell level-1" />
        <span className="rb-heat-cell level-2" />
        <span className="rb-heat-cell level-3" />
        <span className="rb-heat-cell level-4" />
        <small>More</small>
      </div>
    </section>
  );
}
