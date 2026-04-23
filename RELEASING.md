# Releasing

Carpil usa trunk-based development con [release-please](https://github.com/googleapis/release-please) para versionado automático. `app` y `api` tienen versiones independientes.

## Flujo completo

```
feature/CARPIL-123  ──PR──►  main
                              │
                              ├─► API: deploy automático a Railway development
                              ├─► App: OTA update al canal dev (o EAS build si cambió el fingerprint nativo)
                              └─► release-please abre/actualiza el Release PR
```

Cuando querés promover a beta testers:

```
Mergear el Release PR  ──►  tag vX.Y.Z creado automáticamente
                              │
                              ├─► API: deploy automático a Railway staging
                              ├─► App: EAS build → TestFlight Internal + Play Internal
                              ├─► E2E: Maestro smoke + happy en Android e iOS
                              └─► (si E2E pasa) gate de producción habilitado
```

Para liberar a producción:

```
Aprobar el gate en GitHub Actions  ──►
  ├─► API: Railway production
  └─► App: App Store + Play Store submit
```

## Paso a paso

### 1. Mergear features a main

Usá commits convencionales — release-please los lee para calcular el bump:

| Commit | Bump |
|--------|------|
| `fix: ...` | patch (1.0.**1**) |
| `feat: ...` | minor (1.**1**.0) |
| `feat!: ...` o `BREAKING CHANGE:` | major (**2**.0.0) |

### 2. Mergear el Release PR

release-please mantiene un PR abierto con el CHANGELOG y el bump de versión. Cuando estés listo para promover, mergealo. El tag se crea solo.

### 3. Aprobar el gate de producción

En [carpil/app Actions](https://github.com/carpil/app/actions) y [carpil/api Actions](https://github.com/carpil/api/actions), el job `deploy-production` espera aprobación manual. Los E2E deben haber pasado antes de que el gate aparezca disponible.

## Secrets necesarios en GitHub

| Secret | Repos | Descripción |
|--------|-------|-------------|
| `EXPO_TOKEN` | app | EAS builds y updates |
| `RAILWAY_TOKEN` | api | Deploy a Railway production |
| `INFISICAL_TOKEN` | app, api | Leer secrets en CI |

Todos los secrets de runtime (Firebase, Stripe, Sentry, PostHog) viven en **Infisical** y se inyectan automáticamente en Railway y en los builds de EAS.
