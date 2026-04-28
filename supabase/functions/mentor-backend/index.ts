import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password",
};

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function jsonResponse(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requireServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase service configuration");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Edge → PostgREST sometimes hits dropped TLS (rustls close_notify / unexpected EOF). */
function isTransientFetchFailure(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /close_notify|unexpected.eof|unexpected_eof|SendRequest|connection reset|ECONNRESET|ETIMEDOUT|timed out|peer closed connection|broken pipe|520|522|523|524/i.test(
    m,
  );
}

/** Retry a few times with backoff when the Supabase client’s fetch throws mid-request. */
async function withPostgrestRetry<T>(fn: () => PromiseLike<T>): Promise<T> {
  const waitsMs = [300, 900, 2200];
  let last: unknown;
  for (let i = 0; i <= waitsMs.length; i++) {
    try {
      return await Promise.resolve(fn());
    } catch (e) {
      last = e;
      if (!isTransientFetchFailure(e) || i === waitsMs.length) throw e;
    }
    await new Promise((r) => setTimeout(r, waitsMs[i]!));
  }
  throw last;
}

function assertAdmin(req: Request) {
  const expected = Deno.env.get("ADMIN_PASSWORD");
  const got = req.headers.get("x-admin-password") ?? "";
  if (!expected || got !== expected) {
    throw new Error("unauthorized");
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const MENTOR_JOB_TITLES = ["Manager", "Senior Manager", "Director", "Senior Director"] as const;

const MENTEE_JOB_TITLES = [
  "Associate",
  "Senior Associate",
  "Associate Manager",
  "Manager",
  "Senior Manager",
] as const;

const JOB_TITLE_RANK: Record<string, number> = {
  Associate: 1,
  "Senior Associate": 2,
  "Associate Manager": 3,
  Manager: 4,
  "Senior Manager": 5,
  Director: 6,
  "Senior Director": 7,
};

/** Mentor must sit strictly higher than mentee on this ladder (≥1 rank gap). */
function mentorOutranksMentee(mentorJobTitle: string, menteeJobTitle: string): boolean {
  const m = JOB_TITLE_RANK[mentorJobTitle.trim()] ?? -1;
  const e = JOB_TITLE_RANK[menteeJobTitle.trim()] ?? -1;
  if (m < 1 || e < 1) return false;
  return m > e;
}

const MAX_MULTI_PICKS = 3;

const MENTOR_FOCUS_AREAS = [
  "People Management",
  "Career Growth & Promotions",
  "Cross-functional Collaboration",
  "Strategic Thinking",
  "Operations / Execution",
  "Product / Tech",
  "Data & Analytics",
  "Communication & Influence",
] as const;

const MENTOR_MENTORSHIP_STYLES = [
  "Hands-on / Tactical (resume reviews, problem solving)",
  "Strategic / Big-picture guidance",
  "Coaching through questions (Socratic style)",
  "Sponsorship & advocacy",
  "Flexible / depends on mentee needs",
] as const;

const MENTOR_BEST_SUITED_MENTEE = [
  "Early career (0–2 years)",
  "Mid-level (3–6 years)",
  "Senior ICs",
  "New managers",
  "Aspiring managers",
] as const;

const MENTEE_DEVELOPMENT_GOALS = [
  "Getting promoted",
  "Becoming a manager",
  "Improving performance in current role",
  "Building strategic thinking skills",
  "Navigating cross-functional work",
  "Improving communication / influence",
  "Exploring new career paths",
] as const;

const MENTEE_PREFERRED_MENTORSHIP_STYLES = [
  "Direct advice & feedback",
  "Structured guidance (goals, plans)",
  "Open-ended coaching conversations",
  "Accountability check-ins",
  "Flexible",
] as const;

const MENTEE_MENTOR_LEVEL_PREFERENCE = [
  "1 level above me",
  "2+ levels above me",
  "Different function / perspective",
  "No preference",
] as const;

function isAllowedTitle<T extends readonly string[]>(allowed: T, s: string): boolean {
  return (allowed as readonly string[]).includes(s);
}

function parseUniqueStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function validateMentorStructured(payload: Record<string, unknown>) {
  const fa = parseUniqueStrings(payload.mentorFocusAreas);
  if (fa.length < 1 || fa.length > MAX_MULTI_PICKS) throw new Error("invalid_mentor_focus");
  const allowedFa = MENTOR_FOCUS_AREAS as readonly string[];
  for (const x of fa) {
    if (!allowedFa.includes(x)) throw new Error("invalid_mentor_focus");
  }
  const style = typeof payload.mentorshipStyle === "string" ? payload.mentorshipStyle.trim() : "";
  if (!(MENTOR_MENTORSHIP_STYLES as readonly string[]).includes(style)) {
    throw new Error("invalid_mentor_style");
  }
  const suited = typeof payload.bestSuitedMentee === "string" ? payload.bestSuitedMentee.trim() : "";
  if (!(MENTOR_BEST_SUITED_MENTEE as readonly string[]).includes(suited)) {
    throw new Error("invalid_mentor_mentee_type");
  }
}

function validateMenteeStructured(payload: Record<string, unknown>) {
  const goals = parseUniqueStrings(payload.developmentGoals);
  if (goals.length < 1 || goals.length > MAX_MULTI_PICKS) throw new Error("invalid_mentee_goals");
  const allowedG = MENTEE_DEVELOPMENT_GOALS as readonly string[];
  for (const x of goals) {
    if (!allowedG.includes(x)) throw new Error("invalid_mentee_goals");
  }
  const pref =
    typeof payload.preferredMentorshipStyle === "string" ? payload.preferredMentorshipStyle.trim() : "";
  if (!(MENTEE_PREFERRED_MENTORSHIP_STYLES as readonly string[]).includes(pref)) {
    throw new Error("invalid_mentee_style");
  }
  const lvl =
    typeof payload.mentorLevelLookingFor === "string" ? payload.mentorLevelLookingFor.trim() : "";
  if (!(MENTEE_MENTOR_LEVEL_PREFERENCE as readonly string[]).includes(lvl)) {
    throw new Error("invalid_mentee_mentor_level");
  }
}

function trunc(s: unknown, max: number): string {
  const t = typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const MIN_ESSAY_WORDS = 50;

function countWords(s: unknown): number {
  const t = typeof s === "string" ? s.trim() : "";
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function validateApplicationPayload(payload: unknown) {
  if (!isRecord(payload)) throw new Error("invalid_payload");
  if (payload.role !== "mentor" && payload.role !== "mentee") throw new Error("invalid_role");
  if (typeof payload.email !== "string" || !normalizeEmail(payload.email).includes("@")) {
    throw new Error("invalid_email");
  }
  if (typeof payload.name !== "string" || !payload.name.trim()) throw new Error("invalid_name");
  if (payload.role === "mentor") {
    const jobTitle = typeof payload.jobTitle === "string" ? payload.jobTitle.trim() : "";
    if (!jobTitle || !isAllowedTitle(MENTOR_JOB_TITLES, jobTitle)) throw new Error("invalid_job_title");
    if (typeof payload.teachingAreas !== "string" || !payload.teachingAreas.trim()) {
      throw new Error("invalid_teaching_areas");
    }
    if (countWords(payload.teachingAreas) < MIN_ESSAY_WORDS) {
      throw new Error("invalid_teaching_word_count");
    }
    const capRaw = payload.menteeCapacity;
    const cap = typeof capRaw === "number" ? capRaw : Number(capRaw);
    if (!Number.isFinite(cap) || cap < 1 || cap > 5 || ![1, 2, 3, 4, 5].includes(cap)) {
      throw new Error("invalid_capacity");
    }
    validateMentorStructured(payload);
  } else {
    const jobTitle = typeof payload.jobTitle === "string" ? payload.jobTitle.trim() : "";
    if (!jobTitle || !isAllowedTitle(MENTEE_JOB_TITLES, jobTitle)) throw new Error("invalid_job_title");
    if (typeof payload.coachingAreas !== "string" || !payload.coachingAreas.trim()) {
      throw new Error("invalid_coaching");
    }
    if (countWords(payload.coachingAreas) < MIN_ESSAY_WORDS) {
      throw new Error("invalid_coaching_word_count");
    }
    validateMenteeStructured(payload);
  }
}

type AppRow = {
  id: string;
  role: string;
  payload: Record<string, unknown>;
};

function normOneSpace(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

/** Rationale must not invent a different "fit %" than the JSON score field. */
function rationaleUsesForbiddenScoreLanguage(rationale: string): boolean {
  if (/\d{1,3}\s*%/.test(rationale)) return true;
  const l = rationale.toLowerCase();
  const banned = [
    "programmatic fit",
    "putting the scoring together",
    "% fit",
    "percent fit",
    "algorithmic match",
    "match engine",
    "confidence score",
  ];
  return banned.some((b) => l.includes(b));
}

/** Normalize text so model output can still match user essays (quotes, dashes, unicode). */
function normalizeForAnchoring(s: string): string {
  return normOneSpace(s)
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...");
}

/** Essays + dropdown answers merged so rationales can anchor on structured selections too. */
function mentorAnchorBlob(mp: Record<string, unknown>): string {
  const fa = Array.isArray(mp.mentorFocusAreas)
    ? mp.mentorFocusAreas.filter((x): x is string => typeof x === "string").join("; ")
    : "";
  return [mp.teachingAreas, fa, mp.mentorshipStyle, mp.bestSuitedMentee, mp.jobTitle]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function menteeAnchorBlob(ep: Record<string, unknown>): string {
  const dg = Array.isArray(ep.developmentGoals)
    ? ep.developmentGoals.filter((x): x is string => typeof x === "string").join("; ")
    : "";
  return [ep.coachingAreas, dg, ep.preferredMentorshipStyle, ep.mentorLevelLookingFor, ep.jobTitle]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Require overlap with each side’s application text so rationales cannot be fully generic.
 * Checks are case-insensitive and punctuation-tolerant; we try several substrings, then
 * consecutive word windows, because models often paraphrase punctuation while keeping words.
 */
function rationaleAnchoredToBothApplications(
  mp: Record<string, unknown>,
  ep: Record<string, unknown>,
  rationale: string,
): boolean {
  const r = normalizeForAnchoring(rationale).toLowerCase();

  const charAnchorsProve = (field: unknown): boolean => {
    const f = normalizeForAnchoring(String(field ?? ""));
    if (!f) return false;
    const fl = f.toLowerCase();
    if (fl.length < 8) return r.includes(fl);
    if (fl.length <= 28) return r.includes(fl);

    const targetLen = 18;
    const fracs = [0, 0.1, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8];
    for (const frac of fracs) {
      const start = Math.floor(f.length * frac);
      const frag = f.slice(start, start + targetLen).toLowerCase();
      if (frag.length >= 10 && r.includes(frag)) return true;
    }
    const tail = f.slice(Math.max(0, f.length - 22)).toLowerCase();
    if (tail.length >= 10 && r.includes(tail)) return true;
    return r.includes(f.slice(0, 22).toLowerCase());
  };

  /** Five consecutive words from the essay appear in order in the rationale (verbatim words). */
  const wordWindowProves = (field: unknown): boolean => {
    const f = normalizeForAnchoring(String(field ?? ""));
    const words = f.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 5) return false;
    const step = Math.max(1, Math.floor(words.length / 24));
    for (let i = 0; i + 5 <= words.length; i += step) {
      const phrase = words.slice(i, i + 5).join(" ").toLowerCase();
      if (phrase.length >= 18 && r.includes(phrase)) return true;
    }
    return false;
  };

  const fieldProves = (field: unknown): boolean => {
    return charAnchorsProve(field) || wordWindowProves(field);
  };

  return fieldProves(mentorAnchorBlob(mp)) && fieldProves(menteeAnchorBlob(ep));
}

function slimForModel(rows: AppRow[]) {
  return rows.map((r) => {
    const p = r.payload;
    if (r.role === "mentor") {
      return {
        id: r.id,
        role: "mentor",
        name: p.name,
        email: p.email,
        jobTitle: p.jobTitle,
        menteeCapacity: p.menteeCapacity,
        mentorFocusAreas: Array.isArray(p.mentorFocusAreas) ? p.mentorFocusAreas : [],
        mentorshipStyle: p.mentorshipStyle,
        bestSuitedMentee: p.bestSuitedMentee,
        teachingAreas: trunc(p.teachingAreas, 4500),
      };
    }
    return {
      id: r.id,
      role: "mentee",
      name: p.name,
      email: p.email,
      jobTitle: p.jobTitle,
      developmentGoals: Array.isArray(p.developmentGoals) ? p.developmentGoals : [],
      preferredMentorshipStyle: p.preferredMentorshipStyle,
      mentorLevelLookingFor: p.mentorLevelLookingFor,
      coachingAreas: trunc(p.coachingAreas, 4500),
    };
  });
}

function validateLlmPairs(
  pairs: unknown,
  mentorById: Map<string, AppRow>,
  menteeById: Map<string, AppRow>,
  opts?: { rationaleCharCap?: number },
): { mentorId: string; menteeId: string; score: number; rationale: string }[] {
  const rationaleMax = (opts?.rationaleCharCap ?? 1200) + 200;
  if (!Array.isArray(pairs)) throw new Error("llm_pairs_not_array");
  const usedMentees = new Set<string>();
  const mentorCounts = new Map<string, number>();
  const out: { mentorId: string; menteeId: string; score: number; rationale: string }[] = [];

  for (const raw of pairs) {
    if (!isRecord(raw)) throw new Error("llm_pair_invalid");
    const mentorId = typeof raw.mentorId === "string" ? raw.mentorId : "";
    const menteeId = typeof raw.menteeId === "string" ? raw.menteeId : "";
    const rationale = typeof raw.rationale === "string" ? raw.rationale : "";
    const scoreRaw = raw.score;
    let score =
      typeof scoreRaw === "number" && Number.isFinite(scoreRaw)
        ? scoreRaw
        : typeof scoreRaw === "string" && Number.isFinite(Number(scoreRaw))
        ? Number(scoreRaw)
        : 0.75;
    if (score > 1 && score <= 100) score = score / 100;
    score = Math.min(1, Math.max(0, score));

    const mRow = mentorById.get(mentorId);
    const eRow = menteeById.get(menteeId);
    if (!mRow || !eRow) throw new Error("llm_unknown_id");
    const mp = mRow.payload;
    const ep = eRow.payload;

    const mj = String(mp.jobTitle ?? "").trim();
    const ej = String(ep.jobTitle ?? "").trim();
    if (!mentorOutranksMentee(mj, ej)) {
      throw new Error("llm_invalid_seniority");
    }

    const cap = Number(mp.menteeCapacity);
    if (!Number.isFinite(cap) || cap < 1 || cap > 5) throw new Error("llm_bad_capacity");
    const prev = mentorCounts.get(mentorId) ?? 0;
    if (prev + 1 > cap) throw new Error("llm_capacity_exceeded");
    mentorCounts.set(mentorId, prev + 1);

    if (usedMentees.has(menteeId)) throw new Error("llm_duplicate_mentee");
    usedMentees.add(menteeId);

    if (rationale.trim().length < 220) throw new Error("llm_rationale_too_short");
    if (rationale.length > rationaleMax) throw new Error("llm_rationale_too_long");
    if (!rationale.includes("\n\n")) throw new Error("llm_rationale_not_two_paragraphs");
    if (rationaleUsesForbiddenScoreLanguage(rationale)) {
      throw new Error("llm_rationale_forbidden_score_language");
    }
    if (!rationaleAnchoredToBothApplications(mp, ep, rationale)) {
      throw new Error("llm_rationale_not_grounded_in_applications");
    }

    out.push({ mentorId, menteeId, score, rationale: rationale.trim() });
  }
  return out;
}

type LlmRouting = "gemini_direct" | "anthropic_direct" | "openai_direct";

type LlmGatewayMeta = {
  gateway: "gemini" | "anthropic" | "openai";
  routing: LlmRouting;
  chatUrlHost: string;
};

function getGeminiApiKey(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_AI_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_API_KEY")?.trim() ||
    undefined;
}

function extractGeminiText(json: Record<string, unknown>): string {
  const candidates = json.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const c0 = candidates[0];
  if (!isRecord(c0)) return "";
  const content = c0.content;
  if (!isRecord(content)) return "";
  const parts = content.parts;
  if (!Array.isArray(parts)) return "";
  const texts: string[] = [];
  for (const p of parts) {
    if (isRecord(p) && typeof p.text === "string") texts.push(p.text);
  }
  return texts.join("");
}

function extractAnthropicText(json: Record<string, unknown>): string {
  const content = json.content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("");
}

/** Strip optional ```json fences (leading and/or wrapping the whole payload). */
function unwrapMarkdownJsonFences(s: string): string {
  let t = s.trim();
  const wrapped = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/im.exec(t);
  if (wrapped?.[1]) return wrapped[1].trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/u, "").trim();
  }
  return t;
}

/**
 * Extract the first top-level JSON object, respecting strings so braces inside rationales
 * do not end the object early.
 */
function extractBalancedJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseModelJsonOutput(raw: string): unknown {
  const cleaned = unwrapMarkdownJsonFences(raw.trim());
  try {
    return JSON.parse(cleaned);
  } catch {
    const slice = extractBalancedJsonObject(cleaned);
    if (slice) {
      try {
        return JSON.parse(slice);
      } catch {
        /* fall through */
      }
    }
    throw new Error("llm_invalid_json");
  }
}

function geminiFinishReason(oaJson: Record<string, unknown>): string | undefined {
  const candidates = oaJson.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  const c0 = candidates[0];
  if (!isRecord(c0)) return undefined;
  return typeof c0.finishReason === "string" ? c0.finishReason : undefined;
}

/** Non-secret snapshot for admin diagnostics (matches routing logic below). */
function getLlmEnvSummary(): {
  gateway: "gemini" | "anthropic" | "openai" | "none";
  routing: string;
  geminiModel: string;
  geminiKeyPresent: boolean;
  openaiModel: string;
  anthropicModel: string;
  anthropicKeyPresent: boolean;
  openaiKeyPresent: boolean;
} {
  const geminiKeyPresent = Boolean(getGeminiApiKey());
  const geminiModel = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.0-flash";
  const openaiKeyPresent = Boolean(Deno.env.get("OPENAI_API_KEY")?.trim());
  const anthropicKeyPresent = Boolean(Deno.env.get("ANTHROPIC_API_KEY")?.trim());
  const openaiModel = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4o-mini";
  const anthropicModel =
    Deno.env.get("ANTHROPIC_MODEL")?.trim() ||
    Deno.env.get("CLAUDE_MODEL")?.trim() ||
    "claude-3-5-sonnet-20241022";

  if (geminiKeyPresent) {
    return {
      gateway: "gemini",
      routing: "gemini_direct",
      geminiModel,
      geminiKeyPresent: true,
      openaiModel,
      anthropicModel,
      anthropicKeyPresent,
      openaiKeyPresent,
    };
  }
  if (anthropicKeyPresent) {
    return {
      gateway: "anthropic",
      routing: "anthropic_direct",
      geminiModel,
      geminiKeyPresent: false,
      openaiModel,
      anthropicModel,
      anthropicKeyPresent: true,
      openaiKeyPresent,
    };
  }
  let gateway: "openai" | "none" = "none";
  let routing = "missing_llm_credentials";
  if (openaiKeyPresent) {
    gateway = "openai";
    routing = "openai_direct";
  }
  return {
    gateway,
    routing,
    geminiModel,
    geminiKeyPresent: false,
    openaiModel,
    anthropicModel,
    anthropicKeyPresent: false,
    openaiKeyPresent,
  };
}

type LlmTransport =
  | {
    family: "gemini";
    url: string;
    headers: Record<string, string>;
    meta: LlmGatewayMeta;
    model: string;
  }
  | {
    family: "anthropic";
    url: string;
    headers: Record<string, string>;
    meta: LlmGatewayMeta;
    model: string;
  }
  | {
    family: "openai_chat";
    url: string;
    headers: Record<string, string>;
    meta: LlmGatewayMeta;
    model: string;
  };

/** Gemini (Google AI Studio) first, then Anthropic, then OpenAI direct. */
function resolveLlmTransport(): LlmTransport {
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.0-flash";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    return {
      family: "gemini",
      url,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      meta: {
        gateway: "gemini",
        routing: "gemini_direct",
        chatUrlHost: "generativelanguage.googleapis.com",
      },
      model,
    };
  }
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (anthropicKey) {
    const model =
      Deno.env.get("ANTHROPIC_MODEL")?.trim() ||
      Deno.env.get("CLAUDE_MODEL")?.trim() ||
      "claude-3-5-sonnet-20241022";
    return {
      family: "anthropic",
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      meta: {
        gateway: "anthropic",
        routing: "anthropic_direct",
        chatUrlHost: "api.anthropic.com",
      },
      model,
    };
  }
  const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (openaiKey) {
    const model = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4o-mini";
    return {
      family: "openai_chat",
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      meta: { gateway: "openai", routing: "openai_direct", chatUrlHost: "api.openai.com" },
      model,
    };
  }
  throw new Error("missing_llm_credentials");
}

async function runAiMatchWithLlm(
  supabase: ReturnType<typeof requireServiceClient>,
): Promise<{
  matches: Json[];
  model: string;
  usage: Record<string, unknown>;
  llm: LlmGatewayMeta & { modelRequested: string; modelReported: string | null };
}> {
  const transport = resolveLlmTransport();
  const model = transport.model;
  const llmMeta = transport.meta;

  const { data: appsRaw, error: aErr } = await withPostgrestRetry(async () =>
    await supabase.from("applications").select("id,role,payload").order("created_at", { ascending: true })
  );
  if (aErr) throw aErr;
  const apps = (appsRaw ?? []) as AppRow[];
  const mentors = apps.filter((a) => a.role === "mentor");
  const mentees = apps.filter((a) => a.role === "mentee");
  if (mentors.length === 0 || mentees.length === 0) {
    throw new Error("need_at_least_one_mentor_and_one_mentee");
  }

  const mentorById = new Map(mentors.map((m) => [m.id, m]));
  const menteeById = new Map(mentees.map((m) => [m.id, m]));

  const { data: ps, error: psErr } = await withPostgrestRetry(async () =>
    await supabase.from("program_state").select("published").eq("id", 1).maybeSingle()
  );
  if (psErr) throw psErr;
  const published = Boolean(ps?.published);
  const menteeCount = mentees.length;
  /**
   * Per-completion output budget (generationConfig.maxOutputTokens). This is NOT the same as
   * AI Studio "TPM" — TPM is tokens/minute across all traffic; maxOutputTokens is how long ONE
   * response may be before Gemini stops with finishReason MAX_TOKENS (truncated JSON).
   */
  const rationaleCharCap = menteeCount > 22 ? 580 : menteeCount > 14 ? 720 : menteeCount > 8 ? 900 : 1200;
  const GEMINI_OUTPUT_HARD_CAP = 65_536;
  const geminiMaxOutFromEnv = Deno.env.get("GEMINI_MAX_OUTPUT_TOKENS")?.trim();
  const geminiMaxOutParsed = geminiMaxOutFromEnv ? Number(geminiMaxOutFromEnv) : NaN;
  /** Default scales with mentee count so small pilots work without secrets; override via GEMINI_MAX_OUTPUT_TOKENS. */
  const geminiMaxOutDefault = Math.min(
    GEMINI_OUTPUT_HARD_CAP,
    Math.max(12_288, 2200 + menteeCount * 1600),
  );
  const geminiMaxOut = Number.isFinite(geminiMaxOutParsed) && geminiMaxOutParsed >= 1024
    ? Math.min(GEMINI_OUTPUT_HARD_CAP, Math.floor(geminiMaxOutParsed))
    : geminiMaxOutDefault;
  const anthropicMaxOut = Math.min(
    16_384,
    Math.max(4096, Number(Deno.env.get("ANTHROPIC_MAX_OUTPUT_TOKENS") ?? "8192") || 8192),
  );
  const openaiMaxOut = Math.min(
    16_384,
    Math.max(4096, Number(Deno.env.get("OPENAI_MAX_OUTPUT_TOKENS") ?? "16000") || 16000),
  );

  const system = [
    "You are an expert internal mentorship matcher. You only know what appears in the JSON blobs provided in the user message.",
    "You must output ONLY valid JSON matching the schema described by the user message (no markdown, no commentary).",
    "Never invent details (metrics, projects, prior roles, or quotes) that are not explicitly present in MENTORS_JSON or MENTEES_JSON.",
  ].join(" ");

  const user = [
    "MATCHING RULES (hard constraints):",
    "- Pair each mentee with at most one mentor.",
    "- A mentor may have multiple mentees ONLY up to their menteeCapacity (1–5). Never exceed capacity.",
    "- Seniority: the mentor's jobTitle MUST be strictly more senior than the mentee's jobTitle on this ladder (low→high): Associate, Senior Associate, Associate Manager, Manager, Senior Manager, Director, Senior Director. Same title or mentor more junior than mentee is forbidden.",
    "- Primary fit signals: (1) overlap between mentorFocusAreas and developmentGoals (same or closely related themes); (2) alignment between mentorshipStyle and preferredMentorshipStyle; (3) whether bestSuitedMentee matches the mentee's likely career stage implied by jobTitle + goals; (4) mentorLevelLookingFor vs actual title gap (e.g. \"2+ levels above\" needs a mentor several rungs up when possible); (5) teachingAreas vs coachingAreas narrative overlap. Use jobTitle for the seniority rule first.",
    "",
    "SCORE FIELD (must stay consistent with your prose):",
    "- \"score\" is a single float STRICTLY between 0 and 1 (e.g. 0.62), reflecting how strong the substantive fit is given ONLY the JSON fields.",
    "- Do NOT mention percentages, \"fit scores\", \"programmatic\" language, \"algorithms\", or any second numeric ranking in the rationale. The rationale is read by humans; the score column shows the number.",
    "- If fit is moderate, write in a moderate tone; do not call a modest fit \"excellent\" or \"near-perfect\".",
    "",
    "OUTPUT JSON SHAPE:",
    '{"pairs":[{"mentorId":"<uuid>","menteeId":"<uuid>","score":0.0,"rationale":"<string>"}]}',
    "",
    "RATIONALE REQUIREMENTS:",
    "- Write in natural, human prose (not bullet templates).",
    `- HARD OUTPUT CAP: each "rationale" must be at most ${rationaleCharCap} characters (count letters/spaces/punctuation). With ${menteeCount} mentees, longer rationales risk cutting off the JSON and failing the whole run. Shorter paragraphs are fine.`,
    "- Use AT LEAST TWO paragraphs separated by a blank line (two newline characters: \\n\\n).",
    "- In the FIRST paragraph: synthesize the mentor (teachingAreas, mentorFocusAreas, mentorshipStyle, bestSuitedMentee) and the mentee (coachingAreas, developmentGoals, preferredMentorshipStyle, mentorLevelLookingFor). You MUST include at least one contiguous substring of at least 18 characters copied exactly from that mentor's teachingAreas OR from a selected mentorFocusAreas string, AND one of at least 18 characters from the mentee's coachingAreas OR from a selected developmentGoals string — all from MENTORS_JSON / MENTEES_JSON (same letters, spaces, punctuation). Put each substring inside straight double quotes so it stays exact.",
    "- In the SECOND paragraph: explain why this pairing is likely to work in practice; reference at least one structured choice (focus area, goal, or style) and name 1–2 concrete focus areas for the first 2–3 sessions.",
    "- Avoid generic filler (\"synergy\", \"unlock value\", \"best-in-class\", \"leverage\", \"circle back\"). Prefer concrete nouns and verbs taken from their answers.",
    "",
    "MENTORS_JSON:",
    JSON.stringify(slimForModel(mentors)),
    "",
    "MENTEES_JSON:",
    JSON.stringify(slimForModel(mentees)),
  ].join("\n");

  const systemForAnthropic =
    `${system} Output must be a single raw JSON object only (no markdown code fences, no text before or after the JSON).`;

  const geminiBody = {
    systemInstruction: { parts: [{ text: `${system} Output only valid JSON for the schema; no markdown fences.` }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.22,
      maxOutputTokens: geminiMaxOut,
      responseMimeType: "application/json",
    },
  };

  const oaRes = await fetch(transport.url, {
    method: "POST",
    headers: transport.headers,
    body: JSON.stringify(
      transport.family === "gemini"
        ? geminiBody
        : transport.family === "anthropic"
        ? {
          model: transport.model,
          max_tokens: anthropicMaxOut,
          temperature: 0.22,
          system: systemForAnthropic,
          messages: [{ role: "user", content: user }],
        }
        : {
          model: transport.model,
          temperature: 0.22,
          max_tokens: openaiMaxOut,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
    ),
  });

  const oaJson = (await oaRes.json()) as Record<string, unknown>;
  if (!oaRes.ok) {
    let msg: string;
    if (transport.family === "gemini") {
      const er = oaJson.error;
      msg = isRecord(er) && typeof er.message === "string"
        ? String(er.message)
        : JSON.stringify(oaJson);
    } else if (transport.family === "anthropic") {
      const er = oaJson.error;
      msg = isRecord(er) && typeof er.message === "string"
        ? String(er.message)
        : (typeof oaJson.message === "string" ? oaJson.message : JSON.stringify(oaJson));
    } else {
      msg = typeof oaJson.error === "object" && oaJson.error !== null &&
          typeof (oaJson.error as Record<string, unknown>).message === "string"
        ? String((oaJson.error as Record<string, unknown>).message)
        : await oaRes.text();
    }
    throw new Error(`llm_http_${oaRes.status}: ${msg}`);
  }

  let content: string;
  if (transport.family === "gemini") {
    const fr = geminiFinishReason(oaJson);
    if (fr === "MAX_TOKENS") {
      throw new Error("llm_output_truncated");
    }
    content = extractGeminiText(oaJson);
  } else if (transport.family === "anthropic") {
    const sr = typeof oaJson.stop_reason === "string" ? oaJson.stop_reason : "";
    if (sr === "max_tokens") throw new Error("llm_output_truncated");
    content = extractAnthropicText(oaJson);
  } else {
    const choices = oaJson.choices as unknown[] | undefined;
    const first = Array.isArray(choices) && choices.length > 0 ? choices[0] : null;
    const finish =
      first && isRecord(first) && typeof first.finish_reason === "string"
        ? String(first.finish_reason)
        : "";
    if (finish === "length") throw new Error("llm_output_truncated");
    const message = first && isRecord(first) && isRecord(first.message)
      ? first.message
      : null;
    content = message && typeof message.content === "string" ? message.content : "";
  }
  if (!content.trim()) throw new Error("llm_empty_content");

  let parsed: unknown;
  try {
    parsed = parseModelJsonOutput(content);
  } catch (e) {
    if (e instanceof Error && e.message === "llm_invalid_json") {
      const head = content.slice(0, 280).replace(/\s+/g, " ");
      const tail = content.slice(Math.max(0, content.length - 280)).replace(/\s+/g, " ");
      console.error("llm_invalid_json: parse failed. head=", head, "tail=", tail, "len=", content.length);
    }
    throw e instanceof Error ? e : new Error("llm_invalid_json");
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.pairs)) throw new Error("llm_missing_pairs");

  const matches = validateLlmPairs(parsed.pairs, mentorById, menteeById, {
    rationaleCharCap,
  });

  const { error: upErr } = await withPostgrestRetry(async () =>
    await supabase.from("program_state").upsert({
      id: 1,
      published,
      matches,
      updated_at: new Date().toISOString(),
    })
  );
  if (upErr) throw upErr;

  const usage = transport.family === "gemini" && isRecord(oaJson.usageMetadata)
    ? oaJson.usageMetadata
    : isRecord(oaJson.usage)
    ? oaJson.usage
    : {};
  const modelReported = transport.family === "gemini"
    ? (typeof oaJson.modelVersion === "string" ? oaJson.modelVersion : null)
    : typeof oaJson.model === "string"
    ? oaJson.model
    : null;
  return {
    matches: matches as unknown as Json[],
    model,
    usage,
    llm: {
      ...llmMeta,
      modelRequested: model,
      modelReported,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const action = body.action;
  if (typeof action !== "string") {
    return jsonResponse({ ok: false, error: "missing_action" }, 400);
  }

  try {
    const supabase = requireServiceClient();

    if (action === "programStatus") {
      const { data, error } = await withPostgrestRetry(async () =>
        await supabase.from("program_state").select("published").eq("id", 1).maybeSingle()
      );
      if (error) throw error;
      return jsonResponse({ ok: true, published: Boolean(data?.published) });
    }

    if (action === "submitApplication") {
      const payload = body.payload;
      try {
        validateApplicationPayload(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "invalid_payload";
        return jsonResponse({ ok: false, error: msg }, 400);
      }
      const p = payload as Record<string, unknown>;
      const email = normalizeEmail(p.email as string);
      const row = {
        email: (p.email as string).trim(),
        email_normalized: email,
        role: p.role as string,
        payload,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await withPostgrestRetry(async () =>
        await supabase.from("applications").upsert(row, {
          onConflict: "email_normalized,role",
        }).select("id,email,role,payload,created_at,updated_at").single()
      );
      if (error) throw error;
      return jsonResponse({ ok: true, application: data });
    }

    if (action === "lookupMatch") {
      const emailRaw = body.email;
      if (typeof emailRaw !== "string" || !emailRaw.trim()) {
        return jsonResponse({ ok: false, error: "missing_email" }, 400);
      }
      const norm = normalizeEmail(emailRaw);
      const { data: ps, error: psErr } = await withPostgrestRetry(async () =>
        await supabase.from("program_state").select("published,matches").eq("id", 1).maybeSingle()
      );
      if (psErr) throw psErr;
      if (!ps?.published) {
        return jsonResponse({ ok: true, published: false, items: [] });
      }
      const { data: apps, error: aErr } = await withPostgrestRetry(async () =>
        await supabase.from("applications").select("id,email,role,payload,created_at,updated_at").eq(
          "email_normalized",
          norm,
        )
      );
      if (aErr) throw aErr;
      if (!apps?.length) {
        return jsonResponse({ ok: true, published: true, items: [] });
      }
      const matches = (ps.matches ?? []) as Array<{
        mentorId: string;
        menteeId: string;
        rationale: string;
        score: number;
      }>;
      const items: Json[] = [];
      for (const row of apps) {
        const rid = row.id as string;
        const role = row.role as string;
        const related = matches.filter((m) =>
          role === "mentor" ? m.mentorId === rid : m.menteeId === rid
        );
        if (related.length === 0) continue;
        const pSelf = row.payload as Record<string, unknown>;
        const capRaw = role === "mentor" ? pSelf.menteeCapacity : undefined;
        const capN = typeof capRaw === "number" ? capRaw : Number(capRaw);
        const menteeCapacitySignedUp =
          role === "mentor" && Number.isFinite(capN) && capN >= 1 && capN <= 5 ? capN : null;

        for (const pair of related) {
          const counterpartId = role === "mentor" ? pair.menteeId : pair.mentorId;
          const { data: cp } = await withPostgrestRetry(async () =>
            await supabase.from("applications").select("payload,role").eq("id", counterpartId).maybeSingle()
          );
          const pCp = (cp?.payload ?? {}) as Record<string, unknown>;
          items.push({
            yourRole: role,
            yourName: String(pSelf.name ?? ""),
            counterpartName: String(pCp.name ?? ""),
            counterpartRole: String(cp?.role ?? ""),
            rationale: pair.rationale,
            score: pair.score,
            menteeCapacitySignedUp,
            mentorMatchTotal: role === "mentor" ? related.length : null,
          });
        }
      }
      return jsonResponse({ ok: true, published: true, items });
    }

    assertAdmin(req);

    if (action === "llmConfig") {
      return jsonResponse({ ok: true, ...getLlmEnvSummary() });
    }

    if (action === "llmPing") {
      const env = getLlmEnvSummary();
      if (env.gateway === "none") {
        return jsonResponse({ ok: false, error: env.routing });
      }
      let transport: LlmTransport;
      try {
        transport = resolveLlmTransport();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "missing_llm_credentials";
        return jsonResponse({ ok: false, error: msg });
      }
      const pingModel = transport.model;
      const t0 = Date.now();
      const oaRes = await fetch(transport.url, {
        method: "POST",
        headers: transport.headers,
        body: JSON.stringify(
          transport.family === "gemini"
            ? {
              contents: [{ role: "user", parts: [{ text: "Reply with exactly: ok" }] }],
              generationConfig: { maxOutputTokens: 24, temperature: 0 },
            }
            : transport.family === "anthropic"
            ? {
              model: transport.model,
              max_tokens: 20,
              temperature: 0,
              messages: [{ role: "user", content: "Reply with exactly: ok" }],
            }
            : {
              model: transport.model,
              max_tokens: 4,
              temperature: 0,
              messages: [{ role: "user", content: "Reply with exactly: ok" }],
            },
        ),
      });
      const latencyMs = Date.now() - t0;
      let oaJson: Record<string, unknown> = {};
      try {
        oaJson = (await oaRes.json()) as Record<string, unknown>;
      } catch {
        /* body not json */
      }
      const modelReported = transport.family === "gemini"
        ? (typeof oaJson.modelVersion === "string" ? oaJson.modelVersion : null)
        : typeof oaJson.model === "string"
        ? oaJson.model
        : null;
      const errMsg = transport.family === "gemini"
        ? (isRecord(oaJson.error) && typeof (oaJson.error as Record<string, unknown>).message === "string"
          ? String((oaJson.error as Record<string, unknown>).message)
          : null)
        : transport.family === "anthropic"
        ? (isRecord(oaJson.error) && typeof (oaJson.error as Record<string, unknown>).message === "string"
          ? String((oaJson.error as Record<string, unknown>).message)
          : null)
        : (typeof oaJson.error === "object" && oaJson.error !== null &&
            typeof (oaJson.error as Record<string, unknown>).message === "string"
          ? String((oaJson.error as Record<string, unknown>).message)
          : null);
      if (!oaRes.ok) {
        return jsonResponse({
          ok: false,
          error: `llm_ping_http_${oaRes.status}`,
          detail: errMsg,
          latencyMs,
          ...transport.meta,
          modelRequested: pingModel,
          modelReported,
        });
      }
      return jsonResponse({
        ok: true,
        latencyMs,
        ...transport.meta,
        modelRequested: pingModel,
        modelReported,
      });
    }

    if (action === "runAiMatch") {
      const { matches, model, usage, llm } = await runAiMatchWithLlm(supabase);
      return jsonResponse({ ok: true, matches, model, usage, llm });
    }

    if (action === "listApplications") {
      const { data, error } = await withPostgrestRetry(async () =>
        await supabase.from("applications").select("id,email,role,payload,created_at,updated_at").order(
          "created_at",
          { ascending: false },
        )
      );
      if (error) throw error;
      return jsonResponse({ ok: true, applications: data ?? [] });
    }

    if (action === "getProgramState") {
      const { data, error } = await withPostgrestRetry(async () =>
        await supabase.from("program_state").select("*").eq("id", 1).maybeSingle()
      );
      if (error) throw error;
      return jsonResponse({
        ok: true,
        program: {
          published: Boolean(data?.published),
          matches: data?.matches ?? [],
          updatedAt: data?.updated_at ?? new Date().toISOString(),
        },
      });
    }

    if (action === "setProgramState") {
      const published = Boolean(body.published);
      const matches = body.matches;
      if (!Array.isArray(matches)) return jsonResponse({ ok: false, error: "invalid_matches" }, 400);
      const { error } = await withPostgrestRetry(async () =>
        await supabase.from("program_state").upsert({
          id: 1,
          published,
          matches,
          updated_at: new Date().toISOString(),
        })
      );
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "updateApplication") {
      const id = body.id;
      const payload = body.payload;
      if (typeof id !== "string" || !isRecord(payload)) {
        return jsonResponse({ ok: false, error: "invalid_update" }, 400);
      }
      try {
        validateApplicationPayload(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "invalid_payload";
        return jsonResponse({ ok: false, error: msg }, 400);
      }
      const p = payload as Record<string, unknown>;
      const email = normalizeEmail(p.email as string);
      const { data, error } = await withPostgrestRetry(async () =>
        await supabase.from("applications").update({
          email: (p.email as string).trim(),
          email_normalized: email,
          role: p.role as string,
          payload,
          updated_at: new Date().toISOString(),
        }).eq("id", id).select("id,email,role,payload,created_at,updated_at").single()
      );
      if (error) throw error;
      return jsonResponse({ ok: true, application: data });
    }

    if (action === "deleteApplication") {
      const id = body.id;
      if (typeof id !== "string") return jsonResponse({ ok: false, error: "missing_id" }, 400);

      const { data: ps, error: psErr } = await withPostgrestRetry(async () =>
        await supabase.from("program_state").select("matches").eq("id", 1).maybeSingle()
      );
      if (psErr) throw psErr;
      const matches = (ps?.matches ?? []) as Array<{ mentorId: string; menteeId: string }>;
      const nextMatches = matches.filter((m) => m.mentorId !== id && m.menteeId !== id);
      const { error: uErr } = await withPostgrestRetry(async () =>
        await supabase.from("program_state").update({
          matches: nextMatches,
          updated_at: new Date().toISOString(),
        }).eq("id", 1)
      );
      if (uErr) throw uErr;

      const { error: dErr } = await withPostgrestRetry(async () =>
        await supabase.from("applications").delete().eq("id", id)
      );
      if (dErr) throw dErr;
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "unauthorized") return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    if (msg === "missing_llm_credentials" || msg === "need_at_least_one_mentor_and_one_mentee") {
      return jsonResponse({ ok: false, error: msg }, 400);
    }
    if (msg.startsWith("llm_")) {
      return jsonResponse({ ok: false, error: msg }, 422);
    }
    console.error(e);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
