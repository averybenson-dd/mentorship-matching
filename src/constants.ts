export const ADMIN_PASSWORD = "admin1999";

export const MENTEE_JOB_TITLES = [
  "Associate",
  "Senior Associate",
  "Associate Manager",
  "Manager",
  "Senior Manager",
] as const;

/** Mentor eligibility: Senior Manager and above only. */
export const MENTOR_JOB_TITLES = ["Senior Manager", "Director", "Senior Director"] as const;

/** Mentor mentee capacity options (numeric labels only in UI). */
export const MENTOR_MENTEE_CAPACITY_VALUES = [1, 2, 3, 4, 5] as const;
