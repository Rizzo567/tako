# Disclaimer fiscale — Tako e il registratore telematico

Una pagina da tenere sott'occhio (per Manuel) e da consegnare al cliente. Chiaro e senza giri di
parole, così nessuno promette o capisce ciò che Tako non fa.

---

## In una riga

**Tako AFFIANCA il registratore telematico, non lo sostituisce.** La Cassa di Tako gestisce i
**conti interni** del locale; **non emette scontrini né documenti commerciali fiscali.**

---

## Cosa fa (e cosa NON fa) la Cassa di Tako

Verificato nel codice: `apps/server/src/routes/bills.ts`, `apps/server/src/lib/billing.ts`,
schema `packages/db/src/schema/bills.ts`.

**Fa** (contabilità interna del locale):
- Apre conti per tavolo/asporto, somma gli ordini, applica **sconti**, **coperto** e **mancia**.
- Ricalcola sempre il totale **dal database del locale** (mai dal telefono del cliente: nessuno può barare sul totale).
- **Registra** l'incasso di un conto con un metodo di pagamento — i valori possibili sono
  `cash` (contanti), `card` (carta), `digital`, `split` — e chiude il conto.
- Stampa **comanda di cucina** e **scontrino / nota conto di CORTESIA** (ESC/POS, taglio carta, cassetto).

**NON fa** (nessuna funzione fiscale — confermato in `docs/tako-funzionalita-ristoratori.md`, sezione limiti):
- ❌ Nessuno **scontrino fiscale** / documento commerciale.
- ❌ Nessun **registratore telematico (RT)**.
- ❌ Nessun invio di **corrispettivi** all'Agenzia delle Entrate, nessun **SDI**, nessuna fatturazione elettronica.
- Lo scontrino che stampa è **di cortesia**: serve al cliente per vedere il conto, non ha valore fiscale.
- I pagamenti sono **registrati a mano** (contanti / POS esterno): Tako non incassa e non muove denaro.

> Nel prodotto questo è già dichiarato: lo scontrino è etichettato «di cortesia, NON fiscale».
> Non ci sono claim fiscali da smentire: Tako non promette nulla sul fronte fiscale.

---

## Procedura consigliata di riconciliazione a fine giornata

Tako e il registratore telematico vivono in parallelo. A fine servizio, allinea i due totali:

1. **Chiudi tutti i conti aperti** in Tako (nessun tavolo con conto pendente).
2. In Tako leggi il **totale incassi del giorno** (dal copilota: «quanto ho incassato oggi?», o
   dalle statistiche cassa), possibilmente **diviso per metodo** (contanti / carta).
3. Sul **registratore telematico (RT)** stampa la **chiusura giornaliera** (i corrispettivi del giorno).
4. **Confronta**: totale incassi Tako ≈ corrispettivi RT. Piccole differenze possono venire da
   coperti/mance gestiti diversamente o da un incasso battuto solo su uno dei due sistemi.
5. Se c'è uno scarto rilevante, cerca il conto mancante: un ordine chiuso in Tako ma **non
   battuto sull'RT** (o viceversa). **Il documento valido ai fini fiscali è quello dell'RT**, non Tako.

> Regola pratica: **ogni incasso che va sull'RT deve corrispondere a un conto chiuso in Tako**.
> Tako è lo specchio gestionale; l'RT è la verità fiscale.

---

## «Posso buttare il registratore telematico?»

**NO.** Risposta netta da dare al cliente:

- Il registratore telematico è un **obbligo di legge** per la certificazione dei corrispettivi.
  Tako **non** lo assolve e non lo sostituisce.
- Tako serve a **gestire il locale** (ordini, cucina, tavoli, conti interni, magazzino), non a
  **certificare gli incassi** verso il Fisco.
- Il registratore **resta**. Tako gli sta accanto e ti fa lavorare meglio; l'emissione dello
  scontrino/documento commerciale fiscale continua a passare **dall'RT**.

> Per Manuel: se un cliente insiste o ha dubbi normativi, rimandalo al suo **commercialista**.
> Non dare mai garanzie fiscali: Tako non è un sistema fiscale e non va venduto come tale.
