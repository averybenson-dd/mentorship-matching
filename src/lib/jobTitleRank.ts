/**
 * Unified IC / manager ladder. Higher = more senior.
 * Mentor titles: Manager (4) through Senior Director (7).
 * Mentee titles: Associate (1) through Senior Manager (5).
 * A valid pair requires the mentor's title to be strictly more senior than the mentee's.
 */
const RANK: Record<string, number> = {
  Associate: 1,
  "Senior Associate": 2,
  "Associate Manager": 3,
  Manager: 4,
  "Senior Manager": 5,
  Director: 6,
  "Senior Director": 7,
};

export function jobTitleRank(title: string): number {
  return RANK[title.trim()] ?? -1;
}

/** True if mentor is at least one rung above mentee on the ladder. */
export function mentorOutranksMentee(mentorJobTitle: string, menteeJobTitle: string): boolean {
  const m = jobTitleRank(mentorJobTitle);
  const e = jobTitleRank(menteeJobTitle);
  if (m < 1 || e < 1) return false;
  return m > e;
}
