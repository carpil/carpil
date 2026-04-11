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

- Docker + Docker Compose
- Node.js 22+
- Java 11+ (requerido por Firebase Emulator Suite)
- make

## Comandos

| Comando | Descripción |
|---------|-------------|
| `make setup` | Configura el entorno desde cero |
| `make dev` | Levanta Firebase + API + App en paralelo |
| `make seed` | Carga datos semilla en el emulador |
| `make clean` | Detiene contenedores y limpia artefactos |

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
