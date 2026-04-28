import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  MENTEE_DEVELOPMENT_GOALS,
  MENTEE_JOB_TITLES,
  MENTEE_MENTOR_LEVEL_PREFERENCE,
  MENTEE_PREFERRED_MENTORSHIP_STYLES,
  MENTOR_BEST_SUITED_MENTEE,
  MENTOR_FOCUS_AREAS,
  MENTOR_JOB_TITLES,
  MENTOR_MENTEE_CAPACITY_VALUES,
  MENTOR_MENTORSHIP_STYLES,
  MAX_MULTI_PICKS,
} from "../constants";
import BackendRequired from "../components/BackendRequired";
import { backendConfigured, submitApplication } from "../lib/api";
import { isValidEmail } from "../lib/email";
import { countWords, essayWordCountOk, MAX_ESSAY_WORDS, MIN_ESSAY_WORDS } from "../lib/wordCount";
import type {
  MentorApplication,
  MenteeApplication,
  MenteeJobTitle,
  MentorFocusArea,
  MentorJobTitle,
  MenteeDevGoal,
  MentorMenteeCapacity,
  Role,
} from "../types";

function toggleList<T extends string>(list: T[], item: T, max: number): T[] {
  if (list.includes(item)) return list.filter((x) => x !== item) as T[];
  if (list.length >= max) return list;
  return [...list, item] as T[];
}

const initialMentor: Omit<MentorApplication, "role"> = {
  email: "",
  name: "",
  jobTitle: "Manager",
  menteeCapacity: 2,
  mentorFocusAreas: [],
  mentorshipStyle: MENTOR_MENTORSHIP_STYLES[0]!,
  bestSuitedMentee: MENTOR_BEST_SUITED_MENTEE[0]!,
  teachingAreas: "",
};

const initialMentee: Omit<MenteeApplication, "role"> = {
  email: "",
  name: "",
  jobTitle: "Associate",
  developmentGoals: [],
  preferredMentorshipStyle: MENTEE_PREFERRED_MENTORSHIP_STYLES[0]!,
  mentorLevelLookingFor: MENTEE_MENTOR_LEVEL_PREFERENCE[0]!,
  coachingAreas: "",
};

function friendlySubmitError(msg: string): string {
  if (msg === "invalid_teaching_word_count" || msg === "invalid_coaching_word_count") {
    return `The free-text answer must be between ${MIN_ESSAY_WORDS} and ${MAX_ESSAY_WORDS} words (no fewer, no more).`;
  }
  if (msg === "invalid_capacity") {
    return "Choose how many mentees you can take on (1–5).";
  }
  if (msg === "invalid_mentor_focus") {
    return `Select 1–${MAX_MULTI_PICKS} primary areas you can mentor in.`;
  }
  if (msg === "invalid_mentor_style" || msg === "invalid_mentor_mentee_type") {
    return "Please complete the mentor dropdowns.";
  }
  if (msg === "invalid_mentee_goals") {
    return `Select 1–${MAX_MULTI_PICKS} development goals.`;
  }
  if (msg === "invalid_mentee_style" || msg === "invalid_mentee_mentor_level") {
    return "Please complete the mentee dropdowns.";
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
      if (mentor.mentorFocusAreas.length < 1 || mentor.mentorFocusAreas.length > MAX_MULTI_PICKS) {
        setError(`Select 1–${MAX_MULTI_PICKS} primary areas you can mentor in.`);
        return;
      }
      if (!essayWordCountOk(mentor.teachingAreas)) {
        setError(
          `Your response must be between ${MIN_ESSAY_WORDS} and ${MAX_ESSAY_WORDS} words (currently ${countWords(mentor.teachingAreas)}).`,
        );
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
      if (mentee.developmentGoals.length < 1 || mentee.developmentGoals.length > MAX_MULTI_PICKS) {
        setError(`Select 1–${MAX_MULTI_PICKS} development goals.`);
        return;
      }
      if (!essayWordCountOk(mentee.coachingAreas)) {
        setError(
          `Your response must be between ${MIN_ESSAY_WORDS} and ${MAX_ESSAY_WORDS} words (currently ${countWords(mentee.coachingAreas)}).`,
        );
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
        Eligible mentors are people leaders and experienced ICs (Manager and above) with sufficient
        tenure. The program matches mentees with mentors who are at least one level more senior.
        Use the same work email for your application and for results lookup.
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
            <label>Primary areas you can mentor in * (select up to {MAX_MULTI_PICKS})</label>
            <div className="checkbox-grid">
              {MENTOR_FOCUS_AREAS.map((area) => (
                <label key={area} className="radio-line">
                  <input
                    type="checkbox"
                    checked={mentor.mentorFocusAreas.includes(area)}
                    onChange={() =>
                      setMentor({
                        ...mentor,
                        mentorFocusAreas: toggleList(
                          mentor.mentorFocusAreas,
                          area as MentorFocusArea,
                          MAX_MULTI_PICKS,
                        ),
                      })
                    }
                  />
                  <span>{area}</span>
                </label>
              ))}
            </div>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              Selected: {mentor.mentorFocusAreas.length} / {MAX_MULTI_PICKS}
            </p>
          </div>
          <div className="field">
            <label htmlFor="m-style">Mentorship style *</label>
            <select
              id="m-style"
              value={mentor.mentorshipStyle}
              onChange={(e) =>
                setMentor({
                  ...mentor,
                  mentorshipStyle: e.target.value as MentorApplication["mentorshipStyle"],
                })
              }
            >
              {MENTOR_MENTORSHIP_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-best">What type of mentee are you best suited for? *</label>
            <select
              id="m-best"
              value={mentor.bestSuitedMentee}
              onChange={(e) =>
                setMentor({
                  ...mentor,
                  bestSuitedMentee: e.target.value as MentorApplication["bestSuitedMentee"],
                })
              }
            >
              {MENTOR_BEST_SUITED_MENTEE.map((s) => (
                <option key={s} value={s}>
                  {s}
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
            <label htmlFor="m-teach">
              Tell us about yourself * ({MIN_ESSAY_WORDS}–{MAX_ESSAY_WORDS} words, required)
            </label>
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
              rows={6}
            />
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              {countWords(mentor.teachingAreas)} words (must be {MIN_ESSAY_WORDS}–{MAX_ESSAY_WORDS})
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
            <label>What are your top development goals? * (select up to {MAX_MULTI_PICKS})</label>
            <div className="checkbox-grid">
              {MENTEE_DEVELOPMENT_GOALS.map((g) => (
                <label key={g} className="radio-line">
                  <input
                    type="checkbox"
                    checked={mentee.developmentGoals.includes(g)}
                    onChange={() =>
                      setMentee({
                        ...mentee,
                        developmentGoals: toggleList(
                          mentee.developmentGoals,
                          g as MenteeDevGoal,
                          MAX_MULTI_PICKS,
                        ),
                      })
                    }
                  />
                  <span>{g}</span>
                </label>
              ))}
            </div>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              Selected: {mentee.developmentGoals.length} / {MAX_MULTI_PICKS}
            </p>
          </div>
          <div className="field">
            <label htmlFor="e-pref-style">Preferred mentorship style *</label>
            <select
              id="e-pref-style"
              value={mentee.preferredMentorshipStyle}
              onChange={(e) =>
                setMentee({
                  ...mentee,
                  preferredMentorshipStyle:
                    e.target.value as MenteeApplication["preferredMentorshipStyle"],
                })
              }
            >
              {MENTEE_PREFERRED_MENTORSHIP_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="e-level">What level of mentor are you looking for? *</label>
            <select
              id="e-level"
              value={mentee.mentorLevelLookingFor}
              onChange={(e) =>
                setMentee({
                  ...mentee,
                  mentorLevelLookingFor:
                    e.target.value as MenteeApplication["mentorLevelLookingFor"],
                })
              }
            >
              {MENTEE_MENTOR_LEVEL_PREFERENCE.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="e-coach">
              Tell us about yourself * ({MIN_ESSAY_WORDS}–{MAX_ESSAY_WORDS} words, required)
            </label>
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
              rows={6}
            />
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              {countWords(mentee.coachingAreas)} words (must be {MIN_ESSAY_WORDS}–{MAX_ESSAY_WORDS})
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
