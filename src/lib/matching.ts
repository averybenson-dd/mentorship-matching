import { DOORDASH_VALUES } from "../constants";
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

function valueOverlapScore(
  mentor: MentorApplication,
  mentee: MenteeApplication,
): number {
  const superIdx = mentor.valueSuperpower;
  if (!mentee.valuesToDevelop.includes(superIdx)) return 0;
  return 0.35;
}

function excerpt(text: string, max = 200): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function listValues(indices: number[]): string {
  return indices
    .map((i) => DOORDASH_VALUES[i - 1])
    .filter(Boolean)
    .join(", ");
}

function buildRationale(
  mentor: MentorApplication,
  mentee: MenteeApplication,
  topicScore: number,
  valueBonus: number,
): string {
  const mentorSuper = DOORDASH_VALUES[mentor.valueSuperpower - 1] ?? "a DoorDash value";
  const menteeValues = listValues(mentee.valuesToDevelop);
  const menteeValueShort = mentee.valuesToDevelop
    .slice(0, 4)
    .map((i) => DOORDASH_VALUES[i - 1])
    .filter(Boolean)
    .join(", ");

  const mTokens = tokenize(
    `${mentor.teachingAreas} ${mentor.notes ?? ""} ${mentor.favoriteOrder} ${mentor.jobTitle}`,
  );
  const eTokens = tokenize(
    `${mentee.coachingAreas} ${mentee.careerNotes ?? ""} ${mentee.favoriteOrder} ${mentee.team}`,
  );
  const overlap = [...mTokens].filter((t) => eTokens.has(t)).slice(0, 10);

  const teachingExcerpt = excerpt(mentor.teachingAreas, 260);
  const coachingExcerpt = excerpt(mentee.coachingAreas, 260);
  const mentorOrder = excerpt(mentor.favoriteOrder, 120);
  const menteeOrder = excerpt(mentee.favoriteOrder, 120);
  const mentorNotes = mentor.notes?.trim() ? excerpt(mentor.notes, 180) : "";
  const menteeGoals = mentee.careerNotes?.trim() ? excerpt(mentee.careerNotes, 180) : "";

  const paragraph1Parts: string[] = [];
  paragraph1Parts.push(
    `From what you each shared in this cohort’s application, the mentor’s write‑up centers on real S&O delivery experience: they highlighted strengths around “${mentorSuper}” and described teaching comfort in language like: “${teachingExcerpt}”.`,
  );
  paragraph1Parts.push(
    `On the mentee side, the development focus is explicit in the coaching goals text: “${coachingExcerpt}”, paired with values they want to grow (${menteeValueShort || menteeValues || "several DoorDash values"}).`,
  );
  if (mentee.team.trim()) {
    paragraph1Parts.push(
      `The mentee also anchors context to their team (“${excerpt(mentee.team, 120)}”), which helps a mentor tailor stories, stakeholder examples, and operating rhythms to how work actually shows up for this person.`,
    );
  }
  if (mentorOrder || menteeOrder) {
    paragraph1Parts.push(
      `Even the lighter “go‑to order” prompts add texture: the mentor mentioned “${mentorOrder || "their favorite order"}” while the mentee mentioned “${menteeOrder || "their favorite order"}” — small signals of personality and tone that often make mentorship conversations feel more human and less like a performance review.`,
    );
  }
  if (mentorNotes) {
    paragraph1Parts.push(`The mentor added extra context (“${mentorNotes}”) that can become a useful thread in early sessions.`);
  }
  if (menteeGoals) {
    paragraph1Parts.push(`The mentee’s longer‑form goals note (“${menteeGoals}”) gives a clearer runway for what “success” should feel like by the end of the six‑month arc.`);
  }

  const p1 = paragraph1Parts.join(" ");

  const overlapSentence =
    overlap.length > 0
      ? `When we compare the language of both applications, recurring concrete themes show up around: ${overlap.join(", ")} — that overlap is one of the strongest predictors that conversations will move quickly past small talk into specific skills, artifacts, and decision patterns.`
      : `Even where the vocabulary doesn’t overlap heavily, the pairing still works if the first sessions establish a crisp agenda: the mentor can translate generalized goals into weekly practices (narratives, metrics, stakeholder maps, operating cadences) that match how the mentee described their environment.`;

  const valuesSentence =
    valueBonus > 0
      ? `There is a direct values bridge: the mentee is actively trying to develop “${mentorSuper}”, and the mentor named that exact value as a personal superpower — that alignment tends to make feedback feel credible because it is grounded in lived practice, not abstract advice.`
      : `The mentee’s selected values (${menteeValues || "their selected values"}) don’t perfectly intersect the mentor’s named superpower (“${mentorSuper}”), which is not a dealbreaker: it can still be a strong developmental pairing if sessions deliberately connect mentor habits to the mentee’s chosen growth edges.`;

  const cadence =
    mentor.commitment === "yes" && mentee.commitment === "yes"
      ? `Both sides indicated they can sustain the program’s cadence (bi‑weekly/monthly), which reduces scheduling risk for a six‑month commitment.`
      : `Cadence and availability flags matter: if either side selected a non‑standard commitment, the first session should explicitly lock a sustainable rhythm so momentum doesn’t decay mid‑program.`;

  const confidence = Math.round(Math.min(97, 58 + topicScore * 130 + valueBonus * 110));

  const p2 = [
    overlapSentence,
    valuesSentence,
    cadence,
    `Putting the scoring together, this match is a ${confidence}% programmatic fit based on topical overlap between teaching areas and coaching goals, values alignment, mutual availability signals, and the mentor’s stated mentee capacity — chemistry still matters, so treat the first two sessions as a mutual “calibration sprint” to confirm priorities and boundaries.`,
  ].join(" ");

  return `${p1}\n\n${p2}`;
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
