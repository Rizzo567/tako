# manu.md — Da fare prossima sessione (Tako)

> Handoff del 2026-06-26. Stato: sito auth + cloud LIVE; restano azioni di deploy e SEO.

## ✅ FATTO — Render deploy + form/login verificati live (2026-06-27)
Verificato end-to-end: backend cloud HA già il commit `8425e18` deployato.
- `/api/contact` → 200, email lead arriva a manuelrizzo474@gmail.com (testato, confermato).
- `/api/auth/login` `/register` → vivi. `/api/auth/google` → 302 OAuth corretto.
- Frontend sito (takoitalia.com + tutte le `.jsx`) live e cablato su `api.takoitalia.com`.
- → NON serve nessun Manual Deploy. Form e login funzionano.

## 🟠 "Sito pericoloso" sul login Google
Capire quale warning è (chiedere screenshot a Manuel):
- Se **pagina rossa "Sito ingannevole"** = Safe Browsing ha flaggato il dominio nuovo →
  **Google Search Console** → aggiungi `takoitalia.com` → Sicurezza/azioni manuali → **richiedi revisione**.
- Se **"App non verificata"** = OAuth consent screen →
  **Google Cloud Console → OAuth consent screen** → home page + privacy policy + **pubblica in Production** + dominio autorizzato `takoitalia.com`.

## 🟡 SEO — "Tako primo su Google"
Base on-page GIÀ FATTA e live (meta description, Open Graph, JSON-LD, robots.txt, sitemap.xml, og-image).
Resta (azioni di Manuel, serve login Google):
- **Search Console**: aggiungi proprietà `takoitalia.com`, verifica (TXT su Cloudflare), **invia sitemap** `https://takoitalia.com/sitemap.xml`.
- Costruire autorità: Google Business Profile "Tako", backlink (da Aike/social), contenuti.
- Realismo: «tako» secco è competitivo (takoyaki/polpo). Puntare a «tako ristorante / gestionale / italia».

## 🟢 Offerte in sospeso (Manuel deve scegliere)
- **a)** Sistemare struttura URL: home ora è dietro redirect a `Tako Landing.html` (con spazio) → servirla pulita su `/` (meglio per SEO).
- **b)** Aggiungere pagine **Privacy** e **Termini** (servono per OAuth + legittimità dominio).

## ⚙️ Decisioni / pulizie aperte
- **Merge `feat/cloud-auth-20260625` → main**: NON fatto. È basato su `fase1-consolidamento` → trascina 54 commit di fase1. Decisione di Manuel. Non urgente (backend gira dal branch su Render).
- **Revocare il token Cloudflare** temporaneo creato per l'audit (Cloudflare → My Profile → API Tokens). File locale già cancellato.
- **Pulire account di test** nel DB cloud: `manuelrizzo474+takotest@gmail.com`, `manuelrizzo474+e2etest@gmail.com`.
- **Test browser end-to-end**: click link verifica email → login → OAuth Google/GitHub.

## 🗺️ Dove sta tutto (worktree dello stesso repo)
- Sito → `/Users/manuel/Projects/Tako-site-auth/landing/` (branch `feat/site-auth-20260625`; va live su Pages da `main`)
- Backend cloud → `/Users/manuel/Projects/Tako-cloud-auth/` (branch `feat/cloud-auth-20260625`; gira su Render)
- App/dashboard/server locale → `/Users/manuel/Projects/Tako/` (branch `feat/fase1-consolidamento`; qui NON c'è landing/)
- Doc di progetto consolidate in `TAKO.md`. Credenziali in `~/Desktop/Tako-Credenziali/`.

## ✅ Fatto in questa sessione (per contesto)
Deploy cloud live (Render+Supabase+Cloudflare+Resend+Upstash) · sito takoitalia.com+www+api ·
avatar a cerchio post-login · favicon Tako sui domini · form contatti reali + notifica lead ·
demo senza password · SEO base · doc consolidate in TAKO.md.
