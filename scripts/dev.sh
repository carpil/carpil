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
echo -e "  ¿En qué plataforma quieres correr la app?\n"
echo    "    1) iOS"
echo    "    2) Android"
echo    "    3) Ambas"
echo ""
printf "  → Selección [1/2/3]: "
read -r PLATFORM

case $PLATFORM in
  1)
    echo -e "\n→ Iniciando en ${YELLOW}iOS${RESET}..."
    cd app && yarn start --ios
    ;;
  2)
    echo -e "\n→ Iniciando en ${YELLOW}Android${RESET}..."
    cd app && yarn start --android
    ;;
  3)
    echo -e "\n→ Iniciando en ${YELLOW}iOS + Android${RESET}..."
    cd app && yarn start --ios --android
    ;;
  *)
    echo -e "  ${RED}Opción inválida. Iniciando Expo sin plataforma específica...${RESET}"
    cd app && yarn start
    ;;
esac
