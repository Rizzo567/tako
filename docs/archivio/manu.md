# manu.md — Azioni di Manuel (Tako)

> Aggiornato 2026-07-10 sera (piano A eseguito: merge su main FATTO, verifica email +
> newsletter FATTE nel codice). Qui SOLO le cose che devi fare tu. Il resto è in `TAKO.md`.

## 🔴 Per ATTIVARE verifica email + newsletter + QR cloud (in ordine)
1. **Render → deploy da main**: servizio `tako-cloud` → Settings → branch da
   `feat/cloud-auth-20260625` a `main` → Manual Deploy. (main contiene tutto il branch cloud
   + newsletter + fix migrazioni; autoDeploy resta OFF.)
2. **Supabase prod → 4 ALTER** (idempotenti; il file `~/Documents/tako creds/…/tako-render-incolla.txt`
   ha una CLOUD_DATABASE_URL STANTIA — "tenant not found" — prendi quella vera da Render → Environment,
   e aggiorna il file). SQL Editor di Supabase:
   ```sql
   ALTER TABLE "cloud_appliances" ADD COLUMN IF NOT EXISTS "lan_ip" text;
   ALTER TABLE "cloud_appliances" ADD COLUMN IF NOT EXISTS "client_port" integer;
   ALTER TABLE "cloud_appliances" ADD COLUMN IF NOT EXISTS "lan_host" text;
   ALTER TABLE "cloud_owners" ADD COLUMN IF NOT EXISTS "newsletter_opt_in" boolean NOT NULL DEFAULT false;
   ```
3. **Resend → crea una Audience** (dashboard Resend → Audiences) e metti l'id su Render come
   env `RESEND_AUDIENCE_ID`. Senza, l'opt-in si salva ma nessuno viene iscritto (skip loggato).
4. **Appliance → attiva il gate**: env `CLOUD_BASE_URL=https://api.takoitalia.com` al server
   dell'app (per l'app desktop: va aggiunta al bundle/launch env — dimmelo e lo cablo io).
   Spegnimento d'emergenza: `TAKO_EMAIL_VERIFICATION=0`.
5. **E2E del flusso**: registrazione dall'app con una tua email vera → arriva l'email → click
   → login → dentro. Poi verifica il contatto nella Audience Resend.

## 🔴 Decisioni aperte
1. **Login cloud + email per chi usa la dashboard** — oggi la dashboard ha login solo locale;
   l'identità cloud vive sul sito. Il gate email ora copre la registrazione; il login cloud
   completo in-app resta da decidere (dipende dal pairing).
2. **Sorte del worktree `Tako-site-auth`** — i suoi commit sono su main? NO: ha 2 commit
   (fix demo mobile `a101b49` + GOAL doc) non ancora mergiati su main. Decidere merge (porta
   il fix demo mobile LIVE) e poi eventuale rimozione worktree.
3. **Branch morti da cancellare** (0 commit unici): `fix/stats-top-items-query`,
   `perf/orders-parallel-queries`. Altri con 1-2 commit unici da valutare (tabella su richiesta).

## 🟠 Verifiche in sospeso
- **WhatsApp↔copilot**: mai testato e2e — apri Impostazioni → pannello WhatsApp → scansiona il
  QR col telefono, poi prova un comando dal tuo numero (whitelist).
- **Google Safe Browsing**: revisione richiesta il 2026-06-27 — controllare se l'avviso è
  sparito; se rigettata, ri-richiedere (lato codice è già tutto a posto).
- **Stampante termica**: codice ESC/POS fatto, mai provato su stampante fisica.
- **Test browser e2e sito**: click link verifica email → login → OAuth Google/GitHub.
- **Demo mobile sito**: fix crash iOS è su branch `site-auth` (`a101b49`), il LIVE non ce l'ha →
  merge site-auth→main (tuo) + togliere `?debug`. Video showcase Mac incompleto: handoff in
  `~/Projects/Tako-site-auth/GOAL-demo-mobile.md`.

## 🟡 SEO / presenza (serve login Google)
- Search Console: verifica TXT su Cloudflare + invio `https://takoitalia.com/sitemap.xml`.
- Google Business Profile "Tako" + backlink (da Aike/social) + contenuti.
- URL home pulito su `/` (oggi redirect a `Tako Landing.html` con spazio — male per SEO).
- Realismo keyword: «tako» secco è competitivo (takoyaki/polpo) → puntare a «tako ristorante /
  gestionale / italia».

## 🧹 Pulizie account/servizi
- Revocare il token Cloudflare temporaneo dell'audit (My Profile → API Tokens).
- Cancellare account di test nel DB cloud: `manuelrizzo474+takotest@gmail.com`,
  `manuelrizzo474+e2etest@gmail.com`.

## ⚙️ Quando si va in produzione appliance
- Password reale del ruolo `tako_app` (`ALTER ROLE tako_app WITH PASSWORD '…'`) + `DATABASE_URL`
  col ruolo `tako_app` (attiva davvero la RLS — TAKO.md §6-A).
- Firma + notarizzazione Apple dell'app desktop (serve Apple Developer account).

## 🗺️ Dove sta tutto
- Appliance/app → `~/Projects/Tako` (branch `feat/fase1-consolidamento`; NON contiene `landing/`)
- Backend cloud → `~/Projects/Tako-cloud-auth` (branch `feat/cloud-auth-20260625`, gira su Render)
- Sito → `~/Projects/Tako-site-auth/landing/` (live su CF Pages da `main`)
- Credenziali → `~/Desktop/Tako-Credenziali/` (MAI nel repo)
