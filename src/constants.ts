export const ADMIN_PASSWORD = "admin1999";

export const MENTEE_JOB_TITLES = [
  "Associate",
  "Senior Associate",
  "Associate Manager",
  "Manager",
  "Senior Manager",
] as const;

export const MENTOR_JOB_TITLES = [
  "Senior Manager",
  "Manager",
  "Director",
  "Senior Director",
] as const;

export const MENTOR_MENTEE_CAPACITY = [
  { value: "1", label: "1 mentee (about 30–60 minutes per month)" },
  { value: "2", label: "2 mentees — recommended (about 1–2 hours per month)" },
  { value: "3", label: "3 mentees (about 3 hours per month)" },
] as const;

export const COMMITMENT_MENTOR = ["yes", "no", "alternative"] as const;
export const COMMITMENT_MENTEE = ["yes", "no"] as const;
