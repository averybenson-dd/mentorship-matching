import type { ApplicationPayload, ProgramState, StoredApplication } from "../types";

const STORAGE_KEY = "dxlx-mentorship-v1";

interface DbShape {
  applications: StoredApplication[];
  program: ProgramState;
}

function emptyProgram(): ProgramState {
  const t = new Date().toISOString();
  return { published: false, matches: [], updatedAt: t };
}

function load(): DbShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { applications: [], program: emptyProgram() };
    const parsed = JSON.parse(raw) as DbShape;
    if (!Array.isArray(parsed.applications) || !parsed.program) {
      return { applications: [], program: emptyProgram() };
    }
    return parsed;
  } catch {
    return { applications: [], program: emptyProgram() };
  }
}

function save(db: DbShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function listApplications(): StoredApplication[] {
  return load().applications.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addApplication(payload: ApplicationPayload): StoredApplication {
  const db = load();
  const now = new Date().toISOString();
  const row: StoredApplication = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    payload,
  };
  db.applications.unshift(row);
  save(db);
  return row;
}

export function updateApplication(id: string, payload: ApplicationPayload): StoredApplication | null {
  const db = load();
  const idx = db.applications.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const next: StoredApplication = {
    ...db.applications[idx]!,
    payload,
    updatedAt: now,
  };
  db.applications[idx] = next;
  save(db);
  return next;
}

export function deleteApplication(id: string): boolean {
  const db = load();
  const before = db.applications.length;
  db.applications = db.applications.filter((a) => a.id !== id);
  db.program.matches = db.program.matches.filter(
    (m) => m.mentorId !== id && m.menteeId !== id,
  );
  db.program.updatedAt = new Date().toISOString();
  if (db.applications.length === before) return false;
  save(db);
  return true;
}

export function getProgramState(): ProgramState {
  const p = load().program;
  return { ...p, matches: p.matches.map((m) => ({ ...m })) };
}

export function setProgramState(next: ProgramState) {
  const db = load();
  db.program = {
    ...next,
    matches: next.matches.map((m) => ({ ...m })),
    updatedAt: new Date().toISOString(),
  };
  save(db);
}

export function exportDatabaseJson(): string {
  return JSON.stringify(load(), null, 2);
}

export function importDatabaseJson(json: string): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json) as DbShape;
    if (!Array.isArray(parsed.applications) || !parsed.program) {
      return { ok: false, error: "Invalid file shape." };
    }
    save(parsed);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not parse JSON." };
  }
}
