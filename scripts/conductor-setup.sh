#!/usr/bin/env bash
set -euo pipefail

# Provisiona un workspace nuevo de Conductor sin re-pullear de Infisical:
# copia los archivos de config ya generados del repo original y clona
# node_modules del app vía clonefile APFS (copy-on-write: ~15-20s por la
# creación de inodes, pero comparte los bloques de datos → no duplica los
# ~2GB en disco). Orientado al flujo de prueba EAS Update (JS-only), por eso
# NO genera carpetas nativas (app/ios, app/android).

if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 22 2>/dev/null || true
fi

SRC="${CONDUCTOR_ROOT_PATH:-$HOME/Documents/code/carpil/carpil}"
[ -d "$SRC" ] || { echo "✗ Repo original no encontrado: $SRC"; exit 1; }

echo "→ Provisionando workspace desde $SRC"

# 1. Submódulos (el worktree nuevo llega sin ellos inicializados)
git submodule update --init --recursive

# 2. Archivos de config generados (fuente de verdad = repo original, no Infisical)
copy_file() {
  if [ -f "$SRC/$1" ]; then
    mkdir -p "$(dirname "$1")"
    cp "$SRC/$1" "$1"
    echo "  ✓ $1"
  else
    echo "  ⚠ falta en origen: $1"
  fi
}
copy_file .env
copy_file app/.env
copy_file app/.npmrc
copy_file app/google-services.json
copy_file app/GoogleService-Info.plist
copy_file api/.env

# 3. node_modules del app vía clonefile (COW). Fallback a copia normal si el
#    workspace cae en otro volumen APFS.
if [ -d "$SRC/app/node_modules" ]; then
  rm -rf app/node_modules
  if cp -c -R "$SRC/app/node_modules" app/node_modules 2>/dev/null; then
    echo "  ✓ app/node_modules (clonefile COW)"
  else
    cp -R "$SRC/app/node_modules" app/node_modules
    echo "  ✓ app/node_modules (copia normal — distinto volumen)"
  fi
fi

# Reconcilia si el branch tocó deps (no-op rápido si el lockfile ya coincide).
# COW_ONLY=1 lo salta para provisioning ultra-rápido (corré yarn install a mano
# solo si falta una dep).
if [ "${COW_ONLY:-0}" != "1" ]; then
  echo "→ yarn install (chequeo/reconcile)..."
  (cd app && yarn install --silent)
fi

# 4. Deps de api (pnpm store global = barato; sus symlinks no se clonan bien)
if command -v pnpm >/dev/null 2>&1; then
  echo "→ pnpm install (api)..."
  (cd api && pnpm install --frozen-lockfile)
else
  echo "  ⚠ pnpm no encontrado — saltando deps de api"
fi

echo "✓ Workspace listo. Probá con: cd app && eas update --auto"
