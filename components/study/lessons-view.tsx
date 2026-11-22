'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Calculator as CalcIcon, CheckCircle2, Sparkles, ChevronRight, Play, Layers, Send } from 'lucide-react';
import type { PracticeQuestion } from './bbplus';
import { MathText } from './math-text';

interface DesmosStep {
  title: string;
  explanation: string;
  expressions: string[];
}

interface LessonGuide {
  id: string;
  track: 'Math & Desmos' | 'Reading & Writing';
  title: string;
  readTime: string;
  targetSkillMatch: string;
  summary: string;
  sections: { heading: string; body: string }[];
  desmosWalkthrough?: DesmosStep[];
}

const LESSON_GUIDES: LessonGuide[] = [
  {
    id: 'math-desmos-systems',
    track: 'Math & Desmos',
    title: 'Linear Systems, No Solution & Infinite Solutions in Desmos',
    readTime: '6 min',
    targetSkillMatch: 'Linear System',
    summary: 'Spot parallel lines vs intersecting systems instantly using Desmos sliders and slope ratios.',
    sections: [
      {
        heading: '1. The Golden Ratio Rule (No Solution vs Infinitely Many)',
        body: 'For a system $a_1x + b_1y = c_1$ and $a_2x + b_2y = c_2$, **no solution** means the lines are parallel with different intercepts: $\\frac{a_1}{a_2} = \\frac{b_1}{b_2} \\neq \\frac{c_1}{c_2}$. **Infinitely many solutions** means they are the exact same line: $\\frac{a_1}{a_2} = \\frac{b_1}{b_2} = \\frac{c_1}{c_2}$.',
      },
      {
        heading: '2. Why Desmos Sliders Crush Unknown Constants ($k$ or $p$)',
        body: 'Whenever a Digital SAT problem gives a constant like $kx - 4y = 12$, type both equations directly into Desmos and click **add slider** for $k$. Drag the slider until the lines become perfectly parallel or overlap completely.',
      },
    ],
    desmosWalkthrough: [
      {
        title: 'Step 1: Graph a parallel no-solution pair',
        explanation: 'Both lines share slope $m = 2$, so they never intersect.',
        expressions: ['y = 2x + 3', 'y = 2x - 4'],
      },
      {
        title: 'Step 2: Solve by clicking intersection',
        explanation: 'Graph both equations directly in standard form and tap the gray intersection dot.',
        expressions: ['3x + 2y = 14', 'x - y = 3'],
      },
      {
        title: 'Step 3: Parameter slider ($k$)',
        explanation: 'Add $k$ to test when two lines have identical slope ($k = 6$).',
        expressions: ['k = 6', 'kx - 4y = 12', '3x - 2y = 5'],
      },
    ],
  },
  {
    id: 'math-desmos-regression',
    track: 'Math & Desmos',
    title: 'Desmos Regression (`~`) for Tables, Quadratics & Exponentials',
    readTime: '7 min',
    targetSkillMatch: 'Quadratic',
    summary: 'Fit exact lines, parabolas, and exponential curves from two or three points in 8 seconds.',
    sections: [
      {
        heading: '1. Syntax You Must Memorize: $y_1 \\sim ax_1^2 + bx_1 + c$',
        body: 'Press `+` in Desmos, insert a **Table**, enter the $(x, y)$ rows given by the problem, then type $y_1 \\sim mx_1 + b$ (linear), $y_1 \\sim ax_1^2 + bx_1 + c$ (quadratic), or $y_1 \\sim a(b)^{x_1}$ (exponential). Desmos outputs exact parameter values immediately.',
      },
      {
        heading: '2. Equivalent Expressions Trick (Plot-Compare)',
        body: 'Unsure which algebraic expansion matches $4(x - 3)^2 - 16$? Graph the original expression as $f(x)$ and type your top contender as $g(x)$ — equivalent expressions trace the exact same curve everywhere.',
      },
    ],
    desmosWalkthrough: [
      {
        title: 'Step 1: Compare equivalent vertex & standard quadratics',
        explanation: 'Toggle the curves to verify they overlap point-for-point.',
        expressions: ['y = (x - 3)^2 - 4', 'y = x^2 - 6x + 5'],
      },
      {
        title: 'Step 2: Exponential growth curve & doubling point',
        explanation: 'Inspect the initial value $(0, 120)$ and rapid growth at $x = 5$.',
        expressions: ['y = 120(1.15)^x', 'y = 240'],
      },
    ],
  },
  {
    id: 'rw-boundaries-clauses',
    track: 'Reading & Writing',
    title: 'Standard English Conventions: Clause Boundaries & Punctuation',
    readTime: '5 min',
    targetSkillMatch: 'Boundaries',
    summary: 'Never guess commas vs semicolons again using the Independent vs Dependent Clause Check.',
    sections: [
      {
        heading: '1. Period = Semicolon = Comma + FANBOYS',
        body: 'On the Digital SAT, a period (.), a semicolon (;), and `, and / , but / , so` are **grammatically identical** for joining two independent clauses. Therefore, if two options differ only between a period and a semicolon with identical words, BOTH are usually wrong unless one fixes a fragment.',
      },
      {
        heading: '2. The Nonessential Clause Test',
        body: 'If you can cross out the middle phrase (`The botanist, who published twelve papers last year, received...`) and the remaining sentence still reads cleanly (`The botanist received...`), wrap the interruption with matching punctuation: two commas, two dashes, or two parentheses — never mix one comma and one dash.',
      },
    ],
  },
  {
    id: 'rw-transitions-concession',
    track: 'Reading & Writing',
    title: 'Transitions Playbook: Contrast vs Concession vs Cause',
    readTime: '5 min',
    targetSkillMatch: 'Transitions',
    summary: 'Distinguish "In contrast" from "Nevertheless" and spot synonym answer-pair eliminations.',
    sections: [
      {
        heading: '1. Always Cover the Blank and Predict First',
        body: 'Read Sentence 1 and Sentence 2 ignoring all choices. Ask: Does Sentence 2 **continue/add** (*Moreover, Furthermore*), **give an example** (*For instance*), **show result** (*Consequently, Thus*), or **oppose** (*However, Nevertheless*)?',
      },
      {
        heading: '2. Direct Contrast vs Concession',
        body: '**Contrast** (`In contrast`, `By comparison`, `Meanwhile`) compares two different subjects side by side. **Concession** (`Nevertheless`, `Nonetheless`, `Even so`, `Still`) signals a surprising result that happens *despite* Sentence 1.',
      },
    ],
  },
];

export function LessonsView({
  questions = [],
  onStartQuestion,
  onPractice,
  onDashboard,
}: {
  questions?: PracticeQuestion[];
  onStartQuestion?: (index: number) => void;
  onPractice: () => void;
  onDashboard: () => void;
}) {
  const [selectedId, setSelectedId] = useState(LESSON_GUIDES[0].id);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [syllabusOpen, setSyllabusOpen] = useState(true);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachInput, setCoachInput] = useState('');
  const [coachReply, setCoachReply] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);

  const calcFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('redbookprep-lessons-done') || '[]');
      if (Array.isArray(saved)) setCompletedIds(saved);
    } catch {}
  }, []);

  const activeGuide = LESSON_GUIDES.find((g) => g.id === selectedId) || LESSON_GUIDES[0];

  const pushExpressionsToLessonCalc = (expressions: string[]) => {
    calcFrameRef.current?.contentWindow?.postMessage(
      {
        type: 'redbook-graph-set-expressions',
        replace: true,
        expressions: expressions.map((latex, i) => ({ id: `lesson-${i + 1}`, latex })),
      },
      window.location.origin
    );
  };

  const toggleCompleted = (id: string) => {
    setCompletedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('redbookprep-lessons-done', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // 5-question stepping-stone practice set matched to active lesson
  const steppingStones = questions
    .map((q, idx) => ({ q, idx }))
    .filter(
      ({ q }) =>
        q.skill.toLowerCase().includes(activeGuide.targetSkillMatch.toLowerCase()) ||
        q.domain.toLowerCase().includes(activeGuide.targetSkillMatch.toLowerCase())
    )
    .slice(0, 5);

  const askLessonCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachInput.trim() || coachBusy) return;
    setCoachBusy(true);
    setCoachReply('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Gemini 3.5 Flash',
          effort: 'Medium',
          message: `[Lesson Context: "${activeGuide.title}" (${activeGuide.track})]\nStudent asks: ${coachInput}`,
        }),
      });
      const data = await res.json();
      setCoachReply(data.reply || data.error || 'Unable to reach redCoach.');
    } catch {
      setCoachReply('Network error contacting redCoach.');
    } finally {
      setCoachBusy(false);
    }
  };

  const desmosApiKey = process.env.NEXT_PUBLIC_DESMOS_API_KEY?.trim();
  const calcSrc = `/calculator/index.html?theme=dark${desmosApiKey ? `&apiKey=${encodeURIComponent(desmosApiKey)}` : ''}`;

  return (
    <section className="rb-lessons-root">
      <div className="rb-page-heading">
        <div>
          <span className="eyebrow">MASTERCLASSES V1 · INTERACTIVE TEXT &amp; DESMOS</span>
          <h1>Lessons</h1>
          <p>
            High-leverage Reading &amp; Writing playbooks and clickable Desmos walkthroughs paired with 5-question drills.
          </p>
        </div>
        <div className="rb-actions">
          <button type="button" onClick={() => setSyllabusOpen((v) => !v)}>
            <Layers size={15} /> {syllabusOpen ? 'Hide Syllabus' : 'Show Syllabus'}
          </button>
          <button type="button" className="primary" onClick={() => setCoachOpen((v) => !v)}>
            <Sparkles size={15} /> Ask redCoach
          </button>
        </div>
      </div>

      <div className={`rb-lessons-layout ${syllabusOpen ? 'with-syllabus' : 'no-syllabus'}`}>
        {syllabusOpen && (
          <aside className="card rb-lesson-syllabus" aria-label="Lesson syllabus">
            <span className="eyebrow">
              SYLLABUS · {completedIds.length}/{LESSON_GUIDES.length} COMPLETE
            </span>
            {(['Math & Desmos', 'Reading & Writing'] as const).map((track) => (
              <div key={track} className="rb-syllabus-group">
                <strong>{track}</strong>
                {LESSON_GUIDES.filter((g) => g.track === track).map((g) => {
                  const active = g.id === activeGuide.id;
                  const done = completedIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={`rb-syllabus-item ${active ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedId(g.id);
                        setActiveStepIdx(0);
                        setCoachReply('');
                      }}
                    >
                      <CheckCircle2 size={14} className={done ? 'text-emerald-500' : 'opacity-30'} />
                      <span>{g.title}</span>
                      <small>{g.readTime}</small>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>
        )}

        <article className="card rb-lesson-main">
          <div className="rb-lesson-header">
            <div>
              <span className="eyebrow">{activeGuide.track.toUpperCase()} · {activeGuide.readTime} READ</span>
              <h2>{activeGuide.title}</h2>
              <p>{activeGuide.summary}</p>
            </div>
            <button
              type="button"
              className={completedIds.includes(activeGuide.id) ? 'primary' : ''}
              onClick={() => toggleCompleted(activeGuide.id)}
            >
              <CheckCircle2 size={15} />
              <span>{completedIds.includes(activeGuide.id) ? 'Completed' : 'Mark Complete'}</span>
            </button>
          </div>

          <div className="rb-lesson-sections">
            {activeGuide.sections.map((sec) => (
              <section key={sec.heading} className="rb-lesson-sec">
                <h3>{sec.heading}</h3>
                <MathText text={sec.body} />
              </section>
            ))}
          </div>

          {activeGuide.desmosWalkthrough && (
            <section className="rb-desmos-lab">
              <div className="rb-desmos-lab-head">
                <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <CalcIcon size={14} /> INTERACTIVE DESMOS WALKTHROUGH
                </span>
                <small>Click any step to load equations directly into the live canvas</small>
              </div>
              <div className="rb-desmos-lab-grid">
                <div className="rb-desmos-steps">
                  {activeGuide.desmosWalkthrough.map((step, sIdx) => (
                    <button
                      key={step.title}
                      type="button"
                      className={`rb-desmos-step-card ${activeStepIdx === sIdx ? 'is-active' : ''}`}
                      onClick={() => {
                        setActiveStepIdx(sIdx);
                        pushExpressionsToLessonCalc(step.expressions);
                      }}
                    >
                      <strong>{step.title}</strong>
                      <p><MathText inline text={step.explanation} /></p>
                      <code>{step.expressions.join('  |  ')}</code>
                    </button>
                  ))}
                </div>
                <div className="rb-desmos-embed">
                  <iframe
                    ref={calcFrameRef}
                    src={calcSrc}
                    title="Embedded Desmos walkthrough"
                    onLoad={() => {
                      const first = activeGuide.desmosWalkthrough?.[0];
                      if (first) pushExpressionsToLessonCalc(first.expressions);
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {coachOpen && (
            <section className="rb-lesson-coach-drawer">
              <span className="eyebrow">LESSON-AWARE REDCOACH</span>
              <form onSubmit={askLessonCoach} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={`Ask a follow-up question about "${activeGuide.title}"…`}
                  value={coachInput}
                  onChange={(e) => setCoachInput(e.target.value)}
                  style={{ flex: '1 1 240px' }}
                />
                <button type="submit" className="primary" disabled={coachBusy || !coachInput.trim()}>
                  <Send size={14} /> {coachBusy ? 'Thinking…' : 'Ask'}
                </button>
              </form>
              {coachReply && <div className="rb-ai-sentence-feedback" style={{ marginTop: '10px' }}>{coachReply}</div>}
            </section>
          )}

          <section className="rb-lesson-practice-strip">
            <span className="eyebrow">5-QUESTION STEPPING-STONE PRACTICE SET</span>
            {steppingStones.length > 0 && onStartQuestion ? (
              <div className="rb-stepping-list">
                {steppingStones.map(({ q, idx }, i) => (
                  <button key={q.id} type="button" onClick={() => onStartQuestion(idx)}>
                    <span>
                      <strong>#{i + 1} · {q.skill}</strong>
                      <small>{q.questionType === 'spr' ? 'Grid-In (SPR)' : 'Multiple Choice'}</small>
                    </span>
                    <Play size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="rb-actions">
                <button type="button" className="primary" onClick={onPractice}>
                  <BookOpen size={15} /> Go to Practice Library
                </button>
                <button type="button" onClick={onDashboard}>
                  Back to Dashboard <ChevronRight size={15} />
                </button>
              </div>
            )}
          </section>
        </article>
      </div>
    </section>
  );
}
