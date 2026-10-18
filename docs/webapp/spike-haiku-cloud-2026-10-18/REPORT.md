# Spike Haiku 5.5 come cervello del bot titolare — 18/10/2026

Base `main` @ `c721bb3`, branch `codex/spike-haiku-cloud-1018`. Nessuna chiave API, nessun deploy. Opus = ristoratore + server; un sottoagente **Haiku 5.5** nuovo per ogni messaggio del titolare = modello del bot.

## Come
- **Conversazioni**: 92 del banco vero (`tests/eval/cases/banco-vero.ts`, parole di Manuel invariate) + 30 nuove nello stesso stile (`harness/cases-extra.ts`) = 122 conversazioni, 189 messaggi.
- **Prompt a Haiku** (`harness/spike.ts` → `buildPrompt`), in quest'ordine: system (istruzione + vincolo duro + regole del titolare + glossario ricopiati da `owner-brain-context.ts` + schema strumenti) · scheda del locale (menu compatto `p1|nome|prezzo|flag` + nota del locale) · cronologia della giornata · operazioni in sospeso · messaggio. Haiku non ha visto codice.
- **Server simulato**: menu mutabile con id stabili, 20 strumenti; **validatore lato server** (prezzo/nome presenti nel testo del titolare o derivati da delta/percentuale sul prezzo letto; `elimina_piatto` effettivo solo con «sì» al turno dopo; `annulla_ultima` solo ultima pubblicazione, mai piatto del giorno; piano respinto → errore a Haiku, al 2° rifiuto → domanda; max 6 passi; fatti riletti appesi alla risposta).
- **Giudice**: quello del banco (`tests/eval/judge.ts`), stato finale + invarianti per turno.
- **Nota del locale**: ondata A (61 conversazioni, nota vuota) → un Haiku separato scrive la nota per locale (`runs/note-*.txt`, ≤ 500 token, solo significati) → ondata B (altre 61, nota nel prompt). Le ondate alternano le conversazioni (stesso mix).
- **Deviazione**: il tool loop con SendMessage allo stesso Haiku è stato usato per i primi 10 messaggi; poi, per reggere 189 messaggi, ogni Haiku consegnava il suo JSON al server da sé (`spike.ts srv <id> out.json`, che stampa solo i risultati degli strumenti) e lo stesso Haiku proseguiva con quei risultati. Contenuto visto identico a un tool loop API; cambia solo il trasporto (prompt letto da file con Read invece che system message).
- **Log completi**: `runs/<id>/state.json` (ogni passo: uscita di Haiku, strumenti eseguiti/respinti, risposta, menu dopo), `runs/<id>/tN.prompt.txt` (prompt esatto), `runs/<id>/verdict.json`.

## Risultati
| | conv. | ok | GRAVE | MEDIO |
|---|---|---|---|---|
| **Totale** | 122 | **106 (86,9%)** | 9 | 7 |
| Banco vero | 92 | **78 (84,8%)** | 8 | 6 |
| Nuove | 30 | 28 | 1 | 1 |
| Semplici (1 msg) | 74 | 69 | 3 | 2 |
| Multi-turno | 48 | 37 | 6 | 5 |
| bv-semplici (solo banco) | 26 | **26** | 0 | 0 |

Per famiglia (banco): domande 10/10, annulla 8/8, dialetto 5/5, elimina 5/5, deixis 4/4, fuori 4/4, multiple 7/9, aggiunte 5/6, asr 2/5, categorie 1/3, **correzioni 1/7**.

- **Passi di strumento per messaggio**: media **1,85**, max **3** (tetto 6 mai toccato).
- **Piani respinti dal validatore** (corsa finale): **0**. Nelle corse iniziali 5 rifiuti, tutti bug del mio lettore di numeri («11 e 50», «4 e 50», «1 e 40», «50 centesimi», «tre dici»): corretto e rifatte le 5 conversazioni (x-002/006/010/022/030). Auto-correzioni dopo un rifiuto: 1 riuscita; negli altri casi Haiku ha chiesto conferma al titolare invece di riprovare. Altri 2 bug del server simulato corretti e rifatti: «sì» accentato non riconosciuto come conferma (x-013) e più `chiedi` nello stesso passo troncati all'ultimo (bv-correzioni-002).
- **Domande ogni 10 messaggi**: A (nota vuota) **2,78** → B (con nota) **2,53**; domande *non attese* 1,33 → 1,62. Successo A 52/61, B 54/61. **La nota non riduce le domande in modo misurabile**.
- **Token in ingresso** (caratteri/4, prima chiamata del turno): media **1.489**, max 1.870 (A 1.309, B 1.652 per la nota). Le chiamate successive del turno aggiungono ~50–150 token di risultati.
- **Fonetici** (20 conversazioni con storpiature): risolti **17/20**; `cerca_piatti` usato in 14/20 (quando il nome era ovvio dal menu nel prompt Haiku ha agito senza cercare: «u tunnu», «babbà», «carbonare», «kenesac» in bv-multiple-009, «bo» in deixis). Bene: «kenesac», «Bo», «passa il ragù», «pontarelle», «sarte», «tre dici», «Inserisce il piatto la parmigiana». Male: «Bu costa 40» (scritto boh a 40 invece di chiedere), i due «toiibo» delle correzioni (domanda giusta su toiibo, ma problema sulla parmigiana).

## Confronto con Groq di oggi
| Misura | Groq (gpt-oss, oggi) | Haiku 5.5 (spike) |
|---|---|---|
| Banco vero (giudice, oracolo) | 80/92 | **78/92** |
| Banco vero gpt-oss vero (41) | 38/41 | n.d. (stesso sottoinsieme non isolato) |
| Semplici | 26/26 | **26/26** |
| Domande ogni 10 msg | 2,9 | **2,68** (banco) / 2,65 (tutto) |
| Passi per messaggio | 1 chiamata strutturata | 1,85 (tool loop) |
| Token ingresso per chiamata | ~2,7 car/token + schema | ~1,5k (car/4) |

## I 10 fallimenti più istruttivi
Prompt esatto: `runs/<id>/tN.prompt.txt`; uscita completa: `runs/<id>/state.json`.
1. **bv-asr-002** «Bu costa 40 euro» → `cerca_piatti{"testo":"boh"}` → `cambia_prezzo{"piatto_id":"p3","prezzo":40}` → «Fatto: «boh» ora costa 40 €». GRAVE (scrive invece di chiedere). Causa **Haiku**: ha riscritto «Bu» in «boh» prima di cercare; il validatore non può accorgersene.
2. **bv-multiple-002/003** «…Pasta 14, Pizza 16, Tiramisù 7, Acqua 3» → 4 `cambia_prezzo` subito; poi «Lascia il prezzo dell'Acqua com'è» → resta a 3. GRAVE. Causa **validatore/scheda**: il server vero tiene in sospeso > 3 modifiche («Rispondi OK»), il simulatore e la scheda no; in più Haiku legge «com'è» come «com'è adesso».
3. **x-007** «la diavola a 8» → «no scusa, la capricciosa a 8, la diavola lasciala com'era» → scrive la capricciosa e chiede «la Diavola la lascio a 8 o la riporto a 7,5?». GRAVE. Causa **Haiku + strumenti**: manca `ripristina(piatto)`; Haiku aveva il prezzo vecchio in cronologia ma non ha osato.
4. **bv-correzioni-005** «…il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro» → `cambia_prezzo{p7,3}`. GRAVE. Causa **Haiku**: ignora il secondo «anzi no» (con «mettila» femminile dopo «il tiramisù»).
5. **bv-correzioni-004** t1 «tiramisù in promo a 3» (giusto), t2 «…mettilo a 3, anzi no, mettila a 10» → chiede «promo a 3 o prezzo pieno 10?». GRAVE (la promo resta). **Haiku** troppo prudente su una correzione esplicita.
6. **bv-asr-001** «da domani costa 13,50» → chiede «subito o domani?» (giusto); poi tre volte «Confirma»/«conferma» → richiede ogni volta. GRAVE (richiesta persa). Causa **Haiku + scheda**: la domanda era binaria e «conferma» non sceglie; la regola deve dire «se chiedi "lo faccio subito?", sì = subito».
7. **bv-categorie-003** «Aggiungi il piatto pasta al sugo a 12» → «C'è già pasta al ragù a 12: è lo stesso?». GRAVE (non applicato). Causa **scheda**: la regola «X già nel menu → chiedi» viene applicata per somiglianza (sugo ≈ ragù), non per nome identico.
8. **bv-aggiunte-005** «aggiungi pasta al ragù a 10, pasta al pesto a 15, caviale a 150» → crea pesto e caviale e chiede sul ragù. GRAVE per il giudice, ma è l'alternativa che la nota del banco stesso dice accettabile. Causa **attesa** (`alt` del banco da completare).
9. **bv-correzioni-001/002/003** «la parmigiana a 10» con «Inserisce il piatto la parmigiana» nel menu → «aggiorno quello o ne creo un altro?»; il banco vuole la creazione. MEDIO. Causa **Haiku + scheda**: regola dei doppioni su nome contenuto ≠ identico.
10. **x-019** «oggi piatto del giorno pesce spada alla griglia a 18» → chiede se intende «Pesce spada alla ghiotta». MEDIO. **Scheda** (stessa regola troppo larga).
(Prima delle correzioni del server: **x-002/x-010** «tre dici» e «50 centesimi» respinti dal validatore → Haiku chiedeva «Confermi?». Bug del server, non di Haiku: il validatore deve leggere i numeri almeno quanto il modello.)

**Cause dei GRAVI/MEDI**: Haiku 6 · scheda/strumenti 5 · validatore/simulatore 2 · attesa del banco 1 · misti il resto. **Zero «fatto» falsi, zero scritture su domanda, zero eliminazioni senza «sì», zero annulla sbagliati.**

## Conclusione
1. **Sì, con riserva**: Haiku 5.5 regge l'architettura: 78/92 sul banco vero (Groq 80/92), 26/26 semplici, 1,85 passi e ~1,5k token per chiamata.
2. Molto affidabile su sicurezza e protocollo: zero «fatto» falsi, zero scritture su domanda, elimina/annulla sempre corretti, JSON sempre valido.
3. Punto debole: correzioni dentro la frase («a 7, anzi no 15… a 3, anzi no 10») 1/7 → nella scheda «vale l'ultimo valore detto per quel piatto», con due esempi.
4. Secondo difetto: troppe domande di prudenza («Confermi?», doppioni per somiglianza) → regola del doppione solo con nome identico; «non chiedere conferma di un'azione chiara».
5. Storpiature fonetiche buone (17/20), ma vietare di riscrivere il nome prima di `cerca_piatti` («Bu» cercato come «boh»): `cerca_piatti` riceve le parole dette.
6. Strumenti: aggiungere `ripristina(piatto_id)` (com'era prima) e un punteggio nei risultati di `cerca_piatti`, così Haiku distingue un nome sicuro da uno approssimato.
7. Validatore: tenere in sospeso > 3 modifiche con «OK» come il server vero (2 GRAVI qui) e leggere i numeri come li legge il modello (tutti i bug trovati erano di lettura dei numeri).
8. La nota scritta da Haiku non riduce le domande (2,78 → 2,53 ogni 10 msg, le non attese salgono) e può fissare errori («Bo/Bu = boh», «cancellare = nascondere»): va resa una lista di alias confermati dal titolare, non un riassunto libero.
9. Le domande binarie del bot devono accettare «sì/conferma» come la prima opzione (bv-asr-001): lo stato in sospeso va tenuto dal server, non lasciato alla memoria di Haiku.
10. Prossimo passo: rifare questo banco con la scheda corretta e l'API vera (Haiku con tool use), soglia ≥ 85/92 e zero GRAVI di sicurezza.
