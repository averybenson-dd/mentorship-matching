import type { COMMITMENT_MENTEE, COMMITMENT_MENTOR, MENTEE_JOB_TITLES } from "./constants";

export type Role = "mentor" | "mentee";

export type MentorCommitment = (typeof COMMITMENT_MENTOR)[number];
export type MenteeCommitment = (typeof COMMITMENT_MENTEE)[number];
export type MenteeJobTitle = (typeof MENTEE_JOB_TITLES)[number];

export interface MentorApplication {
  role: "mentor";
  /** Work email — used for deduping and results lookup */
  email: string;
  name: string;
  region: string;
  jobTitle: string;
  commitment: MentorCommitment;
  menteeCapacity: 1 | 2 | 3;
  /** 1–12 index into DOORDASH_VALUES */
  valueSuperpower: number;
  teachingAreas: string;
  favoriteOrder: string;
  notes?: string;
}

export interface MenteeApplication {
  role: "mentee";
  email: string;
  name: string;
  region: string;
  jobTitle: MenteeJobTitle;
  jobTitleOther?: string;
  team: string;
  commitment: MenteeCommitment;
  /** 1–12 indices */
  valuesToDevelop: number[];
  coachingAreas: string;
  favoriteOrder: string;
  careerNotes?: string;
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
