# Compito 2 — menu pubblico live · REPORT (16/10/2026)

Online: Worker `takomenu-public` 928ee269 (prima 16ae080f). DB: policy `tako_menu_live_receive` + funzioni e 4 trigger `tako_menu_live_*` (Supabase Realtime Broadcast, solo segnale, nessun dato di bozza). Edge operativa, read-edge, takomenu-web non toccati.

## Numeri (QA, 5 giri per tipo, p50/p95 totale)
Dashboard (salva+pubblica → schermo): prezzo 5,6/8,1 s · nome 6,8/8,2 · piatto nuovo 7,3/9,2 · eliminato 7,3/8,9 · categoria 8,4/9,4 · menu nuovo 7,1/8,7 · esaurito 4,2/5,5. Live (commit → schermo) 1,7–3,6 s p50, ≤4,6 s p95.
WhatsApp (solo comandi deterministici): prezzo 4,2/4,8 s · esaurito 3,5/4,6 · nascondi 4,1/4,8 (bot ~2,2 s + live). Tipi via AI non misurati (quota Groq).
Scroll invariato al pixel, nessun lampeggio, categoria e lingua preservate, console pulita, QA ripristinato per hash.
Carico 30–40 telefoni stesso IP: nessun 429, tutte le riletture riuscite, ma 503 del contatore rate-limit Postgres (problema preesistente) assorbiti dai retry.
Trigger: < 5 ms per pubblicazione.

## Rollback
Pagina: `npx wrangler rollback 16ae080f-d6e2-476e-aa35-fc664aadf74b --config deploy/cloudflare/wrangler-public.jsonc`. DB: `sql/rollback.sql` (solo trigger/funzioni/policy).

## Aperto
1. WhatsApp via AI non misurato. 2. Bug router: nome piatto con « e » («Pasta e fagioli») manda il comando prezzo al percorso AI. 3. Contatore rate limit da rifare (proposte nel report agente). 4. Piano Supabase da confermare (Free = 200 connessioni Realtime). 5. Chiave pubblicabile nel bundle: anon senza permessi; disattivare i signup Supabase Auth. 6. Non provati Safari/iPhone, in-app Instagram, standby lungo. 7. Socket si aggancia 1–2 s dopo l'apertura.
