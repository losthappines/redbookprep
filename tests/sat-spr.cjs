const fs = require('node:fs');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');

const tsCode = fs.readFileSync('lib/sat-spr.ts', 'utf8');
// Transpile export keywords for CommonJS VM evaluation without needing external typescript package
const jsCode = stripTypeScriptTypes(tsCode, { mode: 'strip' })
  .replace(/export\s+function\s+/g, 'function ')
  .replace(/export\s+const\s+/g, 'const ') +
  '\nmodule.exports = { validateSprInput, parseSprNumber, evaluateSprResponse, SAT_SPR_RULES };';

const mod = { exports: {} };
vm.runInNewContext(jsCode, { module: mod, exports: mod.exports });
const { validateSprInput, evaluateSprResponse } = mod.exports;

// 1. Official SAT character limit validation
assert.equal(validateSprInput('12345').valid, true);
assert.equal(validateSprInput('123456').valid, false);
assert.equal(validateSprInput('-12345').valid, true);
assert.equal(validateSprInput('-123456').valid, false);
assert.equal(validateSprInput('1 1/2').valid, false);
assert.equal(validateSprInput('3/0').valid, false);
assert.equal(validateSprInput('.75').valid, true);
assert.equal(validateSprInput('22/3').valid, true);

// 2. Equivalence grading
assert.equal(evaluateSprResponse('3/4', ['0.75']), true);
assert.equal(evaluateSprResponse('.75', ['3/4']), true);
assert.equal(evaluateSprResponse('0.75', ['.75']), true);
assert.equal(evaluateSprResponse('22/3', ['22/3', '7.33']), true);
assert.equal(evaluateSprResponse('7.33', ['22/3', '7.33']), true);
assert.equal(evaluateSprResponse('7.333', ['22/3']), true);
assert.equal(evaluateSprResponse('-24', ['-24']), true);
assert.equal(evaluateSprResponse('24', ['-24']), false);
assert.equal(evaluateSprResponse('14.00', ['14']), true);

// Multi-root accepted values
assert.equal(evaluateSprResponse('2.4', ['2.4', '4.8']), true);
assert.equal(evaluateSprResponse('4.8', ['2.4', '4.8']), true);
assert.equal(evaluateSprResponse('3.6', ['2.4', '4.8']), false);

console.log('tests/sat-spr.cjs: all SAT SPR validation & equivalence assertions passed.');
