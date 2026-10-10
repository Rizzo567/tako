#!/bin/bash
# Archive + upload della app owner iOS su App Store Connect — a zero prompt.
#
# Il portachiavi personale non viene mai toccato: certificato e chiave privata di
# distribuzione nascono dentro un portachiavi dedicato, creato qui con una password
# generata al volo. `set-key-partition-list` gira su QUEL portachiavi, di cui lo
# script conosce la password, quindi codesign non chiede mai nulla a nessuno.
# Vedi la memoria "HearFlow — mai piu la password di firma": e un vincolo, non una comodita.
#
# L'autenticazione verso Apple e sempre a chiave API: la sessione account di Xcode
# in headless fallisce con "No Accounts / No profiles for ...".
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEME="Tako"
WORKSPACE="$APP_DIR/ios/Tako.xcworkspace"
BUILD_DIR="${TAKO_IOS_BUILD_DIR:-$APP_DIR/ios/release}"
ARCHIVE="$BUILD_DIR/Tako.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"

KEY_ID="2FRA4Q4QRY"
ISSUER_ID="fb6abcc7-3ff3-48fb-8c95-9b2837997520"
KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"

KEYCHAIN_NAME="tako-signing.keychain-db"
KEYCHAIN="$HOME/Library/Keychains/$KEYCHAIN_NAME"
ORIGINAL_DEFAULT="$(security default-keychain | tr -d ' "')"

log() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

restore_keychain() {
  # Il default va rimesso comunque: se lo script muore a meta, un default sbagliato
  # rompe ogni firma successiva sulla macchina.
  security default-keychain -s "$ORIGINAL_DEFAULT" 2>/dev/null || true
}
trap restore_keychain EXIT

[ -f "$KEY_PATH" ] || { echo "chiave API assente: $KEY_PATH"; exit 1; }

log "Portachiavi dedicato"
if [ ! -f "$KEYCHAIN" ]; then
  KC_PASS="$(openssl rand -base64 24)"
  security create-keychain -p "$KC_PASS" "$KEYCHAIN_NAME"
  # La password resta solo qui, leggibile da Manuel: serve se un giorno va aperto a mano.
  printf '%s' "$KC_PASS" > "$HOME/.tako/ios-keychain-password"
  chmod 600 "$HOME/.tako/ios-keychain-password"
  echo "creato $KEYCHAIN_NAME"
else
  KC_PASS="$(cat "$HOME/.tako/ios-keychain-password")"
  echo "riuso $KEYCHAIN_NAME"
fi
security set-keychain-settings -lut 21600 "$KEYCHAIN"        # niente auto-lock a meta build
security unlock-keychain -p "$KC_PASS" "$KEYCHAIN"
security list-keychains -d user -s $(security list-keychains -d user | tr -d ' "' | grep -v "$KEYCHAIN_NAME") "$KEYCHAIN"
security default-keychain -s "$KEYCHAIN"

log "Archive"
rm -rf "$ARCHIVE"
mkdir -p "$BUILD_DIR"
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID" \
  OTHER_CODE_SIGN_FLAGS="--keychain $KEYCHAIN" \
  -quiet archive

# Dopo l'archive la chiave privata nuova esiste: si autorizza una volta sola, qui,
# e le firme successive non chiedono piu nulla.
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KC_PASS" "$KEYCHAIN" >/dev/null 2>&1 || true

log "Export App Store"
rm -rf "$EXPORT_DIR"
cat > "$BUILD_DIR/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>VG36RXW5CX</string>
  <key>uploadSymbols</key><true/>
  <key>signingStyle</key><string>automatic</string>
  <key>destination</key><string>export</string>
</dict>
</plist>
PLIST

xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID" \
  -quiet

IPA="$(find "$EXPORT_DIR" -name '*.ipa' | head -1)"
[ -n "$IPA" ] || { echo "nessun .ipa esportato"; exit 1; }
log "IPA: $IPA ($(du -h "$IPA" | cut -f1))"

if [ "${1:-}" = "--upload" ]; then
  log "Validazione"
  xcrun altool --validate-app -f "$IPA" -t ios \
    --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"
  log "Upload su App Store Connect"
  xcrun altool --upload-app -f "$IPA" -t ios \
    --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"
  log "Caricata. La build appare su TestFlight dopo l'elaborazione di Apple."
else
  echo "(nessun upload: rilancia con --upload)"
fi
