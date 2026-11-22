const fs = require('node:fs');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');

// Stub minimal storage for Node VM test
const memStore = new Map();
const localStorageStub = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
};

const tsCode = fs
  .readFileSync('lib/habits.ts', 'utf8')
  .replace(/import\s+type\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];\r?\n?/g, '');

const jsCode =
  stripTypeScriptTypes(tsCode, { mode: 'strip' })
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+const\s+/g, 'const ') +
  '\nmodule.exports = { DEFAULT_HABITS, toLocalDateKey, pickDailyDropQuestions, recordStudyDayInHabits, computeAchievements };';

const mod = { exports: {} };
vm.runInNewContext(jsCode, { module: mod, exports: mod.exports, localStorage: localStorageStub });
const { DEFAULT_HABITS, pickDailyDropQuestions, recordStudyDayInHabits, computeAchievements } = mod.exports;

// 1. Daily drop determinism & Challenge Sunday
const sampleQs = [
  { id: 'rw1', section: 'Reading and Writing', difficulty: 2 },
  { id: 'rw2', section: 'Reading and Writing', difficulty: 5, isChallenge: true },
  { id: 'm1', section: 'Math', difficulty: 2 },
  { id: 'm2', section: 'Math', difficulty: 5, isChallenge: true },
];
const weekdayDrop = pickDailyDropQuestions(sampleQs, '2026-11-23'); // Monday
assert.equal(weekdayDrop.isChallengeSunday, false);
assert.ok(weekdayDrop.rw && weekdayDrop.math);

const sundayDrop = pickDailyDropQuestions(sampleQs, '2026-11-22'); // Sunday
assert.equal(sundayDrop.isChallengeSunday, true);
assert.equal(sundayDrop.rw.id, 'rw2');
assert.equal(sundayDrop.math.id, 'm2');

// 2. Streak increments & Streak Freeze auto-consumption across 1 missed day
let h = { ...DEFAULT_HABITS, streakFreezes: 1, currentStreak: 3, longestStreak: 3, lastStudyDate: '2026-11-20' };
h = recordStudyDayInHabits(h, '2026-11-22'); // skipped 1 day (2026-11-21)
assert.equal(h.currentStreak, 4);
assert.equal(h.streakFreezes, 0);

// 3. 7-day milestone awards Freeze & refreshes Free Sparks
h = { ...DEFAULT_HABITS, streakFreezes: 0, currentStreak: 6, longestStreak: 6, sparksBalance: 2, lastStudyDate: '2026-11-21' };
h = recordStudyDayInHabits(h, '2026-11-22');
assert.equal(h.currentStreak, 7);
assert.equal(h.streakFreezes, 1);
assert.equal(h.sparksBalance, 10);

// 4. Achievement unlocking
const badges = computeAchievements({
  habits: h,
  attempts: [{ id: 'm2', isCorrect: true }],
  dailyState: { date: '2026-11-22', isChallengeSunday: true, rwQuestionId: 'rw2', mathQuestionId: 'm2', rwCompleted: true, mathCompleted: true, bonusClaimed: true },
  sprCorrectCount: 5,
});
assert.equal(badges.find((b) => b.id === 'first-solve').unlocked, true);
assert.equal(badges.find((b) => b.id === 'daily-twin').unlocked, true);
assert.equal(badges.find((b) => b.id === 'week-streak').unlocked, true);
assert.equal(badges.find((b) => b.id === 'spr-sharp').unlocked, true);

console.log('tests/habits.cjs: all Daily 2, Challenge Sunday, Streak Freeze & Achievement assertions passed.');
