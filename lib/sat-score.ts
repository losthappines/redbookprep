export const RW_MODULE_MAX = 27;
export const MATH_MODULE_MAX = 22;
export const RW_HARD_THRESHOLD = 16;
export const MATH_HARD_THRESHOLD = 14;

export type AdaptiveMode = 'auto' | 'harder' | 'easier';
export type ResolvedTier = 'harder' | 'easier';

export type SectionInput = {
  m1: number;
  m2: number;
  mode: AdaptiveMode;
};

export type SectionResult = {
  score: number;
  min: number;
  max: number;
  rawTotal: number;
  maxTotal: number;
  resolvedTier: ResolvedTier;
  m1Threshold: number;
};

export type ScoreBreakdown = {
  total: number;
  totalMin: number;
  totalMax: number;
  percentile: number;
  rw: SectionResult;
  math: SectionResult;
};

export type ScorePreset = {
  id: string;
  label: string;
  description: string;
  rw: SectionInput;
  math: SectionInput;
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function roundTo10(value: number): number {
  return Math.round(value / 10) * 10;
}

function scoreSection(
  input: SectionInput,
  moduleMax: number,
  threshold: number,
  shape: 'rw' | 'math'
): SectionResult {
  const m1 = clampInt(input.m1, 0, moduleMax);
  const m2 = clampInt(input.m2, 0, moduleMax);
  const maxTotal = moduleMax * 2;
  const rawTotal = m1 + m2;
  const resolvedTier: ResolvedTier =
    input.mode === 'auto' ? (m1 >= threshold ? 'harder' : 'easier') : input.mode;

  const hardRatio = Math.max(0, Math.min(1, (m1 * 1.04 + m2 * 0.96) / maxTotal));
  const hardUnit =
    shape === 'rw'
      ? 0.85 * hardRatio + 0.15 * Math.pow(hardRatio, 1.35)
      : 0.9 * Math.pow(hardRatio, 0.92) + 0.1 * Math.pow(hardRatio, 1.6);
  const hardScore = Math.max(200, Math.min(800, roundTo10(200 + 600 * hardUnit)));

  let score = hardScore;
  if (resolvedTier === 'easier') {
    const easyRatio = Math.max(0, Math.min(1, (m1 * 1.1 + m2 * 0.9) / maxTotal));
    const easyRaw = 200 + 440 * (1 - Math.pow(1 - easyRatio, 1.45));
    const easyScore = Math.max(200, Math.min(640, roundTo10(easyRaw)));
    score = Math.min(hardScore, easyScore);
  }

  const spread = score === 200 || score === 800 ? 10 : 20;
  const min = Math.max(200, score - spread);
  const max = Math.min(resolvedTier === 'easier' ? 650 : 800, score + spread);

  return {
    score,
    min,
    max,
    rawTotal,
    maxTotal,
    resolvedTier,
    m1Threshold: threshold,
  };
}

const PERCENTILE_TABLE: readonly [number, number][] = [
  [400, 1],
  [600, 2],
  [700, 6],
  [800, 14],
  [850, 20],
  [900, 27],
  [950, 35],
  [1000, 43],
  [1050, 51],
  [1100, 59],
  [1150, 67],
  [1200, 74],
  [1250, 81],
  [1300, 86],
  [1350, 90],
  [1400, 93],
  [1450, 96],
  [1500, 98],
  [1550, 99],
  [1600, 99],
];

export function estimatePercentile(totalScore: number): number {
  const clamped = Math.max(400, Math.min(1600, totalScore));
  for (let i = 0; i < PERCENTILE_TABLE.length - 1; i++) {
    const [s0, p0] = PERCENTILE_TABLE[i];
    const [s1, p1] = PERCENTILE_TABLE[i + 1];
    if (clamped >= s0 && clamped <= s1) {
      const t = (clamped - s0) / (s1 - s0 || 1);
      return Math.round(p0 + t * (p1 - p0));
    }
  }
  return 99;
}

export function calculateSatScore(input: {
  rw: SectionInput;
  math: SectionInput;
}): ScoreBreakdown {
  const rw = scoreSection(input.rw, RW_MODULE_MAX, RW_HARD_THRESHOLD, 'rw');
  const math = scoreSection(input.math, MATH_MODULE_MAX, MATH_HARD_THRESHOLD, 'math');
  const total = rw.score + math.score;
  const totalMin = Math.max(400, rw.min + math.min);
  const totalMax = Math.min(1600, rw.max + math.max);

  return {
    total,
    totalMin,
    totalMax,
    percentile: estimatePercentile(total),
    rw,
    math,
  };
}

export const SCORE_PRESETS: readonly ScorePreset[] = [
  {
    id: 'baseline',
    label: 'Baseline (1030)',
    description: 'Lower Module 2 routing baseline',
    rw: { m1: 14, m2: 18, mode: 'auto' },
    math: { m1: 11, m2: 14, mode: 'auto' },
  },
  {
    id: 'solid',
    label: 'Solid (1270)',
    description: 'Clears Module 1 threshold in both sections',
    rw: { m1: 19, m2: 20, mode: 'auto' },
    math: { m1: 16, m2: 16, mode: 'auto' },
  },
  {
    id: 'competitive',
    label: 'Competitive (1410)',
    description: 'Strong Harder Module 2 performance',
    rw: { m1: 23, m2: 22, mode: 'auto' },
    math: { m1: 19, m2: 18, mode: 'auto' },
  },
  {
    id: 'top5',
    label: 'Top 5% (1500)',
    description: 'High accuracy across all 4 modules',
    rw: { m1: 25, m2: 24, mode: 'auto' },
    math: { m1: 21, m2: 20, mode: 'auto' },
  },
  {
    id: 'elite',
    label: 'Elite (1570)',
    description: 'Only a few misses total',
    rw: { m1: 26, m2: 26, mode: 'auto' },
    math: { m1: 22, m2: 21, mode: 'auto' },
  },
  {
    id: 'perfect',
    label: 'Perfect (1600)',
    description: 'All 98 questions answered correctly',
    rw: { m1: 27, m2: 27, mode: 'auto' },
    math: { m1: 22, m2: 22, mode: 'auto' },
  },
];
