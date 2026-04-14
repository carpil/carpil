#!/usr/bin/env bash
set -e

CYAN='\033[0;36m'
RED='\033[0;31m'
GREEN='\033[0;32m'
RESET='\033[0m'

# ──────────────────────────────────────────
#  Verificar Maestro CLI
# ──────────────────────────────────────────
if ! command -v maestro > /dev/null 2>&1; then
  echo -e "${RED}✗ Maestro CLI no está instalado.${RESET}"
  echo    "  curl -Ls 'https://get.maestro.mobile.dev' | bash"
  exit 1
fi


# ──────────────────────────────────────────
#  Determinar flows a correr
# ──────────────────────────────────────────
FLOW=${1:-app/maestro}

echo -e "→ Corriendo Maestro ${CYAN}($FLOW)${RESET}..."

maestro test "$FLOW"

echo -e "${GREEN}✓ E2E tests completados.${RESET}"
