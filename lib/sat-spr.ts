// Official Digital SAT Student-Produced Response (SPR / Grid-In)
// validation and grading utilities.

export interface SprValidationResult {
  valid: boolean;
  reason?: string;
  normalized?: string;
  numericValue?: number;
}

const FRACTION_RE = /^(-)?(\d+)\/(\d+)$/;
const DECIMAL_RE = /^(-)?(?:\d+\.\d*|\.\d+|\d+)$/;

/**
 * Enforces official College Board Digital SAT SPR character & syntax constraints:
 * - Up to 5 characters for positive answers
 * - Up to 6 characters (including leading '-') for negative answers
 * - Only digits 0-9, one optional leading '-', one '.' or one '/'
 * - No spaces / mixed numbers (e.g. "1 1/2" is invalid; enter "3/2" or "1.5")
 * - Denominator cannot be zero
 */
export function validateSprInput(raw: string): SprValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Enter a numeric answer, fraction, or decimal.' };
  }

  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      reason: 'Spaces and mixed numbers are not allowed. Use an improper fraction (e.g. 3/2) or decimal.',
    };
  }

  const isNegative = trimmed.startsWith('-');
  const maxLength = isNegative ? 6 : 5;
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      reason: isNegative
        ? 'Negative answers can use at most 6 characters (including the minus sign).'
        : 'Positive answers can use at most 5 characters (including / or .).',
    };
  }

  if (!/^-?[0-9./]+$/.test(trimmed)) {
    return {
      valid: false,
      reason: 'Only digits (0–9), a leading minus sign (-), one decimal point (.), or one slash (/) are allowed.',
    };
  }

  if (trimmed === '-' || trimmed === '.' || trimmed === '-.') {
    return { valid: false, reason: 'Enter a complete number.' };
  }

  const fracMatch = trimmed.match(FRACTION_RE);
  if (fracMatch) {
    const sign = fracMatch[1] ? -1 : 1;
    const num = Number(fracMatch[2]);
    const den = Number(fracMatch[3]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return { valid: false, reason: 'Denominator in a fraction cannot be zero.' };
    }
    return {
      valid: true,
      normalized: trimmed,
      numericValue: sign * (num / den),
    };
  }

  if (DECIMAL_RE.test(trimmed)) {
    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      return { valid: false, reason: 'Enter a valid decimal or whole number.' };
    }
    return {
      valid: true,
      normalized: trimmed,
      numericValue: value,
    };
  }

  return { valid: false, reason: 'Check the placement of "-", ".", or "/" in your answer.' };
}

export function parseSprNumber(raw: string): number | null {
  const checked = validateSprInput(raw);
  if (checked.valid && typeof checked.numericValue === 'number') {
    return checked.numericValue;
  }
  // Also allow key answers slightly longer than 5 chars when comparing exact fractions from answer keys
  const t = raw.trim();
  const frac = t.match(FRACTION_RE);
  if (frac) {
    const den = Number(frac[3]);
    if (den !== 0) return (frac[1] ? -1 : 1) * (Number(frac[2]) / den);
  }
  if (DECIMAL_RE.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Checks whether a student's SPR entry matches any acceptable SAT answer key.
 * Handles exact string matches and SAT rounding/fraction-decimal equivalence (e.g. 2/3, 0.666, .6667).
 */
export function evaluateSprResponse(response: string, acceptableAnswers: string[]): boolean {
  const validation = validateSprInput(response);
  if (!validation.valid || typeof validation.numericValue !== 'number') {
    return false;
  }

  const cleaned = validation.normalized!;
  for (const keyRaw of acceptableAnswers) {
    const key = keyRaw.trim();
    if (!key) continue;
    if (cleaned === key) return true;

    const keyNum = parseSprNumber(key);
    if (keyNum === null) continue;

    // Exact or repeating decimal SAT grid tolerance
    if (Math.abs(validation.numericValue - keyNum) <= 0.0055) {
      // For integers or clean terminating decimals, require tighter precision so e.g. 14 !== 14.004
      if (Number.isInteger(keyNum) && !cleaned.includes('/') && !cleaned.includes('.')) {
        if (Math.abs(validation.numericValue - keyNum) === 0) return true;
        continue;
      }
      // If key explicitly specifies repeating rounding like 7.33 vs 22/3
      const keyDecimals = (key.split('.')[1] || '').length;
      const respDecimals = (cleaned.split('.')[1] || '').length;
      if (cleaned.includes('/') || Math.max(keyDecimals, respDecimals) >= 3) {
        if (Math.abs(validation.numericValue - keyNum) <= 0.0055) return true;
      }
      if (Math.abs(validation.numericValue - keyNum) <= 1e-4) {
        return true;
      }
    }
  }
  return false;
}

export const SAT_SPR_RULES: readonly string[] = [
  'Enter up to 5 characters for positive answers, or up to 6 characters (including the minus sign) for negative answers.',
  'If you enter a decimal with more digits than fit, round it or truncate it at the final digit.',
  'Fractions (like 3/4 or 22/3) do not need to be reduced to lowest terms as long as they fit.',
  'Never enter mixed numbers like 1 1/2 — enter them as an improper fraction (3/2) or decimal (1.5).',
];
