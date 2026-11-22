'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Clock, CheckCircle2, XCircle, Flag, ChevronRight, ChevronLeft, Award, Calculator as CalcIcon } from 'lucide-react';
import type { PracticeQuestion } from './bbplus';
import { MathText, SafeSvgDiagram } from './math-text';
import { SprInput } from './spr-input';
import { evaluateSprResponse } from '@/lib/sat-spr';
import { calculateSatScore } from '@/lib/sat-score';

type MockMode = 'full' | 'rw' | 'math';
type StageKey = 'rw1' | 'rw2' | 'break' | 'math1' | 'math2';

interface SavedMockAttempt {
  id: string;
  title: string;
  mode: MockMode;
  completedAt: string;
  rwRaw1: number;
  rwRaw2: number;
  rwTier: 'easier' | 'harder';
  mathRaw1: number;
  mathRaw2: number;
  mathTier: 'easier' | 'harder';
  rwScore: number;
  mathScore: number;
  totalScore: number;
}

const MOCK_HISTORY_KEY = 'redbookprep-mock-history-v1';

export function MockExamView({
  questions,
  onOpenCalculator,
  onSaveMockAttempts,
}: {
  questions: PracticeQuestion[];
  onOpenCalculator?: () => void;
  onSaveMockAttempts?: (items: { id: string; choice: number; sprResponse?: string; isCorrect: boolean; seconds: number }[]) => void;
}) {
  const [stage, setStage] = useState<'lobby' | 'running' | 'results'>('lobby');
  const [mode, setMode] = useState<MockMode>('full');
  const [history, setHistory] = useState<SavedMockAttempt[]>([]);
  const [activeReport, setActiveReport] = useState<SavedMockAttempt | null>(null);

  const [moduleKey, setModuleKey] = useState<StageKey>('rw1');
  const [moduleItems, setModuleItems] = useState<PracticeQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { choice: number | null; spr: string }>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(32 * 60);
  const [paused, setPaused] = useState(false);

  const [rw1Raw, setRw1Raw] = useState(0);
  const [rwTier, setRwTier] = useState<'easier' | 'harder'>('harder');
  const [rw2Raw, setRw2Raw] = useState(0);
  const [math1Raw, setMath1Raw] = useState(0);
  const [mathTier, setMathTier] = useState<'easier' | 'harder'>('harder');

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(MOCK_HISTORY_KEY) || '[]');
      if (Array.isArray(raw)) setHistory(raw);
    } catch {}
  }, []);

  const rwPool = useMemo(() => questions.filter((q) => q.section === 'Reading and Writing'), [questions]);
  const mathPool = useMemo(() => questions.filter((q) => q.section === 'Math'), [questions]);

  const pickModuleSlice = (pool: PracticeQuestion[], count: number, offset: number, hardBias = false) => {
    const ordered = hardBias
      ? [...pool].sort((a, b) => (b.difficulty || 2) - (a.difficulty || 2))
      : pool;
    if (!ordered.length) return [];
    const slice: PracticeQuestion[] = [];
    for (let i = 0; i < Math.min(count, ordered.length); i += 1) {
      slice.push(ordered[(offset + i) % ordered.length]);
    }
    return slice;
  };

  const beginExam = (chosenMode: MockMode) => {
    setMode(chosenMode);
    setAnswers({});
    setFlagged([]);
    setRw1Raw(0);
    setRw2Raw(0);
    setMath1Raw(0);
    setPaused(false);
    if (chosenMode === 'math') {
      setModuleKey('math1');
      setModuleItems(pickModuleSlice(mathPool, 22, 0));
      setSecondsLeft(35 * 60);
    } else {
      setModuleKey('rw1');
      setModuleItems(pickModuleSlice(rwPool, 27, 0));
      setSecondsLeft(32 * 60);
    }
    setQIdx(0);
    setStage('running');
  };

  useEffect(() => {
    if (stage !== 'running' || paused) return;
    const t = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [stage, paused]);

  const gradeCurrentModule = () => {
    let raw = 0;
    const attempted: { id: string; choice: number; sprResponse?: string; isCorrect: boolean; seconds: number }[] = [];
    for (const q of moduleItems) {
      const ans = answers[q.id];
      const isSpr = q.questionType === 'spr';
      const hasAns = isSpr ? Boolean(ans?.spr?.trim()) : ans?.choice != null;
      if (!hasAns) continue;
      const ok = isSpr
        ? evaluateSprResponse(ans!.spr, q.sprAnswers || [])
        : ans!.choice === q.answer;
      if (ok) raw += 1;
      attempted.push({
        id: q.id,
        choice: isSpr ? -1 : (ans?.choice ?? 0),
        sprResponse: isSpr ? ans?.spr : undefined,
        isCorrect: ok,
        seconds: 45,
      });
    }
    if (attempted.length && onSaveMockAttempts) {
      onSaveMockAttempts(attempted);
    }
    return raw;
  };

  const advanceModule = () => {
    if (moduleKey === 'rw1') {
      const raw = gradeCurrentModule();
      const tier: 'easier' | 'harder' = raw >= Math.round(moduleItems.length * 0.56) ? 'harder' : 'easier';
      setRw1Raw(raw);
      setRwTier(tier);
      setModuleKey('rw2');
      setModuleItems(pickModuleSlice(rwPool, 27, 27, tier === 'harder'));
      setQIdx(0);
      setSecondsLeft(32 * 60);
      return;
    }

    if (moduleKey === 'rw2') {
      const raw = gradeCurrentModule();
      setRw2Raw(raw);
      if (mode === 'rw') {
        finishExam(rw1Raw, raw, rwTier, 0, 0, 'harder');
        return;
      }
      setModuleKey('break');
      setSecondsLeft(10 * 60);
      return;
    }

    if (moduleKey === 'break') {
      setModuleKey('math1');
      setModuleItems(pickModuleSlice(mathPool, 22, 0));
      setQIdx(0);
      setSecondsLeft(35 * 60);
      return;
    }

    if (moduleKey === 'math1') {
      const raw = gradeCurrentModule();
      const tier: 'easier' | 'harder' = raw >= Math.round(moduleItems.length * 0.59) ? 'harder' : 'easier';
      setMath1Raw(raw);
      setMathTier(tier);
      setModuleKey('math2');
      setModuleItems(pickModuleSlice(mathPool, 22, 22, tier === 'harder'));
      setQIdx(0);
      setSecondsLeft(35 * 60);
      return;
    }

    const math2Raw = gradeCurrentModule();
    finishExam(rw1Raw, rw2Raw, rwTier, math1Raw, math2Raw, mathTier);
  };

  const finishExam = (
    rw1: number,
    rw2: number,
    rwT: 'easier' | 'harder',
    m1: number,
    m2: number,
    mT: 'easier' | 'harder'
  ) => {
    const scaled = calculateSatScore({
      rw: { m1: rw1, m2: rw2, mode: rwT },
      math: { m1, m2, mode: mT },
    });
    const entry: SavedMockAttempt = {
      id: `mock-${Date.now()}`,
      title: mode === 'full' ? 'Digital SAT Full Adaptive Mock' : mode === 'rw' ? 'R&W Section Mock' : 'Math Section Mock',
      mode,
      completedAt: new Date().toISOString(),
      rwRaw1: rw1,
      rwRaw2: rw2,
      rwTier: rwT,
      mathRaw1: m1,
      mathRaw2: m2,
      mathTier: mT,
      rwScore: mode === 'math' ? 0 : scaled.rw.score,
      mathScore: mode === 'rw' ? 0 : scaled.math.score,
      totalScore: mode === 'full' ? scaled.total : mode === 'rw' ? scaled.rw.score : scaled.math.score,
    };
    const nextHist = [entry, ...history].slice(0, 20);
    setHistory(nextHist);
    try {
      localStorage.setItem(MOCK_HISTORY_KEY, JSON.stringify(nextHist));
    } catch {}
    setActiveReport(entry);
    setStage('results');
  };

  if (stage === 'lobby') {
    return (
      <section className="rb-mock-lobby">
        <div className="rb-page-heading">
          <div>
            <span className="eyebrow">ADAPTIVE DIGITAL SAT SIMULATOR</span>
            <h1>Mock Exams</h1>
            <p>
              Multistage Module 1 → adaptive Module 2 routing (Easier / Harder) calibrated to the official 400–1600 scale.
            </p>
          </div>
          <small>{questions.length.toLocaleString()} questions ready</small>
        </div>

        <div className="rb-mock-cards-grid">
          <article className="card rb-mock-card">
            <span className="eyebrow">FULL EXAM · 98 QUESTIONS</span>
            <h2>Full Digital SAT Mock</h2>
            <p>Reading &amp; Writing (M1 + adaptive M2) + 10-min break + Math (M1 + adaptive M2) with MCQ &amp; Grid-In SPR.</p>
            <button type="button" className="primary" disabled={rwPool.length < 10 || mathPool.length < 10} onClick={() => beginExam('full')}>
              <Play size={15} /> Start Full Exam
            </button>
          </article>

          <article className="card rb-mock-card">
            <span className="eyebrow">SECTION ONLY · 54 QUESTIONS</span>
            <h2>Reading &amp; Writing Section</h2>
            <p>Two 32-minute adaptive modules focusing purely on Craft, Structure, Inference &amp; Standard English.</p>
            <button type="button" disabled={rwPool.length < 10} onClick={() => beginExam('rw')}>
              <Play size={15} /> Start R&amp;W Mock
            </button>
          </article>

          <article className="card rb-mock-card">
            <span className="eyebrow">SECTION ONLY · 44 QUESTIONS</span>
            <h2>Math Section Mock</h2>
            <p>Two 35-minute adaptive modules with Desmos Graphing &amp; Scientific Calculators and Grid-In SPR questions.</p>
            <button type="button" disabled={mathPool.length < 10} onClick={() => beginExam('math')}>
              <Play size={15} /> Start Math Mock
            </button>
          </article>
        </div>

        {history.length > 0 && (
          <section className="card" style={{ marginTop: '24px' }}>
            <span className="eyebrow">RECENT MOCK REPORTS</span>
            <h2>Past Exam Attempts</h2>
            <div className="rb-mock-history-list">
              {history.map((h) => (
                <div key={h.id} className="rb-mock-history-row">
                  <div>
                    <strong>{h.title}</strong>
                    <small>{new Date(h.completedAt).toLocaleDateString()} · RW ({h.rwTier}) / Math ({h.mathTier})</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <strong style={{ fontSize: '1.2rem' }}>{h.totalScore}</strong>
                    <button type="button" onClick={() => { setActiveReport(h); setStage('results'); }}>
                      View score
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    );
  }

  if (stage === 'results' && activeReport) {
    return (
      <section className="card rb-mock-results">
        <span className="eyebrow">OFFICIAL STYLE SCORE REPORT</span>
        <h1>{activeReport.totalScore} {activeReport.mode === 'full' ? '/ 1600' : '/ 800'}</h1>
        <p>Completed on {new Date(activeReport.completedAt).toLocaleString()}</p>

        <div className="stats-strip">
          {activeReport.mode !== 'math' && (
            <div>
              <strong>{activeReport.rwScore}</strong>
              <span>Reading &amp; Writing ({activeReport.rwRaw1 + activeReport.rwRaw2} raw · {activeReport.rwTier} M2)</span>
            </div>
          )}
          {activeReport.mode !== 'rw' && (
            <div>
              <strong>{activeReport.mathScore}</strong>
              <span>Math ({activeReport.mathRaw1 + activeReport.mathRaw2} raw · {activeReport.mathTier} M2)</span>
            </div>
          )}
          <div>
            <strong><Award size={24} style={{ display: 'inline' }} /> Ready</strong>
            <span>Missed questions synced to Mistakes Hub</span>
          </div>
        </div>

        <div className="rb-actions">
          <button type="button" className="primary" onClick={() => setStage('lobby')}>
            Back to Mock Lobby
          </button>
        </div>
      </section>
    );
  }

  if (moduleKey === 'break') {
    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const secs = String(secondsLeft % 60).padStart(2, '0');
    return (
      <section className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <span className="eyebrow">HALF-TIME BREAK</span>
        <h1>Take a 10-minute breather</h1>
        <p>Stretch, grab water, and resume when you are ready for Math Module 1.</p>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, margin: '18px 0' }}>{mins}:{secs}</div>
        <button type="button" className="primary" onClick={advanceModule}>
          Continue to Math Module 1 <ChevronRight size={16} />
        </button>
      </section>
    );
  }

  const cur = moduleItems[qIdx];
  const curAns = cur ? answers[cur.id] || { choice: null, spr: '' } : { choice: null, spr: '' };
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <section className="rb-mock-runner">
      <header className="practice-header-bar" style={{ borderRadius: '18px', marginBottom: '18px' }}>
        <div className="header-left">
          <button type="button" onClick={() => setStage('lobby')}>Exit Mock</button>
        </div>
        <div className="header-center">
          <strong className="skill-main-name">
            {moduleKey.startsWith('rw') ? 'Reading & Writing' : 'Math'} · Module {moduleKey.endsWith('1') ? '1' : '2'}
          </strong>
          <small>Question {qIdx + 1} of {moduleItems.length}</small>
        </div>
        <div className="header-right">
          <div className="digital-timer-pill">
            <Clock size={14} /> <span>{mins}:{secs}</span>
          </div>
          <button type="button" className="header-tool-btn" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume' : 'Pause'}
          </button>
          {moduleKey.startsWith('math') && onOpenCalculator && (
            <button type="button" className="header-tool-btn" onClick={onOpenCalculator}>
              <CalcIcon size={14} /> Desmos
            </button>
          )}
        </div>
      </header>

      {cur && (
        <div className="card rb-mock-split">
          <div className="rb-mock-pane">
            {cur.passage && <MathText text={cur.passage} />}
            {cur.svgDiagram && <SafeSvgDiagram svg={cur.svgDiagram} />}
            {!cur.svgDiagram && cur.imageDataUrl && (
              <img className="imported-question-image" src={cur.imageDataUrl} alt={cur.imageAlt || cur.skill} />
            )}
            {!cur.passage && !cur.imageDataUrl && !cur.svgDiagram && (
              <p style={{ opacity: 0.7 }}>No companion passage for this problem.</p>
            )}
          </div>

          <div className="rb-mock-pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="eyebrow">{cur.skill}</span>
              <button
                type="button"
                className={`flag-question-btn ${flagged.includes(cur.id) ? 'flagged' : ''}`}
                onClick={() => setFlagged((f) => (f.includes(cur.id) ? f.filter((id) => id !== cur.id) : [...f, cur.id]))}
              >
                <Flag size={13} /> Flag
              </button>
            </div>
            <h2 style={{ marginBottom: '16px' }}><MathText inline text={cur.prompt} /></h2>

            {cur.questionType === 'spr' ? (
              <SprInput
                value={curAns.spr}
                submitted={false}
                acceptableAnswers={[]}
                onChange={(spr) => setAnswers((a) => ({ ...a, [cur.id]: { ...curAns, spr } }))}
              />
            ) : (
              <div className="options-container">
                {cur.options.map((opt, idx) => (
                  <div
                    key={opt.letter}
                    className={`answer-option-row ${curAns.choice === idx ? 'selected' : ''}`}
                    onClick={() => setAnswers((a) => ({ ...a, [cur.id]: { ...curAns, choice: idx } }))}
                  >
                    <button type="button" className="option-select-area">
                      <span className="option-letter-circle">{opt.letter}</span>
                      <span className="option-text-span"><MathText inline text={opt.text} /></span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rb-actions" style={{ marginTop: '20px', justifyContent: 'space-between' }}>
              <button type="button" disabled={qIdx === 0} onClick={() => setQIdx((i) => Math.max(0, i - 1))}>
                <ChevronLeft size={15} /> Previous
              </button>
              {qIdx < moduleItems.length - 1 ? (
                <button type="button" className="primary" onClick={() => setQIdx((i) => i + 1)}>
                  Next <ChevronRight size={15} />
                </button>
              ) : (
                <button type="button" className="primary" onClick={advanceModule}>
                  Submit Module <CheckCircle2 size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
