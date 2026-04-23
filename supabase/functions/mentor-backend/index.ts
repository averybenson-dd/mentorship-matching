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

const DOORDASH_VALUES = [
  "Be an owner",
  "Bias for action",
  "Customer obsessed, not competitor-focused",
  "One team, one fight",
  "1% better every day",
  "And, not either/or",
  "Truth seek",
  "Think outside the room",
  "Make room at the table",
  "Operate at the lowest level of detail",
  "Dream big, start small",
  "Choose optimism and have a plan",
] as const;

function trunc(s: unknown, max: number): string {
  const t = typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function validateApplicationPayload(payload: unknown) {
  if (!isRecord(payload)) throw new Error("invalid_payload");
  if (payload.role !== "mentor" && payload.role !== "mentee") throw new Error("invalid_role");
  if (typeof payload.email !== "string" || !normalizeEmail(payload.email).includes("@")) {
    throw new Error("invalid_email");
  }
  if (typeof payload.name !== "string" || !payload.name.trim()) throw new Error("invalid_name");
  if (typeof payload.region !== "string" || !payload.region.trim()) throw new Error("invalid_region");
  if (payload.role === "mentor") {
    if (typeof payload.jobTitle !== "string" || !payload.jobTitle.trim()) throw new Error("invalid_job_title");
    if (typeof payload.teachingAreas !== "string" || !payload.teachingAreas.trim()) {
      throw new Error("invalid_teaching_areas");
    }
    if (typeof payload.favoriteOrder !== "string" || !payload.favoriteOrder.trim()) {
      throw new Error("invalid_order");
    }
  } else {
    if (typeof payload.team !== "string" || !payload.team.trim()) throw new Error("invalid_team");
    if (!Array.isArray(payload.valuesToDevelop) || payload.valuesToDevelop.length === 0) {
      throw new Error("invalid_values");
    }
    if (typeof payload.coachingAreas !== "string" || !payload.coachingAreas.trim()) {
      throw new Error("invalid_coaching");
    }
    if (typeof payload.favoriteOrder !== "string" || !payload.favoriteOrder.trim()) {
      throw new Error("invalid_order");
    }
    if (payload.jobTitle === "Other") {
      if (typeof payload.jobTitleOther !== "string" || !payload.jobTitleOther.trim()) {
        throw new Error("invalid_job_title_other");
      }
    }
  }
}

type AppRow = {
  id: string;
  role: string;
  payload: Record<string, unknown>;
};

function valueLabel(idx: unknown): string {
  const n = typeof idx === "number" ? idx : Number(idx);
  if (!Number.isFinite(n) || n < 1 || n > DOORDASH_VALUES.length) return "";
  return DOORDASH_VALUES[n - 1] ?? "";
}

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

/**
 * Require verbatim overlap with each side’s application text so rationales cannot be fully generic.
 */
function rationaleAnchoredToBothApplications(
  mp: Record<string, unknown>,
  ep: Record<string, unknown>,
  rationale: string,
): boolean {
  const mentorFields = [mp.teachingAreas, mp.notes, mp.favoriteOrder, mp.jobTitle, mp.region];
  const menteeFields = [ep.coachingAreas, ep.careerNotes, ep.favoriteOrder, ep.team, ep.jobTitle, ep.region];

  const fieldProves = (field: unknown): boolean => {
    const f = normOneSpace(field);
    if (!f) return false;
    if (f.length < 8) return rationale.includes(f);
    if (f.length <= 28) return rationale.includes(f);
    const targetLen = 20;
    const starts = [0, Math.floor(f.length * 0.22), Math.floor(f.length * 0.48)];
    for (const start of starts) {
      const frag = f.slice(start, start + targetLen);
      if (frag.length >= 10 && rationale.includes(frag)) return true;
    }
    return rationale.includes(f.slice(0, 22));
  };

  const mentorOk = mentorFields.some(fieldProves);
  const menteeOk = menteeFields.some(fieldProves);
  return mentorOk && menteeOk;
}

function slimForModel(rows: AppRow[]) {
  return rows.map((r) => {
    const p = r.payload;
    if (r.role === "mentor") {
      const vi = p.valueSuperpower;
      return {
        id: r.id,
        role: "mentor",
        name: p.name,
        email: p.email,
        region: p.region,
        jobTitle: p.jobTitle,
        commitment: p.commitment,
        menteeCapacity: p.menteeCapacity,
        valueSuperpower: valueLabel(vi),
        teachingAreas: trunc(p.teachingAreas, 4500),
        favoriteOrder: trunc(p.favoriteOrder, 900),
        notes: trunc(p.notes, 2000),
      };
    }
    const vals = Array.isArray(p.valuesToDevelop)
      ? (p.valuesToDevelop as unknown[]).map((i) => valueLabel(i)).filter(Boolean)
      : [];
    return {
      id: r.id,
      role: "mentee",
      name: p.name,
      email: p.email,
      region: p.region,
      jobTitle: p.jobTitle === "Other" ? `Other (${p.jobTitleOther})` : p.jobTitle,
      team: trunc(p.team, 400),
      commitment: p.commitment,
      valuesToDevelop: vals,
      coachingAreas: trunc(p.coachingAreas, 4500),
      favoriteOrder: trunc(p.favoriteOrder, 900),
      careerNotes: trunc(p.careerNotes, 2000),
    };
  });
}

function validateLlmPairs(
  pairs: unknown,
  mentorById: Map<string, AppRow>,
  menteeById: Map<string, AppRow>,
): { mentorId: string; menteeId: string; score: number; rationale: string }[] {
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
    if (mp.commitment === "no" || ep.commitment === "no") throw new Error("llm_invalid_commitment_pair");

    const cap = Number(mp.menteeCapacity);
    if (!Number.isFinite(cap) || cap < 1 || cap > 3) throw new Error("llm_bad_capacity");
    const prev = mentorCounts.get(mentorId) ?? 0;
    if (prev + 1 > cap) throw new Error("llm_capacity_exceeded");
    mentorCounts.set(mentorId, prev + 1);

    if (usedMentees.has(menteeId)) throw new Error("llm_duplicate_mentee");
    usedMentees.add(menteeId);

    if (rationale.trim().length < 220) throw new Error("llm_rationale_too_short");
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

type LlmRouting =
  | "anthropic_direct"
  | "virtual_key"
  | "provider_slug"
  | "openai_via_portkey"
  | "openai_direct";

type LlmGatewayMeta = {
  gateway: "anthropic" | "portkey" | "openai";
  routing: LlmRouting;
  chatUrlHost: string;
};

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

/** Claude sometimes wraps JSON in ``` fences even when asked not to. */
function unwrapLeadingCodeFence(s: string): string {
  const t = s.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/u, "").trim();
}

/**
 * Portkey Model Catalog slugs must use `@name` on `x-portkey-provider` (see Portkey inference headers).
 * A bare value like `openai-dasher-logistics` often yields 403; `openai` / `anthropic` stay unchanged.
 */
function formatPortkeyProviderHeader(slug: string): string {
  const s = slug.trim();
  if (!s) return s;
  if (s.startsWith("@")) return s;
  const bare = new Set(["openai", "anthropic", "azure-openai", "google", "groq", "together", "mistral", "cohere"]);
  if (bare.has(s.toLowerCase())) return s;
  return `@${s}`;
}

/** Non-secret snapshot for admin diagnostics (matches routing logic below). */
function getLlmEnvSummary(): {
  gateway: "anthropic" | "portkey" | "openai" | "none";
  routing: string;
  openaiModel: string;
  anthropicModel: string;
  anthropicKeyPresent: boolean;
  portkeyApiKeyPresent: boolean;
  portkeyVirtualKeyPresent: boolean;
  portkeyProviderPresent: boolean;
  /** Value sent on `x-portkey-provider` after catalog `@` normalization (empty if unused). */
  portkeyProviderAsSent: string;
  openaiKeyPresent: boolean;
} {
  const portkeyApiKeyPresent = Boolean(Deno.env.get("PORTKEY_API_KEY")?.trim());
  const portkeyVirtualKeyPresent = Boolean(Deno.env.get("PORTKEY_VIRTUAL_KEY")?.trim());
  const rawProvider = Deno.env.get("PORTKEY_PROVIDER")?.trim() ?? "";
  const portkeyProviderPresent = Boolean(rawProvider);
  const portkeyProviderAsSent = portkeyProviderPresent ? formatPortkeyProviderHeader(rawProvider) : "";
  const openaiKeyPresent = Boolean(Deno.env.get("OPENAI_API_KEY")?.trim());
  const anthropicKeyPresent = Boolean(Deno.env.get("ANTHROPIC_API_KEY")?.trim());
  const openaiModel = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4o-mini";
  const anthropicModel =
    Deno.env.get("ANTHROPIC_MODEL")?.trim() ||
    Deno.env.get("CLAUDE_MODEL")?.trim() ||
    "claude-3-5-sonnet-20241022";

  if (anthropicKeyPresent) {
    return {
      gateway: "anthropic",
      routing: "anthropic_direct",
      openaiModel,
      anthropicModel,
      anthropicKeyPresent: true,
      portkeyApiKeyPresent,
      portkeyVirtualKeyPresent,
      portkeyProviderPresent,
      portkeyProviderAsSent,
      openaiKeyPresent,
    };
  }

  let gateway: "portkey" | "openai" | "none" = "none";
  let routing = "missing_llm_credentials";
  if (portkeyApiKeyPresent) {
    gateway = "portkey";
    if (portkeyVirtualKeyPresent) routing = "virtual_key";
    else if (openaiKeyPresent) routing = "openai_via_portkey";
    else if (portkeyProviderPresent) routing = "provider_slug";
    else routing = "portkey_missing_virtual_key_provider_or_openai";
  } else if (openaiKeyPresent) {
    gateway = "openai";
    routing = "openai_direct";
  }
  return {
    gateway,
    routing,
    openaiModel,
    anthropicModel,
    anthropicKeyPresent: false,
    portkeyApiKeyPresent,
    portkeyVirtualKeyPresent,
    portkeyProviderPresent,
    portkeyProviderAsSent,
    openaiKeyPresent,
  };
}

type LlmTransport =
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

/** Prefer Anthropic (Claude API) when ANTHROPIC_API_KEY is set; else OpenAI-compatible (direct or Portkey). */
function resolveLlmTransport(): LlmTransport {
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
  const o = resolveChatCompletionsRequest();
  const model = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4o-mini";
  return { family: "openai_chat", url: o.url, headers: o.headers, meta: o.meta, model };
}

/** OpenAI direct, or Portkey gateway (https://docs.portkey.ai/docs/api-reference/headers). */
function resolveChatCompletionsRequest(): {
  url: string;
  headers: Record<string, string>;
  meta: LlmGatewayMeta;
} {
  const portkey = Deno.env.get("PORTKEY_API_KEY")?.trim();
  const virtualKey = Deno.env.get("PORTKEY_VIRTUAL_KEY")?.trim();
  const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const providerSlug = Deno.env.get("PORTKEY_PROVIDER")?.trim();

  if (portkey) {
    const headers: Record<string, string> = {
      "x-portkey-api-key": portkey,
      "Content-Type": "application/json",
    };
    let routing: LlmRouting;
    if (virtualKey) {
      headers["x-portkey-virtual-key"] = virtualKey;
      routing = "virtual_key";
    } else if (openaiKey) {
      // Prefer your OpenAI key through Portkey; ignore PORTKEY_PROVIDER when both are set.
      headers["x-portkey-provider"] = "openai";
      headers["Authorization"] = `Bearer ${openaiKey}`;
      routing = "openai_via_portkey";
    } else if (providerSlug) {
      headers["x-portkey-provider"] = formatPortkeyProviderHeader(providerSlug);
      routing = "provider_slug";
    } else {
      throw new Error("missing_portkey_provider");
    }
    const url = "https://api.portkey.ai/v1/chat/completions";
    return { url, headers, meta: { gateway: "portkey", routing, chatUrlHost: "api.portkey.ai" } };
  }
  if (openaiKey) {
    const url = "https://api.openai.com/v1/chat/completions";
    return {
      url,
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      meta: { gateway: "openai", routing: "openai_direct", chatUrlHost: "api.openai.com" },
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

  const numberedValues = DOORDASH_VALUES.map((v, i) => `${i + 1}. ${v}`).join("\n");

  const system = [
    "You are an expert internal mentorship matcher. You only know what appears in the JSON blobs provided in the user message.",
    "You must output ONLY valid JSON matching the schema described by the user message (no markdown, no commentary).",
    "Never invent details (foods, teams, metrics, projects, prior roles, or quotes) that are not explicitly present in MENTORS_JSON or MENTEES_JSON.",
  ].join(" ");

  const user = [
    "DoorDash values list (for context; mentors cite a superpower; mentees cite growth areas):",
    numberedValues,
    "",
    "MATCHING RULES (hard constraints):",
    "- Pair exactly one mentee with at most one mentor per mentee.",
    "- A mentor may have multiple mentees ONLY up to their menteeCapacity (1–3). Never exceed capacity.",
    "- Never pair anyone whose commitment field is \"no\".",
    "- Prefer strong substantive fit: teachingAreas vs coachingAreas, mentor value superpower vs mentee valuesToDevelop, team context, and career notes.",
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
    "- Use AT LEAST TWO paragraphs separated by a blank line (two newline characters: \\n\\n).",
    "- In the FIRST paragraph: synthesize what the mentor said they can teach and what the mentee said they want to learn. You MUST copy at least one short phrase verbatim from that mentor's teachingAreas or notes AND one short phrase verbatim from that mentee's coachingAreas or careerNotes (exact substring as written in MENTORS_JSON / MENTEES_JSON).",
    "- In the SECOND paragraph: explain why this pairing is likely to work in practice (cadence, scope, complementary strengths) and name 1–2 concrete focus areas for the first 2–3 sessions, grounded in their stated interests.",
    "- Avoid generic filler (\"synergy\", \"unlock value\", \"best-in-class\", \"leverage\", \"circle back\"). Prefer concrete nouns and verbs taken from their answers.",
    "- favoriteOrder: only compare or mention orders using the exact favoriteOrder strings from JSON; do not substitute different foods or dishes.",
    "",
    "MENTORS_JSON:",
    JSON.stringify(slimForModel(mentors)),
    "",
    "MENTEES_JSON:",
    JSON.stringify(slimForModel(mentees)),
  ].join("\n");

  const systemForAnthropic =
    `${system} Output must be a single raw JSON object only (no markdown code fences, no text before or after the JSON).`;

  const oaRes = await fetch(transport.url, {
    method: "POST",
    headers: transport.headers,
    body: JSON.stringify(
      transport.family === "anthropic"
        ? {
          model: transport.model,
          max_tokens: 8192,
          temperature: 0.22,
          system: systemForAnthropic,
          messages: [{ role: "user", content: user }],
        }
        : {
          model: transport.model,
          temperature: 0.22,
          max_tokens: 5000,
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
    if (transport.family === "anthropic") {
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
  if (transport.family === "anthropic") {
    content = unwrapLeadingCodeFence(extractAnthropicText(oaJson));
  } else {
    const choices = oaJson.choices as unknown[] | undefined;
    const first = Array.isArray(choices) && choices.length > 0 ? choices[0] : null;
    const message = first && isRecord(first) && isRecord(first.message)
      ? first.message
      : null;
    content = message && typeof message.content === "string" ? message.content : "";
  }
  if (!content.trim()) throw new Error("llm_empty_content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("llm_invalid_json");
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.pairs)) throw new Error("llm_missing_pairs");

  const matches = validateLlmPairs(parsed.pairs, mentorById, menteeById);

  const { error: upErr } = await withPostgrestRetry(async () =>
    await supabase.from("program_state").upsert({
      id: 1,
      published,
      matches,
      updated_at: new Date().toISOString(),
    })
  );
  if (upErr) throw upErr;

  const usage = isRecord(oaJson.usage) ? oaJson.usage : {};
  const modelReported = typeof oaJson.model === "string" ? oaJson.model : null;
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
        const pair = matches.find((m) =>
          role === "mentor" ? m.mentorId === rid : m.menteeId === rid
        );
        if (!pair) continue;
        const counterpartId = role === "mentor" ? pair.menteeId : pair.mentorId;
        const { data: cp } = await withPostgrestRetry(async () =>
          await supabase.from("applications").select("payload,role").eq("id", counterpartId).maybeSingle()
        );
        const pSelf = row.payload as Record<string, unknown>;
        const pCp = (cp?.payload ?? {}) as Record<string, unknown>;
        items.push({
          yourRole: role,
          yourName: String(pSelf.name ?? ""),
          counterpartName: String(pCp.name ?? ""),
          counterpartRole: String(cp?.role ?? ""),
          rationale: pair.rationale,
          score: pair.score,
        });
      }
      return jsonResponse({ ok: true, published: true, items });
    }

    assertAdmin(req);

    if (action === "llmConfig") {
      return jsonResponse({ ok: true, ...getLlmEnvSummary() });
    }

    if (action === "llmPing") {
      const env = getLlmEnvSummary();
      if (env.gateway === "none" || (env.gateway === "portkey" && env.routing.startsWith("portkey_missing"))) {
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
          transport.family === "anthropic"
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
      const modelReported = typeof oaJson.model === "string" ? oaJson.model : null;
      const errMsg = transport.family === "anthropic"
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
    if (
      msg === "missing_llm_credentials" ||
      msg === "missing_portkey_provider" ||
      msg === "need_at_least_one_mentor_and_one_mentee"
    ) {
      return jsonResponse({ ok: false, error: msg }, 400);
    }
    if (msg.startsWith("llm_")) {
      return jsonResponse({ ok: false, error: msg }, 422);
    }
    console.error(e);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
