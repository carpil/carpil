# Carpil Functions

Firebase Cloud Functions for Carpil. Hosts scheduled jobs (ride lifecycle, retention runner) and one-off webhooks that don't belong in the Express API.

## Stack

- Firebase Functions Gen 2 (`firebase-functions@6`)
- Node 22 runtime
- TypeScript 5.7
- `firebase-admin@13` for Firestore + Auth access

## Commands

| Command | Purpose |
|---|---|
| `pnpm build` | `tsc` → emits `lib/` |
| `pnpm serve` | Build + run emulators (Functions + Firestore) |
| `pnpm deploy` | `firebase deploy --only functions` |
| `pnpm logs` | Tail deployed function logs |
| `pnpm lint` | `tsc --noEmit` (typecheck) |

## Local dev

```bash
cd firebase/functions
pnpm install
pnpm serve
```

Emulator UI: http://localhost:4000

## Deploy

Deploys hit the `carpil` Firebase project (single project, three Firestore DBs — `(default)` / `staging` / `prod`). Set the right project before deploying:

```bash
firebase use development   # or: staging, production
pnpm deploy
```

## Layout

```
firebase/functions/
├── src/
│   ├── index.ts          # entry point — exports all functions
│   ├── scheduled/        # onSchedule jobs (ride-lifecycle, retention-runner, …)
│   ├── triggers/         # onDocument / onCall triggers
│   └── push/             # push notification helpers (expo-server-sdk wrapper)
├── package.json
├── tsconfig.json
└── README.md
```

## Adding a new function

1. Create file under `src/scheduled/` or `src/triggers/`.
2. Re-export from `src/index.ts`.
3. `pnpm build` to verify TS.
4. `pnpm serve` to test locally.
5. `pnpm deploy` to ship (or wait for the CI deploy step).
