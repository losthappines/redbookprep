const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const source = fs.readFileSync('lib/sat-score.ts', 'utf8');
const sandbox = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  sandbox
);

const { calculateSatScore, estimatePercentile, SCORE_PRESETS } = sandbox.exports;

// 1. Boundary tests
const minRes = calculateSatScore({
  rw: { m1: 0, m2: 0, mode: 'auto' },
  math: { m1: 0, m2: 0, mode: 'auto' },
});
assert.equal(minRes.total, 400);
assert.equal(minRes.rw.score, 200);
assert.equal(minRes.math.score, 200);
assert.equal(minRes.rw.resolvedTier, 'easier');
assert.equal(minRes.math.resolvedTier, 'easier');

const maxRes = calculateSatScore({
  rw: { m1: 27, m2: 27, mode: 'auto' },
  math: { m1: 22, m2: 22, mode: 'auto' },
});
assert.equal(maxRes.total, 1600);
assert.equal(maxRes.rw.score, 800);
assert.equal(maxRes.math.score, 800);
assert.equal(maxRes.rw.resolvedTier, 'harder');
assert.equal(maxRes.math.resolvedTier, 'harder');

// 2. Monotonicity across RW and Math inputs under explicit tiers
for (const tier of ['harder', 'easier']) {
  let prevRw = 0;
  for (let m1 = 0; m1 <= 27; m1++) {
    for (let m2 = 0; m2 <= 27; m2++) {
      const r = calculateSatScore({
        rw: { m1, m2, mode: tier },
        math: { m1: 0, m2: 0, mode: 'auto' },
      });
      assert.ok(r.rw.score >= 200 && r.rw.score <= 800);
      assert.equal(r.rw.score % 10, 0);
      if (tier === 'easier') assert.ok(r.rw.score <= 640);
      if (m2 > 0) {
        assert.ok(r.rw.score >= prevRw, `RW not monotonic at ${tier} m1=${m1} m2=${m2}`);
      }
      prevRw = r.rw.score;
    }
  }
  let prevMath = 0;
  for (let m1 = 0; m1 <= 22; m1++) {
    for (let m2 = 0; m2 <= 22; m2++) {
      const r = calculateSatScore({
        rw: { m1: 0, m2: 0, mode: 'auto' },
        math: { m1, m2, mode: tier },
      });
      assert.ok(r.math.score >= 200 && r.math.score <= 800);
      assert.equal(r.math.score % 10, 0);
      if (tier === 'easier') assert.ok(r.math.score <= 640);
      if (m2 > 0) {
        assert.ok(r.math.score >= prevMath, `Math not monotonic at ${tier} m1=${m1} m2=${m2}`);
      }
      prevMath = r.math.score;
    }
  }
}

// 3. Easier tier never exceeds harder tier for identical raw scores
for (let m1 = 0; m1 <= 27; m1 += 3) {
  for (let m2 = 0; m2 <= 27; m2 += 3) {
    const hard = calculateSatScore({ rw: { m1, m2, mode: 'harder' }, math: { m1: 14, m2: 14, mode: 'harder' } });
    const easy = calculateSatScore({ rw: { m1, m2, mode: 'easier' }, math: { m1: 14, m2: 14, mode: 'easier' } });
    assert.ok(easy.rw.score <= hard.rw.score);
    assert.ok(easy.math.score <= hard.math.score);
  }
}

// 4. Presets and percentile sanity
for (const preset of SCORE_PRESETS) {
  const res = calculateSatScore(preset);
  console.log(`${preset.id}: total=${res.total} (${res.totalMin}-${res.totalMax}), rw=${res.rw.score} [${res.rw.resolvedTier}], math=${res.math.score} [${res.math.resolvedTier}], pct=${res.percentile}`);
}
assert.equal(estimatePercentile(400), 1);
assert.equal(estimatePercentile(1600), 99);
console.log('sat-score tests passed');
