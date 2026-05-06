# Tako — Agent Backlog

> Questo file è l'interfaccia tra Manuel e gli agenti.
> Manuel scrive qui. Agenti leggono, eseguono, spostano i task in DONE.
> Ordine = priorità. P0 prima di tutto.

---

## P0 — Critico (blocca produzione o vendita)

- [ ] **Multi-tenant base** — ogni ristorante ha il suo schema DB isolato con Drizzle RLS. Senza questo Tako non può servire più di un cliente | contesto: ora tutto è single-tenant | done quando: un secondo ristorante può registrarsi e vedere solo i suoi dati
- [ ] **Auth multi-ristorante** — owner può avere più ristoranti sotto lo stesso account | contesto: ora 1 account = 1 ristorante | done quando: dropdown ristorante nella dashboard funziona
- [ ] **Stripe integration base** — pagamenti con carta dalla customer PWA | contesto: ora solo contanti/tavolo | done quando: cliente può pagare online dal telefono

---

## P1 — Alta priorità

- [ ] **Test coverage server** — unit test per le route Fastify principali (ordini, menu, tavoli) con Vitest | done quando: coverage > 70% su apps/server/src/routes
- [ ] **Pagination ordini** — la pagina ordini carica tutto il DB, serve pagination | done quando: ordini caricano in chunk da 50, scroll infinito
- [ ] **Export report CSV** — owner può esportare ordini e incassi del periodo selezionato | done quando: bottone export nella pagina statistiche scarica CSV corretto
- [ ] **Error handling globale** — errori non gestiti crashano il server senza messaggio utile | done quando: ogni route ha try/catch con risposta JSON strutturata
- [ ] **Landing page completamento** — la folder /landing esiste ma è incompleta | done quando: landing ha hero, features, pricing, CTA, deploy su Cloudflare
- [ ] **Mobile responsive dashboard** — alcune sezioni dashboard non funzionano bene su tablet < 768px | done quando: tutte le sezioni usabili su iPad Mini

---

## P2 — Miglioramento continuo

- [ ] **Analytics avanzati** — grafico revenue per ora del giorno, heatmap giorni settimana
- [ ] **Email notifiche owner** — email giornaliera con summary incassi e ordini
- [ ] **PWA offline mode** — customer PWA funziona anche senza connessione (mostra menu cached)
- [ ] **Dark mode dashboard** — toggle dark/light nella topbar
- [ ] **Multi-lingua** — IT/EN switch nella customer PWA
- [ ] **QR code personalizzato** — owner può customizzare colore/logo del QR tavolo
- [ ] **Notifica push staff** — cameriere riceve push quando cliente chiama o ordine pronto in cucina

---

## DONE ✅

- [x] UI Revision completa (10 task) — 2026-04-28
- [x] Analisi Menu AI (Boston Matrix + GPT suggerimenti) — 2026-04-30
- [x] TypeScript zero errori — 2026-04-30
