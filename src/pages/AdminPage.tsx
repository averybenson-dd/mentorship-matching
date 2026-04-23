import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DOORDASH_VALUES } from "../constants";
import BackendRequired from "../components/BackendRequired";
import {
  backendConfigured,
  deleteApplication,
  exportSnapshot,
  getLlmConfig,
  getProgramState,
  listApplications,
  pingLlmGateway,
  runAiMatch,
  setProgramState,
  updateApplication,
} from "../lib/api";
import type { LlmEnvSummary, LlmPingResult, RunAiMatchMeta } from "../lib/api";
import { getAdminPassword, isAdminAuthenticated, loginAdmin, logoutAdmin } from "../lib/adminSession";
import type { ApplicationPayload, ProgramState, StoredApplication } from "../types";

type ModalMode = "none" | "delete" | "edit";

const DELETE_PHRASE = "DELETE";

function edgeUserMessage(msg: string): string {
  if (msg === "unauthorized") {
    return "Admin password rejected by the server (401). In Supabase Edge Function secrets, set ADMIN_PASSWORD to exactly match your admin login (no extra spaces). Redeploy mentor-backend, then log out and log back in.";
  }
  if (msg.startsWith("http_404")) {
    return "Edge Function not found (404). Deploy: supabase functions deploy mentor-backend --no-verify-jwt — and confirm VITE_SUPABASE_URL points at this same project.";
  }
  if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
    return "Browser could not reach Supabase (network, ad blocker, or mixed content). Open DevTools → Network, retry, and inspect the call to …/functions/v1/mentor-backend.";
  }
  return msg;
}

function resolveMatchSetupError(msg: string): string {
  if (msg === "missing_llm_credentials") {
    return "No LLM credentials configured. Set OPENAI_API_KEY for direct OpenAI, OR use Portkey: PORTKEY_API_KEY plus PORTKEY_VIRTUAL_KEY (recommended). Run: supabase secrets set … then supabase functions deploy mentor-backend --no-verify-jwt.";
  }
  if (msg === "missing_portkey_provider") {
    return "PORTKEY_API_KEY is set but Portkey still needs routing: set PORTKEY_VIRTUAL_KEY (OpenAI key stays in Portkey) or PORTKEY_PROVIDER (e.g. @openai-prod) / OPENAI_API_KEY per Portkey docs. Redeploy mentor-backend, then retry.";
  }
  if (msg === "llm_rationale_forbidden_score_language") {
    return "The model tried to describe fit with percentages or boilerplate that conflicts with the numeric score. Click Run AI match again (the prompt now forbids that); if it keeps happening, try a slightly larger model in OPENAI_MODEL.";
  }
  if (msg === "llm_rationale_not_grounded_in_applications") {
    return "The model’s rationale did not quote enough verbatim text from both applications. Retry Run AI match; if it repeats, shorten very long free-text answers slightly so the model can mirror real phrases.";
  }
  return edgeUserMessage(msg);
}

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
  const [matchError, setMatchError] = useState<string | null>(null);
  const [llmEnv, setLlmEnv] = useState<LlmEnvSummary | null>(null);
  const [llmPing, setLlmPing] = useState<LlmPingResult | null>(null);
  const [lastMatchLlm, setLastMatchLlm] = useState<RunAiMatchMeta | null>(null);
  const [llmPanelError, setLlmPanelError] = useState<string | null>(null);

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
    } catch (e) {
      const raw = e instanceof Error ? e.message : "unknown_error";
      setLoadError(
        `Could not load admin data. ${edgeUserMessage(raw)}`,
      );
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
    setMatchError(null);
    setBusy(true);
    try {
      const { llm } = await runAiMatch(ap);
      setLastMatchLlm(llm ?? null);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Match failed";
      setMatchError(resolveMatchSetupError(msg));
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
    setMatchError(null);
    setBusy(true);
    try {
      const { llm } = await runAiMatch(ap);
      setLastMatchLlm(llm ?? null);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Rematch failed";
      setMatchError(resolveMatchSetupError(msg));
    } finally {
      setBusy(false);
    }
  };

  const onLoadLlmConfig = async () => {
    const ap = requirePwd();
    if (!ap) return;
    setLlmPanelError(null);
    setLlmPing(null);
    try {
      setLlmEnv(await getLlmConfig(ap));
    } catch (e) {
      setLlmPanelError(e instanceof Error ? e.message : "Could not load LLM config");
    }
  };

  const onPingLlm = async () => {
    const ap = requirePwd();
    if (!ap) return;
    setLlmPanelError(null);
    try {
      const r = await pingLlmGateway(ap);
      setLlmPing(r);
      if (!r.ok) {
        setLlmPanelError(r.detail ? `${r.error}: ${r.detail}` : (r.error ?? "Ping failed"));
      }
    } catch (e) {
      setLlmPanelError(e instanceof Error ? e.message : "Ping failed");
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
        <p className="muted" style={{ marginTop: 0 }}>
          <strong>Match / Rematch</strong> calls an LLM from the <code>mentor-backend</code> Edge Function (not
          your browser). Either set <code>OPENAI_API_KEY</code> for direct OpenAI, or use{" "}
          <strong>Portkey</strong>: <code>PORTKEY_API_KEY</code> plus <code>PORTKEY_VIRTUAL_KEY</code> (recommended)
          or <code>PORTKEY_PROVIDER</code> / <code>OPENAI_API_KEY</code> per Portkey docs. Optional{" "}
          <code>OPENAI_MODEL</code> (default <code>gpt-4o-mini</code>). Redeploy after changing secrets.
        </p>
        {loadError && <div className="error">{loadError}</div>}
        {matchError && <div className="error">{matchError}</div>}
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
          The model proposes pairs that respect mentor capacity and &quot;no&quot; availability flags,
          and writes multi-paragraph rationales grounded in what each person wrote. If the model output
          fails validation, fix applications and try again.
        </p>
        {lastMatchLlm && (
          <p className="muted" style={{ marginTop: "1rem", marginBottom: 0 }}>
            Last successful <strong>Match</strong> called <code>{lastMatchLlm.chatUrlHost}</code> (
            {lastMatchLlm.gateway}, <code>{lastMatchLlm.routing}</code>). Requested{" "}
            <code>{lastMatchLlm.modelRequested}</code>
            {lastMatchLlm.modelReported ? (
              <>
                {" "}
                · upstream reported <code>{lastMatchLlm.modelReported}</code>
              </>
            ) : (
              <> · upstream did not echo a model id (check Portkey logs).</>
            )}
          </p>
        )}
      </div>

      <div className="card">
        <h2>LLM / Portkey diagnostics</h2>
        <p className="muted">
          Shows how <code>mentor-backend</code> resolves credentials from Supabase secrets (keys are never returned).
          <strong> Ping gateway</strong> runs one tiny chat completion on the same path as matching. If rationales
          still feel generic, compare <code>modelReported</code> to <code>OPENAI_MODEL</code> and your Portkey
          virtual key / config (fallback model, transforms, cache).
        </p>
        {llmPanelError && <div className="error">{llmPanelError}</div>}
        <div className="stack" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="btn secondary" onClick={() => void onLoadLlmConfig()}>
            Load LLM config
          </button>
          <button type="button" className="btn secondary" onClick={() => void onPingLlm()}>
            Ping gateway
          </button>
        </div>
        {llmEnv && (
          <pre className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(llmEnv, null, 2)}
          </pre>
        )}
        {llmPing && (
          <pre className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(
              {
                ok: llmPing.ok,
                error: llmPing.error,
                detail: llmPing.detail,
                latencyMs: llmPing.latencyMs,
                gateway: llmPing.gateway,
                routing: llmPing.routing,
                chatUrlHost: llmPing.chatUrlHost,
                modelRequested: llmPing.modelRequested,
                modelReported: llmPing.modelReported,
              },
              null,
              2,
            )}
          </pre>
        )}
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
                  <th>Score (0–1)</th>
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
                      <td>
                        {m.score.toFixed(3)}
                        <span className="muted"> (~{Math.round(m.score * 100)}%)</span>
                      </td>
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
