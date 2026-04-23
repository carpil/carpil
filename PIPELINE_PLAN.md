# Plan de Automatización del Pipeline — Carpil

**Fecha:** 2026-04-22
**Objetivo deadline:** lunes 2026-04-27 (MVP), miércoles 2026-04-29 (completo)

---

## Objetivo

Establecer un pipeline CI/CD automatizado trunk-based con `release-please`, que permita:

- **OTA updates** automáticos para cambios JS-only (minutos, sin review)
- **Build nativo automático** solo cuando el fingerprint del proyecto nativo cambia
- Promoción clara: merge a `main` → dev, Release PR merge → preview, tag `vX.Y.Z` → producción
- Observabilidad distribuida app ↔ API
- Tests E2E con Maestro, con intensidad variable por ambiente
- Onboarding friendly para contributors open source

---

## Modelo de ramas y flujo

Una sola rama long-lived: `main`. Los ambientes se disparan por merges y tags, no por ramas.

```
feature/CARPIL-123  ──PR──►  main
                              │
                              ├─► API: deploy auto a Railway "development"
                              ├─► App: fingerprint check
                              │    ├─ igual → OTA a canal "dev"
                              │    └─ distinto → EAS build perfil "development" → IPA/APK descargable
                              │
                              └─► release-please abre "Release PR" (CHANGELOG + version bump)
                                    │
                                    └─(vos mergeás cuando querés promover)──►
                                          ├─► tag vX.Y.Z creado automáticamente
                                          ├─► API: deploy auto a Railway "staging"
                                          ├─► App: EAS build perfil "preview" → TestFlight Internal + Play Internal
                                          │
                                          └─► (manual approval gate en GH Actions)
                                                ├─► API: deploy a Railway "production"
                                                └─► App: EAS build perfil "production" → App Store + Play Store submit
```

---

## Decisiones clave (confirmadas en sesión de contexto)

| Tema | Decisión |
|------|----------|
| Branching model | Trunk-based (Opción A pura) con release-please |
| Versionado | Independiente por repo (app y api tienen su propio semver) |
| Convención de commits | Conventional Commits (`feat:`, `fix:`, `chore:`, `feat!:`) |
| Branch naming | `<type>/CARPIL-<num>-<short-desc>` (compatible con Linear futuro) |
| Runtime version | `{ policy: "fingerprint" }` en `app.config.ts` |
| Detección OTA vs native | `expo-fingerprint` en CI, comentario en PR |
| Firebase | Un solo proyecto, 3 databases: `(default)` (dev), `staging` (preview), `prod` (producción) |
| Railway | Un solo proyecto con 3 environments: `development`, `staging`, `production` |
| Distribución dev | EAS Internal: IPA ad-hoc + APK vía link/QR (sin TestFlight) |
| Distribución preview | TestFlight Internal + Play Internal Testing |
| Distribución prod | App Store + Play Store (con manual approval) |
| Observabilidad | Sentry (errores + performance + session replay) + PostHog (analytics) |
| Tests E2E | Maestro con tags `@smoke` / `@happy` / `@edge` por ambiente |
| Auto-merge | PRs de vos mismo: sí. PRs de contributors externos: manual |
| CI para contributors OSS | Solo lint + tests + Maestro local. No EAS builds (preserva créditos) |
| Secrets management | Infisical = fuente de verdad para secrets de app. GitHub Secrets = solo tokens de infraestructura CI (5 tokens). Railway y EAS reciben secrets vía Infisical, no copiados a mano. |

---

## Fases

### Fase 0 — Prerequisitos ✅ COMPLETADA (2026-04-22)

**Railway:**
1. Reconectar cada environment con `carpil/api` (los 3 muestran "GitHub Repo not found")
2. Prender "Wait for CI" en los 3 ambientes (`development`, `staging`, `production`)

**Firebase:**
3. Activar scheduled backups en databases `prod` y `staging` (plan Blaze)

**EAS:**
4. `eas device:create` para registrar UDIDs de dispositivos de dev (iOS ad-hoc)

**Infisical** (fuente de verdad — secrets de app organizados por env `dev` / `preview` / `prod`):
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `FIRESTORE_DATABASE_ID` (`(default)` / `staging` / `prod`)
- `STRIPE_SECRET_KEY` (test en dev/preview, live en prod)
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `POSTHOG_API_KEY`
- Cualquier otro secret de runtime de la app o el API

**Railway** → conectar integración nativa de Infisical (sync automático por env, reemplaza copiar vars a mano)

**GitHub Secrets** (solo tokens de infraestructura CI — agregar a `carpil/app` y `carpil/api`):
- `INFISICAL_TOKEN` — para que CI pueda leer Infisical
- `EXPO_TOKEN` — plataforma EAS (desde expo.dev/accounts → Access Tokens)
- `APPLE_APP_STORE_CONNECT_API_KEY` — crear en App Store Connect → Users → Integrations → Keys
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — crear en Play Console → Setup → API access
- `RAILWAY_TOKEN` — desde Railway dashboard → Account → Tokens

> Estos 5 son los únicos secrets que viven en GitHub. Todo lo demás vive en Infisical y se inyecta en CI con `infisical/secrets-action` antes de cada job.

**Criterio de éxito:** Railway conectado con GitHub + Infisical sync activo, los 5 GitHub Secrets en su lugar, backups Firebase activos.

---

### Fase 1 — Convenciones y versionado ✅ COMPLETADA (2026-04-22)

1. **Conventional Commits** adoptado formalmente
2. **commitlint + lefthook** (más ligero que husky) en ambos repos para validar mensajes
3. **`CONTRIBUTING.md`** en `app` y `api` con:
   - Convención de commits con ejemplos
   - Branch naming (`feat/CARPIL-123-add-driver-verification`)
   - PR template con checklist
   - Cómo funciona el versionado automático
4. **`release-please`** configurado en `carpil/app` y `carpil/api`:
   - Genera Release PR con CHANGELOG + version bump automático
   - Vos decidís cuándo promover mergeando la Release PR
5. **`app.config.ts`**: cambiar `runtimeVersion: '1.0.0'` → `runtimeVersion: { policy: "fingerprint" }`

**Criterio de éxito:** Commit `feat: add something` mergeado → release-please abre PR con bump minor correcto.

---

### Fase 2 — Pipeline del API ✅ COMPLETADA (2026-04-22)

**`.github/workflows/ci.yml`** en `carpil/api` (on pull_request):
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`

**`.github/workflows/deploy.yml`**:
- On push a `main` → Railway deploya `development` automáticamente (webhook ya configurado + "Wait for CI")
- On Release PR merge → Railway deploya `staging`
- On tag `vX.Y.Z` + manual approval → Railway deploya `production`

**Railway env vars** (verificar que cada env tenga):
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `FIRESTORE_DATABASE_ID` (`(default)` para dev, `staging` para preview, `prod` para producción)
- `STRIPE_SECRET_KEY` (test en dev/preview, live en prod)
- `SENTRY_DSN` (DSN distinto por env para separar datos)
- `POSTHOG_API_KEY` (si el API emite eventos)

**Criterio de éxito:** PR con cambio de API → tests corren → merge → dev deploy automático visible en `dev-api.carpil.app`.

---

### Fase 3 — Pipeline de la App ✅ COMPLETADA (2026-04-22)

**`.github/workflows/ci.yml`** en `carpil/app` (on pull_request):
- Lint, typecheck, test
- **Fingerprint check**: calcula fingerprint de base vs head
  - Si igual: comentario en PR "✅ OTA-eligible — el merge disparará un update JS-only"
  - Si distinto: "⚠️ Native build requerido — razones: [lista de archivos que cambiaron el fingerprint]"

**`.github/workflows/deploy.yml`**:

| Trigger | Fingerprint igual | Fingerprint distinto |
|---------|-------------------|----------------------|
| Push a `main` | `eas update --channel dev --auto` | `eas build --profile development --auto-submit` (IPA ad-hoc + APK) |
| Release PR merge | `eas update --channel preview --auto` | `eas build --profile preview --auto-submit` (TestFlight Internal + Play Internal) |
| Tag `vX.Y.Z` + approval | `eas update --channel production --auto` | `eas build --profile production --auto-submit` (App Store + Play Store) |

**`eas.json` cleanup:**
- Revisar perfiles existentes: `development`, `preview`, `preview-production`, `production`
- Remover `preview-production` si no aporta (simplificar a los 3 ambientes claros)
- Completar `submit` config con credenciales ASC + Play Console

**Criterio de éxito:** Release PR mergeado → tag creado → build de preview llega a TestFlight Internal automáticamente en ~20 min.

---

### Fase 4 — Orchestrator submodule sync ✅ COMPLETADA (2026-04-23)

**`.github/workflows/sync-submodules.yml`** en orchestrator:
- Disparado por webhook cuando `app/main` o `api/main` avanzan
- Bot abre PR en orchestrator con el submódulo actualizado
- Auto-merge si CI del orchestrator pasa

**Criterio de éxito:** Merge a `carpil/app` → PR automático en orchestrator → auto-mergeado sin intervención.

---

### Fase 5 — Observabilidad (3-4 h) [post-lunes]

**Sentry distributed tracing:**
- App: `tracesSampleRate: 1.0` en dev/preview, `0.1` en prod. Propagación de header `sentry-trace` en requests al API.
- API: Sentry con `httpIntegration` capturando trace headers incoming.
- Verificar en Sentry: un ride creado muestra trace completa app → API → Firestore.

**PostHog en app:**
- Instalar `posthog-react-native`
- Proyectos separados en PostHog cloud: `carpil-dev`, `carpil-preview`, `carpil-prod`
- Init con `EXPO_PUBLIC_POSTHOG_KEY` vía env var
- Habilitar session replay
- Eventos iniciales clave:
  - `user_signed_up`, `user_signed_in`
  - `ride_created`, `ride_booked`, `ride_started`, `ride_completed`, `ride_cancelled`
  - `payment_initiated`, `payment_succeeded`, `payment_failed`
  - `chat_message_sent`, `rating_submitted`

**Criterio de éxito:** Crear un ride desde la app → aparece trace end-to-end en Sentry + evento correspondiente en PostHog.

---

### Fase 6 — Maestro E2E (3-4 h) [post-lunes]

**Estructura `.maestro/` en `carpil/app`:**

```
.maestro/
├── flows/
│   ├── smoke/           # @smoke — funcionalidad core, corre en todos los envs
│   │   ├── login.yaml
│   │   └── create-ride.yaml
│   ├── happy-path/      # @happy — flujos principales, preview + dev
│   │   ├── book-ride.yaml
│   │   ├── chat-with-driver.yaml
│   │   └── payment-flow.yaml
│   └── edge-cases/      # @edge — casos límite, solo dev
│       ├── offline-mode.yaml
│       ├── payment-failed.yaml
│       └── cancel-ride.yaml
└── config.yaml
```

**GitHub Action:**

| Trigger | Flows que corren |
|---------|------------------|
| PR | `@smoke` (5-10 min, feedback rápido) |
| Release PR mergeado | `@smoke` + `@happy` (15-20 min) |
| Tag prod + approval | `@smoke` contra preview env antes de autorizar prod |

**Para contributors OSS:** Maestro corre local con `maestro test .maestro/flows/smoke/` — documentado en CONTRIBUTING.md.

**Criterio de éxito:** PR que rompe login → Maestro smoke falla → PR bloqueado para merge.

---

### Fase 7 — Firebase rules versionadas ✅ COMPLETADA (2026-04-23)

- Crear `firestore.rules` y `storage.rules` en `carpil/api/firebase/`
- CI job que valida sintaxis con `firebase deploy --only firestore:rules --dry-run`
- Deploy manual por ahora (automatización queda para v2)

**Criterio de éxito:** PR con rules inválidas → CI falla.

---

### Fase 8 — Documentación mínima (1 h) [post-lunes]

- `CONTRIBUTING.md` en `app` y `api` (ver Fase 1)
- `RELEASING.md` corto explicando el flujo de release-please
- Update del `README.md` del orchestrator con el nuevo flujo

---

## Phasing recomendado

### Sesión 1 (para lunes) — ~8 h de foco
- Fase 0: Prerequisitos
- Fase 1: Convenciones y versionado
- Fase 2: Pipeline API (dev + preview)
- Fase 3: Pipeline app (al menos preview con auto-submit a TestFlight Internal)

**Al final de esta sesión:** podés mergear a `main` y que un build de preview llegue solo a TestFlight Internal + Play Internal sin tocar nada. Suficiente para que tus beta testers descarguen.

### Sesión 2 (martes) — ~4-5 h
- Completar Fase 2 y 3 (production pipeline, manual gates, fingerprint detection completa)
- Fase 4: submodule sync del orchestrator
- Fase 7: Firebase rules versionadas

### Sesión 3 (miércoles) — ~4-5 h
- Fase 5: observabilidad (Sentry distributed + PostHog)
- Fase 6: Maestro con los primeros smoke + happy flows
- Fase 8: CONTRIBUTING.md / RELEASING.md

---

## Fuera del scope (v2, post-launch)

- Package name variants / 3 apps simultáneas en el teléfono
- Deploy automatizado de security rules
- Sistema de migraciones de Firestore con colección `_migrations`
- Stripe sandboxes (seguimos con test/live keys)
- Feature flags / A-B testing (Firebase Remote Config se puede sumar rápido cuando se necesite)
- Docs completas para OSS contributors (más allá de CONTRIBUTING.md básico)
- Landing page deploys (queda fuera, sigue en Vercel manual)
- Cloud Functions (cuando se implementen, se agregan al pipeline del API)

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Railway "GitHub Repo not found" sigue roto después de reconectar | Verificar permisos de la GitHub App de Railway al org `carpil` |
| Fingerprint cambia por upgrades menores sin necesidad de rebuild | Revisar `expo-fingerprint` config para excluir archivos irrelevantes |
| EAS credits se agotan por builds frecuentes | Builds nativos solo se disparan cuando fingerprint cambia; OTAs son gratis |
| Beta testers no reciben updates nuevos | Confirmar que están en TestFlight Internal (hasta 100) no External |
| Apple rechaza submit a producción | Manual approval gate antes de submit + monitoring en Sentry post-release |

---

## Referencias

- [Expo Fingerprint docs](https://docs.expo.dev/eas-update/runtime-versions/#fingerprint-runtime-version-policy)
- [EAS Submit docs](https://docs.expo.dev/submit/introduction/)
- [release-please docs](https://github.com/googleapis/release-please)
- [Maestro docs](https://maestro.mobile.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)
