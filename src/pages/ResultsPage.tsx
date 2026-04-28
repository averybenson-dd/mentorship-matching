import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BackendRequired from "../components/BackendRequired";
import {
  backendConfigured,
  fetchProgramPublished,
  lookupMatchesByEmail,
  type LookupMatchItem,
} from "../lib/api";
import { isValidEmail } from "../lib/email";

export default function ResultsPage() {
  const [email, setEmail] = useState("");
  const [published, setPublished] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LookupMatchItem[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!backendConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchProgramPublished();
        if (!cancelled) setPublished(p);
      } catch {
        if (!cancelled) {
          setLoadError("Could not load program status. Please try again later.");
          setPublished(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!backendConfigured()) {
    return <BackendRequired title="Results lookup unavailable" />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setItems(null);
    if (!isValidEmail(email)) {
      setError("Enter the same work email you used on your application.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await lookupMatchesByEmail(email);
      if (!res.published) {
        setError(
          "Results are not published yet. Please check back after program administrators publish matches.",
        );
        setPublished(false);
        return;
      }
      setPublished(true);
      if (res.items.length === 0) {
        setError(
          "No published match was found for that email. Confirm you used the same email as your application, or ask an admin to rematch.",
        );
        return;
      }
      setItems(res.items);
    } catch {
      setError("Lookup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h1>View My Match</h1>
        <p className="lead">
          After administrators publish pairings, look up your match using the same work email you
          used when you applied.
        </p>
        {loadError && <div className="error">{loadError}</div>}
        {published === false && !loadError && (
          <div className="notice">
            Matching results are not visible yet. You will be able to look up your pairing here once
            the program is published.
          </div>
        )}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="lookup-email">Work email (same as on your application) *</label>
            <input
              id="lookup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <div className="stack">
            <button className="btn primary" type="submit" disabled={submitting || published === false}>
              {submitting ? "Looking up…" : "Look up match"}
            </button>
            <Link className="btn secondary" to="/apply">
              Apply
            </Link>
          </div>
        </form>
      </div>

      {items && items.length > 0 && (
        <div className="card">
          <h2>Your pairing(s)</h2>
          {(() => {
            const mentorMeta = items.find((i) => i.yourRole === "mentor");
            if (!mentorMeta) return null;
            const n =
              mentorMeta.mentorMatchTotal ?? items.filter((i) => i.yourRole === "mentor").length;
            const cap = mentorMeta.menteeCapacitySignedUp;
            if (cap != null && cap >= 1 && cap <= 5) {
              return (
                <p className="muted" style={{ marginBottom: "1rem" }}>
                  You signed up to take on up to {cap} mentee{cap === 1 ? "" : "s"}. You have {n}{" "}
                  published pairing{n === 1 ? "" : "s"} below.
                </p>
              );
            }
            return (
              <p className="muted" style={{ marginBottom: "1rem" }}>
                You have {n} published pairing{n === 1 ? "" : "s"} below.
              </p>
            );
          })()}
          {items.map((it, idx) => (
            <div key={`${it.yourRole}-${idx}`} style={{ marginTop: idx === 0 ? 0 : "1.5rem" }}>
              <p>
                <span className="pill">{it.yourRole}</span>{" "}
                <strong>{it.yourName}</strong>
              </p>
              <p>
                Matched with <strong>{it.counterpartName}</strong> (
                <span className="pill neutral">{it.counterpartRole}</span>)
              </p>
              <h2>Why we think this is a strong fit</h2>
              <p className="muted preline">{it.rationale}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
