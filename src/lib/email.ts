export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  if (!e.includes("@")) return false;
  if (e.length < 5) return false;
  const [local, domain] = e.split("@");
  if (!local || !domain || !domain.includes(".")) return false;
  return true;
}
