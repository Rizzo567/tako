---
titolo: Takomenu - dialetti, ASR e glossario regionale
data: 2026-10-17
progetto: Takomenu
tipo: ricerca
---

# Dialetti e ASR per il bot WhatsApp Takomenu

Ricerca web del 17/10/2026. Dove non ho trovato un dato lo scrivo: niente numeri inventati.

## Raccomandazione (in breve)

1. **Non costruire un rilevatore di dialetto e non dare al modello un "vocabolario dialettale" per regione.** Il rendimento atteso è basso e il rischio di falsi positivi è reale.
2. **Fare invece un glossario unico, piccolo e sempre attivo** (gergo di cucina/servizio + varianti nazionali dei piatti), nel prompt dell'LLM. Costa poche centinaia di token.
3. **Mettere i nomi dei piatti del ristorante (dal suo menu) nel `prompt` di Whisper.** È la leva più concreta sul vero collo di bottiglia, cioè l'ASR.
4. **Misurare prima di costruire:** raccogliere 50-100 vocali veri dei titolari e confrontare WER e esito del comando con e senza glossario. Senza questo test ogni scelta è un'opinione.
5. Se Whisper si dimostra debole sui vocali dialettali, provare un ASR alternativo (ElevenLabs Scribe v2, prezzo simile) prima di toccare l'LLM.

## 1. Quanto capiscono gli LLM i dialetti

Evidenza disponibile, poca e non specifica per cucina/servizio:

- **Comprensione buona, produzione debole.** Lilli, *ChatGPT-4 and Italian Dialects* (Umanistica Digitale n.16, 14/12/2023): ottimo nel riconoscere e capire i dialetti, lacune su produzione, analisi e compiti interattivi. Test manuali, non un benchmark. https://umanisticadigitale.unibo.it/article/view/18221
- **Traduzione dialetto-italiano scadente nei modelli piccoli.** Signoroni e Rychlý (LoResMT 2026): LLM piccoli tra italiano e friulano, ligure, lombardo, siciliano, sardo, veneto con FLORES+/OLDI-Seed, chrF basso in entrambe le direzioni; il fine-tuning non ha battuto lo zero-shot. Napoletano non incluso. https://aclanthology.org/2026.loresmt-1.5 (numeri nel PDF, non verificati da me).
- **Siciliano:** Sprugnoli et al. (CEUR Vol-4112, 2025) testano LLM commerciali su siciliano-italiano e trovano che i dialetti a poche risorse restano difficili. https://ceur-ws.org/Vol-4112/102_main_long.pdf
- **DialectBench** (arXiv 2403.11009) copre siciliano e varietà italiane su POS/NER/NLI, non il napoletano. https://arxiv.org/pdf/2403.11009
- **Non ho trovato** benchmark su gpt-oss-120b, Llama o Qwen con dialetti italiani, né sul napoletano. Per il romanesco, pugliese, calabrese l'evidenza è nulla.

Lettura onesta: un modello da 120B capisce quasi sempre il senso di una frase dialettale breve con contesto, ma sbaglia sulle forme rare. Per i nostri comandi (brevi, con dominio ristretto: "è fernuta la carbonara", "levalo dal menu", "metti 8 e mezzo") il contesto aiuta molto. È un'inferenza, non una misura.

## 2. ASR: Whisper e alternative

- **Italiano standard:** Whisper large riporta circa 4% WER su FLEURS e 7% su Common Voice; su un dataset italiano di intenti (ITALIC) 8,65% pulito e 15,41% con rumore. https://arxiv.org/pdf/2306.08502
- **Dialetti:** non ho trovato nessuna misura di WER di Whisper su napoletano, siciliano o altri. Whisper non ha una lingua "dialetto": il vocale viene decodificato come italiano, quindi le parole dialettali diventano omofoni italiani sbagliati o hallucination. Questo è il rischio principale, e il solo posto dove un glossario può servire davvero.
- **Groq:** whisper-large-v3-turbo a $0,04/ora, circa 216x tempo reale, WER medio dichiarato 12% (tutte le lingue, non Italia). https://groq.com/whisper-large-v3-turbo-now-available-on-groq-combining-speed-quality-for-speech-recognition/
- **Parametro `prompt`:** non esiste uno studio controllato sul miglioramento per nomi propri. La documentazione dice che orienta lessico e ortografia. Conta solo la parte finale (circa 224 token), quindi i termini più rari vanno in fondo, e un prompt può causare allucinazioni (studio su parlato non nativo inglese). Fonti: https://arxiv.org/pdf/2602.18966 e https://arxiv.org/pdf/2503.06924. Implicazione: prompt corto, solo nomi dei piatti del locale e 10-20 termini chiave; testarlo.
- **Alternative (prezzi batch/ora, benchmark Modulate, 19/08/2026):** AssemblyAI Universal-3 Pro $0,21; ElevenLabs Scribe v2 $0,22; Deepgram Nova-3 $0,31. https://docs.modulate.ai/benchmarks/transcription.md . Scribe si dichiara migliore di Whisper large-v3 e Nova-3 su FLEURS, con l'italiano tra le lingue più accurate (dato del vendor, febbraio 2025). https://gigazine.net/gsc_news/en/20250227-elevenlabs-launch-speech-to-text-model-scribe/
  Costo: oltre 5 volte Groq, ma per un titolare che manda pochi vocali al giorno sono centesimi. Latenza non verificata: da misurare. Nessuna di queste ha dati pubblici sui dialetti italiani. Gemini audio: non ho trovato dati utili.

## 3. Rilevare il dialetto

- **Da testo:** al VarDial 2022 (ITDI) il miglior sistema per l'italiano ha ottenuto F1 pesata circa 0,69; vincono modelli semplici su n-grammi di caratteri, non LLM. https://aclanthology.org/events/vardial-2022/ . Su frasi brevi di 5-10 parole, in WhatsApp trascritte da Whisper (che "italianizza"), la precisione sarebbe peggiore.
- **Da audio:** dopo la trascrizione il marcatore ortografico è perso. Non ho trovato strumenti pronti per i dialetti italiani.
- **Da posizione:** la città del ristorante dà un prior debole (il titolare può essere emigrato, i dipendenti parlano diversi) ma costa zero.
- **Conclusione:** il rilevamento puro non vale lo sforzo. Se si vuole una versione economica: città del locale come tag, usato solo per scegliere le varianti dei piatti (arancini/arancine, panzerotti/calzoni, ecc.), non per cambiare lingua al modello.

## 4. Risorse riutilizzabili

- **Wikizziunariu** (Wiktionary siciliano), da cui Sprugnoli et al. hanno estratto un glossario bilingue siciliano-italiano (OntoLex-Lemon, LiITA). Licenza: Wiktionary è in genere CC BY-SA, ma non l'ho verificata sul sito scn.wiktionary.org: controllare prima di usarla. https://ceur-ws.org/Vol-4112/102_main_long.pdf
- **DESN** (Dizionario Etimologico e Storico del Napoletano, Federico II): in migrazione su piattaforma web; l'articolo descrittivo è CC BY, ma la licenza del lessico non è confermata. https://edizionicafoscari.unive.it/it/edizioni4/riviste/quaderni-veneti/2024/1/una-piattaforma-lessicografica-per-il-dizionario-e
- **Wiktionary napoletano (nap.)**: da verificare esistenza e licenza.
- **Non trovato** nessun lessico aperto di verbi/espressioni da cucina e servizio. Ciò che serve ("nun ce sta", "è fernuta", "levalo", "mettice", "e mezzo") è breve: si scrive a mano, circa 100-200 voci, e si fa validare da camerieri veri (anche i clienti pilota di Takomenu).
- **Nomi regionali dei piatti:** costruirli dai menu già caricati dai locali, non da fonti esterne; ottimo materiale per il `prompt` di Whisper.

## 5. Conclusione onesta

- **L'LLM probabilmente ci arriva già** per le frasi di dominio, grazie al contesto (menu del locale, comando atteso). Il guadagno del glossario nell'LLM è piccolo e non misurato da nessuno per gpt-oss-120b. Un glossario nel prompt costa pochi token e il rischio è basso; un glossario per regione è sforzo sproporzionato.
- **Il collo di bottiglia è l'ASR.** Se Whisper scrive "e ferruta" o "fernuta" come altro, l'LLM riceve rumore. Qui agiscono: `prompt` con piatti e termini, un ASR alternativo, e la richiesta di conferma al titolare quando il comando è ambiguo (più economica di qualsiasi modello migliore).
- **Rete di sicurezza:** conferma esplicita prima di azioni distruttive (cancellare piatto, cambiare prezzo) quando la confidenza è bassa, con il testo trascritto mostrato.

## Piano di test (mezza giornata)

1. 50-100 vocali reali con trascrizione di riferimento (regioni diverse; frasi: esaurito, rimuovi, prezzi detti a voce "otto e mezzo", "due e cinquanta").
2. Whisper turbo con e senza `prompt` (piatti + gergo), poi Scribe v2.
3. Misurare WER e, soprattutto, **percentuale di comandi eseguiti correttamente** (il WER da solo non basta). Budget quota Groq: vedi nota sui test.
4. Decisione: se il glossario nel prompt dell'LLM non alza l'esito di almeno 3-5 punti, non mantenerlo oltre il minimo.
