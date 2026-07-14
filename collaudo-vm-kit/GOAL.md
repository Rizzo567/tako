# GOAL — Tako Windows perfetto come su Mac

**Obiettivo:** certificare che Tako su Windows funziona in modo affidabile e completo
— backend (server+DB embedded, ciclo di vita processi, dati) e frontend (app owner e
PWA cliente) — fino a poterlo installare da un ristoratore con PC Windows.

**Condizione di stop globale:** ogni voce ✅ con evidenza nel report, oppure BLOCCATO
(serve hardware/credenziali/decisione di Manuel). Poi report finale: fix applicati
(branch `collaudo-vm-tako`), problemi residui, rischi, giudizio "vendibile su
Windows: sì/no/con riserve".

## A. Installazione e ciclo di vita (evidenza = log, tasklist, screenshot)

1. [ ] Installer NSIS parte (SmartScreen "Esegui comunque" = atteso, documenta il
       flusso); WebView2 presente o installato in automatico
2. [ ] Primo avvio: bootstrap completo — Postgres initdb **UTF8** (verifica encoding
       del cluster!), migrazioni, server :4317 su, app mostra la UI. Cronometra
3. [ ] `TAKO_HOME` (app data locale): struttura sensata, config/log presenti
4. [ ] Chiusura app → **zero processi node/postgres orfani** (tasklist prima/dopo)
5. [ ] Riavvio normale → dati intatti, avvio più veloce del primo
6. [ ] Crash test: taskkill /F dell'app → riavvio → healStaleLock recupera il lock
       stantio, Postgres riparte pulito, niente doppio processo
7. [ ] Due istanze: secondo avvio mentre la prima gira → single-instance (non due app)

## B. Funzionalità core owner (evidenza = azione riuscita + dato persistito)

8. [ ] Setup iniziale: locale/ristorante, sala + tavoli creati
9. [ ] Menu: categorie e piatti (con prezzi, varianti se presenti) CRUD completo
10. [ ] Ordine al tavolo dall'app owner: creazione, invio, stato, conto, chiusura;
        il totale è giusto; il coperto/asporto si comporta come da impostazioni
11. [ ] Inventario: carico/scarico, statistiche di base
12. [ ] Riavvio dopo tutto ciò → ogni dato ancora presente (persistenza vera)

## C. PWA cliente (evidenza = screenshot + ordine arrivato)

13. [ ] Dall'app owner genera il QR/URL del tavolo → apri in Edge nella VM →
        menu cliente carica, lingua corretta
14. [ ] Ordine dal "telefono" (Edge) → arriva in tempo reale all'app owner
15. [ ] Se la rete UTM lo consente (IP raggiungibile), prova dal telefono vero di
        Manuel; altrimenti BLOCCATO-RETE con spiegazione

## D. Updater e test suite

16. [ ] L'app interroga `updates.takoitalia.com/latest.json` senza errori (log);
        con versione uguale → nessun prompt. NON simulare update sul feed vero
17. [ ] Test suite integrazione in VM: Postgres portable + migrate + server :3001 +
        vitest → **72/72** (conferma che la CI non mente sul runtime reale)

## E. Frontend / UI (evidenza = screenshot in collaudo-vm-kit/screenshots/)

18. [ ] App owner: rendering WebView2 pulito, niente glitch, DPI 100%/125%/150%,
        font leggibili, nessun testo tagliato nelle viste principali
19. [ ] PWA: viewport mobile corretto (DevTools device mode), touch target sensati
20. [ ] Confronto qualitativo: dove la UI Windows diverge dal comportamento atteso
        (animazioni, scroll, focus, scorciatoie che su Windows usano Ctrl invece di
        Cmd) → lista nel report con proposta fixare/accettare

## Priorità

A (ciclo di vita: è ciò che NON è mai stato provato) → B → C → D → E.
Fix piccoli: subito su `collaudo-vm-tako` con test. Fix architetturali: proposta
nel report prima di implementare. Ogni fix NON deve rompere windows-test.yml.
