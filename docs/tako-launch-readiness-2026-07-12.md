# Tako — Launch-readiness: audit + fix (2026-07-12)

Seconda revisione focalizzata su **coerenza e prontezza al lancio** (non ri-test funzionale). Audit read-only di 42 findings, poi fix in autonomia. Tutto buildato e deployato; login e flussi verificati.

## Fixato e deployato in questa sessione

### Bloccanti (tutti risolti o mitigati)
- **Icone PWA** generate (icon-192/512, apple-touch, favicon 16/32) + `metadata.icons` nel layout → niente più icona bianca all'installazione.
- **Coperto mostrato al cliente**: `features.coverCharge` esposto dal server; CartView mostra "Coperto · a persona · aggiunto al conto del tavolo" (asporto escluso) → il totale non è più fuorviante.
- **Prenotazioni multilingua**: `ReservationForm` interamente localizzato (14 lingue) + pagina `/prenota` in `I18nProvider`.
- **Menu: errore + Riprova** invece di skeleton infinito se il fetch fallisce.
- **Copy pagamento carta/digitale** onesta ("conferma manuale", niente POS promesso).
- **Conto asporto**: modale mostra "Asporto · {nome}" invece di "Tavolo " vuoto.

### Importanti
- **Upload logo cablato** (input file → uploadImage → PATCH `/restaurants/me`); backend `logoUrl` rilassato per accettare `/uploads/`.
- **Guardia ruolo**: il copilota owner non è più apribile da cameriere/chef/cassiere (CoworkCard nascosta + `go('cowork')` bloccato).
- **Leak i18n cliente chiusi** (~40 chiavi ×14 lingue): nav asporto, notifica OS "ordine pronto", "Language", loading/errori table-app, OrderTracking (annullato/errore), link footer, splash, aria-label.
- **Tipo `RestaurantSettings` allineato** alle chiavi reali (coverCharge, tips, kds*, autoConfirm, showOnboarding…).
- `confirm()` nativo → componente `<Confirm>` (affidabile in WKWebView).
- Empty-state aggiunti (0 conti/tavoli/sezioni/menu; menu cliente vuoto o filtri troppo stretti).
- Saluti corretti (nome del ruolo giusto + fascia oraria); cowork saluta l'utente, non il ristorante.
- Rifiniture: icona "lock" aggiunta al set, trend KPI hardcoded rimosso, componente morto `LanguageSelector` eliminato, prop morto `onBack`, TODO fuorviante rimosso.

## Rimandati (richiedono backend, decisione prodotto, o lavoro maggiore)
- **[IMPORTANTE] Lingue menu editabili dall'owner + editor traduzioni sulle lingue reali** (oggi bloccato a IT/EN/FR): serve UI dedicata. **Da fare prima del lancio multilingua reale.**
- **[IMPORTANTE] Chiamate cameriere non persistite** (spariscono al refresh): serve tabella + endpoint (sono solo realtime).
- **Pagamenti online / PSP**: assente per scelta (copy ora onesta). Decisione business.
- **Fiscale (RT/SDI)**: assente per scelta.
- **Branding PWA per-ristorante** (manifest/titolo col nome del locale): oggi "Tako"; serve metadata dinamici.
- Stazioni cucina configurabili; "Nuovo conto" anche per asporto; hint ⌘K nascosto su mobile; roster pin pubblico (pattern POS); drift cartelle mascotte; normalizzazione codici lingua maiuscoli→minuscoli; stato tavolo "pronto" non persistito (documentato).
- **App macOS non firmata/notarizzata** (blocco: Apple Developer $99).

## Verifiche post-deploy
login owner → 200 · coperto nel menu cliente → `coverCharge=2` · icone nel bundle web · payment copy / logo upload / role guard nel bundle staff · health ok. Nessuna regressione della SPA (login funziona).

Vedi anche `tako-report-revisione-2026-07-12.md` (revisione funzionale, 12/12) e `tako-funzionalita-ristoratori.md`.
