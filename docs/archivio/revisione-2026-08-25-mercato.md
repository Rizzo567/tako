# Tako — Report strategico di mercato
**Data:** 25 agosto 2026 · **Fonte:** tre ricerche di mercato indipendenti, consolidate e messe in contraddizione dove serviva.

---

## 0. La sintesi in cinque righe

Tako non ha un concorrente frontale: il mercato è spaccato tra **casse fiscali cloud** (39–69 €/mese, risolvono il fisco, gestionale mediocre) e **menu QR** (10–49 €/mese, non gestiscono niente). Tako sta in mezzo e aggiunge tre cose che in Italia non ha nessuno: offline vero, assistente AI che *esegue* azioni, PWA cliente multilingua con AI. Il problema non è il prodotto: è che **Tako non emette scontrini**, e questa è la prima domanda che ti faranno. La risposta commerciale non è costruire il fiscale — è vendere Tako *sopra* la cassa che hanno già. Il pricing 490 + 89 non regge come titolo, ma non per il motivo che pensi: regge male perché stai confrontando un pacchetto con una scatola dentro contro un canone senza hardware. Va ristrutturato, non abbassato.

---

## 1. La mappa del mercato

| Chi | Cosa costa | Hardware richiesto | Cosa fa che noi NON facciamo | Minaccia per noi |
|---|---|---|---|---|
| **SumUp Cassa / Cassa Pro** | 0 → 69 €/mese + 1,95% a transazione; hardware 399–649 € | Terminale SumUp; RT (**vedi nota A**) | Fisco + pagamenti + cassa in un fornitore solo; barriera d'ingresso zero; brand noto | **ALTA — è il vero concorrente** |
| **Qromo** | Free / 29 / **49** / 99 €/mese, pubblico; commissioni 0,9–1,6% | Solo smartphone | Ordine + pagamento al tavolo da QR nativi a 49 €; prezzo pubblico; onboarding self-service | **ALTA — è l'ancora di prezzo** |
| **Tilby / Scloby (Zucchetti)** | 34 retail / **44 ristorazione** €/mese + attivazione 499 €; 29 €/mese con convenzione Confcommercio | Tablet + stampante fiscale RT | Fiscalizzazione certificata; rete rivenditori capillare; canale Confcommercio | **ALTA — è il numero che ti citeranno** |
| **Cassa in Cloud (TeamSystem)** | Da ~40 €/mese, sale coi moduli; attivazione ~499 €; **listino non pubblico** | Tablet/PC + RT + stampanti comanda | Integrazione col gestionale del commercialista del cliente; fisco garantito | ALTA (istituzionale) |
| **Nexi SmartPOS Cassa+** | 49 €/mese (promo, poi 59) + commissioni; installazione 0 | Nessuno: device incluso | Un oggetto solo = POS + RT + cassa. La risposta più semplice all'obbligo 2026 | MEDIA (gestionale povero) |
| **EasyCassa** | 39–79 €/mese; hardware 499 € o comodato | Kit cassa fiscalizzato | Intervento assistenza **entro 8 ore** — la paura vera del ristoratore | MEDIA |
| **Bacco (Dylog)** | Non pubblico, solo rivenditore | PC Windows + palmari + RT | Base installata più ampia d'Italia; installatore locale che va sul posto | MEDIA (incumbent) |
| **iPratico** | Non pubblico | iPad + RT | 4.000 locali; comanda vocale Siri; UX curata su ecosistema Apple | MEDIA |
| **RistoManager (8byte)** | Non pubblico; una tantum + licenza annuale; Chiavi in Mano vincolo 36 mesi | PC Win/Mac/Linux + RT | **Rivendica l'offline** (Windows-centrico); 5.000 ristoranti; opzione hardware+assistenza 24/7 | MEDIA — è il più vicino a noi come modello |
| **Lightspeed Restaurant** | 69–399 $/mese listino int.; in Italia a preventivo | iPad + RT esistente | Pilota le stampanti fiscali che il cliente ha già — **il modello che dobbiamo copiare** | MEDIA |
| **Menu QR low-cost** (MenuDigitale.io, LeggìMenu, Stello, NordQR, MenuIsland…) | 8–25 €/mese; MenuIsland 300 € a vita | Nessuno | Niente: sono PDF migliorati | BASSA (ma avvelenano l'aspettativa di prezzo) |
| **Tomato AI / Ordinoo / Bencall** | Non pubblico | Nessuno | Food cost, marginalità, revenue management, risposta alle chiamate | BASSA (complementari) |
| **TheFork Manager** | 49–89 €/mese + commissione a coperto (non pubblico) | Nessuno | **Porta clienti veri.** È domanda, non software | BASSA (complementare) |
| **Toast, Square, Sunday, Storekit, Yumpingo** | — | — | — | **NULLA: non sono in Italia** |

**Nota A — contraddizione da verificare prima di aprire bocca con un cliente.** Le ricerche si contraddicono su SumUp: una dice che il registratore telematico è **incluso gratis nell'app** e trasmette da solo all'Agenzia delle Entrate; l'altra dice che serve comunque un RT separato. La differenza è enorme: nel primo caso SumUp risolve tutto a 39 €/mese e ti sfonda il pitch. **Azione: 30 minuti di verifica sulla pagina fiscale ufficiale SumUp prima della prima visita.** Non improvvisare su questo punto davanti a un ristoratore.

**Fatto che vale più della tabella:** i giganti americani non ci sono. Toast (106.000 ristoranti) dichiara esplicitamente di non entrare in Italia/Francia/Germania/Spagna perché servono l'integrazione fiscale con lo Stato. Square non processa pagamenti in Italia. **Il fisco italiano è il muro che ti protegge — ed è lo stesso muro contro cui sbatti tu.**

---

## 2. Il muro fiscale

### Cosa serve per legge

| Obbligo | Da quando | Sanzione |
|---|---|---|
| Memorizzare e trasmettere i corrispettivi via **Registratore Telematico** (D.Lgs 127/2015) | 2021, già in vigore | 100% dell'imposta, min. 500 €; **sospensione licenza dopo 4 violazioni in 5 anni** |
| **Collegamento logico POS ↔ RT** (L. 207/2024 + Provv. AdE 424470/2025) | 1 gennaio 2026; portale dal 5 marzo; scadenza 20 aprile 2026 | 1.000–4.000 € + 100 €/violazione (max 1.000 €/trimestre) |
| Soluzioni software RT (PEM/PEL, Provv. AdE 111204/2025) | operative dal 1 gennaio 2026 | non commerciabili senza iter di certificazione completo |

### La regola d'oro che risolve il problema

**La trasmissione dei corrispettivi è compito del Registratore Telematico, non del gestionale.** Ogni ristorante che apre la porta ha già un RT — è obbligatorio da cinque anni. Tako non deve sostituirlo. Deve affiancarlo, e in seconda battuta pilotarlo.

Questo è esattamente il modello di Lightspeed, Tilby e mezzo mercato: si integrano con Custom, RCH ed Epson **che il ristoratore ha già**, senza obbligo di sostituzione.

### Le tre strade, in ordine di sensatezza

| Strada | Costo per te | Tempo | Verdetto |
|---|---|---|---|
| **A. Complementare puro** — Tako gestisce sala, cucina, cliente, magazzino; il conto si batte sulla cassa esistente | 0 € | 0 | **FALLO SUBITO.** È l'unico modo di vendere i primi 10 clienti quest'anno |
| **B. Pilotare la stampante RT esistente via HTTP/XML** — Epson FP-81II, Custom, RCH espongono web service XML nativo, zero driver, zero certificazione per te | Qualche settimana di sviluppo, 0 € di certificazione. RT nuovo se manca: ~569–855 € (a carico del cliente) | 1–2 mesi | **FALLO DOPO i primi 3 clienti**, quando sai su quale stampante lavorare davvero |
| **C. Integrare un provider software già certificato** (A-Cube, Servicepay Fiscal da 14,99 €/mese per punto cassa) | Integrazione API; nessun iter di certificazione tuo | 1–3 mesi | Opzione B-bis, buona per locali senza RT o con RT vecchio |
| **D. Certificarti tu** (ente accreditato + Commissione misuratori fiscali + provvedimento AdE) | Mesi, costi non pubblici | 6–18 mesi | **NO. Insostenibile per una persona sola senza P.IVA.** Non pensarci più |

### Cosa implica per prezzo e pitch

1. **Sul prezzo:** non puoi chiedere il prezzo di una cassa se non sei una cassa. Ma puoi chiedere *in aggiunta* alla cassa, perché il tuo canone non sostituisce il loro: si somma. Questo abbassa il tetto psicologico. Sopra i 44 €/mese di Tilby *già pagati*, un secondo canone di 89 € è una vendita difficile. Un secondo canone di 59 € è una vendita possibile.
2. **Sul pitch:** non dire mai "sostituisce la cassa". Di': *"la tua cassa resta dov'è, io non la tocco. Io ti prendo la sala, la cucina e i clienti."* Chi promette di toccare il fiscale si prende la responsabilità del fiscale — e non ce l'hai.
3. **Regalo di contesto:** ogni ristoratore in questo momento ha la testa piena della scadenza POS-RT (già scaduta ad aprile, sanzioni vive). Sapere *di cosa parlano* ti dà credibilità in 20 secondi, anche se non vendi niente su quel fronte. È il tuo gancio di conversazione, non il tuo prodotto.

---

## 3. Dove ci infiliamo (e dove no)

### Il segmento dove Tako vince davvero

| Dimensione | Profilo |
|---|---|
| **Tipo di locale** | Ristorante o trattoria con **servizio al tavolo**, cucina propria, menu che cambia. NON bar, NON fast food |
| **Coperti** | **40–90**. Sotto i 40 non c'è dolore sufficiente; sopra i 100 vogliono un fornitore con assistenza h24 e tu non ce l'hai |
| **Clientela** | **Turistica o mista italiano/straniero.** È qui che la PWA multilingua con AI diventa un motivo di acquisto e non una feature |
| **Rete** | Wi-Fi ballerino, FWA, locali in centro storico, seminterrati, dehors lontani dal router. **Più la connessione fa schifo, più vali** |
| **Chi decide** | **Il proprietario che sta in sala.** Titolare 40–58 anni, impresa familiare, decide da solo in 10 minuti. Non c'è comitato, non c'è IT |
| **Cassa** | Ne ha già una e non la vuole cambiare. **Perfetto: è il tuo requisito, non il tuo ostacolo** |
| **Geografia** | **Una sola città + 40 km di raggio.** Non due. Devi poter essere lì in 45 minuti un sabato sera |

Il mercato aggredibile non sono i 194.899 ristoranti italiani. Sono i **ristoranti turistici indipendenti con servizio al tavolo, con cassa già in essere, dentro il tuo raggio d'auto**. Realisticamente: 200–400 locali totali nel tuo territorio. Ne servono 10.

### I segmenti dove NON dobbiamo andare

| Segmento | Perché no |
|---|---|
| **Bar, caffetterie, tabaccherie** | Scontrino veloce al banco, nessun tavolo, nessuna comanda. Vendi la funzione sbagliata e SumUp li prende a 0 € |
| **Chi vuole sostituire la cassa** | Non puoi. Ogni minuto speso a spiegarglielo è tempo perso. Qualificalo alla prima domanda e saluta |
| **Catene e multi-sede** | Vogliono SLA, contratti, referenze, un fornitore con P.IVA da 5 anni. Perdi 3 mesi e non firmi |
| **Solo delivery / dark kitchen** | Il valore di Tako è la sala. Lì contano Deliverect e le commissioni delle piattaforme |
| **Locali che non hanno un Wi-Fi di sala e non vogliono spenderci 150 €** | Senza rete, il QR al tavolo non esiste. Non è un cliente, è un cantiere |
| **Chi cerca il prezzo più basso** | Ti confronterà con MenuIsland a 300 € a vita. Non vincerai mai quella conversazione e non la vuoi vincere |

---

## 4. Perché dovrebbero scegliere noi — tre argomenti difendibili

### 1. "Se salta internet, tu continui a lavorare. Loro no."

**Prova concreta dal prodotto:** il server Fastify e Postgres girano dentro il locale, la PWA cliente è servita in LAN con QR LAN-first (`tako.local`), `printer.ts` apre socket TCP diretti verso la stampante di cucina su porte 9100-9103 — tutto senza uscire dalla rete. Load test da 45 clienti simultanei passato in VM. Il degrado a internet giù è documentato e pulito: cadono solo AI, WhatsApp e vista da remoto. SumUp, Tilby, Cassa in Cloud, Qromo, Nexi, Lightspeed sono **tutti** cloud-dipendenti.

**La controbiezione che ti faranno:** *"Ma a me internet non salta mai."*
**La risposta:** *"Neanche a me. Fino a un sabato di agosto alle nove di sera. Quanto ti costa un'ora di sala ferma?"* — E poi la vera chiusura: non è internet a saltare, è il router del locale. Chiedigli quante volte ha dovuto staccare e riattaccare il modem durante il servizio. Risponderanno tutti la stessa cosa.

### 2. "Il lavoro amministrativo lo fa l'assistente, tu scrivi su WhatsApp."

**Prova concreta:** registro `ai-actions.ts` con 41 azioni (37 lato owner), raggiungibile dal canale WhatsApp owner. "Aggiungi le linguine alle vongole a 16 euro", "chi ha timbrato oggi", "quanto abbiamo incassato ieri" — e l'azione viene eseguita, con card di conferma sulle mutazioni. In Italia **nessuno** fa questo: Tomato AI fa analisi di food cost, Bencall risponde al telefono, Ordinoo fa amministrazione. Nessuno pilota il gestionale conversando.

**La controbiezione:** *"L'intelligenza artificiale sbaglia / non mi fido."*
**La risposta:** *"Su tutto quello che cambia i dati ti chiede conferma prima, con un pulsante. Non fa niente da sola."* È vero e verificabile in demo. Fagliela vedere sbagliare volutamente una volta e mostrare la card di conferma: la fiducia si compra così, non a parole.

### 3. "Il tuo cliente straniero ordina nella sua lingua, e le foto dei piatti te le faccio io."

**Prova concreta:** assistente PWA cliente che risponde in 14 lingue nella lingua di chi scrive, con pulsanti azione tappabili (invia ordine, prenota, chiama il cameriere); foto piatti generate con Gemini a partire da una reference del locale. Un ristorante turistico oggi ha un menu QR in italiano e inglese tradotto male, e zero foto perché il fotografo costa 800 €.

**La controbiezione:** *"Le foto AI si vedono che sono finte."*
**La risposta:** mostra il caso reference-based (foto vera del piatto → variante pulita). E se non convince, non insistere: il valore vero è il multilingua conversazionale, la foto è il contorno che chiude la trattativa con chi ha un menu senza immagini.

**Argomento bonus, sottovalutato:** **nessun vincolo contrattuale**. RistoManager Chiavi in Mano lega 36 mesi. EasyCassa lega col comodato. Deliverect si rinnova in automatico. "Disdetta con 30 giorni, i tuoi dati te li porti via" è un argomento di chiusura concreto contro tutti.

---

## 5. Il ristoratore senza computer

Premessa che vale più di tutta la tabella: **nell'architettura attuale il ristoratore non deve usare un computer nemmeno oggi.** La scatola è un elettrodomestico senza schermo né tastiera che sta nello sgabuzzino; lui lavora dal suo telefono via PWA owner. "Non ho il computer" è un'obiezione di *percezione*. Si smonta cambiando il copy della vendita, non l'architettura.

| Opzione | Costo hardware | Margine su 490 € (401,64 € imponibili) | Chi installa | Cosa si rompe |
|---|---|---|---|---|
| **1. Mac mini fornito da noi** | 979 € nuovo / ~829 € ricondizionato | **−577 € / −433 €: perdita secca** | Manuel, di persona | Niente di tecnico. Si rompono i tuoi conti |
| **1b. Micro PC business ricondizionato + UPS** (HP EliteDesk 800 Mini, Dell OptiPlex Micro) | 140–200 € + UPS 46–93 € = **200–270 €** | **+130 / +200 € lordi**, prima di spedizione e giornata di installazione | Manuel, di persona o guidato in videochiamata | RMA hardware (serve una scatola di scorta); RAEE; capitale immobilizzato |
| **2. Solo iPad/iPhone, nessun server** | 509–829 € se da comprare | irrilevante | — | **Non funziona.** iOS sospende le app in background: appena il titolare blocca lo schermo, il QR al tavolo dà errore. Nessun permesso lo aggira. Più: nessun binario Postgres per iOS, stampa comande impossibile. **Scartata** |
| **3. Cloud puro** | 0 € | canone quasi tutto margine (3–8 €/mese di infra per locale) | Nessuno: onboarding remoto in 10 minuti | Sabato sera con la linea giù = locale fermo. Stampa comande rotta (`printer.ts` rifiuta IP non privati → serve un agente locale, cioè di nuovo hardware). E diventi titolare del trattamento dei dati operativi con RLS che nel repo è ancora "da fare". **Butti via il tuo argomento migliore** |
| **4. Raspberry Pi 5** | 180–220 € tutto compreso | +180 € circa | Manuel | **Costa più di un micro PC x86 ricondizionato e ti obbliga a costruire e mantenere un terzo canale di auto-update da solo.** Nessun target Linux nel bundle Tauri oggi. Box Android: impossibile, Postgres non ha binari per Android |
| **5. Ibrido: scatola muta in locale + cloud sottile + telefono** | **200–270 €** | **+130 / +200 € lordi** | Manuel, o spedizione + videochiamata | Resta capitale, logistica, RAEE, una trasferta. Dipendenza da Cloudflare per la vista da remoto. Il QR cloud stabile è codato ma **non ancora live** |

### La raccomandazione netta

**Opzione 5, con micro PC business ricondizionato.** Tre motivi, in ordine:

1. **È l'unica combinazione in cui i conti tornano senza rinunciare all'offline.** Il Mac mini nel 2026 è matematicamente fuori (crisi memorie, +280 € sui listini Apple dal 27 giugno). Il cloud puro ti fa perdere l'unico differenziatore che il ristoratore capisce in 5 secondi.
2. **È già costruita all'80%.** `tunnel.ts` (Cloudflare Tunnel in uscita, nessuna porta aperta sul router del cliente), `remoteGate.ts`, auth con `Authorization: Bearer` già funzionante fra LAN http e tunnel https, PWA owner già bundlata nell'appliance, resolver QR cloud già codato. **Manca il deploy, non il progetto.**
3. **Il build Windows è già collaudato** (CI 72/72 su windows-latest, auto-update 0.1.3→0.1.4 PASS). Micro PC x86 = costo di sviluppo zero. Linux/Pi = un terzo canale di rilascio da mantenere da solo, e la lezione l'hai già pagata: un fix dell'updater si collauda sempre sul salto successivo.

**Due avvertenze operative da chiudere prima della prima vendita:**
- L'UPS deve alimentare **anche il router e l'access point**, non solo la scatola. Server vivo e nessun telefono che lo raggiunge è peggio di server spento.
- **Distribuire hardware ha obblighi RAEE reali** (L. 50/2026: ritiro uno-contro-uno professionale come obbligo diretto del distributore, iscrizione al Centro di Coordinamento RAEE, sanzioni pesanti). **Mitigazione per i primi 10:** non rivendere la scatola. Manda al ristoratore il link, la ordina lui a suo nome, tu fatturi solo installazione e canone. Zero RAEE, zero capitale, zero magazzino. Ci pensi quando avrai P.IVA e un commercialista che ti dice come farlo bene.

---

## 6. Prezzo — verdetto e proposta

### Il verdetto onesto su 490 + 89

**Il 490 regge, l'89 no. E il 190 fondatore ti fa perdere soldi in modo che devi decidere consapevolmente.**

- **490 € una tantum: in linea con il mercato.** Cassa in Cloud, Tilby ed EasyCassa chiedono tutti ~499 € di attivazione — **e non ti danno nessuna scatola.** Non è un prezzo alto: è un prezzo *magro*. Con hardware a 200–270 € più una giornata di installazione, il margine reale è vicino a zero. Se ci metti la scatola, quel numero va alzato.
- **89 €/mese: sopra il tetto.** Il ristoratore ha in testa "Tilby 44", "Qromo Pro 49", "Nexi 49". E tu **ti sommi** alla cassa che paga già, non la sostituisci. 89 come numero unico e non spiegato ti fa perdere trattative che potresti vincere.
- **190 + 59 fondatore: vendibile, ma sappi che i primi 10 li paghi tu.** 190 € imponibili sono ~156 €: sotto il costo della scatola. Aggiungi una giornata di installazione. **Costo di acquisizione reale del cliente fondatore: 250–400 €.** Va benissimo — è marketing, non è una perdita — ma va messo a bilancio come tale, non scoperto a dicembre.

### La proposta

**Sposta il prezzo dal confronto sbagliato.** Non competere sul numero mensile: competi sul TCO e sulle commissioni. Un locale che fa 30.000 €/mese di incassato carta paga a SumUp 585 €/mese di commissioni. Il tuo canone è rumore di fondo rispetto a quel numero, e va detto.

**Listino proposto:**

| Voce | Prezzo | Cosa include |
|---|---|---|
| **Installazione — con scatola** | **690 € una tantum** | Appliance + UPS + installazione in loco + menu caricato + QR stampati + formazione del personale |
| **Installazione — senza scatola** | **390 € una tantum** | Se il locale ha già un Mac o un mini PC utilizzabile |
| **Tako Sala** | **59 €/mese** | Gestionale, PWA cliente multilingua, comande, conti, prenotazioni, app owner sul telefono |
| **Tako Completo** | **99 €/mese** | Tutto Sala + assistente AI 41 azioni + WhatsApp + foto piatti AI + magazzino, turni e timbrature |
| **Vincolo** | **Nessuno** | Disdetta 30 giorni, dati esportabili |

**Offerta fondatore (solo i primi 10, dichiarata come tale e con scadenza vera):**
> **190 € di installazione + 59 €/mese per 12 mesi, con Tako Completo incluso** (cioè il piano da 99 al prezzo del 59, a vita per chi entra ora).
> In cambio, e va scritto nel contratto: referenza citabile con nome del locale, una video-testimonianza da 60 secondi dopo 60 giorni, mezz'ora di feedback ogni due settimane, e il diritto di portare altri ristoratori a vedere il sistema in funzione durante il servizio.

**Perché questa struttura funziona meglio:**
1. **Due piani spostano la conversazione da "quanto costa" a "quale prendo".** È la mossa che disinnesca il confronto con Tilby a 44: 59 è vicino, difendibile, e non è il tuo prezzo vero — il tuo prezzo vero è 99, e chi compra l'AI compra una cosa che nessun altro vende.
2. **Il 690 con scatola è onesto e sostenibile:** ~565 € imponibili meno 250 € di kit = 315 € per coprire trasferta, installazione e la scatola di scorta per l'RMA. Il 490 con scatola dentro non copre la giornata di lavoro.
3. **Il "senza vincolo" vale più di 10 €/mese di sconto** contro concorrenti che legano 36 mesi.
4. **Non svendere il canone fondatore sotto 59.** Sotto quella soglia il cliente non ti considera un fornitore serio e tu non copri l'AI a consumo, il cloud e la reperibilità.

**Cosa NON fare:** non pubblicare 89 come numero unico; non regalare il canone (regala l'installazione o due mesi, mai il ricorrente); non fare pilota gratuito senza data di fine scritta.

---

## 7. I primi 10 clienti

### La strategia in una frase
Manuel non ha una rete di rivenditori e non la costruirà quest'anno. Quindi non vende su scala: **vende 10 volte, a mano, in una sola città, con il menu del ristoratore già dentro Tako prima di suonare il campanello.**

### Il funnel realistico

| Passo | Numero | Come |
|---|---|---|
| Lista qualificata | **80 locali** | Google Maps + TripAdvisor entro 40 km. Filtro: servizio al tavolo, 40–90 coperti, recensioni in ≥3 lingue, indipendente, menu QR assente o pessimo |
| Visite di persona | **50** | Martedì–giovedì, **15:00–17:30**. Mai in servizio, mai il sabato, mai per telefono la prima volta |
| Demo vere (10+ minuti col titolare) | **20** | Solo dove il titolare c'è ed è il decisore |
| Pilota 30 giorni | **12** | Installazione vera nel locale, non slide |
| Clienti paganti | **6–8** | Gli altri 2–4 arrivano dai referral dei primi |

### Le cinque mosse, in ordine

1. **Il colpo che cambia tutto: arriva col loro menu già caricato.** 20 minuti di lavoro prima della visita: prendi il PDF dal loro sito, caricalo in Tako, genera due foto AI dei loro piatti di punta, stampa il QR. Poi entri e dici *"guardi, questo è il suo menu"* e gli passi il telefono. Non stai vendendo un software: gli stai facendo vedere il suo ristorante che già funziona. È l'unica cosa che nessun concorrente con rete di vendita si prende la briga di fare.
2. **Tre pilota gratuiti da 30 giorni, con data di fine scritta**, ai tre locali più visibili della lista, in cambio di referenza e della possibilità di portarci altri ristoratori. Sono la tua vetrina, non i tuoi clienti.
3. **Il canale che vale più di tutto il resto: i rappresentanti.** L'agente della birra, del caffè, del fornitore alimentare entra in 40 locali a settimana e il titolare gli apre. Trovane due, offri 150 € a cliente firmato. È il surrogato della rete commerciale che i concorrenti hanno e tu no. Secondo canale: il commercialista locale specializzato in horeca.
4. **Referral esplicito dal primo cliente:** un mese gratis per ogni segnalazione che diventa pilota. Chiedilo il giorno 30, non il giorno 1.
5. **Cosa NON fare:** niente ads, niente cold email, niente fiera, niente sito che converte. Con 10 clienti da fare, ogni euro speso in marketing è un'ora non passata dentro un ristorante.

### Lo script telefonico — 30 secondi, da dire così

> *"Buongiorno, sono Manuel, non le vendo la cassa e non le tocco lo scontrino — quello lo lascio esattamente com'è.*
> *Io faccio la parte della sala: il cliente inquadra il QR al tavolo, vede il menu con le foto e ordina nella sua lingua, anche se è tedesco o giapponese; la comanda esce in cucina da sola. E funziona anche quando le salta internet, perché gira dentro il suo locale, non su un sito.*
> *Le ho già caricato dentro il suo menu, ci ho messo venti minuti. Le va se passo martedì alle quattro e glielo faccio vedere sul suo telefono? Dieci minuti, se non le piace me ne vado.*"

**Perché funziona:** disinnesca l'obiezione fiscale nella prima riga (non ti tocco la cassa), dà il beneficio in linguaggio da sala e non da software, mette l'offline come fatto e non come feature, e chiude con un impegno asimmetrico — tu hai già lavorato per lui, lui rischia dieci minuti.

### Le tre cose da chiudere prima della prima visita

1. **P.IVA.** Senza, non fatturi. I ristoratori sono soggetti IVA e la fattura la pretendono. Questo blocca la vendita prima ancora del fisco e prima ancora dell'hardware.
2. **Verificare la questione RT di SumUp** (nota A al §1). Se il loro RT è davvero incluso e gratuito, il tuo pitch va riscritto sulla sala e sul multilingua, non sul confronto di prezzo.
3. **Deployare il resolver QR cloud e le colonne LAN su `cloud_appliances`.** È l'ultimo pezzo mancante dell'opzione 5, ed è deploy, non progettazione.