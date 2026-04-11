.PHONY: help setup dev seed clean \
        setup/submodules setup/deps setup/env \
        dev/firebase dev/api dev/app \
        env/dev env/preview env/production

# ──────────────────────────────────────────
#  Carga .env automáticamente si existe
# ──────────────────────────────────────────
-include .env
export

# ──────────────────────────────────────────
#  Colores
# ──────────────────────────────────────────
CYAN  := \033[0;36m
RESET := \033[0m

# ──────────────────────────────────────────
#  Help
# ──────────────────────────────────────────
help:
	@echo ""
	@echo "$(CYAN)Carpil — comandos disponibles$(RESET)"
	@echo ""
	@echo "  make setup            Configura el entorno local (emuladores)"
	@echo "  make dev              Levanta Firebase + API + App en paralelo"
	@echo "  make seed             Carga datos semilla en el emulador"
	@echo "  make clean            Detiene contenedores y limpia artefactos"
	@echo ""
	@echo "  make dev/firebase     Solo emulador de Firebase"
	@echo "  make dev/api          Solo API (Docker)"
	@echo "  make dev/app          Solo React Native"
	@echo ""
	@echo "  make env/dev          Jala secrets de desarrollo desde Infisical"
	@echo "  make env/preview      Jala secrets de preview desde Infisical"
	@echo "  make env/production   Jala secrets de producción desde Infisical"
	@echo ""

# ──────────────────────────────────────────
#  Setup
# ──────────────────────────────────────────
setup: setup/submodules setup/env setup/deps
	@echo "$(CYAN)✓ Setup completo. Ejecuta 'make dev' para iniciar.$(RESET)"

setup/submodules:
	@echo "→ Actualizando submódulos..."
	git submodule update --init --recursive

setup/env:
	@echo "→ Configurando variables de entorno..."
	@bash scripts/setup-env.sh

setup/deps:
	@echo "→ Instalando dependencias de app..."
	cd app && yarn install --frozen-lockfile
	@echo "→ Instalando dependencias de seed..."
	cd firebase/seed && npm install --silent

# ──────────────────────────────────────────
#  Dev
# ──────────────────────────────────────────
dev:
	make -j3 dev/firebase dev/api dev/app

dev/firebase:
	@echo "→ Iniciando Firebase Emulator Suite..."
	cd firebase && firebase emulators:start \
		--project demo-carpil \
		--import ./emulator-data \
		--export-on-exit ./emulator-data

dev/api:
	@echo "→ Iniciando API..."
	docker compose up

dev/app:
	@echo "→ Iniciando React Native..."
	cd app && yarn start

# ──────────────────────────────────────────
#  Seed
# ──────────────────────────────────────────
seed:
	@echo "→ Cargando datos semilla en Firestore..."
	FIRESTORE_EMULATOR_HOST=localhost:8080 \
	FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
	node firebase/seed/seed.js

# ──────────────────────────────────────────
#  Env (Infisical)
# ──────────────────────────────────────────
env/dev:
	@bash scripts/pull-env.sh dev

env/preview:
	@bash scripts/pull-env.sh preview

env/production:
	@bash scripts/pull-env.sh production

# ──────────────────────────────────────────
#  Clean
# ──────────────────────────────────────────
clean:
	@echo "→ Deteniendo contenedores..."
	-docker compose down
	@echo "→ Limpiando artefactos..."
	rm -rf firebase/emulator-data app/.npmrc
	@echo "$(CYAN)✓ Limpieza completa.$(RESET)"
