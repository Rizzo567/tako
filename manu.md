# manu.md — Azioni di Manuel (Tako)

> Aggiornato 2026-07-10 (dopo lint completo). Qui SOLO le cose che deve fare Manuel a mano
> o decidere. Tutto il resto (stato, backlog, piani) è in `TAKO.md`.

## 🔴 Decisioni aperte
1. **Merge `feat/cloud-auth-20260625` → main** — non fatto. È basato su fase1 → trascina ~54
   commit. Proposta consigliata: mergiare PRIMA `fase1-consolidamento` su main (è la linea di
   prodotto reale), poi cloud-auth diventa un merge piccolo. Il dossier conflitti lo prepara
   l'agente (TAKO.md §6-C.4); il merge lo esegui solo tu.
2. **Login cloud + email per chi usa la dashboard** — oggi la dashboard ha login solo locale;
   l'identità cloud (Supabase DB + Resend) vive sul sito. Se lo vuoi dentro l'app: serve piano
   nuovo, dipende dal pairing/merge cloud-auth. Decidere se e quando.
3. **Sorte del worktree `Tako-site-auth`** — il branch è mergiato su main (0 commit unici):
   si può rimuovere worktree + branch? Serve il tuo ok.

## 🟠 Verifiche in sospeso
- **Google Safe Browsing**: revisione richiesta il 2026-06-27 — controllare se l'avviso è
  sparito; se rigettata, ri-richiedere (lato codice è già tutto a posto).
- **Stampante termica**: codice ESC/POS fatto, mai provato su stampante fisica.
- **Test browser e2e sito**: click link verifica email → login → OAuth Google/GitHub.

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
