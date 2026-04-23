# Carpil

Carpooling para Latinoamérica. Open Source.

## Repositorios

| Repo | Descripción |
|------|-------------|
| [`carpil/carpil`](https://github.com/carpil/carpil) | Orquestador (este repo) |
| [`carpil/app`](https://github.com/carpil/app) | React Native app |
| [`carpil/api`](https://github.com/carpil/api) | Node.js + Express API |

## Setup rápido

```bash
git clone --recurse-submodules https://github.com/carpil/carpil.git
cd carpil
make setup
make dev
```

> Tiempo estimado desde cero: < 5 minutos.

## ¿Clonaste sin `--recurse-submodules`?

Si `app/` o `api/` están vacíos, corre:

```bash
git submodule update --init --recursive
```

Luego continúa con `make setup`.

## Prerequisitos

| Herramienta | Requerido por | Instalación |
|---|---|---|
| Docker + Docker Compose | API | `brew install --cask docker` |
| Node.js 22 | App + Seed | `fnm install 22 && fnm use 22` |
| Java 11+ | Firebase Emulator | `brew install openjdk@11` |
| make | Orquestador | `brew install make` |
| Infisical CLI | Solo equipo interno | `brew install infisical/get-cli/infisical` |
| gum | Recomendado | `brew install gum` |

> Colaboradores OSS no necesitan Infisical CLI.

## Comandos

| Comando | Descripción |
|---------|-------------|
| `make setup` | Configura el entorno desde cero |
| `make dev` | Levanta Firebase + API + App en paralelo |
| `make seed` | Carga datos semilla en el emulador |
| `make clean` | Detiene contenedores y limpia artefactos |
| `make env/dev` | Jala secrets de desarrollo desde Infisical |
| `make env/preview` | Jala secrets de preview desde Infisical |
| `make env/production` | Jala secrets de producción desde Infisical |

## Pipeline CI/CD

Trunk-based con release-please. Una sola rama long-lived: `main`.

```
feat/CARPIL-123  ──PR──►  main
                            │
                            ├─► API → Railway development (auto)
                            ├─► App → OTA dev o EAS build (según fingerprint)
                            └─► release-please abre Release PR

                  Release PR merge ──►  tag vX.Y.Z
                            │
                            ├─► API → Railway staging (auto)
                            ├─► App → TestFlight Internal + Play Internal
                            ├─► E2E Maestro → Android + iOS (gate)
                            └─► (aprobación manual) → producción
```

Ver [RELEASING.md](./RELEASING.md) para el flujo completo.

## Observabilidad

| Herramienta | Uso |
|------------|-----|
| [Sentry](https://sentry.io) | Errores, crashes, distributed tracing app ↔ API |
| [PostHog](https://posthog.com) | Analytics de producto, session replay |

## Estructura

```
carpil/
├── .github/workflows/ # Submodule sync automático
├── firebase/          # Reglas de Firestore/Storage + emulator
├── scripts/           # Scripts de setup
├── app/               # React Native (submódulo)
├── api/               # Node.js API (submódulo)
├── Makefile
├── RELEASING.md       # Cómo hacer releases
└── docker-compose.yml
```
