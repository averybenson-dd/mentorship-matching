export const ADMIN_PASSWORD = "admin1999";

export const DOORDASH_VALUES: readonly string[] = [
  "Be an owner",
  "Bias for action",
  "Customer obsessed, not competitor-focused",
  "One team, one fight",
  "1% better every day",
  "And, not either/or",
  "Truth seek",
  "Think outside the room",
  "Make room at the table",
  "Operate at the lowest level of detail",
  "Dream big, start small",
  "Choose optimism and have a plan",
] as const;

export const MENTEE_JOB_TITLES = [
  "Associate",
  "Senior Associate",
  "Associate Manager",
  "Manager",
  "Senior Manager",
  "Other",
] as const;

export const MENTOR_MENTEE_CAPACITY = [
  { value: "1", label: "1 mentee (about 30–60 minutes per month)" },
  { value: "2", label: "2 mentees — recommended (about 1–2 hours per month)" },
  { value: "3", label: "3 mentees (about 3 hours per month)" },
] as const;

export const COMMITMENT_MENTOR = ["yes", "no", "alternative"] as const;
export const COMMITMENT_MENTEE = ["yes", "no"] as const;
