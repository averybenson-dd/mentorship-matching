import { DOORDASH_VALUES } from "../constants";
import type {
  MatchPair,
  MentorApplication,
  MenteeApplication,
  Role,
  StoredApplication,
} from "../types";

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

function valueOverlapScore(
  mentor: MentorApplication,
  mentee: MenteeApplication,
): number {
  const superIdx = mentor.valueSuperpower;
  if (!mentee.valuesToDevelop.includes(superIdx)) return 0;
  return 0.35;
}

function buildRationale(
  mentor: MentorApplication,
  mentee: MenteeApplication,
  topicScore: number,
  valueBonus: number,
): string {
  const mTokens = tokenize(`${mentor.teachingAreas} ${mentor.jobTitle}`);
  const eTokens = tokenize(`${mentee.coachingAreas} ${mentee.team}`);
  const overlap = [...mTokens].filter((t) => eTokens.has(t)).slice(0, 8);

  const sharedValues = mentee.valuesToDevelop
    .filter((i) => i === mentor.valueSuperpower)
    .map((i) => DOORDASH_VALUES[i - 1])
    .filter(Boolean);

  const parts: string[] = [];
  if (sharedValues.length) {
    parts.push(
      `You are aligned on developing “${sharedValues[0]}”, which this mentor called out as a personal strength.`,
    );
  }
  if (overlap.length) {
    parts.push(
      `There is topical overlap around themes like ${overlap.join(", ")} — useful for practical coaching conversations.`,
    );
  }
  if (topicScore > 0.12) {
    parts.push(
      "The mentor’s stated teaching areas and your coaching goals share meaningful language, which usually makes sessions easier to structure.",
    );
  } else if (parts.length === 0) {
    parts.push(
      "This pairing balances availability and program constraints; consider using early sessions to align on specific outcomes and cadence.",
    );
  }
  parts.push(
    `Match confidence is ${Math.round(
      Math.min(99, 55 + topicScore * 120 + valueBonus * 100),
    )}% based on text overlap, values fit, and capacity — not a guarantee of chemistry.`,
  );
  return parts.join(" ");
}

function pairScore(mentor: MentorApplication, mentee: MenteeApplication): number {
  const mTokens = tokenize(
    `${mentor.teachingAreas} ${mentor.notes ?? ""} ${mentor.favoriteOrder}`,
  );
  const eTokens = tokenize(
    `${mentee.coachingAreas} ${mentee.careerNotes ?? ""} ${mentee.favoriteOrder}`,
  );
  const topic = jaccard(mTokens, eTokens);
  const valueBonus = valueOverlapScore(mentor, mentee);
  return topic * 1.4 + valueBonus + (mentor.commitment === "yes" && mentee.commitment === "yes" ? 0.05 : 0);
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
    capacity.set(m.id, m.payload.menteeCapacity);
    used.set(m.id, 0);
  }

  const pairs: { mentorId: string; menteeId: string; score: number; rationale: string }[] =
    [];

  for (const mt of mentors) {
    for (const me of mentees) {
      const mentor = mt.payload;
      const mentee = me.payload;
      if (mentor.commitment === "no" || mentee.commitment === "no") continue;
      const mTokens = tokenize(
        `${mentor.teachingAreas} ${mentor.notes ?? ""} ${mentor.favoriteOrder}`,
      );
      const eTokens = tokenize(
        `${mentee.coachingAreas} ${mentee.careerNotes ?? ""} ${mentee.favoriteOrder}`,
      );
      const topicScore = jaccard(mTokens, eTokens);
      const valueBonus = valueOverlapScore(mentor, mentee);
      const score = pairScore(mentor, mentee);
      const rationale = buildRationale(mentor, mentee, topicScore, valueBonus);
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

export function findMatchForPerson(
  apps: StoredApplication[],
  matches: MatchPair[],
  name: string,
  roleFilter: Role | "either",
): { self: StoredApplication; counterpart: StoredApplication; rationale: string } | null {
  const norm = (s: string) => s.trim().toLowerCase();
  const n = norm(name);
  const candidates = apps.filter((a) => norm(a.payload.name) === n);
  if (candidates.length === 0) return null;

  const self =
    roleFilter === "either"
      ? candidates[0]
      : candidates.find((a) => a.payload.role === roleFilter) ?? null;
  if (!self) return null;

  const effectiveRole = self.payload.role;

  const pair = matches.find((m) => {
    if (effectiveRole === "mentor") return m.mentorId === self.id;
    return m.menteeId === self.id;
  });
  if (!pair) return null;

  const counterpartId = effectiveRole === "mentor" ? pair.menteeId : pair.mentorId;
  const counterpart = apps.find((a) => a.id === counterpartId);
  if (!counterpart) return null;

  return { self, counterpart, rationale: pair.rationale };
}
