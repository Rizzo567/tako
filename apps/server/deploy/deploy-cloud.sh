#!/usr/bin/env bash
# Deploy automatico del control-plane Tako su Fly.
# Legge i valori da ~/Desktop/tako-credenziali.txt, imposta i secret, fa il deploy
# e richiede il certificato per api.takoitalia.com.
#
# PREREQUISITI (li fai tu una volta):
#   1) flyctl installato           → brew install flyctl
#   2) login a Fly                 → fly auth login
#   3) il file Desktop compilato   → ~/Desktop/tako-credenziali.txt (tutti i valori)
#
# USO (dal root del worktree cloud):
#   bash apps/server/deploy/deploy-cloud.sh
set -euo pipefail

FILE="$HOME/Desktop/tako-credenziali.txt"
DOMAIN="takoitalia.com"
API_HOST="api.${DOMAIN}"

# ── prerequisiti ────────────────────────────────────────────────────────────
command -v fly >/dev/null 2>&1 || { echo "❌ flyctl non installato. Esegui: brew install flyctl"; exit 1; }
fly auth whoami >/dev/null 2>&1 || { echo "❌ Non sei loggato a Fly. Esegui: fly auth login"; exit 1; }
[ -f "$FILE" ] || { echo "❌ Non trovo $FILE"; exit 1; }

# ── parsing del file "CHIAVE = valore" (tieni eventuali '=' dentro il valore) ──
getval() {
  grep -m1 -E "^$1[[:space:]]*=" "$FILE" \
    | sed -E "s/^$1[[:space:]]*=[[:space:]]*//" \
    | sed -E 's/[[:space:]]+$//'
}

APP="$(getval FLY_APP_NAME)";            APP="${APP:-tako-cloud}"
CLOUD_DATABASE_URL="$(getval CLOUD_DATABASE_URL)"
REDIS_URL="$(getval REDIS_URL)"
RESEND_API_KEY="$(getval RESEND_API_KEY)"
EMAIL_FROM="$(getval EMAIL_FROM)";       EMAIL_FROM="${EMAIL_FROM:-Tako <no-reply@${DOMAIN}>}"
GOOGLE_CLIENT_ID="$(getval GOOGLE_CLIENT_ID)"
GOOGLE_CLIENT_SECRET="$(getval GOOGLE_CLIENT_SECRET)"
GITHUB_CLIENT_ID="$(getval GITHUB_CLIENT_ID)"
GITHUB_CLIENT_SECRET="$(getval GITHUB_CLIENT_SECRET)"

# ── validazione (niente deploy con buchi) ─────────────────────────────────────
missing=()
[ -n "$CLOUD_DATABASE_URL" ]   || missing+=("CLOUD_DATABASE_URL")
[ -n "$REDIS_URL" ]            || missing+=("REDIS_URL")
[ -n "$RESEND_API_KEY" ]      || missing+=("RESEND_API_KEY")
[ -n "$GOOGLE_CLIENT_ID" ]    || missing+=("GOOGLE_CLIENT_ID")
[ -n "$GOOGLE_CLIENT_SECRET" ] || missing+=("GOOGLE_CLIENT_SECRET")
[ -n "$GITHUB_CLIENT_ID" ]    || missing+=("GITHUB_CLIENT_ID")
[ -n "$GITHUB_CLIENT_SECRET" ] || missing+=("GITHUB_CLIENT_SECRET")
if [ "${#missing[@]}" -gt 0 ]; then
  echo "❌ Mancano questi valori nel file Desktop:"; printf '   - %s\n' "${missing[@]}"; exit 1
fi
case "$CLOUD_DATABASE_URL" in
  *:6543/*) echo "⚠️  La CLOUD_DATABASE_URL usa la porta 6543 (transaction pooler). Usa la 5432."; exit 1;;
esac

echo "→ App Fly: $APP   ·   dominio: $DOMAIN"

# ── crea l'app se non esiste ──────────────────────────────────────────────────
if ! fly apps list 2>/dev/null | grep -qw "$APP"; then
  echo "→ Creo l'app $APP…"; fly apps create "$APP"
fi

# ── secret (i casuali generati al volo, mai nel file) ─────────────────────────
echo "→ Imposto i secret…"
fly secrets set -a "$APP" \
  TAKO_MODE=cloud \
  CLOUD_DATABASE_URL="$CLOUD_DATABASE_URL" \
  SESSION_SECRET="$(openssl rand -hex 64)" \
  TOKEN_PEPPER="$(openssl rand -hex 32)" \
  SITE_BASE_URL="https://${DOMAIN}" \
  OAUTH_BASE_URL="https://${API_HOST}" \
  ALLOWED_ORIGINS="https://${DOMAIN},https://www.${DOMAIN}" \
  COOKIE_MODE=samesite \
  EMAIL_TRANSPORT=resend \
  EMAIL_FROM="$EMAIL_FROM" \
  RESEND_API_KEY="$RESEND_API_KEY" \
  GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
  GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" \
  REDIS_URL="$REDIS_URL" \
  TRUST_PROXY=1

# ── deploy (build context = root del monorepo) ────────────────────────────────
echo "→ Deploy…"
fly deploy -c apps/server/deploy/fly.toml

# ── certificato per il sottodominio API ───────────────────────────────────────
echo "→ Certificato per ${API_HOST}…"
fly certs add "$API_HOST" -a "$APP" || true

echo
echo "✅ Deploy lanciato. Ora i DNS su Cloudflare per ${API_HOST}:"
fly ips list -a "$APP" || true
echo "   Crea su Cloudflare (proxy DNS only / nuvola grigia):"
echo "     A    api   → <IPv4 qui sopra>"
echo "     AAAA api   → <IPv6 qui sopra>"
echo "   Poi verifica:  fly certs show ${API_HOST} -a $APP   (atteso: issued)"
echo "   Test:          curl -s https://${API_HOST}/health"
