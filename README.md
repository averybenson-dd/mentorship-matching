# DxLx S&O Mentorship (GitHub Pages + Supabase)

Single-page app for mentor/mentee applications, admin matching/publish controls, and participant lookup. **Data lives in Supabase Postgres** (not in GitHub itself) so every browser shares the same responses. GitHub hosts the static frontend; Supabase hosts the database and the small **Edge Function** that gates admin operations and public lookup.

## Features

- **Apply** — mentor vs mentee flows; **work email** is the unique key per role (re-submitting upserts the same row). **Manager name fields were removed.**
- **Admin** — password `admin1999` by default (must match the `ADMIN_PASSWORD` secret in Supabase). List/edit/delete (delete still requires typing `DELETE` + acknowledgment), **Match / Publish / Unpublish / Rematch**, JSON export snapshot.
- **My match** — after publish, lookup by **email only** (no mentor/mentee toggle). If someone applied as both roles with the same email, you may see two pairing cards.
- **Rationale** — at least **two paragraphs**, grounded in excerpts from teaching areas, coaching goals, values, team, orders, and notes.
- **Routing** — `HashRouter` (`/#/apply`) for GitHub Pages.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In the SQL editor, run the migration in `supabase/migrations/20260423000000_init.sql`.

## 2. Deploy the Edge Function

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from this repo:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Set secrets (use a strong admin password in production; for the stock app use `admin1999` if you want parity with the UI copy):

```bash
supabase secrets set ADMIN_PASSWORD=admin1999
```

**LLM auth (priority: Gemini → Anthropic → OpenAI)**

1. **Google Gemini ([AI Studio](https://aistudio.google.com/apikey))** — default when `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, or `GOOGLE_API_KEY` is set. Uses the [Generative Language API](https://ai.google.dev/api/rest) (`generateContent`, JSON output).

   ```bash
   supabase secrets set GEMINI_API_KEY=...   # API key from Google AI Studio
   # optional; default gemini-2.0-flash
   supabase secrets set GEMINI_MODEL=gemini-2.0-flash
   ```

2. **Anthropic Claude** — if no Gemini key, uses `ANTHROPIC_API_KEY` ([Console](https://console.anthropic.com/)); not the same as a consumer claude.ai-only subscription.

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set ANTHROPIC_MODEL=claude-3-5-sonnet-20241022   # optional
   ```

3. **Direct OpenAI** — if neither Gemini nor Anthropic keys are set:

   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase secrets set OPENAI_MODEL=gpt-4o-mini   # optional
   ```

Secrets are read **only inside the Edge Function** (never in GitHub Pages). After any change: `supabase functions deploy mentor-backend --no-verify-jwt`.

Deploy:

```bash
supabase functions deploy mentor-backend --no-verify-jwt
```

`--no-verify-jwt` is required because the browser calls the function with the **anon** key for public actions (`submitApplication`, `programStatus`, `lookupMatch`).

## 3. Configure GitHub Actions (Pages build)

In your GitHub repo → **Settings → Secrets and variables → Actions** → **Repository secrets** (the **Repository** tab, not “Environment secrets” only on `github-pages`), add:

| Secret | Value |
|--------|--------|
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **anon public** key (Settings → API → Legacy anon / service_role) |

If you only add these under **Environments → github-pages**, the **build** job cannot see them, and the live site will still show “backend missing.” The workflow reads `${{ secrets.* }}` at the **repository** level for `npm run build`.

The workflow passes these into `npm run build` so the static site can call Supabase.

**Important:** Never commit the **service role** key to the repo or to Vite env vars. It is only used inside the Edge Function (Supabase injects `SUPABASE_SERVICE_ROLE_KEY` automatically).

## Local development

Create `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Then:

```bash
npm install
npm run dev
```

## Security notes

- The admin password is checked **server-side** in the Edge Function. The in-app default is still a simple password — treat it as a convenience gate, not enterprise IAM.
- Public endpoints (`submitApplication`, `lookupMatch`) can be abused (spam, enumeration). For a wider rollout add rate limiting (e.g. Cloudflare in front), CAPTCHA, or authenticated submit.

## Matching logic

**Match / Rematch** runs in the **`mentor-backend` Edge Function**: **Gemini** (`GEMINI_API_KEY` / `GOOGLE_AI_API_KEY`, `GEMINI_MODEL`), else **Anthropic** Messages, else **OpenAI** Chat Completions. The model receives trimmed mentor/mentee JSON and returns pairs + rationales; the function validates capacity, duplicate mentees, and “no” availability before saving to `program_state`.

The older heuristic matcher still exists in `src/lib/matching.ts` for reference but is **not** used by the admin UI anymore.

## Deploy to GitHub Pages

Enable **GitHub Actions** as the Pages source. Pushes to `main` run `.github/workflows/deploy-pages.yml`, which must receive the Supabase secrets above.

Site URL pattern: `https://<user>.github.io/<repo>/#/apply`
