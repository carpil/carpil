.PHONY: help setup dev seed clean \
        setup/submodules setup/deps setup/env \
        dev/firebase dev/api dev/app

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
	@echo "  make setup          Configura el entorno desde cero"
	@echo "  make dev            Levanta Firebase + API + App en paralelo"
	@echo "  make seed           Carga datos semilla en el emulador"
	@echo "  make clean          Detiene contenedores y limpia artefactos"
	@echo ""
	@echo "  make dev/firebase   Solo emulador de Firebase"
	@echo "  make dev/api        Solo API (Docker)"
	@echo "  make dev/app        Solo React Native"
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
	@if [ ! -f api/.env ]; then cp api/.env.example api/.env; echo "  ✓ api/.env creado"; fi
	@if [ ! -f app/.env ]; then cp app/.env.example app/.env; echo "  ✓ app/.env creado"; fi

setup/deps:
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
	cd app && npm start

# ──────────────────────────────────────────
#  Seed
# ──────────────────────────────────────────
seed:
	@echo "→ Cargando datos semilla en Firestore..."
	FIRESTORE_EMULATOR_HOST=localhost:8080 \
	FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
	node firebase/seed/seed.js

# ──────────────────────────────────────────
#  Clean
# ──────────────────────────────────────────
clean:
	@echo "→ Deteniendo contenedores..."
	docker compose down
	@echo "→ Limpiando artefactos..."
	rm -rf firebase/emulator-data
	@echo "$(CYAN)✓ Limpieza completa.$(RESET)"
