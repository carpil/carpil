.PHONY: help setup dev seed clean reset/tokens \
        setup/submodules setup/deps setup/env \
        dev/firebase dev/api dev/app \
        test/rules

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
	@echo "  make test/rules       Corre los tests de reglas de Firestore y Storage (emulador)"
	@echo ""
	@echo "  make reset/tokens     Resetea NPM_TOKEN_GOOGLE_SIGN_IN (token vencido)"
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
	cd app && yarn install
	@echo "→ Instalando dependencias de seed..."
	cd firebase/seed && npm install --silent

# ──────────────────────────────────────────
#  Dev
# ──────────────────────────────────────────
dev:
	@bash scripts/dev.sh

dev/firebase:
	@echo "→ Iniciando Firebase Emulator Suite (Docker)..."
	docker compose up firebase

dev/api:
	@echo "→ Iniciando API..."
	docker compose up

dev/app:
	@echo "→ Iniciando React Native..."
	cd app && yarn start

# ──────────────────────────────────────────
#  Tests
# ──────────────────────────────────────────
test/rules:
	@bash scripts/test-rules.sh

# ──────────────────────────────────────────
#  Seed
# ──────────────────────────────────────────
seed:
	@echo "→ Cargando datos semilla en Firestore..."
	FIRESTORE_EMULATOR_HOST=localhost:8080 \
	FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
	node firebase/seed/seed.js

# ──────────────────────────────────────────
#  Reset tokens
# ──────────────────────────────────────────
reset/tokens:
	@echo "→ Reseteando tokens en .env..."
	@sed -i.bak "s|NPM_TOKEN_GOOGLE_SIGN_IN=.*|NPM_TOKEN_GOOGLE_SIGN_IN=|" .env && rm -f .env.bak
	@echo "$(CYAN)✓ Tokens reseteados. Corre 'make setup' para ingresarlos de nuevo.$(RESET)"

# ──────────────────────────────────────────
#  Clean
# ──────────────────────────────────────────
clean:
	@echo "→ Deteniendo contenedores..."
	-docker compose down
	@echo "→ Eliminando dependencias..."
	rm -rf app/node_modules
	rm -rf firebase/seed/node_modules
	rm -rf firebase/rules-tests/node_modules
	@echo "→ Eliminando archivos generados..."
	rm -rf app/ios app/android
	rm -rf app/google-services.json app/GoogleService-Info.plist
	rm -rf app/.npmrc
	rm -rf firebase/emulator-data
	@echo "→ Eliminando variables de entorno generadas..."
	rm -f app/.env api/.env
	@echo "$(CYAN)✓ Reset completo. Corre 'make setup' para reiniciar.$(RESET)"
