# Email Takomenu: attivazione verificabile

## Sappiamo
Resend: dominio verificato, chiave solo invio, due prove consegnate a Manuel. Mittente noreply@takoitalia.com; Reply-To manuelrizzo474@gmail.com. Nessun invio retroattivo.

## Incognite e verifiche
| Sappiamo | Da accertare | Ipotesi / verifica | Punti ciechi |
| --- | --- | --- | --- |
| Recupero password Node presente | Parità del bundle operativo corrente | Acquisire bundle attivo e confrontare prima del delta | Interventi Claude non ancora integrati |
| Outbox prenotazioni presente | Worker transazionale generale assente | Migrazione separata con dedupe e claim | Concorrenza / risposte provider incerte |
| Prova di 30 giorni richiesta | Fonte autorevole inizio/fine prova | Identificare modello e job reali | Nessuna scadenza inventata |
| Tre notifiche abbonamento richieste | Stripe subscription webhook non trovato | Confermare eventi, firma e versioni | Piano/prezzo ancora da definire |

## Loop e condizioni di arresto
1. Audit read-only dei flussi reali.
2. Catalogo copy condiviso e renderer: test su escaping, link, variabili e layout.
3. Integrazione del recupero esistente senza alterare i dati dei clienti.
4. Prima di attivare: outbox persistente, test concorrenza, retry e cancellazione; poi secret e QA sintetico.
5. Deploy solo dopo sblocco coordinamento Claude e confronto del bundle online: AGENTS del checkout condiviso impone STOP. Nessun deploy da questo branch isolato.

Stop: nessun invio reale a clienti, nessuna finta attivazione di eventi non implementati. Le automazioni mancanti rimangono esplicitamente non attive.

## Note implementazione
Il codice locale non dimostra invio automatico online. I template non lanciano job o invii. La comunicazione di servizio richiede approvazione esplicita e lista destinatari.

## Aggiornamento rilascio
Il 19 ottobre Manuel ha sbloccato il solo delta email. v121 online, recupero e conferma dopo reset verificati; dettagli nel resoconto di sessione. Il vincolo di confronto col bundle online resta valido. Tutte le altre integrazioni elencate sopra sono ancora mancanti.
