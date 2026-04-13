#!/usr/bin/env bash
set -e

# Asegurar Node 22 via fnm si está disponible
if command -v fnm > /dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 22 2>/dev/null || true
fi

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

# ──────────────────────────────────────────
#  Escribir archivos de Google Services
# ──────────────────────────────────────────
echo "→ Escribiendo archivos de Google Services..."

infisical secrets get GOOGLE_SERVICES_JSON \
  --env="$INFISICAL_ENV" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --plain 2>/dev/null > app/google-services.json
echo -e "  ${GREEN}✓ app/google-services.json${RESET}"

infisical secrets get GOOGLE_SERVICE_INFO_PLIST \
  --env="$INFISICAL_ENV" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --plain 2>/dev/null > app/GoogleService-Info.plist
echo -e "  ${GREEN}✓ app/GoogleService-Info.plist${RESET}"

# ──────────────────────────────────────────
#  Verificar NPM_TOKEN_GOOGLE_SIGN_IN
# ──────────────────────────────────────────
if [ -f .env ]; then set -a; source .env; set +a; fi

if [ -z "$NPM_TOKEN_GOOGLE_SIGN_IN" ]; then
  echo "  → Obteniendo NPM_TOKEN_GOOGLE_SIGN_IN desde Infisical..."
  NPM_TOKEN=$(infisical secrets get NPM_TOKEN_GOOGLE_SIGN_IN \
    --env=dev \
    --projectId="$INFISICAL_PROJECT_ID" \
    --plain 2>/dev/null)

  if [ -z "$NPM_TOKEN" ]; then
    echo -e "${RED}✗ No se encontró NPM_TOKEN_GOOGLE_SIGN_IN en Infisical.${RESET}"
    exit 1
  fi

  if grep -q "NPM_TOKEN_GOOGLE_SIGN_IN" .env 2>/dev/null; then
    sed -i.bak "s|NPM_TOKEN_GOOGLE_SIGN_IN=.*|NPM_TOKEN_GOOGLE_SIGN_IN=$NPM_TOKEN|" .env && rm -f .env.bak
  else
    echo "NPM_TOKEN_GOOGLE_SIGN_IN=$NPM_TOKEN" >> .env
  fi
  export NPM_TOKEN_GOOGLE_SIGN_IN="$NPM_TOKEN"
  echo -e "  ${GREEN}✓ NPM_TOKEN_GOOGLE_SIGN_IN obtenido desde Infisical${RESET}"
fi

printf "@react-native-google-signin:registry=https://npm.pkg.github.com\n" > app/.npmrc
printf "//npm.pkg.github.com/:_authToken=%s\n" "$NPM_TOKEN_GOOGLE_SIGN_IN" >> app/.npmrc

# ──────────────────────────────────────────
#  Expo Prebuild
# ──────────────────────────────────────────
echo "→ Corriendo expo prebuild..."
if [ ! -d "app/node_modules" ]; then
  echo "  → Instalando dependencias de app..."
  (cd app && yarn install --silent)
fi
rm -rf app/ios app/android
(cd app && ./node_modules/.bin/expo prebuild --no-install --platform all)
cp app/GoogleService-Info.plist app/ios/Carpil/GoogleService-Info.plist
echo -e "  ${GREEN}✓ Carpetas ios/ y android/ generadas${RESET}"

echo -e "${GREEN}✓ Entorno '$ENV' listo.${RESET}"
