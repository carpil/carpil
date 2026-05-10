# Carpil — Orchestrator Repo

Carpooling para Latinoamérica. Live in production on iOS + Android since 2026-04-29 (~1.3k registered users). This repo is the umbrella/orchestrator — the actual app and API live in submodules.

## Repo Layout

```
carpil/                  # this repo (orchestrator, public)
├── app/                  # submodule → carpil/app   (React Native / Expo, public)
├── api/                  # submodule → carpil/api   (Node.js / Express / TS, public)
├── firebase/             # Firestore rules + emulator + seed
├── scripts/              # setup-env.sh, dev.sh, pull-env.sh
├── decisions/            # per-question decision records (~56 resolved on 2026-05-07)
├── DECISION_AUDIT.md     # canonical decisions index
├── OCTALYSIS_VIRAL_AUDIT.md  # canonical product/strategy doc
├── PIPELINE_PLAN.md      # CI/CD plan
├── OTA_STRATEGY.md       # OTA vs binary release strategy
├── RELEASING.md          # release flow
└── Makefile
```

## When Working in a Submodule

When the task is in `app/` or `api/`, treat that submodule as its own repo:

- `cd app/` or `cd api/` before running git commands. **Never commit submodule pointer bumps from the orchestrator** — those happen automatically via the submodule-sync workflow in `.github/workflows/`.
- Each submodule has (or will have) its own `CLAUDE.md` — read it first.
- Branch and PR inside the submodule, not the orchestrator.

## When to Read Which Doc

**Before starting any feature work → check Linear first.** The roadmap is fully scoped (initiative `Carpil Roadmap`, 7 epic projects EP1–EP7, 40 milestones, 199 issues, 221 dependency links). Look for the issue corresponding to the work; if found, the AC + estimate + dependencies are already there. Don't re-derive scope that's already in an issue.

Before proposing roadmap, gamification, retention, KYC, ratings, referrals, or trust/safety changes → **read `OCTALYSIS_VIRAL_AUDIT.md` first**. Every claim there cites `file:line`. Don't re-do exploratory recon if §X already covered it.

Before proposing architecture, infra, or process changes → check `DECISION_AUDIT.md` and `decisions/` — many questions are already decided with rationale.

For release flow → `RELEASING.md`. For pipeline state → `PIPELINE_PLAN.md`.

For UI design references → check the **Stitch project** (`17174419702346855076`) before commissioning new wireframes. ~27 screens already cover login, signup, onboarding, home, ride detail, ride creation 3-step, payment, rating, "Resumen Viaje Finalizado", chat, profile. Design system: `Carpil Nebula — Vibrant` (assets/24cf37ae...). Net new screens needed for the roadmap are catalogued in `/tmp/carpil_linear/stitch_prompts.md` (12 milestones).

## Stack & Environments

- **App:** React Native + Expo (Node 22, yarn). Lives in `app/`.
- **API:** Node.js + Express + TypeScript, runs in Docker on port 3000 locally. Lives in `api/`.
- **Firebase:** single project `carpil`, three Firestore DBs in region `nam5`:
  - `(default)` → development env
  - `staging` → preview/beta env
  - `prod` → production
- **Hosting:** Railway (API), EAS (app builds). Domains proxied through Cloudflare.
- **Secrets:** Infisical (project `41a4242c-4634-4662-9d5d-bf90c31f841e`), envs `dev` / `preview` / `prod`. `make env/{dev,preview,production}` pulls them locally.
- **Observability:** Sentry, Crashlytics, PostHog.
- **Linear:** workspace `carpil`, single team `CARPIL` (`9a77469a-...`). Roadmap as one initiative + 7 epic projects (`EP1`…`EP7`) + 40 project milestones + 199 issues. Every issue has description, AC, estimate (S/M/L), dependencies, ready/blocked status, and external-blocker flag where applicable. Use a Linear personal API key (Settings → Account → Security & access → Personal API keys) + GraphQL via `curl` for bulk operations — OAuth via MCP is unreliable in remote sessions.
- **Stitch (design):** project `17174419702346855076`, design system `Carpil Nebula — Vibrant` (`assets/24cf37ae14a244dbbf4bd625c52f7ce5`). MCP `generate_screen_from_text` calls have been flaky (timeouts in this environment); paste prompts in the Stitch web UI directly.

| Ambient | Railway env | API domain | Firestore DB |
|---|---|---|---|
| Development | `development` | `dev-api.carpil.app` | `(default)` |
| Preview (beta) | `staging` | `preview-api.carpil.app` | `staging` |
| Production | `production` | `api.carpil.app` | `prod` |

## Commands (orchestrator level)

| Command | Purpose |
|---|---|
| `make setup` | Configure local env from scratch (submodules + env + deps) |
| `make dev` | Run Firebase emulator + API + App in parallel |
| `make dev/firebase` / `make dev/api` / `make dev/app` | Individual services |
| `make seed` | Load seed data into Firestore emulator |
| `make env/dev` \| `env/preview` \| `env/production` | Pull secrets from Infisical |
| `make reset/tokens` | Reset `INFISICAL_TOKEN` + `NPM_TOKEN_GOOGLE_SIGN_IN` |
| `make clean` | Stop containers, wipe generated files |

Firebase emulator ports: Auth `9099`, Firestore `8080`, Storage `9199`, UI `4000`.

## Pre-Commit Quality Gates

**Run these locally before opening any PR — never iterate CI failures.**

| Submodule | Package Mgr | Commands |
|---|---|---|
| `app/` | yarn | `cd app && yarn lint && yarn typecheck` |
| `api/` | pnpm | `cd api && pnpm lint && npx tsc --noEmit` (no `typecheck` script; `pnpm build` also typechecks) |

Each submodule has its own `CLAUDE.md` with stack-specific rules — read it when working there.

If a pre-commit hook catches something, fix it and create a **new** commit (never `--amend` after a hook fail — the original commit didn't land).

## Rules

### Always
- **Every feature or issue gets its own branch + PR — no exceptions.** First action when picking up a Linear issue is `git checkout -b <type>/<issue-key>-<slug>` where `<type>` is one of `feat`/`fix`/`chore`/`refactor`/`test`/`docs` and `<issue-key>` is the Linear issue key. Examples: `feat/M9.1-A-strip-phone-from-unauth`, `fix/M3.1-A-rating-math`, `chore/M11.2-A-upstash-redis`. Open a PR back to `main` with the issue key in the title (e.g., `feat(M9.1-A): strip phoneNumber from unauth response`). **Never push to `main` directly** — even for one-line typos.
- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. release-please parses commit messages to generate version bumps, tags, and changelogs — wrong prefix = wrong release. Breaking changes use `!` or `BREAKING CHANGE:` footer.
- **Run lint + typecheck locally** before pushing (see table above).
- **Use the Four Cuts scoping methodology** for any new work that isn't already in Linear: Epic → Milestone → Issue → Acceptance Criteria. Issue descriptions ≤4 sentences (longer = split it); AC items independently testable in <10 seconds; estimates `S` (≤30 min), `M` (30-90 min), `L` (split — `L` not allowed). One issue = one agent session = one PR. New scope mid-flight gets its own issue with AC, never quietly absorbed into the current milestone.
- **Audit tag/trigger alignment at session start** for any release/deploy work:
  ```bash
  gh api repos/carpil/carpil/tags --jq '.[0].name'
  grep -r "tags:" .github/workflows/
  ```
  release-please tag format must match the workflow trigger pattern. Past mismatch (`carpil-v1.1.2` vs `v*`) silently skipped a deploy.
- **Resolve known blockers from prior sessions first.** If a prior session left an item marked PRIORIDAD ALTA, P0, or "fix next session," do it before starting new work.
- **Verify audit citations before branching.** `DECISION_AUDIT.md` and `OCTALYSIS_VIRAL_AUDIT.md` cite `file:line` from a 2026-05-07 snapshot — some have already drifted. Concrete example: the audit blamed `api/src/index.ts:74` for the unauth phone leak, but `api/package.json` `start: node build/main.js` shows production runs the modular `main.ts` (legacy `index.ts` is stale). Before opening a P0 fix branch, run a 5-min recon (grep + curl + Railway start command) to confirm the cited code is the actual prod path. If the citation is stale, fix the right file and flag the audit drift in the PR.

### Never
- **Never push directly to `main`.** Zero exceptions — not for typos, not for one-line copy fixes, not for "trivial" changes. Every commit reaches `main` only via a branch + PR. Direct pushes flood CI, bypass auto-merge, skip review, and break the Linear issue → branch → PR → tag audit trail. If you typed `git push` and your current branch is `main`, stop and `git checkout -b <type>/<slug>` first.
- **Never `2>/dev/null` on build/tool commands** whose output feeds downstream steps. It hides failures and produces silent `null` results (e.g. `BUILD_URL=null`). If you find one, flag it as a blocker and remove it.
- **Never modify submodules from the orchestrator.** Don't bump submodule pointers manually — the sync workflow handles it. Work happens *inside* `app/` or `api/`.
- **Never `--amend` or force-push** after a pre-commit hook failure (the commit didn't happen — `--amend` rewrites the *previous* one, destroying work). Fix and re-commit.
- **Never use `git add -A` / `git add .`** — risks committing `.env`, secrets, or build artifacts. Stage by name.
- **Never skip hooks** (`--no-verify`, `--no-gpg-sign`) unless I explicitly ask.
- **Never invent scope mid-session.** A new request becomes a new issue with AC; it doesn't quietly merge into the current milestone. Mid-flight scope creep is the #1 reason milestones slip.

## Pipeline (mental model)

```
feat/CARPIL-###  ──PR──►  main
                            ├─► API → Railway development (auto)
                            ├─► App → OTA dev or EAS build (per fingerprint)
                            └─► release-please opens Release PR

           Release PR merge ──►  tag vX.Y.Z
                            ├─► API → Railway staging
                            ├─► App → TestFlight Internal + Play Internal
                            ├─► E2E Maestro (Android + iOS) → gate
                            └─► (manual approval) → production
```

Trunk-based. One long-lived branch: `main`. Full flow in `RELEASING.md`.

## Known Production Bugs

All tracked in Linear. Verify these still exist before fixing — memory may be stale:

- **P0 unauthenticated phone-number leak:** `GET /rides/drivers/:id` returns driver `phoneNumber` with no auth required. Tracked as Linear `M9.1-A` in milestone `MS6.1`. Ship within 2 weeks of session start. (Source: `DECISION_AUDIT.md` §1.)
- Hardcoded `"4.9 · Conductor"` rating string at `app/app/(app)/ride/[id].tsx:357`. Linear `M3.1-C` in `MS2.1`.
- Broken `averageRating` math `(old+new)/2` at `api/src/services/ratings.service.ts:47` — corrupting public profiles for all ~1.3k users; fix requires backfill. Linear `M3.1-A` (math fix) + `M3.1-B` (backfill) in `MS2.1`.

## External Blockers (start procurement now)

Long-lead vendor / approval items that gate critical milestones. Every day not started extends the critical path:

| Blocker | Gates milestone | Linear issue |
|---|---|---|
| Truora vendor contract + sandbox | `MS1.3` (auto ID verification) | `M1.4-A` |
| Stripe Connect Express approval (per country: CR/MX/CO easier; BR/AR/CL harder) | `MS5.2` (driver payouts) | `M14.2-A` |
| WhatsApp Cloud API template approval (CR first) | `MS6.3` (driver MFA via WhatsApp OTP) | `M7.4-A` |
| Hacienda Factura sandbox + e-invoice spec compliance | `MS6.5` (factura electrónica) | `M8.5-A1` |
| Resend account creation | `MS7.6` (transactional email) | `M13.3-A` |
| Branch (or AppsFlyer/Adjust) vendor decision | `MS3.6` (deferred deep-link) | `M15.2-A` |
| Legal counsel review (CR + LATAM) | `MS4.1` (corporate ToS) | `M6.1-A` |
| Ops to identify 5–10 unsafe pickup zones (CR) | `MS1.6` (pickup geofence blocklist) | `M2.6-A` |

## Working Style

- One step at a time — implement, wait for me to test before continuing.
- Concise responses, minimal narration.
- Ask clarifying questions before non-trivial implementation.
- Prefer scripts in `scripts/` over inline Makefile logic for anything non-trivial.
