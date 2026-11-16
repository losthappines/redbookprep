'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CalendarDays,
  Target,
  Clock3,
  CheckCircle2,
  ArrowUpRight,
  BookOpen,
  Sparkles,
  Activity,
} from 'lucide-react';
import { pushCloudProgress } from '@/lib/firebase';

type Attempt = { id: string; choice: number; seconds: number; date: string };
type Question = {
  id: string;
  skill: string;
  answer: number;
  moduleTitle?: string;
  section?: string;
  domain?: string;
};
type Goal = { exam: string; current: string; target: string };
type Task = { id: string; date: string; questionId: string; title: string; done: boolean };
type Plan = { minutes: number; days: number[]; tasks: Task[] };

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function chartPaths(values: number[], w: number, h: number, pad: number) {
  const n = values.length;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map(
    (v, i) =>
      [
        pad + (n < 2 ? 0 : (i / (n - 1)) * (w - pad * 2)),
        h - pad - ((v - lo) / span) * (h - pad * 2),
      ] as [number, number]
  );
  let line = '';
  pts.forEach(([x, y], i) => {
    if (i === 0) {
      line = 'M' + x.toFixed(1) + ',' + y.toFixed(1);
      return;
    }
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    line +=
      ' C' +
      cx.toFixed(1) +
      ',' +
      py.toFixed(1) +
      ' ' +
      cx.toFixed(1) +
      ',' +
      y.toFixed(1) +
      ' ' +
      x.toFixed(1) +
      ',' +
      y.toFixed(1);
  });
  const area = n
    ? line +
      ' L' +
      pts[n - 1][0].toFixed(1) +
      ',' +
      (h - pad) +
      ' L' +
      pts[0][0].toFixed(1) +
      ',' +
      (h - pad) +
      ' Z'
    : '';
  return { line, area, points: pts };
}

function nearestIndex(xs: number[], x: number): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) {
    if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  }
  return best;
}

function useReducedPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
    const sync = () => {
      setReduced(Boolean(mq?.matches) || document.documentElement.dataset.motion === 'reduced');
    };
    sync();
    mq?.addEventListener?.('change', sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => {
      mq?.removeEventListener?.('change', sync);
      observer.disconnect();
    };
  }, []);
  return reduced;
}

/**
 * Bidirectional scroll-reveal: fades elements in both when scrolling down
 * and when scrolling back up from below the viewport.
 */
function useScrollReveal(threshold = 0.08) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);
  const [fromDir, setFromDir] = useState<'up' | 'down'>('down');
  const lastY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') {
      setInView(true);
      return;
    }

    lastY.current = window.scrollY;
    const rect = el.getBoundingClientRect();
    const initiallyVisible = rect.top < window.innerHeight * 0.96 && rect.bottom > 16;
    setInView(initiallyVisible);

    const io = new IntersectionObserver(
      (entries) => {
        const currentY = window.scrollY;
        const scrollingUp = currentY < lastY.current;
        lastY.current = currentY;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setFromDir(scrollingUp || entry.boundingClientRect.top < 0 ? 'up' : 'down');
            setInView(true);
          } else {
            // Re-arm fade whenever element scrolls off-screen above or below
            setFromDir(entry.boundingClientRect.top < 0 ? 'up' : 'down');
            setInView(false);
          }
        }
      },
      { threshold, rootMargin: '-12px 0px -12px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView, fromDir } as const;
}

function DashBrackets() {
  return (
    <>
      <span className="rb-ib-c rb-ib-c-tl" aria-hidden="true" />
      <span className="rb-ib-c rb-ib-c-tr" aria-hidden="true" />
      <span className="rb-ib-c rb-ib-c-bl" aria-hidden="true" />
      <span className="rb-ib-c rb-ib-c-br" aria-hidden="true" />
    </>
  );
}

function RevealFrame({
  children,
  className = '',
  delay = 0,
  interactive = true,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const { ref, inView, fromDir } = useScrollReveal(0.08);
  const [pulse, setPulse] = useState(false);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.removeProperty('--mx');
    e.currentTarget.style.removeProperty('--my');
  };

  const handlePointerDown = () => {
    if (!interactive) return;
    setPulse(true);
    window.setTimeout(() => setPulse(false), 360);
  };

  return (
    <div
      ref={ref}
      data-in={inView}
      data-dir={fromDir}
      data-pulse={pulse ? 'true' : undefined}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onClick={onClick}
      className={`rb-ib-frame ${interactive ? 'rb-ib-frame-hover' : ''} ${className}`}
    >
      <DashBrackets />
      {children}
    </div>
  );
}

function DomainGlyph({ index }: { index: number }) {
  const k = index % 4;
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {k === 0 && (
        <>
          <path d="M-5.5 4.5 L0 -5.5 L5.5 4.5" />
          <path d="M-3.4 1.2 H3.4" />
        </>
      )}
      {k === 1 && (
        <>
          <path d="M-5.5 4 Q0 -6 5.5 4" />
          <circle cx="0" cy="-1.5" r="1.3" fill="currentColor" stroke="none" />
        </>
      )}
      {k === 2 && (
        <>
          <path d="M-4.5 -5.5h6l3 3v8h-9z" />
          <path d="M-2 -0.5h4.5M-2 2.5h4.5" />
        </>
      )}
      {k === 3 && (
        <>
          <path d="M-5 3 L3 -5 L5 -3 L-3 5 L-5 5 Z" />
          <path d="M1 -3 L3 -1" />
        </>
      )}
    </g>
  );
}

type DomainStat = {
  key: string;
  label: string;
  short: string;
  solved: number;
  correct: number;
  accuracy: number;
  nextQuestionId?: string;
};

function StudyFlowCard({
  recentCount,
  accuracyPct,
  due,
  reduced,
  onPractice,
  onMistakes,
}: {
  recentCount: number;
  accuracyPct: number;
  due: number;
  reduced: boolean;
  onPractice: () => void;
  onMistakes: () => void;
}) {
  const [side, setSide] = useState<'' | 'left' | 'right'>('');
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [stackTick, setStackTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setStackTick((n) => n + 1), 3200);
    return () => window.clearInterval(t);
  }, [reduced]);

  const nodes = [
    { x: 58, y: 36, label: 'Timed drill · Algebra' },
    { x: 106, y: 22, label: 'Passage reading · RW' },
    { x: 152, y: 40, label: 'Calc check · Adv. Math' },
    { x: 48, y: 92, label: 'Notes · Flagged items' },
    { x: 146, y: 114, label: 'Pacing · Review queue' },
  ];
  const L1 = 'M117,67 C196,67 210,100 262,100';
  const L2 = 'M117,73 C186,73 206,120 262,120';
  const R1 = 'M378,100 C412,100 418,86 450,86';
  const R2 = 'M378,120 C412,120 418,134 450,134';
  const uid = 'rbflow';
  const reportNumber = recentCount + stackTick;

  return (
    <RevealFrame className="rb-ib-wide">
      <div className="rb-ib-card rb-ib-flow-card">
        <svg
          className="rb-ib-diagram"
          viewBox="0 0 640 178"
          role="img"
          aria-label="Live practice flow from study sessions through RedBookPrep into mistake review"
        >
          <defs>
            <radialGradient id={`${uid}glow`} cx="320" cy="110" r="190" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--rb-accent)" stopOpacity="0.14" />
              <stop offset="1" stopColor="var(--rb-accent)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}rays`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--rb-line)" stopOpacity="0.7" />
              <stop offset="1" stopColor="var(--rb-line)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="640" height="178" fill={`url(#${uid}glow)`} />
          {[-62, -38, -14, 14, 38, 62].map((a, i) => (
            <path
              key={i}
              d={`M320,110 L${320 + Math.sin((a * Math.PI) / 180) * 260},${110 - Math.cos((a * Math.PI) / 180) * 260} L${320 + Math.sin(((a + 7) * Math.PI) / 180) * 260},${110 - Math.cos(((a + 7) * Math.PI) / 180) * 260}Z`}
              fill={`url(#${uid}rays)`}
              opacity="0.45"
            />
          ))}

          {/* Left study cluster */}
          <g
            onMouseEnter={() => setSide('left')}
            onMouseLeave={() => {
              setSide('');
              setActiveNode(null);
            }}
            onClick={onPractice}
            style={{ cursor: 'pointer' }}
          >
            <rect x="18" y="8" width="174" height="130" fill="transparent" />
            {nodes.map((m, i) => (
              <line
                key={`l${i}`}
                x1={m.x}
                y1={m.y}
                x2="104"
                y2="70"
                stroke="var(--rb-line)"
                strokeDasharray="2 3"
              />
            ))}
            <g transform="translate(91,57)">
              <rect width="26" height="26" rx="6" className="rb-ib-node" />
              <circle cx="13" cy="13" r="5.5" fill="none" stroke="var(--rb-accent)" strokeWidth="1.8" />
              <circle cx="13" cy="13" r="2" fill="var(--rb-accent)" />
            </g>
            {nodes.map((m, i) => {
              const hot = activeNode === i;
              return (
                <g
                  key={i}
                  className="rb-ib-av"
                  tabIndex={0}
                  role="button"
                  aria-label={m.label}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setSide('left');
                    setActiveNode(i);
                  }}
                  onFocus={() => {
                    setSide('left');
                    setActiveNode(i);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPractice();
                  }}
                >
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r="11"
                    className="rb-ib-node"
                    style={hot ? { stroke: 'var(--rb-accent)' } : undefined}
                  />
                  <text
                    x={m.x}
                    y={m.y + 3}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="var(--rb-ink)"
                  >
                    {['Q1', 'RW', 'M2', '★', '⏱'][i]}
                  </text>
                  <circle
                    cx={m.x + 8}
                    cy={m.y + 8}
                    r="2.6"
                    fill={i === 4 ? 'var(--rb-muted)' : '#22c55e'}
                    stroke="var(--rb-panel)"
                    className={i === 4 || reduced ? undefined : 'rb-ib-presence'}
                  />
                  <g className="rb-ib-av-tip" transform={`translate(${m.x},${m.y - 18})`}>
                    <rect
                      x={-m.label.length * 2.5 - 8}
                      y="-9"
                      width={m.label.length * 5 + 16}
                      height="15"
                      rx="3"
                      fill="var(--rb-ink)"
                    />
                    <text x="0" y="1.5" textAnchor="middle" fontSize="7.5" fill="var(--rb-panel)">
                      {m.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* Animated flow connectors */}
          {[L1, L2].map((d, i) => (
            <path
              key={d}
              d={d}
              className={`rb-ib-flow ${side === 'left' ? 'rb-ib-flow-on' : ''} ${i ? 'rb-ib-dash' : ''}`}
            />
          ))}
          {[R1, R2].map((d, i) => (
            <path
              key={d}
              d={d}
              className={`rb-ib-flow ${side === 'right' ? 'rb-ib-flow-on' : ''} ${i ? 'rb-ib-dash' : ''}`}
            />
          ))}
          {!reduced &&
            [L1, L2, R1, R2].map((d, i) => (
              <circle key={`p${i}`} r="2.3" className="rb-ib-pkt">
                <animateMotion
                  dur={`${2.1 + (i % 2) * 0.55}s`}
                  begin={`${i * 0.32}s`}
                  repeatCount="indefinite"
                  path={d}
                />
              </circle>
            ))}

          {/* Center RedBookPrep hub chip */}
          <g transform="translate(262,88)" onClick={onPractice} style={{ cursor: 'pointer' }}>
            <rect
              x="-4"
              y="-4"
              width="124"
              height="52"
              rx="9"
              fill="none"
              stroke="var(--rb-accent)"
              strokeOpacity="0.35"
              className={reduced ? undefined : 'rb-ib-glow'}
            />
            <rect width="116" height="44" rx="7" className="rb-ib-node" />
            <circle cx="20" cy="22" r="7" fill="var(--rb-soft)" stroke="var(--rb-accent)" strokeWidth="1.3" />
            <circle cx="20" cy="22" r="2.5" fill="var(--rb-accent)" />
            <text
              x="35"
              y="25"
              fontSize="8.2"
              letterSpacing="1.2"
              fontWeight="700"
              fill="var(--rb-ink)"
              textLength="60"
              lengthAdjust="spacingAndGlyphs"
            >
              REDBOOKPREP
            </text>
            <path d="M101 18l4 4-4 4" fill="none" stroke="var(--rb-muted)" strokeWidth="1.4" />
          </g>

          {/* Right review / mastery stack */}
          <g
            onMouseEnter={() => setSide('right')}
            onMouseLeave={() => setSide('')}
            onClick={onMistakes}
            style={{ cursor: 'pointer' }}
          >
            {[2, 1, 0].map((k) => (
              <g
                key={reportNumber - k}
                transform={`translate(${450 + k * 12},${40 - k * 10})`}
                opacity={1 - k * 0.24}
              >
                <g className={`rb-ib-sheet ${k === 0 && !reduced ? 'rb-ib-sheet-new' : ''}`}>
                  <rect width="138" height="102" rx="5" className="rb-ib-sheet-bg" />
                  {k === 0 && (
                    <>
                      <text x="10" y="16" fontSize="7" fill="var(--rb-muted)" fontWeight="600">
                        {`SESSION #${Math.max(1, reportNumber)} · ${due} DUE`}
                      </text>
                      <rect x="10" y="24" width="68" height="5" rx="1.5" fill="var(--rb-ink)" opacity="0.75" />
                      <rect x="10" y="33" width="94" height="3" rx="1" fill="var(--rb-line)" />
                      <rect x="10" y="39" width="76" height="3" rx="1" fill="var(--rb-line)" />
                      {[20, 28, 16, 32, 26, Math.max(12, Math.round((accuracyPct / 100) * 38))].map(
                        (h, j) => (
                          <rect
                            key={j}
                            x={12 + j * 13}
                            y={92 - h}
                            width="8"
                            height={h}
                            rx="1.5"
                            fill={j === 5 ? 'var(--rb-accent)' : 'var(--rb-ink)'}
                            opacity={j === 5 ? 0.95 : 0.22 + j * 0.1}
                          />
                        )
                      )}
                      <path
                        d="M92 64h34M92 72h28M92 80h32"
                        stroke="var(--rb-line)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </g>
              </g>
            ))}
          </g>
        </svg>

        <div className="rb-ib-wide-copy">
          <button type="button" className="rb-ib-copy-action" onClick={onPractice}>
            <h3>
              Live Practice Loop <ArrowUpRight size={14} />
            </h3>
            <p>
              {recentCount > 0
                ? `${recentCount} recent ${recentCount === 1 ? 'attempt' : 'attempts'} routed through your practice modules.`
                : 'Click to jump into split-screen SAT drills and start building live study data.'}
            </p>
          </button>
          <button type="button" className="rb-ib-copy-action" onClick={onMistakes}>
            <h3>
              Adaptive Mistake Queue <ArrowUpRight size={14} />
            </h3>
            <p>
              {due > 0
                ? `${due} review ${due === 1 ? 'card is' : 'cards are'} queued for spaced repetition right now.`
                : 'Missed questions automatically stack here with explanations and review dates.'}
            </p>
          </button>
        </div>
      </div>
    </RevealFrame>
  );
}

function DomainHubCard({
  domains,
  reduced,
  onPractice,
}: {
  domains: DomainStat[];
  reduced: boolean;
  onPractice: (id?: string) => void;
}) {
  const [hover, setHover] = useState(-1);
  const [selected, setSelected] = useState(-1);
  const [auto, setAuto] = useState(0);

  useEffect(() => {
    if (reduced || hover >= 0 || selected >= 0) return;
    const t = window.setInterval(() => setAuto((a) => (a + 1) % 4), 1900);
    return () => window.clearInterval(t);
  }, [reduced, hover, selected]);

  const on = hover >= 0 ? hover : selected >= 0 ? selected : reduced ? 0 : auto;
  const activeDomain = domains[on] ?? domains[0];

  const tiles = [
    { x: 64, y: 34 },
    { x: 64, y: 116 },
    { x: 236, y: 34 },
    { x: 236, y: 116 },
  ];

  const path = (i: number) => {
    const t = tiles[i];
    const dir = t.x < 150 ? -1 : 1;
    return `M${150 + dir * 17},75 H${150 + dir * 42} V${t.y} H${t.x - dir * 15}`;
  };

  return (
    <RevealFrame delay={60}>
      <div className="rb-ib-card">
        <div className="rb-ib-card-tagrow">
          <span className="eyebrow">SAT DOMAIN SYNC</span>
          <span className="rb-ib-pill">
            {activeDomain.solved > 0
              ? `${activeDomain.short} · ${activeDomain.accuracy}% acc`
              : `${activeDomain.short} · Ready`}
          </span>
        </div>

        <svg className="rb-ib-diagram" viewBox="0 0 300 150" role="group" aria-label="Interactive SAT domain hub">
          {tiles.map((_, i) => (
            <path key={i} d={path(i)} className={`rb-ib-flow ${on === i ? 'rb-ib-flow-on' : ''}`} />
          ))}
          {!reduced && on >= 0 && (
            <circle key={on} r="2.4" className="rb-ib-pkt">
              <animateMotion dur="1.15s" repeatCount="indefinite" path={path(on)} />
            </circle>
          )}
          <g transform="translate(133,58)">
            <rect width="34" height="34" rx="8" className="rb-ib-node" />
            <circle cx="17" cy="17" r="7" fill="var(--rb-soft)" stroke="var(--rb-accent)" strokeWidth="1.5" />
            <circle cx="17" cy="17" r="2.6" fill="var(--rb-accent)" />
          </g>
          {tiles.map((t, i) => {
            const d = domains[i];
            const isActive = on === i;
            return (
              <g
                key={d.key}
                className={`rb-ib-tool ${isActive ? 'rb-ib-tool-on' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${d.label}: ${d.solved > 0 ? `${d.accuracy}% accuracy across ${d.solved} solved` : 'Click to practise'}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(-1)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(-1)}
                onClick={() => {
                  setSelected(i);
                  onPractice(d.nextQuestionId);
                }}
              >
                <rect x={t.x - 16} y={t.y - 16} width="32" height="32" rx="7" className="rb-ib-node" />
                <g transform={`translate(${t.x},${t.y})`} style={{ color: isActive ? 'var(--rb-accent)' : 'var(--rb-ink)' }}>
                  <DomainGlyph index={i} />
                </g>
                <text
                  x={t.x}
                  y={t.y + (t.y < 75 ? -22 : 28)}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fill={isActive ? 'var(--rb-ink)' : 'var(--rb-muted)'}
                  style={{ transition: 'fill .25s' }}
                >
                  {d.short}
                </text>
              </g>
            );
          })}
          <text x="150" y="114" textAnchor="middle" fontSize="7" fill="var(--rb-muted)">
            {activeDomain.solved > 0
              ? `syncing · ${activeDomain.solved} solved`
              : `click ${activeDomain.short.toLowerCase()} to start`}
          </text>
        </svg>

        <div className="rb-ib-card-foot">
          <div>
            <h3>{activeDomain.label}</h3>
            <p>
              {activeDomain.solved > 0
                ? `${activeDomain.correct} of ${activeDomain.solved} correct · Click any node to launch a drill.`
                : 'Hover a domain node to preview or click to open its practice module.'}
            </p>
          </div>
          <button
            type="button"
            className="rb-ib-mini-btn"
            onClick={() => onPractice(activeDomain.nextQuestionId)}
          >
            Practise <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
    </RevealFrame>
  );
}

function TrajectoryChartCard({
  attempts,
  questions,
  reduced,
  onProgress,
}: {
  attempts: Attempt[];
  questions: Question[];
  reduced: boolean;
  onProgress: () => void;
}) {
  const [hover, setHover] = useState(-1);
  const [pinned, setPinned] = useState(-1);
  const uid = 'rbchart';
  const W = 300;
  const H = 130;

  const series = useMemo(() => {
    const recent = attempts.slice(-9);
    if (recent.length >= 3) {
      let runningCorrect = 0;
      const actual = recent.map((a, idx) => {
        const q = questions.find((item) => item.id === a.id);
        if (q && q.answer === a.choice) runningCorrect += 1;
        return Math.round((runningCorrect / (idx + 1)) * 100);
      });
      const last = actual[actual.length - 1];
      const proj1 = Math.min(100, Math.round(last + (100 - last) * 0.25));
      const proj2 = Math.min(100, Math.round(last + (100 - last) * 0.45));
      const proj3 = Math.min(100, Math.round(last + (100 - last) * 0.65));
      return {
        values: [...actual, proj1, proj2, proj3],
        split: actual.length,
        isLive: true,
      };
    }
    return {
      values: [42, 48, 46, 55, 58, 64, 62, 70, 74, 79, 84, 88],
      split: 8,
      isLive: false,
    };
  }, [attempts, questions]);

  const vals = series.values;
  const { line, area, points } = chartPaths(vals, W, H, 14);
  const split = clamp(series.split, 1, vals.length - 1);
  const last = points[points.length - 1];
  const activeIdx = hover >= 0 ? hover : pinned >= 0 ? clamp(pinned, 0, points.length - 1) : points.length - 1;
  const p = points[activeIdx];
  const delta = vals[activeIdx] - vals[0];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(nearestIndex(points.map((q) => q[0]), ((e.clientX - r.left) / r.width) * W));
  };

  const onChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const idx = nearestIndex(points.map((q) => q[0]), ((e.clientX - r.left) / r.width) * W);
    setPinned((prev) => (prev === idx ? -1 : idx));
  };

  return (
    <RevealFrame delay={120}>
      <div className="rb-ib-card">
        <div className="rb-ib-card-tagrow">
          <span className="eyebrow">ACCURACY TRAJECTORY</span>
          <span className="rb-ib-pill">
            {series.isLive ? 'Live attempts' : 'Sample curve'}
          </span>
        </div>

        <svg
          className="rb-ib-diagram rb-ib-chart"
          viewBox={`0 0 ${W} ${H + 6}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(-1)}
          onClick={onChartClick}
          role="img"
          aria-label="Interactive accuracy trajectory chart. Scrub or click points to inspect."
        >
          <defs>
            <linearGradient id={`${uid}area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--rb-accent)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--rb-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="14" x2={W - 14} y1={H * g} y2={H * g} stroke="var(--rb-line)" />
          ))}
          <path d={area} fill={`url(#${uid}area)`} />
          <path
            d={line}
            fill="none"
            stroke="var(--rb-accent)"
            strokeWidth="1.8"
            pathLength={1}
            className="rb-ib-line-draw"
          />
          <line
            x1={points[split][0]}
            x2={points[split][0]}
            y1="10"
            y2={H - 14}
            stroke="var(--rb-line)"
            strokeDasharray="2 3"
          />
          <text x={points[split][0] - 4} y={H - 18} textAnchor="end" fontSize="6.8" fill="var(--rb-muted)">
            FORECAST
          </text>
          {(hover >= 0 || pinned >= 0) && (
            <line x1={p[0]} x2={p[0]} y1="8" y2={H - 14} stroke="var(--rb-ink)" strokeOpacity="0.35" />
          )}
          {!reduced && hover < 0 && pinned < 0 && (
            <circle cx={last[0]} cy={last[1]} r="7" fill="var(--rb-accent)" opacity="0.22" className="rb-ib-glow" />
          )}
          <circle
            cx={p[0]}
            cy={p[1]}
            r="3.4"
            fill="var(--rb-panel)"
            stroke="var(--rb-accent)"
            strokeWidth="1.7"
          />
          <g transform={`translate(${clamp(p[0], 44, W - 44)},${p[1] < 34 ? p[1] + 22 : p[1] - 12})`}>
            <rect x="-36" y="-11" width="72" height="15" rx="3" fill="var(--rb-ink)" />
            <text x="0" y="-0.5" textAnchor="middle" fontSize="7.4" fill="var(--rb-panel)" fontWeight="600">
              {`${activeIdx >= split ? 'goal ' : `#${activeIdx + 1} `}${vals[activeIdx]}% (${delta >= 0 ? '+' : ''}${delta}%)`}
            </text>
          </g>
        </svg>

        <div className="rb-ib-card-foot">
          <div>
            <h3>Predictive Pacing</h3>
            <p>
              {pinned >= 0
                ? `Pinned point #${pinned + 1} (${vals[pinned]}%). Click again to unpin.`
                : 'Move cursor across the curve to scrub or click to pin a checkpoint.'}
            </p>
          </div>
          <button type="button" className="rb-ib-mini-btn" onClick={onProgress}>
            Analytics <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
    </RevealFrame>
  );
}

export function StudyDashboard({
  attempts,
  questions,
  user,
  due,
  onPractice,
  onProgress,
  onMistakes,
  plannerOnly = false,
}: {
  attempts: Attempt[];
  questions: Question[];
  user: { name: string; testDate?: string; targetScore?: number } | null;
  due: number;
  onPractice: (id?: string) => void;
  onProgress: () => void;
  onMistakes: () => void;
  plannerOnly?: boolean;
}) {
  const planElement = useRef<HTMLElement>(null);
  const reduced = useReducedPreference();

  const [goal, setGoal] = useState<Goal>({
    exam: user?.testDate || '',
    current: '',
    target: user?.targetScore ? String(user.targetScore) : '',
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [minutes, setMinutes] = useState(20);
  const [days, setDays] = useState([1, 3, 5]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (planning) planElement.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [planning]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('redbookprep-dashboard-goals') || 'null');
      if (
        saved &&
        typeof saved.exam === 'string' &&
        typeof saved.current === 'string' &&
        typeof saved.target === 'string'
      ) {
        setGoal(saved);
        setDraft(saved);
      }
      const p = JSON.parse(localStorage.getItem('redbookprep-study-plan') || 'null');
      if (
        p &&
        Number.isFinite(p.minutes) &&
        Array.isArray(p.days) &&
        Array.isArray(p.tasks) &&
        p.tasks.every(
          (t: Task) =>
            typeof t.id === 'string' &&
            typeof t.date === 'string' &&
            typeof t.title === 'string' &&
            typeof t.questionId === 'string'
        )
      ) {
        setPlan(p);
        setMinutes(p.minutes);
        setDays(p.days);
      }
    } catch {
      setError('Some saved dashboard settings could not be loaded.');
    }
    setReady(true);
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const today = dateKey(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).getTime();
  const previous = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59).getTime();
  const recent = attempts.filter((a) => new Date(a.date).getTime() >= start && new Date(a.date) <= now);
  const before = attempts.filter(
    (a) => new Date(a.date).getTime() >= previous && new Date(a.date).getTime() < start
  );
  const correct = recent.filter((a) => questions.find((q) => q.id === a.id)?.answer === a.choice).length;
  const accuracyPct = recent.length ? Math.round((correct / recent.length) * 100) : 0;
  const active = new Set(recent.map((a) => dateKey(new Date(a.date)))).size;
  const time = recent.reduce((sum, a) => sum + Math.max(0, a.seconds), 0);
  const remaining = goal.exam ? Math.max(0, new Date(goal.exam + 'T00:00:00').getTime() - now.getTime()) : 0;
  const countdown = [
    Math.floor(remaining / 86400000),
    Math.floor(remaining / 3600000) % 24,
    Math.floor(remaining / 60000) % 60,
  ];
  const todays = plan?.tasks.filter((t) => t.date === today) || [];
  const overdue = plan?.tasks.filter((t) => t.date < today && !t.done) || [];

  const domainStats: DomainStat[] = useMemo(() => {
    const defs = [
      { key: 'algebra', label: 'Algebra', short: 'Algebra', match: (q: Question) => q.domain === 'Algebra' },
      {
        key: 'adv-math',
        label: 'Advanced Math',
        short: 'Adv. Math',
        match: (q: Question) =>
          q.domain === 'Advanced Math' ||
          q.domain === 'Problem-Solving and Data Analysis' ||
          q.domain === 'Geometry and Trigonometry',
      },
      {
        key: 'reading',
        label: 'Reading & Comprehension',
        short: 'Reading',
        match: (q: Question) =>
          q.domain === 'Information and Ideas' || q.domain === 'Craft and Structure',
      },
      {
        key: 'writing',
        label: 'Writing & Conventions',
        short: 'Writing',
        match: (q: Question) =>
          q.domain === 'Expression of Ideas' || q.domain === 'Standard English Conventions',
      },
    ];
    return defs.map((d) => {
      const pool = questions.filter(d.match);
      const ids = new Set(pool.map((q) => q.id));
      const matched = attempts.filter((a) => ids.has(a.id));
      const ok = matched.filter((a) => pool.find((q) => q.id === a.id)?.answer === a.choice).length;
      const firstUnanswered = pool.find((q) => !attempts.some((a) => a.id === q.id)) ?? pool[0];
      return {
        key: d.key,
        label: d.label,
        short: d.short,
        solved: matched.length,
        correct: ok,
        accuracy: matched.length ? Math.round((ok / matched.length) * 100) : 0,
        nextQuestionId: firstUnanswered?.id,
      };
    });
  }, [questions, attempts]);

  function savePlan(next: Plan) {
    try {
      localStorage.setItem('redbookprep-study-plan', JSON.stringify(next));
      setPlan(next);
      setError('');
      void pushCloudProgress({ plan: next as unknown as Record<string, unknown> });
      return true;
    } catch {
      setError('Your study plan could not be saved.');
      return false;
    }
  }

  function createPlan() {
    if (!days.length) return;
    const tasks: Task[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (!days.includes(date.getDay()) || (goal.exam && dateKey(date) > goal.exam)) continue;
      const q = questions[tasks.length % questions.length];
      if (q)
        tasks.push({
          id: crypto.randomUUID(),
          date: dateKey(date),
          questionId: q.id,
          title: `Practise ${(q.skill === 'Unclassified skill' ? q.moduleTitle || 'a practice module' : q.skill).toLowerCase()}`,
          done: false,
        });
    }
    if (!tasks.length) {
      setError('No selected study days fall before your exam. Update the exam date or choose another study day.');
      return;
    }
    if (savePlan({ minutes, days, tasks })) setPlanning(false);
  }

  const metricCards = [
    {
      icon: CheckCircle2,
      label: 'Questions solved',
      value: recent.length,
      detail: `${before.length} in the previous 30 days`,
      progress: Math.min(100, Math.round((recent.length / 50) * 100)),
      hint: 'Practise more',
      onClick: () => onPractice(),
    },
    {
      icon: Target,
      label: 'Practice accuracy',
      value: recent.length ? `${accuracyPct}%` : '—',
      detail: recent.length
        ? `${correct} correct / ${recent.length} ${recent.length === 1 ? 'attempt' : 'attempts'}`
        : 'Complete practice to see accuracy',
      progress: recent.length ? accuracyPct : 0,
      hint: 'View breakdown',
      onClick: onProgress,
    },
    {
      icon: Clock3,
      label: 'Study time',
      value: time >= 3600 ? `${(time / 3600).toFixed(1)}h` : `${Math.floor(time / 60)}m`,
      detail: 'Recorded question time',
      progress: Math.min(100, Math.round((time / 3600) * 100)),
      hint: 'Pacing details',
      onClick: onProgress,
    },
    {
      icon: CalendarDays,
      label: 'Active days',
      value: `${active} of 30`,
      detail: 'Days with submitted practice',
      progress: Math.round((active / 30) * 100),
      hint: 'Adjust schedule',
      onClick: () => planElement.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
  ];

  const planArea = (
    <RevealFrame delay={60}>
      <section ref={planElement} className="dashboard-plan card rb-dash-surface" style={{ scrollMarginTop: 100 }}>
        <div className="dashboard-section-title">
          <h2>
            <CalendarDays size={20} /> {plannerOnly ? 'Your study plan' : 'Today’s study plan'}
          </h2>
          <button disabled={!ready} onClick={() => setPlanning(!planning)}>
            {plan ? 'Edit plan' : 'Create study plan'}
          </button>
        </div>
        {planning ? (
          <form
            className="dashboard-plan-form"
            onSubmit={(e) => {
              e.preventDefault();
              createPlan();
            }}
          >
            <label>
              Minutes per study day
              <input
                type="number"
                min={5}
                max={180}
                required
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
            <fieldset>
              <legend>Study days</legend>
              <div className="dashboard-days">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={days.includes(i)}
                      onChange={(e) =>
                        setDays(e.target.checked ? [...days, i] : days.filter((d) => d !== i))
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <p>Creates the next seven days of practice tasks. Saving replaces your existing schedule.</p>
            <div className="module-actions">
              <button type="button" onClick={() => setPlanning(false)}>
                Cancel
              </button>
              <button className="primary" disabled={!days.length}>
                Save weekly plan
              </button>
            </div>
          </form>
        ) : !plan ? (
          <div className="dashboard-empty">
            <CalendarDays size={42} />
            <h3>Give your preparation a plan.</h3>
            <p>
              Choose your study days and the time you can set aside. Start with a manageable week.
            </p>
            <button className="primary" onClick={() => setPlanning(true)}>
              Build my study plan
            </button>
          </div>
        ) : (
          <>
            <p>
              {plan.minutes} minutes per study day · {plan.tasks.filter((t) => t.done).length} of{' '}
              {plan.tasks.length} tasks complete
            </p>
            {(plannerOnly ? plan.tasks : todays).length === 0 && (
              <p>
                {plan.tasks.some((t) => t.date >= today)
                  ? 'No practice scheduled today. Take a break or explore your library.'
                  : 'Your week is complete. Edit your plan to schedule the next seven days.'}
              </p>
            )}
            {(plannerOnly ? plan.tasks : todays).map((task) => (
              <div className={`dashboard-task ${task.done ? 'is-done' : ''}`} key={task.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() =>
                      savePlan({
                        ...plan,
                        tasks: plan.tasks.map((t) =>
                          t.id === task.id ? { ...t, done: !t.done } : t
                        ),
                      })
                    }
                  />
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      {task.date} · {plan.minutes} min{task.done ? ' · Complete' : ''}
                    </small>
                  </span>
                </label>
                <button onClick={() => onPractice(task.questionId)}>
                  Practise <ArrowUpRight size={15} />
                </button>
              </div>
            ))}
            {overdue.length > 0 && (
              <div className="dashboard-carry">
                <p>
                  {overdue.length} unfinished {overdue.length === 1 ? 'task' : 'tasks'} from earlier
                  days.
                </p>
                <button
                  onClick={() =>
                    savePlan({
                      ...plan,
                      tasks: plan.tasks.map((t) =>
                        t.date < today && !t.done ? { ...t, date: today } : t
                      ),
                    })
                  }
                >
                  Move unfinished tasks to today
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </RevealFrame>
  );

  return (
    <div className="study-dashboard">
      {error && <p role="alert">{error}</p>}
      {!plannerOnly && (
        <>
          <RevealFrame className="rb-dash-hero-frame" interactive={false}>
            <div className="dashboard-hero">
              <section className="dashboard-intro">
                <span className="eyebrow">YOUR DAILY STUDY SPACE</span>
                <h1>{user ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Make your study time count.'}</h1>
                <p>
                  A clear plan. A little practice.
                  <br />
                  Progress you can understand.
                </p>
                <div className="rb-actions">
                  <button className="primary" onClick={() => setPlanning(true)}>
                    <CalendarDays size={17} />
                    {plan ? 'Adjust my study plan' : 'Create SAT study plan'}
                  </button>
                  <button onClick={() => onPractice()}>
                    <BookOpen size={17} />
                    {attempts.length > 0 ? 'Continue practising' : 'Start practising'}
                  </button>
                </div>
              </section>

              <div className="dashboard-goals">
                <section className="dashboard-countdown">
                  <div>
                    <span>SAT exam countdown</span>
                    <button
                      onClick={() => {
                        setDraft(goal);
                        setEditing(!editing);
                      }}
                      aria-label="Edit exam date and score goals"
                    >
                      {goal.exam || 'Set exam date'} · Edit
                    </button>
                  </div>
                  <div className="dashboard-clock">
                    {countdown.map((value, i) => (
                      <div key={i}>
                        <strong>{goal.exam ? String(value).padStart(2, '0') : '—'}</strong>
                        <small>{['days', 'hours', 'mins'][i]}</small>
                      </div>
                    ))}
                  </div>
                  {goal.exam && remaining === 0 && (
                    <small>
                      {goal.exam === today
                        ? 'Your exam day is here.'
                        : 'This exam date has passed. Set your next date.'}
                    </small>
                  )}
                </section>

                <RevealFrame>
                  <section
                    className="dashboard-score rb-dash-surface"
                    onClick={() => {
                      setDraft(goal);
                      setEditing(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      <span>Current score</span>
                      <strong>{goal.current || '—'}</strong>
                      <small>
                        {goal.current ? 'Self-reported baseline' : 'Add a recent SAT or practice-test score'}
                      </small>
                    </div>
                    <div>
                      <span>Target score</span>
                      <strong>{goal.target || '—'}</strong>
                      <small>{goal.target ? 'Your personal goal' : 'Set a score to work toward'}</small>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraft(goal);
                        setEditing(!editing);
                      }}
                    >
                      Edit scores <Target size={16} />
                    </button>
                  </section>
                </RevealFrame>
              </div>
            </div>
          </RevealFrame>

          {editing && (
            <RevealFrame>
              <form
                className="card dashboard-goal-form rb-dash-surface"
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    localStorage.setItem('redbookprep-dashboard-goals', JSON.stringify(draft));
                    setGoal(draft);
                    setEditing(false);
                    setError('');
                    void pushCloudProgress({ goals: draft as unknown as Record<string, unknown> });
                  } catch {
                    setError('Your goals could not be saved.');
                  }
                }}
              >
                <h2>Your exam and score goals</h2>
                <div>
                  <label>
                    Exam date
                    <input
                      type="date"
                      value={draft.exam}
                      onInput={(e) => setDraft({ ...draft, exam: e.currentTarget.value })}
                      onChange={(e) => setDraft({ ...draft, exam: e.target.value })}
                    />
                  </label>
                  <label>
                    Current score · optional
                    <input
                      type="number"
                      min={400}
                      max={1600}
                      step={10}
                      placeholder="e.g. 1100"
                      value={draft.current}
                      onChange={(e) => setDraft({ ...draft, current: e.target.value })}
                    />
                  </label>
                  <label>
                    Target score · optional
                    <input
                      type="number"
                      min={400}
                      max={1600}
                      step={10}
                      placeholder="e.g. 1400"
                      value={draft.target}
                      onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                    />
                  </label>
                </div>
                <div className="module-actions">
                  <button type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button className="primary">Save goals</button>
                </div>
              </form>
            </RevealFrame>
          )}

          <section className="dashboard-analytics">
            <RevealFrame interactive={false}>
              <div className="dashboard-section-title">
                <h2>
                  <Activity size={19} /> Practice analytics
                </h2>
                <button onClick={onProgress}>
                  See all analytics <ArrowUpRight size={16} />
                </button>
              </div>
              <small>
                Last 30 calendar days · Practice accuracy is not a predicted SAT score.
              </small>
            </RevealFrame>

            <div className="dashboard-metrics">
              {metricCards.map(({ icon: Icon, label, value, detail, progress, hint, onClick }, idx) => (
                <RevealFrame key={label} delay={idx * 55}>
                  <button
                    type="button"
                    onClick={onClick}
                    className="card dashboard-metric rb-dash-metric-btn rb-dash-surface"
                    aria-label={`${label}: ${value}. ${hint}`}
                  >
                    <div className="rb-dash-metric-top">
                      <span className="dashboard-metric-icon">
                        <Icon size={21} />
                      </span>
                      <span className="rb-dash-metric-hint">
                        <span className={`rb-dash-live-dot ${reduced ? '' : 'animate'}`} />
                        {hint}
                      </span>
                    </div>
                    <div className="rb-dash-metric-body">
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>{detail}</small>
                    </div>
                    <div className="rb-dash-metric-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(4, progress)}%` }} />
                    </div>
                  </button>
                </RevealFrame>
              ))}
            </div>

            <div className="rb-ib-bento">
              <StudyFlowCard
                recentCount={recent.length}
                accuracyPct={accuracyPct}
                due={due}
                reduced={reduced}
                onPractice={() => onPractice()}
                onMistakes={onMistakes}
              />
              <DomainHubCard
                domains={domainStats}
                reduced={reduced}
                onPractice={onPractice}
              />
              <TrajectoryChartCard
                attempts={attempts}
                questions={questions}
                reduced={reduced}
                onProgress={onProgress}
              />
            </div>
          </section>
        </>
      )}

      {planArea}

      {!plannerOnly && (
        <RevealFrame delay={90}>
          <section
            className="card dashboard-review rb-dash-surface"
            onClick={onMistakes}
            style={{ cursor: 'pointer' }}
          >
            <div>
              <span className="eyebrow">
                <Sparkles size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 5 }} />
                SPACED REPETITION
              </span>
              <h2>{due ? `${due} reviews ready for you` : 'Keep what you learn.'}</h2>
              <p>
                {due
                  ? 'Revisit missed questions and write down what clicked.'
                  : 'Your mistake notebook keeps explanations, notes, and review dates together.'}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMistakes();
              }}
            >
              Open mistake notebook <ArrowUpRight size={16} />
            </button>
          </section>
        </RevealFrame>
      )}
    </div>
  );
}
