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
      const { data, error } = await supabase.from("program_state").select("published").eq("id", 1).maybeSingle();
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
      const { data, error } = await supabase.from("applications").upsert(row, {
        onConflict: "email_normalized,role",
      }).select("id,email,role,payload,created_at,updated_at").single();
      if (error) throw error;
      return jsonResponse({ ok: true, application: data });
    }

    if (action === "lookupMatch") {
      const emailRaw = body.email;
      if (typeof emailRaw !== "string" || !emailRaw.trim()) {
        return jsonResponse({ ok: false, error: "missing_email" }, 400);
      }
      const norm = normalizeEmail(emailRaw);
      const { data: ps, error: psErr } = await supabase
        .from("program_state")
        .select("published,matches")
        .eq("id", 1)
        .maybeSingle();
      if (psErr) throw psErr;
      if (!ps?.published) {
        return jsonResponse({ ok: true, published: false, items: [] });
      }
      const { data: apps, error: aErr } = await supabase
        .from("applications")
        .select("id,email,role,payload,created_at,updated_at")
        .eq("email_normalized", norm);
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
        const { data: cp } = await supabase
          .from("applications")
          .select("payload,role")
          .eq("id", counterpartId)
          .maybeSingle();
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

    if (action === "listApplications") {
      const { data, error } = await supabase
        .from("applications")
        .select("id,email,role,payload,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse({ ok: true, applications: data ?? [] });
    }

    if (action === "getProgramState") {
      const { data, error } = await supabase.from("program_state").select("*").eq("id", 1).maybeSingle();
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
      const { error } = await supabase.from("program_state").upsert({
        id: 1,
        published,
        matches,
        updated_at: new Date().toISOString(),
      });
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
      const { data, error } = await supabase
        .from("applications")
        .update({
          email: (p.email as string).trim(),
          email_normalized: email,
          role: p.role as string,
          payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id,email,role,payload,created_at,updated_at")
        .single();
      if (error) throw error;
      return jsonResponse({ ok: true, application: data });
    }

    if (action === "deleteApplication") {
      const id = body.id;
      if (typeof id !== "string") return jsonResponse({ ok: false, error: "missing_id" }, 400);

      const { data: ps, error: psErr } = await supabase.from("program_state").select("matches").eq("id", 1).maybeSingle();
      if (psErr) throw psErr;
      const matches = (ps?.matches ?? []) as Array<{ mentorId: string; menteeId: string }>;
      const nextMatches = matches.filter((m) => m.mentorId !== id && m.menteeId !== id);
      const { error: uErr } = await supabase.from("program_state").update({
        matches: nextMatches,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (uErr) throw uErr;

      const { error: dErr } = await supabase.from("applications").delete().eq("id", id);
      if (dErr) throw dErr;
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "unauthorized") return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    console.error(e);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
