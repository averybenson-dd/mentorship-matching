import type {
  MatchPair,
  MentorApplication,
  MenteeApplication,
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

function excerpt(text: string, max = 200): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildRationale(
  mentor: MentorApplication,
  mentee: MenteeApplication,
  topicScore: number,
): string {
  const mTokens = tokenize(`${mentor.teachingAreas} ${mentor.jobTitle}`);
  const eTokens = tokenize(`${mentee.coachingAreas} ${mentee.team}`);
  const overlap = [...mTokens].filter((t) => eTokens.has(t)).slice(0, 10);

  const teachingExcerpt = excerpt(mentor.teachingAreas, 260);
  const coachingExcerpt = excerpt(mentee.coachingAreas, 260);

  const paragraph1Parts: string[] = [];
  paragraph1Parts.push(
    `The mentor described teaching comfort in language like: “${teachingExcerpt}”.`,
  );
  paragraph1Parts.push(
    `The mentee’s coaching goals read: “${coachingExcerpt}”.`,
  );
  if (mentee.team.trim()) {
    paragraph1Parts.push(
      `The mentee anchors context to their team (“${excerpt(mentee.team, 120)}”), which can help tailor examples to how work shows up for them.`,
    );
  }

  const p1 = paragraph1Parts.join(" ");

  const overlapSentence =
    overlap.length > 0
      ? `Recurring concrete themes in both write-ups include: ${overlap.join(", ")} — that overlap supports a focused first few sessions.`
      : `Where vocabulary differs, early sessions can still align the mentor’s teaching themes to the mentee’s stated coaching priorities.`;

  const cadence =
    mentor.commitment === "yes" && mentee.commitment === "yes"
      ? `Both sides indicated they can sustain the program cadence, which reduces scheduling risk.`
      : `If either side selected a non-standard commitment, the first session should lock a sustainable rhythm.`;

  const tone =
    topicScore > 0.12
      ? `The topical overlap between teaching areas and coaching goals is a solid basis for a six-month arc.`
      : `Fit relies more on deliberate agenda-setting in the first two sessions than on automatic keyword overlap.`;

  const p2 = [overlapSentence, cadence, tone].join(" ");

  return `${p1}\n\n${p2}`;
}

function pairScore(mentor: MentorApplication, mentee: MenteeApplication): number {
  const mTokens = tokenize(`${mentor.teachingAreas} ${mentor.jobTitle}`);
  const eTokens = tokenize(`${mentee.coachingAreas} ${mentee.team}`);
  const topic = jaccard(mTokens, eTokens);
  return topic * 1.45 + (mentor.commitment === "yes" && mentee.commitment === "yes" ? 0.05 : 0);
}

function isSeniorManagerPair(mentor: MentorApplication, mentee: MenteeApplication): boolean {
  return mentor.jobTitle.trim() === "Senior Manager" && mentee.jobTitle.trim() === "Senior Manager";
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

  const pairs: { mentorId: string; menteeId: string; score: number; rationale: string }[] = [];

  for (const mt of mentors) {
    for (const me of mentees) {
      const mentor = mt.payload;
      const mentee = me.payload;
      if (mentor.commitment === "no" || mentee.commitment === "no") continue;
      if (isSeniorManagerPair(mentor, mentee)) continue;
      const mTokens = tokenize(`${mentor.teachingAreas} ${mentor.jobTitle}`);
      const eTokens = tokenize(`${mentee.coachingAreas} ${mentee.team}`);
      const topicScore = jaccard(mTokens, eTokens);
      const score = pairScore(mentor, mentee);
      const rationale = buildRationale(mentor, mentee, topicScore);
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
