#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Deploy dell'app desktop Tako — in place su /Applications/Tako.app.
# Garantisce UN SOLO Tako sul Mac: builda solo il .app (niente DMG), aggiorna
# l'app esistente con rsync, e RIMUOVE+DEREGISTRA il build-output così non
# appare mai un secondo Tako fantasma in Launchpad.
#
# Uso:  sh scripts/deploy-desktop.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPDIR="$ROOT/apps/app"
BUILDOUT="$APPDIR/src-tauri/target/release/bundle/macos/Tako.app"
INSTALLED="/Applications/Tako.app"
LSREG="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

echo "▶ build (solo .app, niente DMG)"
# `tauri build` firma anche l'artefatto dell'updater (createUpdaterArtifacts nel
# tauri.conf) e senza TAURI_SIGNING_PRIVATE_KEY esce 1 — DOPO aver già prodotto il
# .app. Per un'installazione locale quell'artefatto non serve: le release le taglia
# la CI, che la chiave ce l'ha. Quindi l'uscita non-zero non butta via una build
# riuscita: il controllo che conta è l'esistenza del bundle, qui sotto.
( cd "$APPDIR" && pnpm desktop:build ) || echo "⚠ build uscita non-zero (updater non firmato?) — verifico il .app"

if [ ! -d "$BUILDOUT" ]; then echo "✗ build-output non trovato: $BUILDOUT"; exit 1; fi

echo "▶ chiudo Tako se aperto"
osascript -e 'quit app "Tako"' 2>/dev/null || true
sleep 1

echo "▶ aggiorno /Applications/Tako.app in place (rsync)"
rsync -a --delete "$BUILDOUT/" "$INSTALLED/"

echo "▶ firma ad-hoc (l'identità dell'app deve restare com.tako.dashboard)"
# Senza identità di firma, `tauri build` lascia solo la firma del LINKER: identificatore
# `app-<hash>`, Info.plist non legato, risorse non sigillate. macOS àncora i permessi
# (microfono della dettatura) e le voci di portachiavi a quell'identificatore: senza
# questa riga ogni aggiornamento in place cambierebbe identità all'app e il ristoratore
# si ritroverebbe i permessi da riconcedere. Stessa incantazione di install-usb-mac.sh.
codesign --force --deep --sign - "$INSTALLED" 2>/dev/null || echo "⚠ firma ad-hoc non riuscita"
xattr -dr com.apple.quarantine "$INSTALLED" 2>/dev/null || true

echo "▶ pulizia: rimuovo e deregistro il build-output (evita il 2° Tako)"
"$LSREG" -u "$BUILDOUT" 2>/dev/null || true
rm -rf "$BUILDOUT" "$BUILDOUT.tar.gz" "$BUILDOUT.tar.gz.sig"
# smonta eventuali DMG residui (per sicurezza, anche se --bundles app non li crea)
for v in /Volumes/dmg.*; do [ -d "$v" ] && hdiutil detach "$v" -quiet 2>/dev/null || true; done

echo "✓ deploy fatto. Tako.app installati:"
find /Applications ~/Applications -maxdepth 2 -iname 'Tako*.app' 2>/dev/null
