import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  COMMITMENT_MENTEE,
  COMMITMENT_MENTOR,
  DOORDASH_VALUES,
  MENTEE_JOB_TITLES,
  MENTOR_MENTEE_CAPACITY,
} from "../constants";
import { addApplication } from "../lib/storage";
import type {
  MentorApplication,
  MenteeApplication,
  MenteeJobTitle,
  MentorCommitment,
  MenteeCommitment,
  Role,
} from "../types";

const initialMentor: Omit<MentorApplication, "role"> = {
  name: "",
  region: "",
  jobTitle: "",
  managerName: "",
  commitment: "yes",
  menteeCapacity: 2,
  valueSuperpower: 1,
  teachingAreas: "",
  favoriteOrder: "",
  notes: "",
};

const initialMentee: Omit<MenteeApplication, "role"> = {
  name: "",
  region: "",
  jobTitle: "Associate",
  jobTitleOther: "",
  managerName: "",
  team: "",
  commitment: "yes",
  valuesToDevelop: [],
  coachingAreas: "",
  favoriteOrder: "",
  careerNotes: "",
};

export default function ApplyPage() {
  const [role, setRole] = useState<Role | "">("");
  const [mentor, setMentor] = useState(initialMentor);
  const [mentee, setMentee] = useState(initialMentee);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (role === "mentor") return "Mentor application";
    if (role === "mentee") return "Mentee application";
    return "Application";
  }, [role]);

  function toggleMenteeValue(idx: number) {
    setMentee((m) => {
      const has = m.valuesToDevelop.includes(idx);
      const valuesToDevelop = has
        ? m.valuesToDevelop.filter((i) => i !== idx)
        : [...m.valuesToDevelop, idx].sort((a, b) => a - b);
      return { ...m, valuesToDevelop };
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!role) {
      setError("Please choose mentor or mentee.");
      return;
    }
    if (role === "mentor") {
      if (!mentor.name.trim() || !mentor.region.trim() || !mentor.jobTitle.trim()) {
        setError("Please complete all required mentor fields.");
        return;
      }
      if (!mentor.managerName.trim() || !mentor.teachingAreas.trim() || !mentor.favoriteOrder.trim()) {
        setError("Please complete all required mentor fields.");
        return;
      }
      const payload: MentorApplication = { role: "mentor", ...mentor };
      addApplication(payload);
    } else {
      if (!mentee.name.trim() || !mentee.region.trim() || !mentee.managerName.trim() || !mentee.team.trim()) {
        setError("Please complete all required mentee fields.");
        return;
      }
      if (mentee.jobTitle === "Other" && !mentee.jobTitleOther?.trim()) {
        setError("Please specify your job title.");
        return;
      }
      if (mentee.valuesToDevelop.length === 0) {
        setError("Pick at least one value you want to develop.");
        return;
      }
      if (!mentee.coachingAreas.trim() || !mentee.favoriteOrder.trim()) {
        setError("Please complete coaching areas and your go-to order.");
        return;
      }
      const payload: MenteeApplication = { role: "mentee", ...mentee };
      addApplication(payload);
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="card">
        <h1>Thank you</h1>
        <p className="lead">Your application was saved. Program administrators will follow up.</p>
        <div className="row">
          <Link className="btn secondary" to="/">
            Home
          </Link>
          <button type="button" className="btn" onClick={() => { setDone(false); setRole(""); }}>
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
        program pairs people based on development goals and mentor strengths.
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
            <label htmlFor="m-name">Name *</label>
            <input
              id="m-name"
              value={mentor.name}
              onChange={(e) => setMentor({ ...mentor, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="m-region">Which state or region are you based in? *</label>
            <input
              id="m-region"
              value={mentor.region}
              onChange={(e) => setMentor({ ...mentor, region: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="m-title">Job title *</label>
            <input
              id="m-title"
              value={mentor.jobTitle}
              onChange={(e) => setMentor({ ...mentor, jobTitle: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="m-mgr">Manager&apos;s name *</label>
            <input
              id="m-mgr"
              value={mentor.managerName}
              onChange={(e) => setMentor({ ...mentor, managerName: e.target.value })}
              required
            />
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
            <label htmlFor="m-val">Which DoorDash value is your superpower? *</label>
            <select
              id="m-val"
              value={String(mentor.valueSuperpower)}
              onChange={(e) =>
                setMentor({ ...mentor, valueSuperpower: Number(e.target.value) as number })
              }
            >
              {DOORDASH_VALUES.map((v, i) => (
                <option key={v} value={String(i + 1)}>
                  {i + 1}. {v}
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
          <div className="field">
            <label htmlFor="m-order">Please share your go-to DoorDash order *</label>
            <textarea
              id="m-order"
              value={mentor.favoriteOrder}
              onChange={(e) => setMentor({ ...mentor, favoriteOrder: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="m-notes">Anything else we should know?</label>
            <textarea
              id="m-notes"
              value={mentor.notes ?? ""}
              onChange={(e) => setMentor({ ...mentor, notes: e.target.value })}
            />
          </div>
        </>
      )}

      {role === "mentee" && (
        <>
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
            <label htmlFor="e-region">Which state or region are you based in? *</label>
            <input
              id="e-region"
              value={mentee.region}
              onChange={(e) => setMentee({ ...mentee, region: e.target.value })}
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
          {mentee.jobTitle === "Other" && (
            <div className="field">
              <label htmlFor="e-title-other">Please specify *</label>
              <input
                id="e-title-other"
                value={mentee.jobTitleOther ?? ""}
                onChange={(e) => setMentee({ ...mentee, jobTitleOther: e.target.value })}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="e-mgr">Manager&apos;s name *</label>
            <input
              id="e-mgr"
              value={mentee.managerName}
              onChange={(e) => setMentee({ ...mentee, managerName: e.target.value })}
              required
            />
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
            <label>Which DoorDash values are you looking to further develop? *</label>
            <div className="checkbox-grid">
              {DOORDASH_VALUES.map((v, i) => {
                const idx = i + 1;
                return (
                  <label key={v} className="radio-line">
                    <input
                      type="checkbox"
                      checked={mentee.valuesToDevelop.includes(idx)}
                      onChange={() => toggleMenteeValue(idx)}
                    />
                    <span>
                      {idx}. {v}
                    </span>
                  </label>
                );
              })}
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
          <div className="field">
            <label htmlFor="e-order">Please share your go-to DoorDash order *</label>
            <textarea
              id="e-order"
              value={mentee.favoriteOrder}
              onChange={(e) => setMentee({ ...mentee, favoriteOrder: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="e-career">Anything else about your goals or interest in a mentor?</label>
            <textarea
              id="e-career"
              value={mentee.careerNotes ?? ""}
              onChange={(e) => setMentee({ ...mentee, careerNotes: e.target.value })}
            />
          </div>
        </>
      )}

      {error && <div className="error">{error}</div>}

      {role && (
        <div className="stack">
          <button className="btn primary" type="submit">
            Submit application
          </button>
          <Link className="btn secondary" to="/">
            Cancel
          </Link>
        </div>
      )}
    </form>
  );
}
