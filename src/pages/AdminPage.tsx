import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DOORDASH_VALUES } from "../constants";
import BackendRequired from "../components/BackendRequired";
import {
  backendConfigured,
  deleteApplication,
  exportSnapshot,
  getProgramState,
  listApplications,
  setProgramState,
  updateApplication,
} from "../lib/api";
import { getAdminPassword, isAdminAuthenticated, loginAdmin, logoutAdmin } from "../lib/adminSession";
import { runMatching } from "../lib/matching";
import type { ApplicationPayload, ProgramState, StoredApplication } from "../types";

type ModalMode = "none" | "delete" | "edit";

const DELETE_PHRASE = "DELETE";

export default function AdminPage() {
  const [pwd, setPwd] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [auth, setAuth] = useState(isAdminAuthenticated());
  const [rows, setRows] = useState<StoredApplication[]>([]);
  const [program, setProgram] = useState<ProgramState>(() => ({
    published: false,
    matches: [],
    updatedAt: new Date().toISOString(),
  }));
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalMode>("none");
  const [active, setActive] = useState<StoredApplication | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [editJson, setEditJson] = useState("");

  const refresh = useCallback(async () => {
    const ap = getAdminPassword();
    if (!ap) return;
    setLoadError(null);
    try {
      const [apps, prog] = await Promise.all([listApplications(ap), getProgramState(ap)]);
      setRows(apps);
      setProgram(prog);
    } catch {
      setLoadError("Could not load data from Supabase. Check the Edge Function and secrets.");
    }
  }, []);

  useEffect(() => {
    if (auth && getAdminPassword()) void refresh();
  }, [auth, refresh]);

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (loginAdmin(pwd)) {
      setAuth(true);
      setPwd("");
      void refresh();
    } else {
      setLoginError("Incorrect password.");
    }
  };

  const onLogout = () => {
    logoutAdmin();
    setAuth(false);
    setRows([]);
    setProgram({ published: false, matches: [], updatedAt: new Date().toISOString() });
  };

  const requirePwd = () => {
    const ap = getAdminPassword();
    if (!ap) {
      onLogout();
      return null;
    }
    return ap;
  };

  const onMatch = async () => {
    const ap = requirePwd();
    if (!ap) return;
    setBusy(true);
    try {
      const apps = await listApplications(ap);
      const matches = runMatching(apps);
      const cur = await getProgramState(ap);
      await setProgramState(ap, { ...cur, matches });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    const ap = requirePwd();
    if (!ap) return;
    const cur = await getProgramState(ap);
    await setProgramState(ap, { ...cur, published: true });
    await refresh();
  };

  const onUnpublish = async () => {
    const ap = requirePwd();
    if (!ap) return;
    const cur = await getProgramState(ap);
    await setProgramState(ap, { ...cur, published: false });
    await refresh();
  };

  const onRematch = async () => {
    const ap = requirePwd();
    if (!ap) return;
    setBusy(true);
    try {
      const apps = await listApplications(ap);
      const matches = runMatching(apps);
      const cur = await getProgramState(ap);
      await setProgramState(ap, { ...cur, matches });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const openDelete = (row: StoredApplication) => {
    setActive(row);
    setDeleteInput("");
    setDeleteAck(false);
    setModal("delete");
  };

  const confirmDelete = async () => {
    const ap = requirePwd();
    if (!ap || !active) return;
    if (deleteInput.trim() !== DELETE_PHRASE) return;
    if (!deleteAck) return;
    await deleteApplication(ap, active.id);
    setModal("none");
    setActive(null);
    await refresh();
  };

  const openEdit = (row: StoredApplication) => {
    setActive(row);
    setEditJson(JSON.stringify(row.payload, null, 2));
    setModal("edit");
  };

  const saveEdit = async () => {
    const ap = requirePwd();
    if (!ap || !active) return;
    try {
      const parsed = JSON.parse(editJson) as ApplicationPayload;
      if (parsed.role !== "mentor" && parsed.role !== "mentee") {
        alert("Invalid role.");
        return;
      }
      await updateApplication(ap, active.id, parsed);
      setModal("none");
      setActive(null);
      await refresh();
    } catch {
      alert("Invalid JSON or save failed.");
    }
  };

  const summary = useMemo(() => {
    const mentors = rows.filter((r) => r.payload.role === "mentor").length;
    const mentees = rows.filter((r) => r.payload.role === "mentee").length;
    return { mentors, mentees, matches: program.matches.length };
  }, [rows, program.matches.length]);

  if (!backendConfigured()) {
    return <BackendRequired title="Admin unavailable" />;
  }

  if (!auth) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h1>Admin</h1>
        <p className="lead">Sign in to review applications, run matching, and publish results.</p>
        <form onSubmit={onLogin}>
          <div className="field">
            <label htmlFor="admin-pwd">Password</label>
            <input
              id="admin-pwd"
              type="password"
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
          </div>
          {loginError && <div className="error">{loginError}</div>}
          <button className="btn primary" type="submit">
            Unlock
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1rem" }}>
          <Link to="/">Back to site</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Admin console</h1>
          <div className="row">
            <Link className="btn secondary" to="/">
              Public site
            </Link>
            <button type="button" className="btn secondary" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
        <div className="notice">
          Applications and matches are stored in <strong>Supabase</strong> (Postgres) so any browser
          sees the same data. The admin password is checked by the Edge Function using the{" "}
          <code>ADMIN_PASSWORD</code> secret — rotate it for anything beyond a trusted pilot.
        </div>
        {loadError && <div className="error">{loadError}</div>}
        <p className="muted" style={{ marginTop: 0 }}>
          Mentors: {summary.mentors} · Mentees: {summary.mentees} · Active matches:{" "}
          {summary.matches} · Published: {program.published ? "yes" : "no"}
        </p>
        <div className="stack">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void onMatch()}>
            Match
          </button>
          <button type="button" className="btn" disabled={busy || program.published} onClick={() => void onPublish()}>
            Publish
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!program.published}
            onClick={() => void onUnpublish()}
          >
            Unpublish
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void onRematch()}>
            Rematch
          </button>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Matching scores coaching/teaching text overlap, mentee value goals vs mentor superpower,
          mutual availability, and each mentor&apos;s mentee capacity. Rationales are generated from the
          text of both applications.
        </p>
      </div>

      <div className="card">
        <h2>Export snapshot</h2>
        <p className="muted">
          Downloads the currently loaded applications and program state as JSON (useful for backups).
        </p>
        <div className="stack">
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              const ap = getAdminPassword();
              if (!ap) return;
              const blob = new Blob([exportSnapshot(rows, program)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `mentorship-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Applications</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Email</th>
                <th>Name</th>
                <th>Region</th>
                <th>Highlights</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={r.payload.role === "mentor" ? "pill" : "pill neutral"}>
                      {r.payload.role}
                    </span>
                  </td>
                  <td>{r.email}</td>
                  <td>{r.payload.name}</td>
                  <td>{r.payload.region}</td>
                  <td className="muted">{previewPayload(r.payload)}</td>
                  <td className="muted">{new Date(r.updatedAt).toLocaleString()}</td>
                  <td>
                    <div className="row">
                      <button type="button" className="btn secondary" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button type="button" className="btn danger" onClick={() => openDelete(r)}>
                        Delete…
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No applications yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Current matches</h2>
        {program.matches.length === 0 ? (
          <p className="muted">Run matching to generate pairs.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Mentee</th>
                  <th>Score</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {program.matches.map((m) => {
                  const mentor = rows.find((x) => x.id === m.mentorId);
                  const mentee = rows.find((x) => x.id === m.menteeId);
                  return (
                    <tr key={`${m.mentorId}-${m.menteeId}`}>
                      <td>{mentor?.payload.name ?? m.mentorId}</td>
                      <td>{mentee?.payload.name ?? m.menteeId}</td>
                      <td>{m.score}</td>
                      <td className="muted preline">{m.rationale}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === "delete" && active && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog">
            <h3>Delete application</h3>
            <p className="muted">
              This removes the application and any matches involving this person. This cannot be
              undone.
            </p>
            <p>
              To confirm, type <strong>{DELETE_PHRASE}</strong> exactly and acknowledge below. A
              single accidental click is not enough.
            </p>
            <div className="field">
              <label htmlFor="del-confirm">Confirmation text</label>
              <input
                id="del-confirm"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                autoComplete="off"
              />
            </div>
            <label className="radio-line">
              <input
                type="checkbox"
                checked={deleteAck}
                onChange={(e) => setDeleteAck(e.target.checked)}
              />
              <span>I understand this permanently deletes this response.</span>
            </label>
            <div className="stack">
              <button
                type="button"
                className="btn danger"
                disabled={deleteInput.trim() !== DELETE_PHRASE || !deleteAck}
                onClick={() => void confirmDelete()}
              >
                Permanently delete
              </button>
              <button type="button" className="btn secondary" onClick={() => setModal("none")}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "edit" && active && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal("none");
          }}
        >
          <div className="modal" role="dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3>Edit application JSON</h3>
            <p className="muted">
              Advanced editing — invalid JSON or shapes will be rejected. Include the correct{" "}
              <code>email</code> field in the payload.
            </p>
            <div className="field">
              <label htmlFor="edit-json">Payload</label>
              <textarea id="edit-json" value={editJson} onChange={(e) => setEditJson(e.target.value)} />
            </div>
            <div className="stack">
              <button type="button" className="btn primary" onClick={() => void saveEdit()}>
                Save changes
              </button>
              <button type="button" className="btn secondary" onClick={() => setModal("none")}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function previewPayload(p: ApplicationPayload): string {
  if (p.role === "mentor") {
    const v = DOORDASH_VALUES[p.valueSuperpower - 1] ?? "";
    return `${p.jobTitle} · teaches: ${truncate(p.teachingAreas)} · ${v}`;
  }
  const vals = p.valuesToDevelop
    .slice(0, 3)
    .map((i) => DOORDASH_VALUES[i - 1])
    .filter(Boolean)
    .join(", ");
  return `${p.jobTitle}${p.jobTitle === "Other" && p.jobTitleOther ? ` (${p.jobTitleOther})` : ""} · ${truncate(
    p.coachingAreas,
  )} · values: ${vals}`;
}

function truncate(s: string, n = 80) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}
