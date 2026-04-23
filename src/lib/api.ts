import { hasSupabaseConfig, functionsUrl, supabaseAnonKey } from "./env";
import type { ApplicationPayload, ProgramState, StoredApplication } from "../types";

async function invoke(body: Record<string, unknown>, adminPassword?: string) {
  if (!hasSupabaseConfig()) {
    throw new Error("missing_supabase_config");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseAnonKey()}`,
    apikey: supabaseAnonKey(),
  };
  if (adminPassword) headers["x-admin-password"] = adminPassword;

  const res = await fetch(functionsUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`http_${res.status}`);
  }
  if (!res.ok) {
    const err = typeof json.error === "string" ? json.error : `http_${res.status}`;
    throw new Error(err);
  }
  return json;
}

export function backendConfigured(): boolean {
  return hasSupabaseConfig();
}

export async function submitApplication(payload: ApplicationPayload): Promise<void> {
  const out = await invoke({ action: "submitApplication", payload });
  if (!out.ok) throw new Error("submit_failed");
}

export async function fetchProgramPublished(): Promise<boolean> {
  const out = await invoke({ action: "programStatus" });
  if (!out.ok) throw new Error("program_status_failed");
  return Boolean(out.published);
}

export type LookupMatchItem = {
  yourRole: string;
  yourName: string;
  counterpartName: string;
  counterpartRole: string;
  rationale: string;
  score: number;
};

export async function lookupMatchesByEmail(email: string): Promise<{
  published: boolean;
  items: LookupMatchItem[];
}> {
  const out = await invoke({ action: "lookupMatch", email });
  if (!out.ok) throw new Error("lookup_failed");
  return {
    published: Boolean(out.published),
    items: Array.isArray(out.items) ? (out.items as LookupMatchItem[]) : [],
  };
}

function mapRow(row: Record<string, unknown>): StoredApplication {
  return {
    id: String(row.id),
    email: String(row.email),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    payload: row.payload as StoredApplication["payload"],
  };
}

export async function listApplications(adminPassword: string): Promise<StoredApplication[]> {
  const out = await invoke({ action: "listApplications" }, adminPassword);
  if (!out.ok) throw new Error("list_failed");
  const apps = out.applications;
  if (!Array.isArray(apps)) return [];
  return apps.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getProgramState(adminPassword: string): Promise<ProgramState> {
  const out = await invoke({ action: "getProgramState" }, adminPassword);
  if (!out.ok) throw new Error("program_failed");
  const program = out.program as Record<string, unknown> | undefined;
  if (!program) {
    return { published: false, matches: [], updatedAt: new Date().toISOString() };
  }
  return {
    published: Boolean(program.published),
    matches: Array.isArray(program.matches) ? (program.matches as ProgramState["matches"]) : [],
    updatedAt: String(program.updatedAt ?? new Date().toISOString()),
  };
}

export async function setProgramState(adminPassword: string, next: ProgramState): Promise<void> {
  const out = await invoke(
    {
      action: "setProgramState",
      published: next.published,
      matches: next.matches,
    },
    adminPassword,
  );
  if (!out.ok) throw new Error("save_program_failed");
}

export async function updateApplication(
  adminPassword: string,
  id: string,
  payload: ApplicationPayload,
): Promise<void> {
  const out = await invoke({ action: "updateApplication", id, payload }, adminPassword);
  if (!out.ok) throw new Error("update_failed");
}

export async function deleteApplication(adminPassword: string, id: string): Promise<void> {
  const out = await invoke({ action: "deleteApplication", id }, adminPassword);
  if (!out.ok) throw new Error("delete_failed");
}

export function exportSnapshot(applications: StoredApplication[], program: ProgramState): string {
  return JSON.stringify({ applications, program }, null, 2);
}
