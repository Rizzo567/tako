# Onboarding Tako — incognite, 10 ottobre 2026

Contesto: Tako originale già web, PostgreSQL operativo e workspace revisionato. Questa fase semplifica il primo accesso del cliente con logo/sfondo/colori e menu incollato; conserva il design e protegge i dati presenti. Nessun provider AI, inferenza alimentare o pubblicazione implicita.

| Sappiamo | Sappiamo di non sapere | Ipotesi da verificare / come / conseguenza se falsa | Punti ciechi |
|---|---|---|---|
| Import CSV aggiunge piatti su copia e conserva gli UUID presenti; nuovo testo usa quel percorso | Formato reale dei menu incollati dai clienti | Prezzi espliciti `Nome — 12,50 €` oppure `Nome 12,50€`, sezioni `# Titolo`; fixture con separatori, descrizioni e ambiguità. Input non riconosciuto diventa warning, mai prezzo inventato | Numeri nel nome, titoli subito dopo descrizione, prezzi senza simbolo euro né trattino |
| Tenant ricavato dalla sessione, menu target cercato soltanto nel workspace del tenant | Conferma del confine bootstrap/import sul primo accesso | GET workspace inizializza la base storica; preview può eseguire lo stesso bootstrap. Su workspace esistente conteggi/bozza/pubblico restano invariati; verificare con HTTP+DB isolato | Riferimenti foreign nel JSON esistente e revoca agenzia durante richiesta |
| Bozza e snapshot pubblico separati, salvataggio con revisione ottimistica | Flusso nuovo conserva guard per risultato tardivo? | Cambiare testo/target/bozza durante richiesta: risultato non applicabile; se falso possibile perdita modifiche locali | Due richieste fuori ordine, cambio locale, ritorno dal wizard |
| Applicare deve aggiungere alla bozza locale; salvare e pubblicare restano azioni esplicite | Upload logo/sfondo e revisione sono presentati chiaramente nel wizard? | QA browser tenant di prova e audit chiamate; nessun PUT/publish automatico dopo preview | Asset caricato ma non ancora referenziato, bozza sporca dopo abbandono |
| Parser limita 2 MB, 10000 righe e 5000 piatti; non esegue testo | Limiti UI coincidono e errori risultano comprensibili? | Test input limite/malformed e rendering escaped; se falso bloccare l'applicazione con messaggio preciso | Testo HTML/script, Unicode e CRLF, import ripetuto che duplica piatti |

Stop discovery: formato conservativo dichiarato, ownership disgiunta e gate testabili. Ambiguità non modifica architettura: warning e revisione umana. Un problema tenant/perdita dati è un gate aperto, mai attestato come completato.

## Evidenza del pass QA
Nuovo test HTTP `tests/parity/onboarding-menu-text.integration.test.ts`: **1/1 verde**, PostgreSQL temporaneo indipendente, auth/cookie reali e due tenant. Preview aggiunge un piatto solo nella risposta, conserva il piatto/ID precedente, rifiuta target dell’altro tenant e revisione obsoleta, rifiuta prezzo negativo. Bozza, snapshot pubblicato, revisioni, numero versioni e piatti operativi nel DB restano invariati.

Audit read-only wizard: input/target disabilitati durante analisi, risultato azzerato se cambiano; fingerprint della bozza e requestId all’unmount; Applica modifica soltanto lo stato editor, Salva/Pubblica restano espliciti. Iframe autorizzato e controlli origin/parent conservati. Il parser segnala possibili duplicati ma li aggiunge; descrizioni multiline supportate. Nessun gap P0 concreto emerso; resta collaudo browser del wizard finale a cura orchestratore.
