#!/usr/bin/env bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

# ──────────────────────────────────────────
#  Utilidad: esperar a que un puerto esté disponible
# ──────────────────────────────────────────
wait_for_port() {
  local port=$1
  local service=$2
  printf "  → Esperando $service (puerto $port)..."
  while ! nc -z localhost "$port" 2>/dev/null; do
    printf "."
    sleep 1
  done
  echo -e " ${GREEN}listo${RESET}"
}

# ──────────────────────────────────────────
#  Cleanup al salir (Ctrl+C)
# ──────────────────────────────────────────
cleanup() {
  echo ""
  echo "→ Deteniendo servicios..."
  [ -n "$FIREBASE_PID" ] && kill "$FIREBASE_PID" 2>/dev/null
  docker compose down 2>/dev/null
  echo -e "${CYAN}✓ Servicios detenidos.${RESET}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ──────────────────────────────────────────
#  1. Firebase Emulator
# ──────────────────────────────────────────
echo -e "\n${CYAN}[1/3] Firebase Emulator Suite${RESET}"
cd firebase
firebase emulators:start \
  --project demo-carpil \
  --import ./emulator-data \
  --export-on-exit ./emulator-data &
FIREBASE_PID=$!
cd ..

wait_for_port 8080 "Firestore"
wait_for_port 9099 "Auth"
wait_for_port 4000 "Emulator UI"

# ──────────────────────────────────────────
#  2. API
# ──────────────────────────────────────────
echo -e "\n${CYAN}[2/3] API${RESET}"
docker compose up -d
wait_for_port 3000 "API"

# ──────────────────────────────────────────
#  3. App — selección de plataforma
# ──────────────────────────────────────────
echo -e "\n${CYAN}[3/3] App${RESET}"

RUN_IOS=false
RUN_ANDROID=false

if command -v gum > /dev/null 2>&1; then
  PLATFORMS=$(gum choose --no-limit \
    --header "¿En qué plataforma quieres correr la app? (Space para seleccionar, Enter para confirmar)" \
    "iOS" \
    "Android")

  echo "$PLATFORMS" | grep -q "iOS"     && RUN_IOS=true
  echo "$PLATFORMS" | grep -q "Android" && RUN_ANDROID=true
else
  echo -e "  ${YELLOW}Tip: instala 'gum' para una selección interactiva (brew install gum)${RESET}\n"
  echo    "    1) iOS"
  echo    "    2) Android"
  echo    "    3) Ambas"
  echo ""
  printf "  → Selección [1/2/3]: "
  read -r CHOICE
  case $CHOICE in
    1) RUN_IOS=true ;;
    2) RUN_ANDROID=true ;;
    3) RUN_IOS=true; RUN_ANDROID=true ;;
    *) RUN_IOS=true; RUN_ANDROID=true ;;
  esac
fi

FLAGS=""
$RUN_IOS     && FLAGS="$FLAGS --ios"
$RUN_ANDROID && FLAGS="$FLAGS --android"

echo -e "\n→ Iniciando app en ${YELLOW}$(echo $FLAGS | xargs)${RESET}..."
cd app && yarn start $FLAGS
