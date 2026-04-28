/**
 * Submit N synthetic mentor/mentee applications for load testing.
 *
 * Requires (same as the Vite app):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/pressure-test-applications.mjs
 *
 * Optional: COUNT=25 SEED=1
 */

const COUNT = Math.max(1, Math.min(100, Number(process.env.COUNT) || 25));
const SEED = Number(process.env.SEED) || 1;

const MENTOR_JOB_TITLES = ["Manager", "Senior Manager", "Director", "Senior Director"];
const MENTEE_JOB_TITLES = [
  "Associate",
  "Senior Associate",
  "Associate Manager",
  "Manager",
  "Senior Manager",
];
const MENTOR_FOCUS_AREAS = [
  "People Management",
  "Career Growth & Promotions",
  "Cross-functional Collaboration",
  "Strategic Thinking",
  "Operations / Execution",
  "Product / Tech",
  "Data & Analytics",
  "Communication & Influence",
];
const MENTOR_MENTORSHIP_STYLES = [
  "Hands-on / Tactical (resume reviews, problem solving)",
  "Strategic / Big-picture guidance",
  "Coaching through questions (Socratic style)",
  "Sponsorship & advocacy",
  "Flexible / depends on mentee needs",
];
const MENTOR_BEST_SUITED_MENTEE = [
  "Early career (0–2 years)",
  "Mid-level (3–6 years)",
  "Senior ICs",
  "New managers",
  "Aspiring managers",
];
const MENTEE_DEVELOPMENT_GOALS = [
  "Getting promoted",
  "Becoming a manager",
  "Improving performance in current role",
  "Building strategic thinking skills",
  "Navigating cross-functional work",
  "Improving communication / influence",
  "Exploring new career paths",
];
const MENTEE_PREFERRED_MENTORSHIP_STYLES = [
  "Direct advice & feedback",
  "Structured guidance (goals, plans)",
  "Open-ended coaching conversations",
  "Accountability check-ins",
  "Flexible",
];
const MENTEE_MENTOR_LEVEL_PREFERENCE = [
  "1 level above me",
  "2+ levels above me",
  "Different function / perspective",
  "No preference",
];

const FIRST = [
  "Jordan",
  "Priya",
  "Marcus",
  "Elena",
  "Sam",
  "Taylor",
  "Devon",
  "Aisha",
  "Chris",
  "Morgan",
  "Riley",
  "Alex",
  "Jamie",
  "Casey",
  "Quinn",
  "Blake",
  "Skyler",
  "Noah",
  "Zoe",
  "Diego",
  "Kenji",
  "Amara",
  "Vikram",
  "Sofia",
  "Hannah",
];
const LAST = [
  "Nguyen",
  "Patel",
  "Okafor",
  "Martinez",
  "Kim",
  "Chen",
  "Williams",
  "Brown",
  "Garcia",
  "Thompson",
  "Singh",
  "Park",
  "Rivera",
  "Davis",
  "Lee",
  "Johnson",
  "Anderson",
  "Silva",
  "Khan",
  "Murphy",
  "Tanaka",
  "Okonkwo",
  "Hernandez",
  "Foster",
  "Brooks",
];
const ORGS = [
  "New Verticals strategy",
  "Marketplace growth analytics",
  "Dasher experience programs",
  "Merchant ads and promos",
  "Corporate FP&A",
  "Legal product partnerships",
  "People Technology",
  "Eng reliability for dispatch",
  "Ads measurement science",
  "Mx onboarding tooling",
  "Consumer subscriptions",
  "International expansion PMO",
  "Trust and safety policy",
  "Supply chain S&O",
];

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickN(rng, arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** 10–50 words (matches production essay limits). */
function mentorEssay(name, title, org) {
  return (
    `I am ${name}, ${title} on ${org} at DoorDash. ` +
    `I focus on roadmap alignment, stakeholder trust, and execution at scale. ` +
    `I mentor on communication, prioritization, and cross-team delivery with patience and candor.`
  );
}

function menteeEssay(name, title, org) {
  return (
    `Hi, I am ${name}, a ${title} in ${org} at DoorDash. ` +
    `I want clearer promotion goals, stronger exec presence, and practical feedback each session. ` +
    `I learn best with short agendas and small experiments between meetings.`
  );
}

async function submit(baseUrl, anonKey, payload) {
  const url = `${baseUrl.replace(/\/$/, "")}/functions/v1/mentor-backend`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ action: "submitApplication", payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status} ${JSON.stringify(json)}`);
  }
  if (!json.ok) {
    throw new Error(String(json.error ?? "submit_failed"));
  }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY).");
  process.exit(1);
}

let ok = 0;
let fail = 0;

for (let i = 0; i < COUNT; i++) {
  const idx = i + 1;
  const r = mulberry32(SEED + i * 7919);
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 3) % LAST.length];
  const name = `${first} ${last}`;
  const email = `mentorship.loadtest.${String(idx).padStart(2, "0")}.${Date.now()}@doordash.com`;
  const org = pick(r, ORGS);
  const asMentor = r() < 0.52;

  try {
    if (asMentor) {
      const jobTitle = pick(r, MENTOR_JOB_TITLES);
      const payload = {
        role: "mentor",
        email,
        name,
        jobTitle,
        menteeCapacity: 1 + Math.floor(r() * 5),
        mentorFocusAreas: pickN(r, MENTOR_FOCUS_AREAS, 1 + Math.floor(r() * 3)),
        mentorshipStyle: pick(r, MENTOR_MENTORSHIP_STYLES),
        bestSuitedMentee: pick(r, MENTOR_BEST_SUITED_MENTEE),
        teachingAreas: mentorEssay(name, jobTitle, org),
      };
      await submit(url, anonKey, payload);
      console.log(`OK mentor  ${idx}/${COUNT} ${email}`);
    } else {
      const jobTitle = pick(r, MENTEE_JOB_TITLES);
      const payload = {
        role: "mentee",
        email,
        name,
        jobTitle,
        developmentGoals: pickN(r, MENTEE_DEVELOPMENT_GOALS, 1 + Math.floor(r() * 3)),
        preferredMentorshipStyle: pick(r, MENTEE_PREFERRED_MENTORSHIP_STYLES),
        mentorLevelLookingFor: pick(r, MENTEE_MENTOR_LEVEL_PREFERENCE),
        coachingAreas: menteeEssay(name, jobTitle, org),
      };
      await submit(url, anonKey, payload);
      console.log(`OK mentee ${idx}/${COUNT} ${email}`);
    }
    ok++;
  } catch (e) {
    fail++;
    console.error(`FAIL ${idx}/${COUNT} ${email}:`, e.message || e);
  }
}

console.log(`\nDone. Success: ${ok}, failed: ${fail}`);
