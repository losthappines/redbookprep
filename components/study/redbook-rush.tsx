'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Flame, Play, Star, Zap, ChevronRight, RotateCcw, Trophy } from 'lucide-react';
import type { PracticeQuestion } from './bbplus';
import { MathText, SafeSvgDiagram } from './math-text';
import { SprInput } from './spr-input';
import { evaluateSprResponse, validateSprInput } from '@/lib/sat-spr';
import { playTone } from '@/lib/sound-fx';

type RushSection = 'Mixed' | 'Reading and Writing' | 'Math';
type RushDifficulty = 'Standard' | 'Hard 1400+' | '1500+ Challenge';

export function RedBookRush({
  questions,
  soundEnabled,
  bestScore,
  onRecordAttempt,
  onSaveBest,
  onClose,
}: {
  questions: PracticeQuestion[];
  soundEnabled: boolean;
  bestScore: number;
  onRecordAttempt: (payload: { id: string; choice: number; sprResponse?: string; isCorrect: boolean; seconds: number }) => void;
  onSaveBest: (score: number) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'setup' | 'playing' | 'summary'>('setup');
  const [section, setSection] = useState<RushSection>('Mixed');
  const [durationSec, setDurationSec] = useState(180);
  const [difficulty, setDifficulty] = useState<RushDifficulty>('Standard');
  const [selectedDomain, setSelectedDomain] = useState('All domains');

  const [deck, setDeck] = useState<PracticeQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [results, setResults] = useState<{ q: PracticeQuestion; correct: boolean; seconds: number }[]>([]);
  const [sprVal, setSprVal] = useState('');
  const [qStartedAt, setQStartedAt] = useState(Date.now());
  const [flashState, setFlashState] = useState<'none' | 'hit' | 'miss'>('none');

  const domains = useMemo(() => {
    const set = new Set(
      questions
        .filter((q) => section === 'Mixed' || q.section === section)
        .map((q) => q.domain)
    );
    return ['All domains', ...Array.from(set)];
  }, [questions, section]);

  const startRush = () => {
    const pool = questions.filter((q) => {
      if (section !== 'Mixed' && q.section !== section) return false;
      if (selectedDomain !== 'All domains' && q.domain !== selectedDomain) return false;
      if (difficulty === '1500+ Challenge') return q.isChallenge || (q.difficulty ?? 2) >= 4;
      return true;
    });
    const shuffled = [...(pool.length ? pool : questions)].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setQIdx(0);
    setTimeLeft(durationSec);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setResults([]);
    setSprVal('');
    setQStartedAt(Date.now());
    setStep('playing');
  };

  useEffect(() => {
    if (step !== 'playing') return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStep('summary');
          playTone('complete', soundEnabled);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [step, soundEnabled]);

  useEffect(() => {
    if (step === 'summary' && score > bestScore) {
      onSaveBest(score);
    }
  }, [step, score, bestScore, onSaveBest]);

  const current = deck[qIdx];

  const handleAnswer = (chosenIdx: number | null, sprText?: string) => {
    if (!current || step !== 'playing') return;
    const secs = Math.max(1, Math.round((Date.now() - qStartedAt) / 1000));
    const isSpr = current.questionType === 'spr';
    const correct = isSpr
      ? evaluateSprResponse(sprText || '', current.sprAnswers || [])
      : chosenIdx === current.answer;

    const nextCombo = correct ? combo + 1 : 0;
    const multiplier = Math.min(3, 1 + Math.floor(nextCombo / 3));
    const points = correct ? 50 * multiplier : 0;

    setScore((s) => s + points);
    setCombo(nextCombo);
    setMaxCombo((m) => Math.max(m, nextCombo));
    setResults((r) => [...r, { q: current, correct, seconds: secs }]);
    setFlashState(correct ? 'hit' : 'miss');
    playTone(correct ? 'correct' : 'incorrect', soundEnabled);

    onRecordAttempt({
      id: current.id,
      choice: isSpr ? -1 : (chosenIdx ?? 0),
      sprResponse: isSpr ? sprText : undefined,
      isCorrect: correct,
      seconds: secs,
    });

    window.setTimeout(() => {
      setFlashState('none');
      setSprVal('');
      setQStartedAt(Date.now());
      if (qIdx + 1 >= deck.length) {
        setStep('summary');
      } else {
        setQIdx((i) => i + 1);
      }
    }, 260);
  };

  if (step === 'setup') {
    return (
      <section className="card rb-rush-card">
        <div className="rb-page-heading" style={{ marginBottom: '18px' }}>
          <div>
            <span className="eyebrow">ARCADE DRILL · TIMED STREAK</span>
            <h2>RedBook Rush</h2>
            <p>Answer rapidly, build a ×3 streak multiplier, and earn 3 stars before the clock runs out.</p>
          </div>
          <button type="button" onClick={onClose}>
            Back to Library
          </button>
        </div>

        <div className="rb-rush-setup-grid">
          <label>
            1. Subject focus
            <select value={section} onChange={(e) => { setSection(e.target.value as RushSection); setSelectedDomain('All domains'); }}>
              <option value="Mixed">Mixed (R&amp;W + Math)</option>
              <option value="Math">Math Only</option>
              <option value="Reading and Writing">Reading &amp; Writing Only</option>
            </select>
          </label>
          <label>
            2. Domain filter
            <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)}>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            3. Clock duration
            <select value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))}>
              <option value={60}>1 min Blitz</option>
              <option value={180}>3 min Sprint</option>
              <option value={300}>5 min Marathon</option>
            </select>
          </label>
          <label>
            4. Difficulty tier
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as RushDifficulty)}>
              <option value="Standard">Balanced Mix</option>
              <option value="Hard 1400+">Hard 1400+</option>
              <option value="1500+ Challenge">1500+ Challenge</option>
            </select>
          </label>
        </div>

        <div className="rb-actions" style={{ marginTop: '20px', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '.85rem', opacity: 0.78 }}>
            <Trophy size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Personal Best: <strong>{bestScore} pts</strong>
          </span>
          <button type="button" className="primary" onClick={startRush} disabled={questions.length === 0}>
            <Play size={16} />
            <span>Launch Rush Run</span>
          </button>
        </div>
      </section>
    );
  }

  if (step === 'summary') {
    const correctCount = results.filter((r) => r.correct).length;
    const stars = score >= 450 ? 3 : score >= 250 ? 2 : score >= 100 ? 1 : 0;
    return (
      <section className="card rb-rush-card">
        <span className="eyebrow">RUSH COMPLETE</span>
        <h2>{score} Points · {stars} / 3 Stars</h2>
        <div className="rb-rush-stars" aria-label={`${stars} out of 3 stars`}>
          {[1, 2, 3].map((n) => (
            <Star key={n} size={28} className={n <= stars ? 'text-amber-400 fill-amber-400' : 'opacity-25'} />
          ))}
        </div>
        <div className="stats-strip" style={{ margin: '18px 0' }}>
          <div><strong>{correctCount}/{results.length}</strong><span>Correct answers</span></div>
          <div><strong>{maxCombo}×</strong><span>Best streak combo</span></div>
          <div><strong>{Math.max(bestScore, score)}</strong><span>Personal best</span></div>
        </div>
        <div className="rb-actions">
          <button type="button" className="primary" onClick={startRush}>
            <RotateCcw size={15} /> Play again
          </button>
          <button type="button" onClick={onClose}>Return to Library</button>
        </div>
      </section>
    );
  }

  const starsProgress = Math.min(100, Math.round((score / 450) * 100));
  const multiplier = Math.min(3, 1 + Math.floor(combo / 3));

  return (
    <section className={`card rb-rush-card ${flashState === 'hit' ? 'is-hit' : flashState === 'miss' ? 'is-miss' : ''}`}>
      <div className="rb-rush-hud">
        <div className="rb-habit-pill">
          <Zap size={14} className="text-amber-400" />
          <strong>{score} pts</strong>
        </div>
        <div className="rb-habit-pill">
          <Flame size={14} className="text-orange-400" />
          <span>{combo} streak (×{multiplier})</span>
        </div>
        <div className="rb-rush-star-bar" title="3-Star Progress">
          <div style={{ width: `${starsProgress}%` }} />
        </div>
        <div className="digital-timer-pill">
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
        <button type="button" onClick={() => setStep('summary')}>
          End
        </button>
      </div>

      {current && (
        <div className="rb-rush-question">
          <span className="eyebrow">
            {current.section} · {current.skill}
          </span>
          {current.passage && <MathText text={current.passage} className="rb-rush-passage" />}
          {current.svgDiagram && <SafeSvgDiagram svg={current.svgDiagram} />}
          {!current.svgDiagram && current.imageDataUrl && (
            <img className="imported-question-image" src={current.imageDataUrl} alt={current.imageAlt || current.skill} />
          )}
          <h3><MathText inline text={current.prompt} /></h3>

          {current.questionType === 'spr' ? (
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <SprInput
                value={sprVal}
                submitted={false}
                acceptableAnswers={current.sprAnswers || []}
                onChange={setSprVal}
                onSubmit={() => handleAnswer(null, sprVal)}
              />
              <button
                type="button"
                className="primary"
                disabled={!sprVal.trim() || !validateSprInput(sprVal).valid}
                onClick={() => handleAnswer(null, sprVal)}
              >
                <span>Lock Answer</span>
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="options-container" style={{ marginTop: '12px' }}>
              {current.options.map((opt, idx) => (
                <div key={opt.letter} className="answer-option-row" onClick={() => handleAnswer(idx)}>
                  <button type="button" className="option-select-area">
                    <span className="option-letter-circle">{opt.letter}</span>
                    <span className="option-text-span"><MathText inline text={opt.text} /></span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
