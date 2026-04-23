# DxLx S&O Mentorship (static web app)

Single-page app for collecting mentor/mentee applications, running a deterministic matching pass, publishing results, and letting participants look up their pairing.

## Features

- Public **Apply** flow with mentor vs mentee paths (questions mirror your Google Form templates).
- **Admin** console (password: `admin1999`) to review submissions, **Match**, **Publish** / **Unpublish**, **Rematch**, edit JSON payloads, and export/import backups.
- **Delete** requires typing `DELETE` and checking an acknowledgment — not a one-click removal.
- **My match** lookup (only after publish) using the applicant’s name.
- **Hash-based routing** (`/#/apply`) so hosting on **GitHub Pages** does not require SPA rewrite rules.

## Local development

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source (not “Deploy from a branch” unless you prefer that flow).
3. Ensure **Settings → Actions → General → Workflow permissions** allows **Read and write** (needed for Pages artifacts on some orgs).
4. Push to `main` (or edit `.github/workflows/deploy-pages.yml` to use your default branch). The workflow builds with:

   `VITE_BASE_PATH=/<repository-name>/`

   so asset URLs resolve correctly for project sites (`https://<user>.github.io/<repo>/`).

5. After the workflow succeeds, open the Pages URL and use routes like `https://<user>.github.io/<repo>/#/apply`.

If you host at the root of a custom domain, set `VITE_BASE_PATH=/` when building.

## Data storage (important)

By default, submissions and matches are stored in each visitor’s browser **`localStorage`**. That is fine for demos or a single shared machine, but **applicants will not see each other’s submissions centrally**, and admins only see data for browsers where responses were collected or JSON was imported.

For a real company rollout you will want a small database (for example Supabase or Firebase) plus server-side rules so PII is not world-readable. The export/import tools exist so coordinators can shuttle data until a backend is wired in.

## Security notes

- The admin password is embedded in client code — anyone can extract it. Treat this as an operational convenience for a trusted internal pilot, not strong security.
- Do not collect highly sensitive information in the free static version without a proper backend and access controls.

## Matching logic

Matching runs entirely in the browser (no external model API calls, so nothing is sent to a third party). It tokenizes coaching/teaching text, scores overlap, rewards mentee value goals that include the mentor’s “superpower” value, respects mentor mentee capacity, and skips obvious “No” availability answers. Each pair stores a plain-language **rationale** blurb you can later replace with an LLM by calling OpenAI (or similar) from a **secured server or edge function** — do not ship API keys in this static bundle.
