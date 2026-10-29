/**
 * Utility to format Digital SAT skills consistently in Title Case.
 */
export function formatSkillTitle(skill?: string | null): string {
  if (!skill || typeof skill !== 'string') return '';
  const trimmed = skill.trim();
  if (!trimmed) return '';

  const minorWords = new Set([
    'a',
    'an',
    'the',
    'and',
    'but',
    'or',
    'for',
    'nor',
    'on',
    'at',
    'to',
    'from',
    'by',
    'over',
    'in',
    'of',
    'with',
  ]);

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      // Strip punctuation for minor-word check
      const alphaWord = lower.replace(/[^a-z0-9]/gi, '');
      if (index > 0 && minorWords.has(alphaWord)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
