# Carpil

Carpooling para Latinoamérica. Open Source.

## Repositorios

| Repo | Descripción |
|------|-------------|
| [`carpil`](https://github.com/tu-org/carpil) | Orquestador (este repo) |
| [`carpil-app`](https://github.com/tu-org/carpil-app) | React Native app |
| [`carpil-api`](https://github.com/tu-org/carpil-api) | Node.js + Express API |

## Setup rápido

```bash
git clone --recurse-submodules https://github.com/tu-org/carpil.git
cd carpil
make setup
make dev
```

> Tiempo estimado desde cero: < 5 minutos.

## Prerequisitos

- Docker + Docker Compose
- Node.js 20+
- Java 11+ (requerido por Firebase Emulator Suite)
- make

## Estructura

```
carpil/
├── app/           # React Native (submódulo)
├── api/           # Node.js API (submódulo)
├── Makefile       # Comandos centralizados
└── docker-compose.yml
```
