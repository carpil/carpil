#!/usr/bin/env bash
set -e

CYAN='\033[0;36m'
RED='\033[0;31m'
GREEN='\033[0;32m'
RESET='\033[0m'

INFISICAL_PROJECT_ID="41a4242c-4634-4662-9d5d-bf90c31f841e"

# ──────────────────────────────────────────
#  Argumento: ambiente
# ──────────────────────────────────────────
ENV=$1

case $ENV in
  dev)        INFISICAL_ENV="dev" ;;
  preview)    INFISICAL_ENV="preview" ;;
  production) INFISICAL_ENV="prod" ;;
  *)
    echo -e "${RED}Uso: make env/dev | make env/preview | make env/production${RESET}"
    exit 1
    ;;
esac

# ──────────────────────────────────────────
#  Verificar CLI y token
# ──────────────────────────────────────────
if ! command -v infisical > /dev/null 2>&1; then
  echo -e "${RED}✗ Infisical CLI no está instalado.${RESET}"
  echo    "  brew install infisical/get-cli/infisical"
  exit 1
fi

if [ -z "$INFISICAL_TOKEN" ]; then
  echo -e "${RED}✗ INFISICAL_TOKEN no está definido en .env${RESET}"
  exit 1
fi

# ──────────────────────────────────────────
#  Jalar secrets
# ──────────────────────────────────────────
echo -e "→ Jalando secrets de Infisical ${CYAN}($ENV)${RESET}..."

SECRETS=$(infisical export \
  --env="$INFISICAL_ENV" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --format=dotenv 2>/dev/null)

if [ -z "$SECRETS" ]; then
  echo -e "${RED}✗ No se obtuvieron secrets. Verifica el token y el ambiente.${RESET}"
  exit 1
fi

# ──────────────────────────────────────────
#  Generar app/.env (prefijo APP_)
# ──────────────────────────────────────────
APP_SECRETS=$(echo "$SECRETS" | grep "^APP_" | sed 's/^APP_//')

if [ -n "$APP_SECRETS" ]; then
  echo "$APP_SECRETS" > app/.env
  echo -e "  ${GREEN}✓ app/.env generado${RESET}"
else
  echo -e "  ⚠ No se encontraron secrets con prefijo APP_"
fi

# ──────────────────────────────────────────
#  Generar api/.env (prefijo API_)
# ──────────────────────────────────────────
API_SECRETS=$(echo "$SECRETS" | grep "^API_" | sed 's/^API_//')

if [ -n "$API_SECRETS" ]; then
  echo "$API_SECRETS" > api/.env
  echo -e "  ${GREEN}✓ api/.env generado${RESET}"
else
  echo -e "  ⚠ No se encontraron secrets con prefijo API_"
fi

echo -e "${GREEN}✓ Entorno '$ENV' listo.${RESET}"
