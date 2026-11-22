'use client';

import React, { useState, useEffect } from 'react';
import { Flame, Zap, Trophy, Timer, Play, Pause, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { AchievementBadge, HabitProfile } from '@/lib/habits';

export function HabitTopbarCluster({
  habits,
  achievements,
  onToggleSound,
}: {
  habits: HabitProfile;
  achievements: AchievementBadge[];
  onToggleSound: () => void;
}) {
  const [openModal, setOpenModal] = useState<'none' | 'timer' | 'streak' | 'achievements'>('none');
  const [pomodoroSec, setPomodoroSec] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);

  useEffect(() => {
    if (!pomodoroRunning) return;
    const t = window.setInterval(() => {
      setPomodoroSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [pomodoroRunning]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const mins = String(Math.floor(pomodoroSec / 60)).padStart(2, '0');
  const secs = String(pomodoroSec % 60).padStart(2, '0');

  return (
    <div className="rb-habit-cluster">
      <button
        type="button"
        className={`rb-habit-pill ${pomodoroRunning ? 'is-live' : ''}`}
        title="Pomodoro focus timer"
        onClick={() => setOpenModal((m) => (m === 'timer' ? 'none' : 'timer'))}
      >
        <Timer size={14} />
        <span>{pomodoroRunning ? `${mins}:${secs}` : 'Focus'}</span>
      </button>

      <button
        type="button"
        className="rb-habit-pill"
        title="Daily study streak & freezes"
        onClick={() => setOpenModal((m) => (m === 'streak' ? 'none' : 'streak'))}
      >
        <Flame size={14} className={habits.currentStreak > 0 ? 'text-orange-400' : ''} />
        <span>{habits.currentStreak}d</span>
      </button>

      <button
        type="button"
        className="rb-habit-pill"
        title="Weekly AI Sparks allowance"
        onClick={() => setOpenModal((m) => (m === 'streak' ? 'none' : 'streak'))}
      >
        <Zap size={14} className="text-amber-400" />
        <span>{habits.sparksTier === 'pro' ? '∞' : habits.sparksBalance}</span>
      </button>

      <button
        type="button"
        className="rb-habit-pill"
        title="Achievements & trophies"
        onClick={() => setOpenModal((m) => (m === 'achievements' ? 'none' : 'achievements'))}
      >
        <Trophy size={14} />
        <span>
          {unlockedCount}/{achievements.length}
        </span>
      </button>

      {openModal === 'timer' && (
        <div className="rb-habit-popover" role="dialog" aria-label="Pomodoro focus timer">
          <div className="rb-habit-pop-head">
            <strong>Study Focus Timer</strong>
            <button type="button" aria-label="Close" onClick={() => setOpenModal('none')}>
              <X size={14} />
            </button>
          </div>
          <div className="rb-pomo-readout">{mins}:{secs}</div>
          <div className="rb-actions">
            <button type="button" className="primary" onClick={() => setPomodoroRunning((r) => !r)}>
              {pomodoroRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{pomodoroRunning ? 'Pause' : 'Start 25m'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPomodoroRunning(false);
                setPomodoroSec(25 * 60);
              }}
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}

      {openModal === 'streak' && (
        <div className="rb-habit-popover" role="dialog" aria-label="Streak and Sparks status">
          <div className="rb-habit-pop-head">
            <strong>Habits &amp; Sparks</strong>
            <button type="button" aria-label="Close" onClick={() => setOpenModal('none')}>
              <X size={14} />
            </button>
          </div>
          <div className="rb-habit-stat-list">
            <div>
              <span>Current Streak</span>
              <strong>{habits.currentStreak} days (best {habits.longestStreak}d)</strong>
            </div>
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={13} /> Streak Freezes
              </span>
              <strong>{habits.streakFreezes} active</strong>
            </div>
            <div>
              <span>Weekly AI Sparks</span>
              <strong>
                {habits.sparksTier === 'pro' ? 'Unlimited (Pro)' : `${habits.sparksBalance} left`}
              </strong>
            </div>
          </div>
          <label className="rb-sound-toggle">
            <span>Subtle sound effects</span>
            <input type="checkbox" checked={habits.soundEnabled} onChange={onToggleSound} />
          </label>
        </div>
      )}

      {openModal === 'achievements' && (
        <div className="navigator-backdrop" onClick={() => setOpenModal('none')}>
          <section
            className="question-navigator"
            role="dialog"
            aria-modal="true"
            aria-label="Achievements"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="navigator-heading">
              <div>
                <h2>Achievements ({unlockedCount}/{achievements.length})</h2>
                <p>Keep studying daily and tackling Grid-Ins to unlock rare badges.</p>
              </div>
              <button type="button" onClick={() => setOpenModal('none')}>
                <X size={16} />
              </button>
            </div>
            <div className="rb-badge-grid">
              {achievements.map((b) => (
                <article key={b.id} className={`rb-badge-card ${b.unlocked ? 'is-unlocked' : 'is-locked'}`}>
                  <div className="rb-badge-top">
                    <span className={`rb-rarity-tag rarity-${b.rarity.toLowerCase()}`}>{b.rarity}</span>
                    <small>{b.progressText}</small>
                  </div>
                  <strong>{b.title}</strong>
                  <p>{b.description}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
