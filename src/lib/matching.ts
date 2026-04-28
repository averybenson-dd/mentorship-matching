import type {
  MatchPair,
  MentorApplication,
  MenteeApplication,
  StoredApplication,
} from "../types";
import { mentorOutranksMentee } from "./jobTitleRank";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "be",
  "this",
  "that",
  "it",
  "we",
  "you",
  "i",
  "my",
  "our",
  "their",
  "into",
  "about",
  "across",
]);

function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  const parts = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const p of parts) {
    if (p.length < 3 || STOP.has(p)) continue;
    out.add(p);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter++;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function excerpt(text: string, max = 200): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function mentorBlob(m: MentorApplication): string {
  return [
    m.teachingAreas,
    m.jobTitle,
    ...m.mentorFocusAreas,
    m.mentorshipStyle,
    m.bestSuitedMentee,
  ].join(" ");
}

function menteeBlob(me: MenteeApplication): string {
  return [
    me.coachingAreas,
    me.jobTitle,
    ...me.developmentGoals,
    me.preferredMentorshipStyle,
    me.mentorLevelLookingFor,
  ].join(" ");
}

/** Token overlap between dropdown labels (different wording, shared themes). */
function structuredGoalOverlap(m: MentorApplication, me: MenteeApplication): number {
  const fa = tokenize(m.mentorFocusAreas.join(" "));
  const dg = tokenize(me.developmentGoals.join(" "));
  return jaccard(fa, dg);
}

function buildRationale(
  mentor: MentorApplication,
  mentee: MenteeApplication,
  topicScore: number,
  structScore: number,
): string {
  const mTokens = tokenize(mentorBlob(mentor));
  const eTokens = tokenize(menteeBlob(mentee));
  const overlap = [...mTokens].filter((t) => eTokens.has(t)).slice(0, 10);

  const teachingExcerpt = excerpt(mentor.teachingAreas, 260);
  const coachingExcerpt = excerpt(mentee.coachingAreas, 260);

  const p1 = [
    `The mentor described teaching comfort in language like: “${teachingExcerpt}”.`,
    `The mentee’s coaching goals read: “${coachingExcerpt}”.`,
  ].join(" ");

  const overlapSentence =
    overlap.length > 0
      ? `Recurring concrete themes in both write-ups include: ${overlap.join(", ")} — that overlap supports a focused first few sessions.`
      : `Where vocabulary differs, early sessions can still align the mentor’s teaching themes to the mentee’s stated coaching priorities.`;

  const structNote =
    structScore > 0.2
      ? `Their selected focus areas and development goals line up in ways that give you a clear thread for the first meetings.`
      : `Use the first session to align the mentor’s stated style (“${excerpt(mentor.mentorshipStyle, 80)}”) with how the mentee prefers to work (“${excerpt(mentee.preferredMentorshipStyle, 80)}”).`;

  const tone =
    topicScore > 0.12 || structScore > 0.25
      ? `The overlap between narratives and structured choices is a decent basis for a six-month arc.`
      : `Fit relies more on deliberate agenda-setting in the first two sessions than on automatic keyword overlap.`;

  const p2 = [overlapSentence, structNote, tone].join(" ");

  return `${p1}\n\n${p2}`;
}

function pairScore(mentor: MentorApplication, mentee: MenteeApplication): number {
  const mTokens = tokenize(mentorBlob(mentor));
  const eTokens = tokenize(menteeBlob(mentee));
  const topic = jaccard(mTokens, eTokens);
  const struct = structuredGoalOverlap(mentor, mentee);
  return topic * 1.25 + struct * 0.35;
}

export function runMatching(applications: StoredApplication[]): MatchPair[] {
  const mentors = applications.filter(
    (a): a is StoredApplication & { payload: MentorApplication } =>
      a.payload.role === "mentor",
  );
  const mentees = applications.filter(
    (a): a is StoredApplication & { payload: MenteeApplication } =>
      a.payload.role === "mentee",
  );

  const capacity = new Map<string, number>();
  const used = new Map<string, number>();
  for (const m of mentors) {
    const cap = Number(m.payload.menteeCapacity);
    capacity.set(m.id, Number.isFinite(cap) && cap >= 1 && cap <= 5 ? cap : 1);
    used.set(m.id, 0);
  }

  const pairs: { mentorId: string; menteeId: string; score: number; rationale: string }[] = [];

  for (const mt of mentors) {
    for (const me of mentees) {
      const mentor = mt.payload;
      const mentee = me.payload;
      if (!mentorOutranksMentee(mentor.jobTitle, mentee.jobTitle)) continue;
      const mTokens = tokenize(mentorBlob(mentor));
      const eTokens = tokenize(menteeBlob(mentee));
      const topicScore = jaccard(mTokens, eTokens);
      const structScore = structuredGoalOverlap(mentor, mentee);
      const score = pairScore(mentor, mentee);
      const rationale = buildRationale(mentor, mentee, topicScore, structScore);
      pairs.push({ mentorId: mt.id, menteeId: me.id, score, rationale });
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  const menteeAssigned = new Set<string>();
  const result: MatchPair[] = [];

  for (const p of pairs) {
    if (menteeAssigned.has(p.menteeId)) continue;
    const cap = capacity.get(p.mentorId) ?? 0;
    const u = used.get(p.mentorId) ?? 0;
    if (u >= cap) continue;
    menteeAssigned.add(p.menteeId);
    used.set(p.mentorId, u + 1);
    result.push({
      mentorId: p.mentorId,
      menteeId: p.menteeId,
      score: Math.round(p.score * 1000) / 1000,
      rationale: p.rationale,
    });
  }

  return result;
}
