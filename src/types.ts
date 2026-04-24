import type { MENTEE_JOB_TITLES, MENTOR_JOB_TITLES, MENTOR_MENTEE_CAPACITY_VALUES } from "./constants";

export type Role = "mentor" | "mentee";

export type MenteeJobTitle = (typeof MENTEE_JOB_TITLES)[number];
export type MentorJobTitle = (typeof MENTOR_JOB_TITLES)[number];
export type MentorMenteeCapacity = (typeof MENTOR_MENTEE_CAPACITY_VALUES)[number];

export interface MentorApplication {
  role: "mentor";
  /** Work email — used for deduping and results lookup */
  email: string;
  name: string;
  jobTitle: MentorJobTitle;
  menteeCapacity: MentorMenteeCapacity;
  teachingAreas: string;
}

export interface MenteeApplication {
  role: "mentee";
  email: string;
  name: string;
  jobTitle: MenteeJobTitle;
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
