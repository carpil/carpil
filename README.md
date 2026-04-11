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
| Docker + Docker Compose | API | [docker.com](https://www.docker.com) |
| Node.js 22+ | App + Seed | [nodejs.org](https://nodejs.org) |
| Java 11+ | Firebase Emulator | `brew install openjdk@11` |
| make | Orquestador | `brew install make` |
| Infisical CLI | Solo equipo interno | `brew install infisical/get-cli/infisical` |

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

## Estructura

```
carpil/
├── firebase/          # Emulator Suite + datos semilla
├── scripts/           # Scripts de setup
├── app/               # React Native (submódulo)
├── api/               # Node.js API (submódulo)
├── Makefile
└── docker-compose.yml
```
