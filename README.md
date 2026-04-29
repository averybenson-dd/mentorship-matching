# 2026 DxLx Mentorship Program — Web App

Vite + React + TypeScript SPA for the **DxLx Mentorship Program**: mentor and mentee applications, AI-assisted matching, admin operations, and participant lookup. **Application data lives in Supabase (Postgres)** so every device sees the same records. **GitHub Pages** hosts the static frontend; **Supabase Edge Functions** run the `mentor-backend` API (public apply/lookup + admin-gated actions).

Routing uses **HashRouter** (`/#/apply`, `/#/admin`, `/#/results`) so deep links work on GitHub Pages.

If someone applied as **both** mentor and mentee with the same email, **View My Match** can show two cards (one per role).

---

## What participants see

- **Apply** — Choose mentor or mentee. Applications are keyed by **work email + role** (re-submitting updates the same row). Structured questions (focus areas, goals, styles, etc.) plus a **short essay**: **10–50 words** (inclusive), validated in the browser and again in the Edge Function.
- **View My Match** — After admins **publish** results, anyone can look up by the **same email** used on the form.
  - **Mentors** see each matched mentee’s **application answers** (including the short essay and dropdown selections) plus the **AI rationale** and match score.
  - **Mentees** see the **AI rationale** and score, and only the mentor’s **name and job title**. Mentor essays and other mentor form fields are **not** returned to mentees.

---

## What admins do

- **Admin console** (`/#/admin`) — List applications, edit payload JSON, guarded delete, export snapshot JSON, **Run AI match**, **Publish / Unpublish**, rematch, and optional **manual** pairings.
- **Admin password** — Set only as the Supabase secret `ADMIN_PASSWORD`. **Do not commit passwords** to this repo or paste them into documentation. Use a strong value in production; rotate if it leaks.

---

## Matching (AI)

- **Run AI match** calls an LLM from the Edge Function with mentor/mentee JSON (essays truncated for the prompt). **Priority:** Gemini (Google AI Studio) → Anthropic → OpenAI, depending on which API keys are configured as secrets.
- The model must respect **mentor capacity**, **one mentee per pair**, **mentor job title strictly more senior than mentee** on the shared ladder, and output **valid JSON** with per-pair rationales. The function validates output; failures surface as specific error codes in the admin UI.
- Optional secrets such as `GEMINI_MODEL`, `GEMINI_MAX_OUTPUT_TOKENS`, `ANTHROPIC_*`, `OPENAI_*` tune models and per-request output limits. **TPM limits in AI Studio are not the same** as per-completion `maxOutputTokens`; large cohorts may need higher output caps or shorter rationales in the prompt.

A legacy heuristic matcher remains in `src/lib/matching.ts` for reference; **admin matching uses the Edge Function + LLM**, not that file.

---

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/20260423000000_init.sql`.

---

## 2. Edge Function + secrets

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from this repo:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Set at least:

```bash
supabase secrets set ADMIN_PASSWORD='<generate-a-strong-secret>'
```

**LLM (optional but required for AI match)** — configure one or more:

**Gemini (preferred if key present)**

```bash
supabase secrets set GEMINI_API_KEY='...'   # or GOOGLE_AI_API_KEY / GOOGLE_API_KEY
# optional
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
supabase secrets set GEMINI_MAX_OUTPUT_TOKENS=65536
```

**Anthropic** (if no Gemini key)

```bash
supabase secrets set ANTHROPIC_API_KEY='sk-ant-...'
# optional
supabase secrets set ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**OpenAI** (if neither Gemini nor Anthropic)

```bash
supabase secrets set OPENAI_API_KEY='sk-...'
# optional
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

Redeploy after changing secrets or function code:

```bash
supabase functions deploy mentor-backend --no-verify-jwt
```

`--no-verify-jwt` is used because the browser calls the function with the **anon** key for public actions (`submitApplication`, `programStatus`, `lookupMatch`).

Secrets are read **only inside the Edge Function**. Never commit the **service role** key to the repo or to Vite env vars; Supabase injects `SUPABASE_SERVICE_ROLE_KEY` for the function automatically.

---

## 3. GitHub Actions (GitHub Pages)

In the repo → **Settings → Secrets and variables → Actions** → **Repository secrets** (not only Environment secrets on `github-pages`), add:

| Secret | Value |
|--------|--------|
| `VITE_SUPABASE_URL` | e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project **anon** key (Settings → API) |

The workflow in `.github/workflows/deploy-pages.yml` passes these into `npm run build`. If secrets are missing or only defined under Environments the build cannot see them, and the site will show backend configuration errors.

Site URL pattern: `https://<user>.github.io/<repo>/#/apply`

---

## Local development

Create `.env.local` (do not commit):

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Then:

```bash
npm install
npm run dev
```

---

## Security notes

- Admin access is a **shared password** verified in the Edge Function — suitable for a pilot, not a substitute for SSO or full IAM.
- Public endpoints (`submitApplication`, `lookupMatch`) can be abused (spam, enumeration). For a wider rollout consider rate limiting (e.g. CDN/WAF), CAPTCHA, or authenticated flows.

---

## License / ownership

Internal program tooling; use and deployment policies follow your organization’s guidelines.
