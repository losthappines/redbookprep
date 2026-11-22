'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  Compass,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { pushCloudProgress } from '@/lib/firebase';
import {
  calculateSatScore,
  MATH_HARD_THRESHOLD,
  MATH_MODULE_MAX,
  RW_HARD_THRESHOLD,
  RW_MODULE_MAX,
  SCORE_PRESETS,
  type AdaptiveMode,
  type SectionInput,
} from '@/lib/sat-score';

const DEFAULT_RW: SectionInput = { m1: 21, m2: 20, mode: 'auto' };
const DEFAULT_MATH: SectionInput = { m1: 18, m2: 17, mode: 'auto' };

function clampInput(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

type ModuleControlProps = {
  id: string;
  label: string;
  hint: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
};

function ModuleControl({ id, label, hint, value, max, onChange }: ModuleControlProps) {
  return (
    <div className="rb-calc-module">
      <div className="rb-calc-module-head">
        <div>
          <label htmlFor={id}>{label}</label>
          <small>{hint}</small>
        </div>
        <div className="rb-calc-stepper">
          <button
            type="button"
            className="rb-calc-step-btn"
            aria-label={`Decrease ${label}`}
            disabled={value <= 0}
            onClick={() => onChange(Math.max(0, value - 1))}
          >
            <Minus size={14} />
          </button>
          <input
            id={id}
            type="number"
            min={0}
            max={max}
            value={value}
            onChange={(e) => onChange(clampInput(Number(e.target.value), max))}
            aria-label={`${label} correct answers out of ${max}`}
          />
          <span className="rb-calc-max">/ {max}</span>
          <button
            type="button"
            className="rb-calc-step-btn"
            aria-label={`Increase ${label}`}
            disabled={value >= max}
            onClick={() => onChange(Math.min(max, value + 1))}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(clampInput(Number(e.target.value), max))}
        aria-label={`${label} slider`}
        className="rb-calc-range"
      />
    </div>
  );
}

type AdaptiveSelectorProps = {
  label: string;
  mode: AdaptiveMode;
  resolvedTier: 'harder' | 'easier';
  m1: number;
  threshold: number;
  moduleMax: number;
  onChange: (mode: AdaptiveMode) => void;
};

function AdaptiveSelector({
  label,
  mode,
  resolvedTier,
  m1,
  threshold,
  moduleMax,
  onChange,
}: AdaptiveSelectorProps) {
  const options: { value: AdaptiveMode; text: string }[] = [
    { value: 'auto', text: 'Auto-detect' },
    { value: 'harder', text: 'Harder M2' },
    { value: 'easier', text: 'Easier M2' },
  ];

  return (
    <div className="rb-calc-adaptive">
      <div className="rb-calc-adaptive-head">
        <span>{label}</span>
        <span className={`rb-calc-tier-pill ${resolvedTier}`}>
          {resolvedTier === 'harder' ? 'Harder Module 2' : 'Easier Module 2'}
        </span>
      </div>
      <div className="rb-calc-mode-group" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={mode === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.text}
          </button>
        ))}
      </div>
      <small>
        {mode === 'auto'
          ? m1 >= threshold
            ? `Module 1 (${m1}/${moduleMax}) clears the ~${threshold}/${moduleMax} routing threshold for the higher-difficulty Module 2.`
            : `Module 1 (${m1}/${moduleMax}) is below the ~${threshold}/${moduleMax} threshold, routing to the easier Module 2 (score ceiling ~640).`
          : `Manually locked to ${resolvedTier === 'harder' ? 'Harder' : 'Easier'} Module 2 regardless of Module 1 count.`}
      </small>
    </div>
  );
}

export function SatScoreCalculator() {
  const [rw, setRw] = useState<SectionInput>(DEFAULT_RW);
  const [math, setMath] = useState<SectionInput>(DEFAULT_MATH);
  const [targetScore, setTargetScore] = useState<number>(1400);
  const [savedToast, setSavedToast] = useState<'idle' | 'saved' | 'error'>('idle');
  const [activePreset, setActivePreset] = useState<string>('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('redbookprep-dashboard-goals') || 'null');
      if (saved && typeof saved.target === 'string') {
        const parsed = Number(saved.target);
        if (Number.isFinite(parsed) && parsed >= 400 && parsed <= 1600) {
          setTargetScore(Math.round(parsed / 10) * 10);
        }
      }
    } catch {}
  }, []);

  const result = useMemo(() => calculateSatScore({ rw, math }), [rw, math]);
  const gap = targetScore - result.total;
  const totalPct = Math.round(((result.total - 400) / 1200) * 100);

  const applyPreset = (presetId: string) => {
    const preset = SCORE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setRw({ ...preset.rw });
    setMath({ ...preset.math });
    setActivePreset(preset.id);
    setSavedToast('idle');
  };

  const resetAll = () => {
    setRw(DEFAULT_RW);
    setMath(DEFAULT_MATH);
    setActivePreset('');
    setSavedToast('idle');
  };

  const saveToDashboard = () => {
    try {
      const existing = JSON.parse(localStorage.getItem('redbookprep-dashboard-goals') || '{}');
      const nextGoals = {
        exam: typeof existing?.exam === 'string' ? existing.exam : '',
        current: String(result.total),
        target: String(targetScore),
      };
      localStorage.setItem('redbookprep-dashboard-goals', JSON.stringify(nextGoals));
      void pushCloudProgress({ goals: nextGoals as unknown as Record<string, unknown> });
      setSavedToast('saved');
      window.setTimeout(() => setSavedToast('idle'), 3000);
    } catch {
      setSavedToast('error');
    }
  };

  const insights = useMemo(() => {
    const tips: string[] = [];
    if (result.rw.resolvedTier === 'easier') {
      const needed = Math.max(0, RW_HARD_THRESHOLD - rw.m1);
      tips.push(
        needed > 0
          ? `Reading & Writing: answering ${needed} more question${needed === 1 ? '' : 's'} correctly in Module 1 unlocks the Harder Module 2 and removes the ~640 ceiling.`
          : 'Reading & Writing is locked to Easier Module 2. Switch to Auto-detect or Harder M2 to check your uncapped ceiling.'
      );
    }
    if (result.math.resolvedTier === 'easier') {
      const needed = Math.max(0, MATH_HARD_THRESHOLD - math.m1);
      tips.push(
        needed > 0
          ? `Math: answering ${needed} more question${needed === 1 ? '' : 's'} correctly in Module 1 unlocks the Harder Module 2 and raises your ceiling to 800.`
          : 'Math is locked to Easier Module 2. Switch to Auto-detect or Harder M2 to check your uncapped ceiling.'
      );
    }
    if (tips.length === 0) {
      if (result.total >= 1550) {
        tips.push(
          'You are in the top 1% range. Focus on eliminating careless errors and pacing difficult final-third Module 2 questions.'
        );
      } else if (result.rw.score < result.math.score - 40) {
        tips.push(
          `Your Math score leads Reading & Writing by ${result.math.score - result.rw.score} points. Reviewing RW transitions, craft & structure, and evidence questions offers the fastest total gain.`
        );
      } else if (result.math.score < result.rw.score - 40) {
        tips.push(
          `Your Reading & Writing score leads Math by ${result.rw.score - result.math.score} points. Drilling Algebra and Advanced Math modules in the Question Bank can lift your composite quickly.`
        );
      } else {
        tips.push(
          'Your Reading & Writing and Math sections are well balanced. Both sections are routed into the Harder Module 2 (full 800 scale unlocked).'
        );
      }
    }
    return tips;
  }, [result, rw.m1, math.m1]);

  return (
    <div className="rb-public rb-landing rb-score-calc-page">
      <a className="rb-skip-link" href="#main">
        Skip to calculator
      </a>
      <header className="site-header">
        <Link className="brand rb-public-brand" href="/">
          <img src="/icon-192.png" alt="" width={30} height={30} className="rb-brand-logo" />
          <b>RedBookPrep</b>
        </Link>
        <div id="navigation-root" className="rb-nav-root">
          <BottomNavBar currentPath="/score-calculator" />
        </div>
        <Link className="button small rb-header-cta" href="/signup">
          Sign up <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <main id="main" className="rb-public-body">
        <section className="rb-calc-hero">
          <div className="rb-calc-hero-top">
            <Link className="rb-calc-back" href="/">
              ← Back to main page
            </Link>
            <span className="rb-eyebrow">DIGITAL SAT SCORE CALCULATOR · 400–1600 SCALE</span>
            <h1>Estimate your Digital SAT score.</h1>
            <p>
              Enter how many questions you got right in each adaptive module for Reading &amp;
              Writing and Math. See your estimated 400–1600 score, realistic IRT range, national
              percentile, and how close you are to your goal.
            </p>
          </div>

          <div className="rb-calc-presets" aria-label="Quick score presets">
            <span className="rb-calc-presets-label">Try a preset:</span>
            {SCORE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`rb-calc-preset-btn ${activePreset === preset.id ? 'active' : ''}`}
                title={preset.description}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" className="rb-calc-preset-btn reset" onClick={resetAll}>
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        </section>

        <section className="rb-calc-workspace" aria-label="SAT score calculator workspace">
          <div className="rb-calc-inputs">
            <article className="rb-calc-card">
              <div className="rb-calc-card-head">
                <div className="rb-calc-card-title">
                  <span className="rb-calc-icon">
                    <BookOpen size={19} />
                  </span>
                  <div>
                    <h2>Reading &amp; Writing</h2>
                    <small>54 total questions across 2 adaptive modules</small>
                  </div>
                </div>
                <div className="rb-calc-section-badge">
                  <strong>{result.rw.score}</strong>
                  <span>/ 800</span>
                </div>
              </div>

              <div className="rb-calc-modules-stack">
                <ModuleControl
                  id="rw-m1"
                  label="Module 1 (Baseline)"
                  hint="Determines Module 2 difficulty routing"
                  value={rw.m1}
                  max={RW_MODULE_MAX}
                  onChange={(m1) => {
                    setActivePreset('');
                    setRw((prev) => ({ ...prev, m1 }));
                  }}
                />
                <ModuleControl
                  id="rw-m2"
                  label="Module 2 (Adaptive)"
                  hint="27 questions · difficulty depends on Module 1"
                  value={rw.m2}
                  max={RW_MODULE_MAX}
                  onChange={(m2) => {
                    setActivePreset('');
                    setRw((prev) => ({ ...prev, m2 }));
                  }}
                />
              </div>

              <AdaptiveSelector
                label="Module 2 routing path"
                mode={rw.mode}
                resolvedTier={result.rw.resolvedTier}
                m1={rw.m1}
                threshold={RW_HARD_THRESHOLD}
                moduleMax={RW_MODULE_MAX}
                onChange={(mode) => {
                  setActivePreset('');
                  setRw((prev) => ({ ...prev, mode }));
                }}
              />
            </article>

            <article className="rb-calc-card">
              <div className="rb-calc-card-head">
                <div className="rb-calc-card-title">
                  <span className="rb-calc-icon">
                    <Calculator size={19} />
                  </span>
                  <div>
                    <h2>Math</h2>
                    <small>44 total questions across 2 adaptive modules</small>
                  </div>
                </div>
                <div className="rb-calc-section-badge">
                  <strong>{result.math.score}</strong>
                  <span>/ 800</span>
                </div>
              </div>

              <div className="rb-calc-modules-stack">
                <ModuleControl
                  id="math-m1"
                  label="Module 1 (Baseline)"
                  hint="Determines Module 2 difficulty routing"
                  value={math.m1}
                  max={MATH_MODULE_MAX}
                  onChange={(m1) => {
                    setActivePreset('');
                    setMath((prev) => ({ ...prev, m1 }));
                  }}
                />
                <ModuleControl
                  id="math-m2"
                  label="Module 2 (Adaptive)"
                  hint="22 questions · difficulty depends on Module 1"
                  value={math.m2}
                  max={MATH_MODULE_MAX}
                  onChange={(m2) => {
                    setActivePreset('');
                    setMath((prev) => ({ ...prev, m2 }));
                  }}
                />
              </div>

              <AdaptiveSelector
                label="Module 2 routing path"
                mode={math.mode}
                resolvedTier={result.math.resolvedTier}
                m1={math.m1}
                threshold={MATH_HARD_THRESHOLD}
                moduleMax={MATH_MODULE_MAX}
                onChange={(mode) => {
                  setActivePreset('');
                  setMath((prev) => ({ ...prev, mode }));
                }}
              />
            </article>
          </div>

          <aside className="rb-calc-summary" aria-label="Estimated SAT score results">
            <div className="rb-calc-score-panel">
              <div className="rb-calc-score-top">
                <span className="rb-eyebrow">ESTIMATED COMPOSITE SCORE</span>
                <span className="rb-calc-percentile">
                  <TrendingUp size={13} />
                  {formatOrdinal(result.percentile)} percentile
                </span>
              </div>

              <div className="rb-calc-total-row">
                <strong className="rb-calc-total-number" aria-live="polite">
                  {result.total}
                </strong>
                <span className="rb-calc-total-scale">/ 1600</span>
              </div>
              <p className="rb-calc-range-note">
                Realistic IRT range: <strong>{result.totalMin} – {result.totalMax}</strong> ·{' '}
                {rw.m1 + rw.m2 + math.m1 + math.m2} / 98 raw correct
              </p>

              <div className="rb-calc-meter" aria-hidden="true">
                <div className="rb-calc-meter-track">
                  <div className="rb-calc-meter-fill" style={{ width: `${totalPct}%` }} />
                </div>
                <div className="rb-calc-meter-labels">
                  <span>400</span>
                  <span>1000</span>
                  <span>1300</span>
                  <span>1600</span>
                </div>
              </div>

              <div className="rb-calc-breakdown-grid">
                <div className="rb-calc-subscore">
                  <div className="rb-calc-subscore-head">
                    <span>Reading &amp; Writing</span>
                    <span className={`rb-calc-tier-dot ${result.rw.resolvedTier}`}>
                      {result.rw.resolvedTier === 'harder' ? 'Harder M2' : 'Easier M2'}
                    </span>
                  </div>
                  <strong>{result.rw.score}</strong>
                  <small>
                    Range {result.rw.min}–{result.rw.max} · {result.rw.rawTotal}/{result.rw.maxTotal}{' '}
                    correct
                  </small>
                </div>

                <div className="rb-calc-subscore">
                  <div className="rb-calc-subscore-head">
                    <span>Math</span>
                    <span className={`rb-calc-tier-dot ${result.math.resolvedTier}`}>
                      {result.math.resolvedTier === 'harder' ? 'Harder M2' : 'Easier M2'}
                    </span>
                  </div>
                  <strong>{result.math.score}</strong>
                  <small>
                    Range {result.math.min}–{result.math.max} · {result.math.rawTotal}/
                    {result.math.maxTotal} correct
                  </small>
                </div>
              </div>

              <div className="rb-calc-goal-box">
                <div className="rb-calc-goal-head">
                  <label htmlFor="target-score-input">
                    <Target size={15} />
                    Your Target Score
                  </label>
                  <div className="rb-calc-goal-input-wrap">
                    <button
                      type="button"
                      className="rb-calc-step-btn"
                      aria-label="Decrease target score"
                      disabled={targetScore <= 400}
                      onClick={() => setTargetScore((v) => Math.max(400, v - 10))}
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      id="target-score-input"
                      type="number"
                      min={400}
                      max={1600}
                      step={10}
                      value={targetScore}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) return;
                        setTargetScore(Math.max(400, Math.min(1600, Math.round(raw / 10) * 10)));
                      }}
                    />
                    <button
                      type="button"
                      className="rb-calc-step-btn"
                      aria-label="Increase target score"
                      disabled={targetScore >= 1600}
                      onClick={() => setTargetScore((v) => Math.min(1600, v + 10))}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <p className={`rb-calc-goal-status ${gap <= 0 ? 'met' : ''}`}>
                  {gap <= 0 ? (
                    <>
                      <Check size={15} />
                      Goal reached ({Math.abs(gap)} pts above your {targetScore} target)
                    </>
                  ) : (
                    <>
                      <Compass size={15} />
                      {gap} points to reach your {targetScore} target
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className="rb-public-button rb-calc-save-btn"
                  onClick={saveToDashboard}
                >
                  {savedToast === 'saved' ? (
                    <>
                      <Check size={16} />
                      Saved to Study Dashboard
                    </>
                  ) : (
                    'Save score & goal to Dashboard'
                  )}
                </button>
                {savedToast === 'error' && (
                  <small className="rb-calc-error">
                    Could not save to browser storage on this device.
                  </small>
                )}
              </div>

              <div className="rb-calc-insights">
                <h3>
                  <Sparkles size={15} />
                  Score insights
                </h3>
                <ul>
                  {insights.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>

              <div className="rb-calc-cta-stack">
                <Link className="rb-public-button primary" href="/study">
                  <Play size={16} />
                  Practise in Study Workspace
                </Link>
                <Link className="rb-public-button" href="/study?tab=question-bank">
                  Browse 2,231+ Question Bank
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </aside>
        </section>

        <section className="rb-public-section rb-calc-explain">
          <div className="rb-section-intro">
            <span className="rb-eyebrow">HOW DIGITAL SAT SCORING WORKS</span>
            <h2>Why Module 1 and Module 2 aren’t weighted the same.</h2>
            <p>
              The Digital SAT uses multistage adaptive testing (MST). Your performance on Module 1
              determines which version of Module 2 you receive, and each version has its own scaled
              score range.
            </p>
          </div>
          <div className="rb-feature-grid">
            {[
              {
                title: '1. Stage-one routing',
                text: 'Module 1 contains mixed difficulty questions. Getting roughly 60%+ right (around 16/27 in Reading & Writing or 14/22 in Math) routes you into the Harder Module 2.',
              },
              {
                title: '2. Why Easier Module 2 caps out',
                text: 'Because the easier Module 2 lacks the hardest high-discrimination items, even a perfect Module 2 score typically tops out around 600–640 for that section.',
              },
              {
                title: '3. IRT question weighting',
                text: 'College Board uses Item Response Theory rather than a simple raw-score table. Missing an easy item or an unscored pretest item affects your score differently, creating a ±20 pt band.',
              },
              {
                title: '4. Turn estimates into action',
                text: 'Save your current and target score to the RedBookPrep Dashboard, then focus on the specific Math and Reading & Writing skills that lift your Module 1 accuracy first.',
              },
            ].map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="rb-public-section rb-faq">
          <div className="rb-section-intro">
            <h2>Score calculator FAQs.</h2>
          </div>
          {[
            {
              q: 'How accurate is this Digital SAT score calculator?',
              a: 'The calculator models published Bluebook Digital SAT adaptive routing curves and displays a ±20 point range per section. Because College Board scores via Item Response Theory (and includes 2 unscored pretest items per module), exact official scores can vary slightly depending on which specific questions were missed.',
            },
            {
              q: 'What if I am not sure whether I got the Harder or Easier Module 2?',
              a: 'Leave the routing path on Auto-detect, which estimates your Module 2 difficulty from your Module 1 score (~16/27 for Reading & Writing and ~14/22 for Math). If you already know from Bluebook or your practice test key, you can manually select Harder M2 or Easier M2.',
            },
            {
              q: 'Does saving my score require an account?',
              a: 'No. Clicking "Save score & goal to Dashboard" stores your score and target locally in your browser so it appears in your Study Dashboard immediately. If you sign in with Google, it also syncs to your cloud profile.',
            },
          ].map(({ q, a }) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={17} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>

      <footer className="rb-public-footer">
        <Link className="rb-public-brand" href="/">
          <img
            src="/icon-192.png"
            alt=""
            width={26}
            height={26}
            className="rb-brand-logo rb-brand-logo-sm"
          />
          RedBookPrep
        </Link>
        <span>
          Independent SAT® test preparation. SAT® is a registered trademark of the College Board,
          which is not affiliated with and does not endorse RedBookPrep.
        </span>
        <div>
          <Link href="/study">Study</Link>
          <Link href="/score-calculator">Score Calculator</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
