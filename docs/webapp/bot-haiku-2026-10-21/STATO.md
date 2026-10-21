# STATO — motore Haiku 5.5 (21/10/2026)

**Aggiornato 13:30 — fermo su richiesta di Manuel.** Online: edge v132 + lettura v27 + worker 3e44eedc (Menu nascosti alla nascita, «rendi visibile», «Menu in arrivo»). Vedi `REPORT.md` §0ter.
- **Menu a prezzo fisso e PDF multipli: SOSPESI** (partono solo su via esplicito del main thread). Contratto: `docs/webapp/menu-prezzo-fisso-2026-10-21/CONTRATTO.md`.
  - Su questo ramo c'è solo il contratto dati (242a2da: campi facoltativi `pricing`/`formulas`/`included` + `menu-fixed-price.ts`), additivo e non usato: i documenti esistenti restano identici.
  - Il lavoro a metà (bot, proiezione pubblica, renderer; NON funzionante) è sul ramo `wip/menu-prezzo-fisso` (2d1112a, pushato). Dashboard e banco a prezzo fisso: non iniziati (solo analisi).
- Panuzza's mostra «Menu in arrivo» in «Fuori menù» e «Verdure» (sottomenu attivi vuoti): dati non toccati, decide Manuel.
