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
# optional: defaults to gpt-4o-mini
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

**LLM auth (choose one path):**

1. **Anthropic Claude (API)** — uses the [Messages API](https://docs.anthropic.com/en/api/messages). This is **billing in Anthropic Console**, not the same as a personal **claude.ai** chat subscription (those do not expose an API key to your app).

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # optional; default claude-3-5-sonnet-20241022
   supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-20250514
   ```

   If `ANTHROPIC_API_KEY` is set, the Edge Function **ignores** OpenAI/Portkey for matching.

2. **Direct OpenAI**:

   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   ```

3. **Portkey** (optional; keys/limits/routing in [Portkey](https://portkey.ai)): the Edge Function calls `https://api.portkey.ai/v1/chat/completions` with `x-portkey-api-key`. Only used when **`ANTHROPIC_API_KEY` is not set**.

   **Virtual key** (OpenAI credential stays in Portkey’s vault):

   ```bash
   supabase secrets set PORTKEY_API_KEY=...        # Portkey API key from their dashboard
   supabase secrets set PORTKEY_VIRTUAL_KEY=...    # Virtual key id for your OpenAI provider
   ```

   **Or** pass-through OpenAI key through Portkey:

   ```bash
   supabase secrets set PORTKEY_API_KEY=...
   supabase secrets set OPENAI_API_KEY=sk-...      # Portkey forwards to OpenAI (x-portkey-provider: openai)
   ```

   **Or** Model Catalog slug (OpenAI-style chat; credentials live in Portkey, not in Supabase):

   ```bash
   supabase secrets set PORTKEY_API_KEY=...   # same workspace key you use in Portkey
   supabase secrets set PORTKEY_PROVIDER=openai-dasher-logistics   # catalog slug; Edge prefixes `@` on `x-portkey-provider` if missing
   supabase secrets set OPENAI_MODEL=gpt-4o-mini   # short model id in the JSON body (Portkey docs use this with `@slug` on the provider header)

   **Or** use Portkey’s combined model id as the body `model` (still set `PORTKEY_API_KEY`; you can keep or omit `PORTKEY_PROVIDER` depending on what Portkey expects for your workspace):

   ```bash
   supabase secrets set OPENAI_MODEL=@openai-dasher-logistics/gpt-4o-mini
   ```
   ```

   **Routing priority** (no virtual key): if `OPENAI_API_KEY` is set, it wins over **`PORTKEY_PROVIDER`**. If `ANTHROPIC_API_KEY` is set, Anthropic wins over Portkey entirely. For **catalog-only**, remove `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` from Edge secrets so only `PORTKEY_API_KEY` + `PORTKEY_PROVIDER` apply.

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

**Match / Rematch** runs in the **`mentor-backend` Edge Function** using the **OpenAI Chat Completions** shape, either **directly** (`OPENAI_API_KEY`) or via the **Portkey** gateway (`PORTKEY_API_KEY` + virtual key or provider). Model defaults to `OPENAI_MODEL` or `gpt-4o-mini`. The model receives trimmed mentor/mentee JSON and returns pairs + rationales; the function validates capacity, duplicate mentees, and “no” availability before saving to `program_state`.

The older heuristic matcher still exists in `src/lib/matching.ts` for reference but is **not** used by the admin UI anymore.

## Deploy to GitHub Pages

Enable **GitHub Actions** as the Pages source. Pushes to `main` run `.github/workflows/deploy-pages.yml`, which must receive the Supabase secrets above.

Site URL pattern: `https://<user>.github.io/<repo>/#/apply`
