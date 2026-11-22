// Daily 2 + Challenge Sunday, Streak Freezes, Sparks economy, and Achievements.
import type { PracticeQuestion } from '@/components/study/bbplus';

export interface DailyDropState {
  date: string;
  isChallengeSunday: boolean;
  rwQuestionId: string;
  mathQuestionId: string;
  rwCompleted: boolean;
  mathCompleted: boolean;
  bonusClaimed: boolean;
}

export interface HabitProfile {
  currentStreak: number;
  longestStreak: number;
  streakFreezes: number;
  lastStudyDate: string;
  activeDates: string[];
  sparksBalance: number;
  sparksTier: 'free' | 'plus' | 'pro';
  rushBestScore: number;
  soundEnabled: boolean;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  unlocked: boolean;
  progressText: string;
}

const HABIT_KEY = 'redbookprep-habits-v1';
const DAILY_KEY = 'redbookprep-daily-v1';

export const DEFAULT_HABITS: HabitProfile = {
  currentStreak: 0,
  longestStreak: 0,
  streakFreezes: 1,
  lastStudyDate: '',
  activeDates: [],
  sparksBalance: 10,
  sparksTier: 'free',
  rushBestScore: 0,
  soundEnabled: false,
};

export function toLocalDateKey(d = new Date()): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

function hashDateSeed(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic daily pair (1 R&W + 1 Math). Sundays spotlight hard Challenge items for 2x Sparks. */
export function pickDailyDropQuestions(
  questions: PracticeQuestion[],
  dateKey = toLocalDateKey()
): { rw?: PracticeQuestion; math?: PracticeQuestion; isChallengeSunday: boolean } {
  const dateObj = new Date(`${dateKey}T12:00:00`);
  const isChallengeSunday = dateObj.getDay() === 0;
  const seed = hashDateSeed(dateKey);

  const rwPoolAll = questions.filter((q) => q.section === 'Reading and Writing');
  const mathPoolAll = questions.filter((q) => q.section === 'Math');

  const rwHard = rwPoolAll.filter((q) => q.isChallenge || (q.difficulty ?? 0) >= 4);
  const mathHard = mathPoolAll.filter((q) => q.isChallenge || (q.difficulty ?? 0) >= 4);

  const rwPool = isChallengeSunday && rwHard.length ? rwHard : rwPoolAll;
  const mathPool = isChallengeSunday && mathHard.length ? mathHard : mathPoolAll;

  return {
    rw: rwPool.length ? rwPool[seed % rwPool.length] : undefined,
    math: mathPool.length ? mathPool[(seed >> 3) % mathPool.length] : undefined,
    isChallengeSunday,
  };
}

export function loadHabits(): HabitProfile {
  try {
    const raw = localStorage.getItem(HABIT_KEY);
    if (!raw) return DEFAULT_HABITS;
    return { ...DEFAULT_HABITS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_HABITS;
  }
}

export function saveHabits(profile: HabitProfile) {
  try {
    localStorage.setItem(HABIT_KEY, JSON.stringify(profile));
  } catch {}
}

export function loadDailyState(questions: PracticeQuestion[], dateKey = toLocalDateKey()): DailyDropState {
  const { rw, math, isChallengeSunday } = pickDailyDropQuestions(questions, dateKey);
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyDropState;
      if (parsed.date === dateKey && parsed.rwQuestionId === (rw?.id || '') && parsed.mathQuestionId === (math?.id || '')) {
        return parsed;
      }
    }
  } catch {}
  return {
    date: dateKey,
    isChallengeSunday,
    rwQuestionId: rw?.id || '',
    mathQuestionId: math?.id || '',
    rwCompleted: false,
    mathCompleted: false,
    bonusClaimed: false,
  };
}

export function saveDailyState(state: DailyDropState) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(state));
  } catch {}
}

/** Updates streak when an attempt is recorded for `dateKey`, applying a streak freeze if exactly 1 day was skipped. */
export function recordStudyDayInHabits(
  prev: HabitProfile,
  dateKey = toLocalDateKey()
): HabitProfile {
  if (prev.lastStudyDate === dateKey) {
    return prev;
  }

  let nextStreak = 1;
  let nextFreezes = prev.streakFreezes;
  let nextSparks = prev.sparksBalance;

  if (prev.lastStudyDate) {
    const prevMs = new Date(`${prev.lastStudyDate}T12:00:00`).getTime();
    const curMs = new Date(`${dateKey}T12:00:00`).getTime();
    const dayDiff = Math.round((curMs - prevMs) / 86400000);
    if (dayDiff === 1) {
      nextStreak = prev.currentStreak + 1;
    } else if (dayDiff === 2 && prev.streakFreezes > 0) {
      // Streak freeze saves a single missed day
      nextStreak = prev.currentStreak + 1;
      nextFreezes -= 1;
    }
  }

  // Every 7-day milestone awards +1 freeze & refreshes Free weekly Sparks
  if (nextStreak > 0 && nextStreak % 7 === 0) {
    nextFreezes = Math.min(3, nextFreezes + 1);
    if (prev.sparksTier === 'free') {
      nextSparks = Math.max(nextSparks, 10);
    }
  }

  const activeSet = Array.from(new Set([...prev.activeDates, dateKey])).slice(-365);

  const next: HabitProfile = {
    ...prev,
    currentStreak: nextStreak,
    longestStreak: Math.max(prev.longestStreak, nextStreak),
    streakFreezes: nextFreezes,
    lastStudyDate: dateKey,
    activeDates: activeSet,
    sparksBalance: nextSparks,
  };
  saveHabits(next);
  return next;
}

export function computeAchievements({
  habits,
  attempts,
  dailyState,
  sprCorrectCount,
}: {
  habits: HabitProfile;
  attempts: { id: string; isCorrect?: boolean }[];
  dailyState: DailyDropState;
  sprCorrectCount: number;
}): AchievementBadge[] {
  const solvedCount = new Set(attempts.map((a) => a.id)).size;
  const correctTotal = attempts.filter((a) => a.isCorrect !== false).length;

  return [
    {
      id: 'first-solve',
      title: 'First Spark',
      description: 'Complete your first Digital SAT practice question.',
      rarity: 'Common',
      unlocked: attempts.length >= 1,
      progressText: `${Math.min(1, attempts.length)}/1`,
    },
    {
      id: 'daily-twin',
      title: 'Daily Twin',
      description: 'Finish both questions in a Daily 2 drop.',
      rarity: 'Uncommon',
      unlocked: dailyState.rwCompleted && dailyState.mathCompleted,
      progressText: `${Number(dailyState.rwCompleted) + Number(dailyState.mathCompleted)}/2 today`,
    },
    {
      id: 'week-streak',
      title: 'Week Warrior',
      description: 'Maintain a 7-day study streak (unlocks +1 Freeze & Sparks reset).',
      rarity: 'Rare',
      unlocked: habits.longestStreak >= 7,
      progressText: `${Math.min(7, habits.currentStreak)}/7 days`,
    },
    {
      id: 'spr-sharp',
      title: 'Grid-In Sharpshooter',
      description: 'Solve 5 Student-Produced Response questions accurately.',
      rarity: 'Rare',
      unlocked: sprCorrectCount >= 5,
      progressText: `${Math.min(5, sprCorrectCount)}/5 SPR`,
    },
    {
      id: 'centurion',
      title: '100 Questions Club',
      description: 'Solve 100 unique Digital SAT questions.',
      rarity: 'Epic',
      unlocked: solvedCount >= 100,
      progressText: `${Math.min(100, solvedCount)}/100 unique`,
    },
    {
      id: 'rush-champ',
      title: 'RedBook Rush Master',
      description: 'Score 300+ points in a RedBook Rush arcade run.',
      rarity: 'Legendary',
      unlocked: habits.rushBestScore >= 300 || correctTotal >= 250,
      progressText: `Best Rush: ${habits.rushBestScore}`,
    },
  ];
}
