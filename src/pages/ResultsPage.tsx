import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { findMatchForPerson } from "../lib/matching";
import { getProgramState, listApplications } from "../lib/storage";
import type { Role } from "../types";

export default function ResultsPage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | "either">("either");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof findMatchForPerson>>(null);

  const program = getProgramState();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!program.published) {
      setError("Results are not published yet. Please check back after program administrators publish matches.");
      return;
    }
    if (!name.trim()) {
      setError("Enter the name you used on your application.");
      return;
    }
    const apps = listApplications();
    const hit = findMatchForPerson(apps, program.matches, name, role);
    if (!hit) {
      setError(
        "No published match found for that name. If you recently applied, confirm spelling or ask an admin to rematch.",
      );
      return;
    }
    setResult(hit);
  }

  return (
    <div>
      <div className="card">
        <h1>My match</h1>
        <p className="lead">
          After administrators publish pairings, look up your match using the same name you entered
          on your application.
        </p>
        {!program.published && (
          <div className="notice">
            Matching results are not visible yet. You will see a confirmation message here once the
            program is published.
          </div>
        )}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="lookup-name">Your name (as on the application) *</label>
            <input
              id="lookup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="field">
            <label>I applied as</label>
            <div className="radio-grid">
              {(
                [
                  ["either", "Not sure / only one application"],
                  ["mentor", "Mentor"],
                  ["mentee", "Mentee"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="radio-line">
                  <input
                    type="radio"
                    name="lookup-role"
                    checked={role === value}
                    onChange={() => setRole(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="stack">
            <button className="btn primary" type="submit" disabled={!program.published}>
              Look up match
            </button>
            <Link className="btn secondary" to="/apply">
              Apply
            </Link>
          </div>
        </form>
      </div>

      {result && (
        <div className="card">
          <h2>Your pairing</h2>
          <p>
            <span className="pill">{result.self.payload.role}</span>{" "}
            <strong>{result.self.payload.name}</strong>
          </p>
          <p>
            Matched with <strong>{result.counterpart.payload.name}</strong> (
            <span className="pill neutral">{result.counterpart.payload.role}</span>)
          </p>
          <h2>Why we think this is a strong fit</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {result.rationale}
          </p>
        </div>
      )}
    </div>
  );
}
