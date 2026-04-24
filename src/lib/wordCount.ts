/** Word count for minimum-length validation (whitespace-separated tokens). */
export function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export const MIN_ESSAY_WORDS = 100;
