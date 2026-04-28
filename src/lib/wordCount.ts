/** Word count for application essays (whitespace-separated tokens). */
export function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export const MIN_ESSAY_WORDS = 10;
export const MAX_ESSAY_WORDS = 50;

export function essayWordCountOk(s: string): boolean {
  const n = countWords(s);
  return n >= MIN_ESSAY_WORDS && n <= MAX_ESSAY_WORDS;
}
