#!/usr/bin/env bash
set -e

CYAN='\033[0;36m'
RED='\033[0;31m'
GREEN='\033[0;32m'
RESET='\033[0m'

# ──────────────────────────────────────────
#  .env raíz
# ──────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ✓ .env creado"
fi

# Carga variables actuales del .env
set -a; source .env; set +a

# ──────────────────────────────────────────
#  Resolver NPM_TOKEN_GOOGLE_SIGN_IN
# ──────────────────────────────────────────
if [ -n "$NPM_TOKEN_GOOGLE_SIGN_IN" ]; then
  echo -e "  ✓ NPM_TOKEN_GOOGLE_SIGN_IN encontrado en entorno"

elif command -v gh > /dev/null 2>&1 && gh auth status > /dev/null 2>&1; then
  echo "  → Obteniendo token desde GitHub CLI..."
  TOKEN=$(gh auth token)
  # Actualiza o agrega la variable en .env
  if grep -q "NPM_TOKEN_GOOGLE_SIGN_IN" .env; then
    sed -i.bak "s|NPM_TOKEN_GOOGLE_SIGN_IN=.*|NPM_TOKEN_GOOGLE_SIGN_IN=$TOKEN|" .env && rm .env.bak
  else
    echo "NPM_TOKEN_GOOGLE_SIGN_IN=$TOKEN" >> .env
  fi
  export NPM_TOKEN_GOOGLE_SIGN_IN="$TOKEN"
  echo -e "  ${GREEN}✓ Token obtenido desde GitHub CLI${RESET}"

else
  echo ""
  echo -e "  ${CYAN}Se necesita un GitHub PAT con scope 'read:packages'.${RESET}"
  echo    "  Genera uno en: GitHub → Settings → Developer settings → Personal access tokens"
  echo ""
  printf "  → NPM_TOKEN_GOOGLE_SIGN_IN: "
  read -rs TOKEN
  echo ""

  if [ -z "$TOKEN" ]; then
    echo -e "  ${RED}✗ Token vacío. Abortando.${RESET}"
    exit 1
  fi

  if grep -q "NPM_TOKEN_GOOGLE_SIGN_IN" .env; then
    sed -i.bak "s|NPM_TOKEN_GOOGLE_SIGN_IN=.*|NPM_TOKEN_GOOGLE_SIGN_IN=$TOKEN|" .env && rm .env.bak
  else
    echo "NPM_TOKEN_GOOGLE_SIGN_IN=$TOKEN" >> .env
  fi
  export NPM_TOKEN_GOOGLE_SIGN_IN="$TOKEN"
  echo -e "  ${GREEN}✓ Token guardado en .env${RESET}"
fi

# ──────────────────────────────────────────
#  Generar app/.npmrc
# ──────────────────────────────────────────
printf "@react-native-google-signin:registry=https://npm.pkg.github.com\n" > app/.npmrc
printf "//npm.pkg.github.com/:_authToken=%s\n" "$NPM_TOKEN_GOOGLE_SIGN_IN" >> app/.npmrc
echo "  ✓ app/.npmrc generado"

# ──────────────────────────────────────────
#  Validar acceso al paquete privado
# ──────────────────────────────────────────
echo "  → Validando acceso a @react-native-google-signin/google-signin..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $NPM_TOKEN_GOOGLE_SIGN_IN" \
  "https://npm.pkg.github.com/@react-native-google-signin%2fgoogle-signin")

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "  ${GREEN}✓ Acceso verificado${RESET}"
else
  echo -e "  ${RED}✗ Token inválido o sin permisos (HTTP $HTTP_STATUS)${RESET}"
  echo    "    Verifica que el token tenga el scope 'read:packages' y acceso al repo carpil/app"
  rm -f app/.npmrc
  exit 1
fi

# ──────────────────────────────────────────
#  .env de submódulos
# ──────────────────────────────────────────
if [ ! -f api/.env ]; then cp api/.env.example api/.env; echo "  ✓ api/.env creado"; fi
if [ ! -f app/.env ]; then cp app/.env.example app/.env; echo "  ✓ app/.env creado"; fi
