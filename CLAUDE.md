# Carpil — Orchestrator

LATAM carpooling app, live on the App Store and Google Play with active users. Umbrella repo over two submodules: `app/` (React Native + Expo) and `api/` (Node + Express + TypeScript). Backend: Firebase (Auth + Firestore in `nam5` with `(default)` / `staging` / `prod` DBs) and Functions Gen 2 in `firebase/functions/`. Hosting: Railway (API), EAS (app builds), Cloudflare (DNS). Secrets via Infisical, observability via Sentry + Crashlytics + PostHog.

## Layout

```
carpil/
├── app/                # submodule — React Native + Expo (yarn)
├── api/                # submodule — Node + Express + TS (pnpm)
├── firebase/
│   ├── functions/      # Functions Gen 2 (Node 22, pnpm)
│   ├── seed/           # Firestore seed (npm)
│   ├── firestore.rules
│   └── storage.rules
├── scripts/            # setup, dev, env pulls, token reset
├── decisions/          # legacy (being retired — Linear is canonical)
├── .github/workflows/  # CI + submodule sync
└── Makefile
```

## Stack & environments

| Env | Railway | API domain | Firestore DB |
|---|---|---|---|
| Development | `development` | `dev-api.carpil.app` | `(default)` |
| Preview | `staging` | `preview-api.carpil.app` | `staging` |
| Production | `production` | `api.carpil.app` | `prod` |

- Hosting: Railway (API), EAS (app builds), Cloudflare (DNS).
- Secrets: Infisical project `41a4242c-4634-4662-9d5d-bf90c31f841e`, envs `dev` / `preview` / `prod`. Pull locally via `make env/*`.
- Observability: Sentry, Crashlytics, PostHog.
- **Linear is the roadmap source of truth.** Workspace `carpil`, team `CARPIL` (`9a77469a-...`). Roadmap: 8 NEW-EP* epics, 51 milestones, 217 issues. Every issue has description + AC + estimate + dependencies — don't re-derive scope already on an issue. For bulk operations use a personal API key + GraphQL via `curl` (OAuth via MCP is unreliable in remote sessions).
- Stitch: project `17174419702346855076`, design system `Carpil Nebula — Vibrant`. Canonical URL: `https://stitch.withgoogle.com/projects/{pid}/screens/{sid}`.
- Emulator ports: Auth 9099, Firestore 8080, Storage 9199, Functions 5001, UI 4000.

## Commands

- `make help` — print the command table (default target)
- `make setup` — full bootstrap: submodules + env + deps (chains the three below)
- `make setup/{submodules,env,deps}` — each setup step alone
- `make dev` — Firebase emulator + API + app in parallel, with interactive iOS/Android picker via `gum` in `scripts/dev.sh`
- `make dev/{firebase,api,app}` — single service only (docker compose for firebase + api; Expo for app)
- `make seed` — seed emulator Firestore (`firebase/seed/seed.js`, Node)
- `make env/{dev,preview,production}` — pull secrets from Infisical CLI for that env
- `make reset/tokens` — reset `INFISICAL_TOKEN` + `NPM_TOKEN_GOOGLE_SIGN_IN`
- `make clean` — stop containers + wipe generated files

No lint/typecheck/test at orchestrator level. For code changes, `cd` into the submodule and use its commands.

## Architecture

- Submodules pinned by SHA; `sync-submodules.yml` workflow (cron + `repository_dispatch`) opens PRs to bump them. To work inside a submodule, `cd` in and treat it as its own repo (own branch, commit, PR, and `CLAUDE.md`).
- Single Firebase project `carpil` with 3 Firestore DBs in `nam5` (`(default)` / `staging` / `prod`); API + Functions pick the DB via `FIREBASE_DATABASE_ID` env (local emulator runs project `demo-carpil`).
- Trunk-based across the umbrella: `main` is the only long-lived branch; each submodule has its own release flow (Release PRs + tags + staged deploys).
- Secrets in Infisical (three envs: `dev` / `preview` / `prod`); pull locally via `make env/*`, never commit `.env`.
- Orchestrator-level CI gate: `validate-firebase-rules` (`.github/workflows/ci.yml`) boots Firestore + Storage emulators against the rules files; per-submodule CI lives in each submodule.

## External blockers

Long-lead vendor / legal / approval items that gate critical milestones. Track in Linear; start procurement on day one:

| Blocker | Gates | Linear |
|---|---|---|
| Truora vendor contract + sandbox | KYC auto-verification | `M1.4-A` |
| Stripe Connect Express approval (per country) | Driver payouts | `M14.2-A` |
| Twilio (WhatsApp BSP) template approval | Driver MFA via WhatsApp OTP | `M7.4-A` |
| Hacienda Factura sandbox + e-invoice spec | Factura electrónica CR | `M8.5-A1` |
| Resend account | Transactional email | `M13.3-A` |
| Branch / AppsFlyer / Adjust vendor pick | Deferred deep-link | `M15.2-A` |
| Legal counsel (CR + LATAM) | Corporate ToS | `M6.1-A` |
| Ops: 5–10 unsafe pickup zones (CR) | Pickup geofence blocklist | `M2.6-A` |

## Testing

No orchestrator-level tests. CI runs a boot-only Firestore + Storage rules check. For code changes, verification commands live in each submodule's `CLAUDE.md`.

## Rules

- **Enter plan mode at session start.** This repo is where I spin up Claude instances that touch both submodules — plan first to avoid scope sprawl and PR bloat. Don't touch code until the plan is approved.

- **Before approving the plan, surface the acceptance criteria.** Pull the AC from the Linear issue (app or api) and read them to me — we audit together for missing edge cases. AC items become the tests we write, so get them right at plan time.

- **Search official docs first, then surface alternatives.** Before proposing a solution, check the framework/library docs; if Option A is the obvious first answer, look for Option B before committing. Improvise only when the official docs don't cover the case. Reason: too many "first idea that fits" answers slip through when a cleaner option was one search away.

- **Drive the Linear issue through its lifecycle automatically:**
  - Plan starts → if no Linear issue exists for this work, create one
  - Plan approved → move issue to `In Progress`
  - PR opened → move issue to `In Review`
  - PR merged → move issue to `Done`

- **Branch / commit / PR format: see `CONTRIBUTING.md`.** Quick reference — branches: `<type>/<carpil-id>-<slug>` (e.g. `feat/carpil-123-driver-payouts`); commits: `<type>(carpil-XXX): <subject>` (conventional commits, e.g. `feat(carpil-123): add Stripe Connect Express`); types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`.

- **Batch related work into one PR, separate by commit.** A feature that ships with a refactor + a related fix + a test goes as ONE PR with three commits — not three PRs. Old "one feature, one PR" rule produced churn. Only split when work is genuinely independent or one piece needs to ship faster.

- **Run lint + typecheck + tests locally before opening the PR.** Stack-specific commands live in each submodule's `CLAUDE.md`. Reason: red PRs waste a CI round-trip and I end up babysitting.

- **Prefer `scripts/` over inline Makefile recipes** for non-trivial logic. Reason: scripts are testable and grep-friendly; Makefile recipes are neither.

- **Never push to `main` directly.** Even typos. Reason: bypasses review, floods CI, breaks the Linear → branch → PR audit trail.

- **Never bump submodule pointers manually from the orchestrator.** Reason: `sync-submodules.yml` is the single source of truth; manual bumps race the workflow.

- **Never `2>/dev/null` on build / tool commands** whose output feeds downstream steps. Reason: hides failures, produces silent `null` values that propagate (e.g. `BUILD_URL=null`).

- **Never `--amend` or force-push after a pre-commit hook failure.** Reason: pre-commit failure means the commit didn't happen — `--amend` rewrites the *previous* commit and destroys it. Fix and create a new commit.

- **Never `git add -A` / `git add .`** Reason: risks staging `.env`, secrets, build artifacts. Stage by name.

- **Never `--no-verify` / `--no-gpg-sign`** unless explicitly requested. Reason: hook bypass is an exception, not a default.

- **Delete the workspace once its PR merges.** Conductor/worktree workspaces are ephemeral: create → merge → delete. Reason: each `app/` worktree carries ~2GB of `node_modules`; stale ones accumulate and eat disk with zero value once merged. Don't hoard workspaces.
