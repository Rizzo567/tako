# Implementation notes — feature vendita 16/10

Ogni feature ha la sua sezione. Qui si annotano le deviazioni dal prompt e dal piano; dove c'era una scelta si è presa l'opzione più conservativa.

## F3+4 — Prezzo promo e scarsità

Ramo `codex/feat-promo-scarsita` (base `7cd55ab`). Nessun deploy, nessuna migrazione, nessuna scrittura su DB reale; Groq mai chiamato (modelli finti nei test).

### Scelte e deviazioni
- **Modello dati nel documento del piatto** (`promo`, `scarcity`), come da UNKNOWNS Allegato C, invece di `tags`/`priceDisplay`. Nessuna tabella: i preset (F2) copiano il piatto e portano i campi.
- **«Solo oggi» scade come etichetta, il piatto resta nel menu.** Il prompt dice «scade a fine giornata»; nascondere il piatto sarebbe un effetto non reversibile da solo. Se Manuel vuole che sparisca anche il piatto, è una riga in `resolveSalesItem`/`publicWorkspace`.
- **Giornata alle 06:00 ovunque per promo e «Solo oggi»** (decisione 16/10). «Fino a domenica» = visibile fino a lunedì 05:59. Le date si calcolano con la data e l'ora locali, non con «adesso − 6 h», così il cambio d'ora del 25/10 resta esatto (test).
- **Bug «piatto del giorno» corretto in lettura:** `publicWorkspace` nasconde sempre ciò che ha una data di fine passata (giornata delle 06:00), anche con `ignoreSchedules` (percorso del Worker `catalogOnly=1`). Le fasce orarie restano ignorate sulla pagina pubblica come prima. Effetti collaterali:
  - un calendario dalla dashboard con «fino al» ora scade anche sulla pagina pubblica (prima restava per sempre); in produzione nessun locale usa calendari (UNKNOWNS F-9);
  - la data del piatto del giorno resta quella di calendario (test esistente invariato): creato all'00:30 vale fino alle 06:00 del giorno dopo; il PDF, che applica anche le fasce orarie, lo toglie a mezzanotte come prima.
- **Promo non valida dalla dashboard:** il campo non blocca il salvataggio (sarebbe toccare il drawer condiviso con F2): una promo non valida **non viene scritta nel documento** e il messaggio lo dice («così non viene salvata»).
- **Promo con «Prezzo mostrato» a testo:** non si mostra (né pagina né PDF) e il bot rifiuta con spiegazione; il testo libero del titolare vince.
- **Esaurito operativo** (PATCH availability, schermata Gestione) fuori dal documento (UNKNOWNS B5): pulizia diretta della chiave in bozza e pubblicato senza bump di revisione. Alternativa scartata: bump di revisione → conflitto con un editor aperto e bot bloccato da `dashboardPending`.
- **Fuso:** pagina pubblica e PDF usano `settings.timezone` (ripiego Europe/Rome). Dashboard (segni e «oggi» del drawer), anteprima e azioni del modello (`validateMenuPlan`) usano Europe/Rome: 33 locali su 35 non hanno il fuso; per gli altri 2 differenza solo se non sono in Italia.
- **Ordini:** il prezzo dell'ordine resta `menu_items.price` (B12); oggi gli ordini pubblici sono spenti. Se si riattivano, la promo non si applica al conto.
- **Frasi composte** («carbonara in promo a 9 e tiramisù solo per oggi») passano dal modello (azioni nuove nel prompt); con Groq esaurito rispondono come oggi ogni frase composta. Le cinque frasi del prompt sono deterministiche.
- **Traduzioni:** etichette statiche in 12 lingue (`SALES_LABELS`, copia web con test di parità), mai LLM.
- **Doppione con F1:** `businessDate` (mio) e `operationalDay` (F1) implementano la stessa regola in rami separati; unificare dopo il merge (vedi contracts.md §2).
- **File condivisi con F1/F2:** solo agganci di una riga; `contracts.md` e questo file sono creati anche nel ramo F1 → al merge conflitto add/add da risolvere tenendo entrambe le sezioni.

### Verifiche (esiti reali, 16/10)
- `tests/menu-sales.test.ts` 15/15, `tests/twilio-menu-sales.test.ts` 11/11, `tests/parity/menu-sales.integration.test.ts` 3/3 (embedded-postgres locale).
- `pnpm test`: 87 file / 1200+ test verdi; gli stessi 20 file / 12 test rossi della base `7cd55ab` (Postgres dev :5432 assente e test già rotti), nessun rosso nuovo.
- Typecheck server e web: 0 errori. ESLint sui file toccati: 0 errori (i 10 `no-useless-escape` di `twilio-menu-ai.ts` riga 194 sono della base).
- Test node web/staff: stessi 21 rossi della base; un rosso a tempo (`public-menu-live`) passa da solo 3/3.
- Registrazioni headless `verifica-f3-f4/` (Chrome /Applications, viewport 1280 e 500): 83/83 controlli. La registrazione ha trovato un bug reale (campo promo che si svuotava digitando «13» dopo «1»), corretto.

### Limiti
- Il drawer è verificato in una fixture con il componente vero (`13-menu-sales.js` com'è) e lo stesso `updateItem`; non dentro la dashboard intera (servirebbe login sul DB). L'aggancio nel drawer vero è di una riga e il file compila nel bundle staff.
- Nessuna prova sul numero WhatsApp reale (vietato oggi).
