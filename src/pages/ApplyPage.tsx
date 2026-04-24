import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  COMMITMENT_MENTEE,
  COMMITMENT_MENTOR,
  MENTEE_JOB_TITLES,
  MENTOR_JOB_TITLES,
  MENTOR_MENTEE_CAPACITY,
} from "../constants";
import BackendRequired from "../components/BackendRequired";
import { backendConfigured, submitApplication } from "../lib/api";
import { isValidEmail } from "../lib/email";
import type {
  MentorApplication,
  MenteeApplication,
  MenteeJobTitle,
  MentorJobTitle,
  MentorCommitment,
  MenteeCommitment,
  Role,
} from "../types";

const initialMentor: Omit<MentorApplication, "role"> = {
  email: "",
  name: "",
  jobTitle: "Manager",
  commitment: "yes",
  menteeCapacity: 2,
  teachingAreas: "",
};

const initialMentee: Omit<MenteeApplication, "role"> = {
  email: "",
  name: "",
  jobTitle: "Associate",
  team: "",
  commitment: "yes",
  coachingAreas: "",
};

export default function ApplyPage() {
  const [role, setRole] = useState<Role | "">("");
  const [mentor, setMentor] = useState(initialMentor);
  const [mentee, setMentee] = useState(initialMentee);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => {
    if (role === "mentor") return "Mentor application";
    if (role === "mentee") return "Mentee application";
    return "Application";
  }, [role]);

  if (!backendConfigured()) {
    return <BackendRequired title="Applications unavailable" />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!role) {
      setError("Please choose mentor or mentee.");
      return;
    }
    if (role === "mentor") {
      if (!isValidEmail(mentor.email)) {
        setError("Please enter a valid work email.");
        return;
      }
      if (!mentor.name.trim() || !mentor.teachingAreas.trim()) {
        setError("Please complete all required mentor fields.");
        return;
      }
      const payload: MentorApplication = { role: "mentor", ...mentor };
      setSubmitting(true);
      try {
        await submitApplication(payload);
        setDone(true);
      } catch {
        setError("Could not save your application. Please try again or contact the program team.");
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!isValidEmail(mentee.email)) {
        setError("Please enter a valid work email.");
        return;
      }
      if (!mentee.name.trim() || !mentee.team.trim() || !mentee.coachingAreas.trim()) {
        setError("Please complete all required mentee fields.");
        return;
      }
      const payload: MenteeApplication = { role: "mentee", ...mentee };
      setSubmitting(true);
      try {
        await submitApplication(payload);
        setDone(true);
      } catch {
        setError("Could not save your application. Please try again or contact the program team.");
      } finally {
        setSubmitting(false);
      }
    }
  }

  if (done) {
    return (
      <div className="card">
        <h1>Thank you</h1>
        <p className="lead">
          Your application was saved to the shared program database. Administrators will follow up,
          and you can look up your match later using the same email address.
        </p>
        <div className="row">
          <Link className="btn secondary" to="/">
            Home
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDone(false);
              setRole("");
              setMentor(initialMentor);
              setMentee(initialMentee);
            }}
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h1>{title}</h1>
      <p className="lead">
        Senior managers and above with at least six months of tenure are eligible to mentor. The
        program pairs people based on coaching goals and what mentors are comfortable teaching. Use
        the same work email for your application and for results lookup.
      </p>

      <div className="field">
        <label>I am applying as *</label>
        <div className="radio-grid">
          {(["mentor", "mentee"] as const).map((r) => (
            <label key={r} className="radio-line">
              <input
                type="radio"
                name="role"
                checked={role === r}
                onChange={() => setRole(r)}
              />
              <span>{r === "mentor" ? "Mentor" : "Mentee"}</span>
            </label>
          ))}
        </div>
      </div>

      {role === "mentor" && (
        <>
          <div className="field">
            <label htmlFor="m-email">Work email (used for results lookup) *</label>
            <input
              id="m-email"
              type="email"
              autoComplete="email"
              value={mentor.email}
              onChange={(e) => setMentor({ ...mentor, email: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="m-name">Name *</label>
            <input
              id="m-name"
              value={mentor.name}
              onChange={(e) => setMentor({ ...mentor, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="m-title">Job title *</label>
            <select
              id="m-title"
              value={mentor.jobTitle}
              onChange={(e) =>
                setMentor({ ...mentor, jobTitle: e.target.value as MentorJobTitle })
              }
              required
            >
              {MENTOR_JOB_TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Are you able to commit to bi-weekly or monthly 30 minute meetings? *</label>
            <div className="radio-grid">
              {COMMITMENT_MENTOR.map((c) => (
                <label key={c} className="radio-line">
                  <input
                    type="radio"
                    name="m-commit"
                    checked={mentor.commitment === c}
                    onChange={() => setMentor({ ...mentor, commitment: c as MentorCommitment })}
                  />
                  <span>
                    {c === "yes"
                      ? "Yes"
                      : c === "no"
                        ? "No"
                        : "Alternative cadence"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="m-cap">How many mentees can you take on? *</label>
            <select
              id="m-cap"
              value={String(mentor.menteeCapacity)}
              onChange={(e) =>
                setMentor({ ...mentor, menteeCapacity: Number(e.target.value) as 1 | 2 | 3 })
              }
            >
              {MENTOR_MENTEE_CAPACITY.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-teach">
              What areas of the business / the S&amp;O role are you most comfortable teaching? *
            </label>
            <textarea
              id="m-teach"
              value={mentor.teachingAreas}
              onChange={(e) => setMentor({ ...mentor, teachingAreas: e.target.value })}
              required
            />
          </div>
        </>
      )}

      {role === "mentee" && (
        <>
          <div className="field">
            <label htmlFor="e-email">Work email (used for results lookup) *</label>
            <input
              id="e-email"
              type="email"
              autoComplete="email"
              value={mentee.email}
              onChange={(e) => setMentee({ ...mentee, email: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="e-name">Name *</label>
            <input
              id="e-name"
              value={mentee.name}
              onChange={(e) => setMentee({ ...mentee, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="e-title">Job title (if known) *</label>
            <select
              id="e-title"
              value={mentee.jobTitle}
              onChange={(e) =>
                setMentee({ ...mentee, jobTitle: e.target.value as MenteeJobTitle })
              }
            >
              {MENTEE_JOB_TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="e-team">Team *</label>
            <input
              id="e-team"
              value={mentee.team}
              onChange={(e) => setMentee({ ...mentee, team: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Are you able to commit to bi-weekly or monthly 30 minute meetings? *</label>
            <div className="radio-grid">
              {COMMITMENT_MENTEE.map((c) => (
                <label key={c} className="radio-line">
                  <input
                    type="radio"
                    name="e-commit"
                    checked={mentee.commitment === c}
                    onChange={() => setMentee({ ...mentee, commitment: c as MenteeCommitment })}
                  />
                  <span>{c === "yes" ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="e-coach">What areas would you like coaching on? *</label>
            <textarea
              id="e-coach"
              value={mentee.coachingAreas}
              onChange={(e) => setMentee({ ...mentee, coachingAreas: e.target.value })}
              required
            />
          </div>
        </>
      )}

      {error && <div className="error">{error}</div>}

      {role && (
        <div className="stack">
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit application"}
          </button>
          <Link className="btn secondary" to="/">
            Cancel
          </Link>
        </div>
      )}
    </form>
  );
}
