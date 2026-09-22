#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIREBASE_TOOLS_VERSION="${FIREBASE_TOOLS_VERSION:-15.30.2}"
MIN_JAVA_MAJOR=21
RULES_TESTS_DIR="$REPO_ROOT/firebase/rules-tests"
LOCKFILE_STAMP="$RULES_TESTS_DIR/node_modules/.package-lock.sha256"

cd "$REPO_ROOT/firebase"

# macOS ships a /usr/bin/java stub without a JDK, so presence alone proves nothing.
if ! java_version_output="$(java -version 2>&1)"; then
  echo "✗ Java no está disponible. Los emuladores de Firestore y Storage necesitan Java $MIN_JAVA_MAJOR+." >&2
  echo "$java_version_output" >&2
  exit 1
fi

# Java 8 and older report "1.8.0_x"; newer releases report "21.0.6".
java_version_pattern='version "([0-9]+)(\.([0-9]+))?'
if [[ ! "$java_version_output" =~ $java_version_pattern ]]; then
  echo "✗ No se pudo leer la versión de Java. Los emuladores de Firestore y Storage necesitan Java $MIN_JAVA_MAJOR+." >&2
  echo "$java_version_output" >&2
  exit 1
fi

java_major="${BASH_REMATCH[1]}"
if [ "$java_major" = "1" ]; then
  java_major="${BASH_REMATCH[3]}"
fi

if [ "$java_major" -lt "$MIN_JAVA_MAJOR" ]; then
  echo "✗ Tienes Java $java_major, pero los emuladores de Firestore y Storage necesitan Java $MIN_JAVA_MAJOR+." >&2
  echo "  Instala un JDK $MIN_JAVA_MAJOR (p. ej. brew install --cask temurin@$MIN_JAVA_MAJOR) y vuelve a intentarlo." >&2
  exit 1
fi

emulator_port() {
  node -p "require('./firebase.json').emulators.$1.port"
}

if command -v nc > /dev/null; then
  for emulator in firestore storage; do
    port="$(emulator_port "$emulator")"
    if nc -z -w 1 localhost "$port"; then
      echo "✗ El puerto $port ($emulator) ya está en uso, probablemente por los emuladores de 'make dev' o 'make dev/firebase' (Docker)." >&2
      echo "  Detén ese proceso (p. ej. docker compose stop firebase) y vuelve a correr 'make test/rules'." >&2
      exit 1
    fi
  done
fi

lockfile_hash="$(shasum -a 256 "$RULES_TESTS_DIR/package-lock.json" | cut -d ' ' -f 1)"
installed_lockfile_hash=""
if [ -f "$LOCKFILE_STAMP" ]; then
  installed_lockfile_hash="$(cat "$LOCKFILE_STAMP")"
fi

if [ "$lockfile_hash" != "$installed_lockfile_hash" ]; then
  echo "→ Instalando dependencias de rules-tests (package-lock.json cambió desde la última instalación)..."
  npm ci --prefix "$RULES_TESTS_DIR"
  echo "$lockfile_hash" > "$LOCKFILE_STAMP"
fi

npx --yes "firebase-tools@$FIREBASE_TOOLS_VERSION" emulators:exec \
  --only firestore,storage \
  --project demo-carpil \
  "npm --prefix rules-tests test"
