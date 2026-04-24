import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  MENTEE_JOB_TITLES,
  MENTOR_JOB_TITLES,
  MENTOR_MENTEE_CAPACITY_VALUES,
} from "../constants";
import BackendRequired from "../components/BackendRequired";
import { backendConfigured, submitApplication } from "../lib/api";
import { isValidEmail } from "../lib/email";
import { countWords, MIN_ESSAY_WORDS } from "../lib/wordCount";
import type {
  MentorApplication,
  MenteeApplication,
  MenteeJobTitle,
  MentorJobTitle,
  MentorMenteeCapacity,
  Role,
} from "../types";

const initialMentor: Omit<MentorApplication, "role"> = {
  email: "",
  name: "",
  jobTitle: "Senior Manager",
  menteeCapacity: 2,
  teachingAreas: "",
};

const initialMentee: Omit<MenteeApplication, "role"> = {
  email: "",
  name: "",
  jobTitle: "Associate",
  coachingAreas: "",
};

function friendlySubmitError(msg: string): string {
  if (msg === "invalid_teaching_word_count" || msg === "invalid_coaching_word_count") {
    return `Please enter at least ${MIN_ESSAY_WORDS} words in the free-text answer.`;
  }
  if (msg === "invalid_capacity") {
    return "Choose how many mentees you can take on (1–5).";
  }
  return msg;
}

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
      if (countWords(mentor.teachingAreas) < MIN_ESSAY_WORDS) {
        setError(`Your response must be at least ${MIN_ESSAY_WORDS} words.`);
        return;
      }
      const payload: MentorApplication = { role: "mentor", ...mentor };
      setSubmitting(true);
      try {
        await submitApplication(payload);
        setDone(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setError(
          msg ? friendlySubmitError(msg) : "Could not save your application. Please try again or contact the program team.",
        );
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!isValidEmail(mentee.email)) {
        setError("Please enter a valid work email.");
        return;
      }
      if (!mentee.name.trim() || !mentee.coachingAreas.trim()) {
        setError("Please complete all required mentee fields.");
        return;
      }
      if (countWords(mentee.coachingAreas) < MIN_ESSAY_WORDS) {
        setError(`Your response must be at least ${MIN_ESSAY_WORDS} words.`);
        return;
      }
      const payload: MenteeApplication = { role: "mentee", ...mentee };
      setSubmitting(true);
      try {
        await submitApplication(payload);
        setDone(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setError(
          msg ? friendlySubmitError(msg) : "Could not save your application. Please try again or contact the program team.",
        );
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
            <label htmlFor="m-cap">How many mentees can you take on? *</label>
            <select
              id="m-cap"
              value={String(mentor.menteeCapacity)}
              onChange={(e) =>
                setMentor({
                  ...mentor,
                  menteeCapacity: Number(e.target.value) as MentorMenteeCapacity,
                })
              }
            >
              {MENTOR_MENTEE_CAPACITY_VALUES.map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-teach">Tell us about yourself * ({MIN_ESSAY_WORDS}+ words)</label>
            <p className="muted" style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}>
              In a concise overview, share your professional experience at DoorDash and before, the
              project or work you are focused on right now, and the areas of the business where you feel
              most comfortable teaching and helping others grow.
            </p>
            <textarea
              id="m-teach"
              value={mentor.teachingAreas}
              onChange={(e) => setMentor({ ...mentor, teachingAreas: e.target.value })}
              required
              rows={10}
            />
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              {countWords(mentor.teachingAreas)} / {MIN_ESSAY_WORDS} words minimum
            </p>
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
            <label htmlFor="e-title">Job title *</label>
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
            <label htmlFor="e-coach">Tell us about yourself * ({MIN_ESSAY_WORDS}+ words)</label>
            <p className="muted" style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}>
              In a concise overview, share your professional experience at DoorDash and before, the
              project or work you are focused on right now, the parts of the business you want to learn
              about and grow in, and how you see your career developing over time.
            </p>
            <textarea
              id="e-coach"
              value={mentee.coachingAreas}
              onChange={(e) => setMentee({ ...mentee, coachingAreas: e.target.value })}
              required
              rows={10}
            />
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              {countWords(mentee.coachingAreas)} / {MIN_ESSAY_WORDS} words minimum
            </p>
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
