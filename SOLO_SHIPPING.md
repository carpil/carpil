# Solo Shipping Loop

Cómo iterar rápido cuando vos sos quien prueba 99% del tiempo. Reemplaza el reflejo "déjame hacer un `eas build --profile preview` y mandarlo a TestFlight" — eso se rompió a propósito el 2026-05-21 (ver `app/EAS_PROFILES.md`).

## Los 4 tiers

| Tier | Cuándo subir a este tier | Cómo | Latencia | EAS credits |
|---|---|---|---|---|
| **0. Simulator** | Default, 90% del tiempo | `cd app && yarn dev` + simulator iOS / emulator Android | <1s hot-reload | 0 |
| **1. Device físico (dev local)** | Cámara, GPS, push, teclado nativo, KYC, Apple/Google Sign-In, Stripe sheet | iPhone por cable + `yarn ios --device` / Android USB-debug + `yarn android --device` | 10min primera vez, después JS hot-reload | 0 |
| **2. `preview` build** | "Quiero ver el binary release-mode antes de lanzar a tienda" | CI lo dispara al crearse el tag — APK + IPA ad-hoc descargables del EAS dashboard | ~10min build, o segundos si JS-only (OTA al canal `preview`) | 0–2 |
| **3. Production** | Shipear a usuarios reales | Aprobás el gate de `production` en GitHub Actions → build prod + auto-submit App Store + Play Store | ~25min build + Apple review (24-48h) | 1–2 |

Bajá de tier cuando podés (más rápido). Subí cuando el tier actual no te cubre.

## Tier 1 — setup one-time

### iPhone
1. Conectar por cable, "Trust this computer".
2. `cd app && yarn ios --device` — la primera vez tarda ~10 min (compila local con Xcode).
3. Para iteraciones JS posteriores: `yarn dev` (Metro), abrir la app en iPhone, hot-reload automático.
4. Si cambiás código nativo (ver checklist abajo) → volver a correr `yarn ios --device`.

### Android
1. USB debugging on en el device.
2. `yarn android --device`.

## Tier 2 — invocar manualmente

```bash
cd app
eas build --profile preview --platform all
```

Te aparece un link de descarga en EAS dashboard. APK directo, IPA ad-hoc.

iOS: el UDID del device debe estar registrado. One-time: `eas device:create`. Si el IPA dice "Untrusted Developer" → registrar y rebuildear.

## ¿Mi cambio es nativo o JS-only?

**Nativo (requiere rebuild de tier 1 o tier 2):**
- Tocaste `app.config.ts` plugins
- Agregaste / actualizaste `@react-native-firebase/*` o cualquier package con código nativo
- Cambiaste `expo-build-properties`
- Editaste manualmente `app/ios/` o `app/android/`
- Agregaste un permission o background mode
- Bumpeaste `FIREBASE_SDK_VERSION` o similar

**JS-only (hot-reload o OTA):**
- Cualquier cosa en `app/`, `components/`, `hooks/`, `services/`, `store/`, `utils/`, `types/`
- Cambios visuales, strings, lógica de negocio
- Form schemas, validation
- Cualquier package JS-only (yup, react-hook-form, zustand)

## Camino completo de un cambio

```
Cambio en simulator  ──►  yarn lint && yarn typecheck  ──►  PR a app/main
                                                              │
                                                              ├─► merge → OTA canal dev (auto)
                                                              └─► release-please abre/actualiza Release PR

  Merge del Release PR  ──►  tag carpil-vX.Y.Z (auto)
                              │
                              ├─► Tier 2: build preview (APK + IPA) → bajás, instalás, validás
                              └─► Tier 3: espera approval del gate "production" en GH Actions

       Aprobás el gate  ──►  build production + auto-submit → App Store + Play Store
```

## Reglas

- **No invocar `eas build --profile preview` para iterar día a día.** Es para sanity check pre-launch (tier 2). Para iterar, usá tier 0 o 1.
- **No usar TestFlight Internal en el flujo solo-founder.** El profile `preview` ya no va ahí. Cuando vuelvan los beta testers, recrear un profile `beta` con `distribution: "store"` + `submit.beta`.
- **No saltar tier 2 cuando hay cambio nativo grande.** Vale los 10 min de build para no descubrir que el binario crashea en App Store.
- **No mergear el Release PR sin haber validado tier 0 + 1** (al menos uno de los dos).

## Rollback

Si shipeaste un OTA mal a `production`:

```
GitHub Actions → workflow "Rollback OTA" → workflow_dispatch
  channel: production
  group_id: <copiá del EAS dashboard → Updates → el group anterior>
```

Para binarios mal en tienda: no hay rollback automático — tenés que shipear el siguiente version con el fix. Por eso tier 2 importa.

## Referencias

- `RELEASING.md` — flujo de release-please en detalle
- `OTA_STRATEGY.md` — runtime version policy (`appVersion`)
- `app/EAS_PROFILES.md` — cuál profile usar cuándo
- `PIPELINE_PLAN.md` — historia/contexto del pipeline
