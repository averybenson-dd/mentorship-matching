import type {
  MENTEE_DEVELOPMENT_GOALS,
  MENTEE_JOB_TITLES,
  MENTEE_MENTOR_LEVEL_PREFERENCE,
  MENTEE_PREFERRED_MENTORSHIP_STYLES,
  MENTOR_BEST_SUITED_MENTEE,
  MENTOR_FOCUS_AREAS,
  MENTOR_JOB_TITLES,
  MENTOR_MENTEE_CAPACITY_VALUES,
  MENTOR_MENTORSHIP_STYLES,
} from "./constants";

export type Role = "mentor" | "mentee";

export type MenteeJobTitle = (typeof MENTEE_JOB_TITLES)[number];
export type MentorJobTitle = (typeof MENTOR_JOB_TITLES)[number];
export type MentorMenteeCapacity = (typeof MENTOR_MENTEE_CAPACITY_VALUES)[number];
export type MentorFocusArea = (typeof MENTOR_FOCUS_AREAS)[number];
export type MenteeDevGoal = (typeof MENTEE_DEVELOPMENT_GOALS)[number];

export interface MentorApplication {
  role: "mentor";
  email: string;
  name: string;
  jobTitle: MentorJobTitle;
  menteeCapacity: MentorMenteeCapacity;
  mentorFocusAreas: MentorFocusArea[];
  mentorshipStyle: (typeof MENTOR_MENTORSHIP_STYLES)[number];
  bestSuitedMentee: (typeof MENTOR_BEST_SUITED_MENTEE)[number];
  teachingAreas: string;
}

export interface MenteeApplication {
  role: "mentee";
  email: string;
  name: string;
  jobTitle: MenteeJobTitle;
  developmentGoals: MenteeDevGoal[];
  preferredMentorshipStyle: (typeof MENTEE_PREFERRED_MENTORSHIP_STYLES)[number];
  mentorLevelLookingFor: (typeof MENTEE_MENTOR_LEVEL_PREFERENCE)[number];
  coachingAreas: string;
}

export type ApplicationPayload = MentorApplication | MenteeApplication;

export interface StoredApplication {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  payload: ApplicationPayload;
}

export interface MatchPair {
  mentorId: string;
  menteeId: string;
  score: number;
  rationale: string;
}

export interface ProgramState {
  published: boolean;
  matches: MatchPair[];
  updatedAt: string;
}
