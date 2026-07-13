> ⚠️ **BOZZA generata con AI — da far revisionare a un professionista prima della firma.**
> Questo documento NON è un parere legale. Contiene campi variabili `[___]` da compilare e clausole da validare con un avvocato prima di ogni utilizzo.

# Atto di nomina a Responsabile del trattamento (art. 28 GDPR) — DPA

Allegato al [[contratto-licenza-BOZZA]] e parte integrante dello stesso.

## Parti
- **Titolare del trattamento:** [RAGIONE SOCIALE DEL RISTORANTE], P.IVA [___], sede in [___], legale rappresentante [___] — di seguito "il Titolare".
- **Responsabile del trattamento:** [NOME / RAGIONE SOCIALE], P.IVA [___], sede in [___], PEC/email [___] — di seguito "il Responsabile".

Con il presente atto il Titolare nomina il Responsabile ai sensi dell'**art. 28 Reg. UE 2016/679 (GDPR)** per i trattamenti connessi all'uso del software gestionale "Tako".

## 1. Oggetto, natura e finalità
Il Responsabile tratta i dati personali **per conto e su istruzione documentata** del Titolare, al solo fine di erogare e mantenere il Software (installazione, assistenza, aggiornamenti, funzioni AI e canale messaggi). Il Responsabile non utilizza i dati per finalità proprie.

## 2. Categorie di interessati e di dati
- **Clienti del ristorante:** dati di prenotazione (**nome e numero di telefono**), contenuto degli **ordini**, note/preferenze eventualmente inserite.
- **Personale (staff) del ristorante:** dati identificativi e di accesso (nome/utente, credenziali/sessioni), dati operativi di servizio.
- **Comunicazioni:** messaggi scambiati sui canali assistiti (es. WhatsApp/copilot owner).

Non è previsto il trattamento intenzionale di **categorie particolari** ex art. 9 GDPR: il Titolare si impegna a non inserire tali dati nei campi liberi.

## 3. Durata
Il trattamento dura per l'intera vigenza del [[contratto-licenza-BOZZA]] e cessa alla sua risoluzione, fatti salvi gli obblighi di cui all'art. 8.

## 4. Obblighi del Responsabile
Il Responsabile si impegna a:
- trattare i dati **solo su istruzione** del Titolare;
- garantire la **riservatezza** delle persone autorizzate al trattamento;
- adottare misure di sicurezza adeguate ex **art. 32 GDPR** (art. 6);
- rispettare le condizioni per il ricorso a **sub-responsabili** (art. 5);
- **assistere il Titolare** con misure tecniche/organizzative per rispondere alle richieste degli interessati (artt. 12-22) e per gli obblighi ex artt. 32-36 (sicurezza, notifica data breach, DPIA);
- **notificare al Titolare senza ingiustificato ritardo** ogni violazione di dati (data breach) di cui venga a conoscenza;
- mettere a disposizione del Titolare le informazioni per dimostrare la conformità e consentire **audit/ispezioni** ragionevoli.

## 5. Sub-responsabili (verificati nel software)
Il Titolare **autorizza** il ricorso ai seguenti sub-responsabili, attivi solo se le relative funzioni sono abilitate. Il Responsabile garantisce che ciascuno sia vincolato da obblighi di protezione dati equivalenti.

| Sub-responsabile | Funzione in Tako | Dati trattati | Note |
|---|---|---|---|
| **Groq, Inc.** (USA) | Assistente AI (function-calling) su richieste cliente e comandi owner | testo dei messaggi/ordini inviati al modello | attivo solo con `GROQ_API_KEY`; trasferimento extra-UE |
| **Google LLC** (Gemini API, USA) | Generazione/stilizzazione **foto dei piatti** | immagini caricate dal ristorante | attivo solo con chiave Gemini e funzione foto abilitata; trasferimento extra-UE |
| **Cloudflare, Inc.** (R2, USA/EU) | **Distribuzione degli aggiornamenti** del software (auto-update firmati) | nessun dato personale del cliente finale (solo artefatti software) | canale di update |
| **Meta Platforms / WhatsApp** | **Canale messaggi WhatsApp** via protocollo **non ufficiale** (libreria terza) | numero e contenuto messaggi | uso facoltativo; vedi rischi in [[contratto-licenza-BOZZA]] art. 10; trasferimento extra-UE |

Per i sub-responsabili extra-UE il trasferimento avviene sulla base delle **Clausole Contrattuali Standard (SCC)** o di altra garanzia adeguata ex Capo V GDPR. Il Titolare prende atto e accetta tali trasferimenti. Il Responsabile informa il Titolare di eventuali modifiche (aggiunta/sostituzione) dei sub-responsabili, consentendo di opporsi.

## 6. Misure di sicurezza (art. 32)
- Software installato **on-premise**: i dati operativi risiedono su hardware del Titolare (Postgres embedded locale).
- Controllo accessi con credenziali e **sessioni** a scadenza; revoca sessioni disponibile.
- Backup del database; canale locale (LAN-first) per l'operatività.
- Trasmissione ai sub-responsabili solo per le funzioni abilitate e tramite connessioni cifrate (HTTPS).
- Minimizzazione: ai modelli AI vengono inviati solo i dati necessari alla singola richiesta.

## 7. Assistenza al Titolare
Il Responsabile assiste il Titolare, nei limiti tecnici ragionevoli, per: rispondere alle richieste di esercizio dei diritti degli interessati, gestire eventuali data breach, effettuare valutazioni d'impatto (DPIA) ove necessarie.

## 8. Cancellazione a fine rapporto
Alla cessazione del contratto, **a scelta del Titolare**, il Responsabile **cancella** o **restituisce** tutti i dati personali trattati per suo conto e cancella le copie esistenti, salvo obblighi di conservazione di legge. I dati operativi restano comunque sull'hardware on-premise del Titolare, che ne conserva il controllo.

## 9. Varie
- In caso di conflitto tra il presente DPA e il contratto di licenza in materia di dati personali, **prevale il presente DPA**.
- Legge applicabile: **italiana**. Foro: **[___]** (coerente con [[contratto-licenza-BOZZA]] art. 12).

---

**Titolare** ______________________  data ____________

**Responsabile** ______________________  data ____________
