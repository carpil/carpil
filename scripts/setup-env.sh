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
#  Resolver INFISICAL_TOKEN (opcional, solo equipo)
# ──────────────────────────────────────────
if [ -z "$INFISICAL_TOKEN" ]; then
  echo ""
  echo -e "  ${CYAN}¿Eres miembro del equipo de Carpil?${RESET}"
  echo    "  Ingresa tu INFISICAL_TOKEN para obtener secrets automáticamente."
  echo    "  (Presiona Enter para omitir si eres colaborador OSS)"
  echo ""
  printf "  → INFISICAL_TOKEN: "
  read -rs TOKEN
  echo ""

  if [ -n "$TOKEN" ]; then
    if grep -q "INFISICAL_TOKEN" .env; then
      sed -i.bak "s|INFISICAL_TOKEN=.*|INFISICAL_TOKEN=$TOKEN|" .env && rm .env.bak
    else
      echo "INFISICAL_TOKEN=$TOKEN" >> .env
    fi
    export INFISICAL_TOKEN="$TOKEN"
    echo -e "  ${GREEN}✓ INFISICAL_TOKEN guardado en .env${RESET}"
  else
    echo "  → Continuando como colaborador OSS..."
  fi
fi

# Si tiene token pero no CLI, avisar
if [ -n "$INFISICAL_TOKEN" ] && ! command -v infisical > /dev/null 2>&1; then
  echo -e "  ${RED}✗ Tienes INFISICAL_TOKEN pero el CLI no está instalado.${RESET}"
  echo    "    brew install infisical/get-cli/infisical"
  echo    "    Luego vuelve a correr make setup."
  exit 1
fi

# ──────────────────────────────────────────
#  Resolver NPM_TOKEN_GOOGLE_SIGN_IN
# ──────────────────────────────────────────
INFISICAL_PROJECT_ID="41a4242c-4634-4662-9d5d-bf90c31f841e"

if [ -n "$NPM_TOKEN_GOOGLE_SIGN_IN" ]; then
  echo -e "  ✓ NPM_TOKEN_GOOGLE_SIGN_IN encontrado en entorno"

elif [ -n "$INFISICAL_TOKEN" ] && command -v infisical > /dev/null 2>&1; then
  echo "  → Obteniendo NPM_TOKEN_GOOGLE_SIGN_IN desde Infisical..."
  TOKEN=$(infisical secrets get NPM_TOKEN_GOOGLE_SIGN_IN \
    --env=dev \
    --projectId="$INFISICAL_PROJECT_ID" \
    --plain 2>/dev/null)

  if [ -z "$TOKEN" ]; then
    echo -e "  ${RED}✗ No se encontró NPM_TOKEN_GOOGLE_SIGN_IN en Infisical.${RESET}"
    exit 1
  fi

  if grep -q "NPM_TOKEN_GOOGLE_SIGN_IN" .env; then
    sed -i.bak "s|NPM_TOKEN_GOOGLE_SIGN_IN=.*|NPM_TOKEN_GOOGLE_SIGN_IN=$TOKEN|" .env && rm .env.bak
  else
    echo "NPM_TOKEN_GOOGLE_SIGN_IN=$TOKEN" >> .env
  fi
  export NPM_TOKEN_GOOGLE_SIGN_IN="$TOKEN"
  echo -e "  ${GREEN}✓ NPM_TOKEN_GOOGLE_SIGN_IN obtenido desde Infisical${RESET}"

else
  echo ""
  echo -e "  ${CYAN}Se necesita el token de acceso a paquetes privados de Carpil.${RESET}"
  echo    "  Encuéntralo en la guía de contribución del proyecto."
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
#  Verificar Infisical CLI (opcional en local)
# ──────────────────────────────────────────
if command -v infisical > /dev/null 2>&1; then
  echo -e "  ✓ Infisical CLI disponible"
else
  echo -e "  ⚠ Infisical CLI no está instalado."
  echo    "    Solo necesario para correr con datos de dev/preview/production."
  echo    "    Instalar: brew install infisical/get-cli/infisical"
fi

# ──────────────────────────────────────────
#  .env de submódulos
# ──────────────────────────────────────────
if [ ! -f api/.env ]; then cp api/.env.example api/.env; echo "  ✓ api/.env creado"; fi
if [ ! -f app/.env ]; then cp app/.env.example app/.env; echo "  ✓ app/.env creado"; fi

# ──────────────────────────────────────────
#  Google Services — placeholders para local
# ──────────────────────────────────────────
if [ ! -f app/google-services.json ]; then
  cat > app/google-services.json << 'EOF'
{
  "project_info": {
    "project_number": "000000000000",
    "project_id": "demo-carpil",
    "storage_bucket": "demo-carpil.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:000000000000:android:0000000000000000",
        "android_client_info": { "package_name": "com.carpil.carpil" }
      },
      "api_key": [{ "current_key": "AIzaSyDEMO00000000000000000000000000000" }],
      "services": { "appinvite_service": { "other_platform_oauth_client": [] } }
    }
  ],
  "configuration_version": "1"
}
EOF
  echo "  ✓ app/google-services.json (placeholder local)"
fi

if [ ! -f app/GoogleService-Info.plist ]; then
  cat > app/GoogleService-Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CLIENT_ID</key>
  <string>000000000000-local.apps.googleusercontent.com</string>
  <key>REVERSED_CLIENT_ID</key>
  <string>com.googleusercontent.apps.000000000000-local</string>
  <key>API_KEY</key>
  <string>AIzaSyDEMO00000000000000000000000000000</string>
  <key>GCM_SENDER_ID</key>
  <string>000000000000</string>
  <key>PLIST_VERSION</key>
  <string>1</string>
  <key>BUNDLE_ID</key>
  <string>com.carpil.carpil</string>
  <key>PROJECT_ID</key>
  <string>demo-carpil</string>
  <key>STORAGE_BUCKET</key>
  <string>demo-carpil.appspot.com</string>
  <key>IS_ADS_ENABLED</key><false/>
  <key>IS_ANALYTICS_ENABLED</key><false/>
  <key>IS_GCM_ENABLED</key><true/>
  <key>IS_SIGNIN_ENABLED</key><true/>
  <key>GOOGLE_APP_ID</key>
  <string>1:000000000000:ios:0000000000000000</string>
</dict>
</plist>
EOF
  echo "  ✓ app/GoogleService-Info.plist (placeholder local)"
fi

# ──────────────────────────────────────────
#  Expo Prebuild — genera ios/ y android/
# ──────────────────────────────────────────
echo "→ Generando carpetas nativas (expo prebuild)..."
(cd app && ./node_modules/.bin/expo prebuild --no-install --platform all 2>/dev/null)
cp app/GoogleService-Info.plist app/ios/Carpil/GoogleService-Info.plist 2>/dev/null || true
echo -e "  ${GREEN}✓ ios/ y android/ generados${RESET}"
