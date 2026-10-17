---
titolo: Takomenu - memoria per-ristoratore e apprendimento dal feedback (ricerca)
data: 2026-10-17
progetto: Takomenu
tipo: ricerca
---

# Takomenu - memoria e apprendimento senza fine-tuning

Ricerca web del 17/10/2026. Dove un dato viene solo da vendor o da blog terzi lo segno **[non verificato]**. Per Groq le fonti ufficiali sono le pagine docs lette direttamente.

## 0. Raccomandazione in breve

1. Per ogni ristoratore un **profilo compatto di 1,5-3k token sempre nel prompt**, in coda a un prefisso statico (istruzioni + schema) per usare la cache Groq. Niente vettoriale, niente grafo.
2. Il profilo è **strutturato (tabella alias, abitudini, errori ASR), non testo libero**, e scritto **solo dal server** con regole deterministiche e promozione a soglia. L'LLM propone, il server decide.
3. **Una sola chiamata** che restituisce JSON strict (`json_schema`, `strict: true`) con intento e testo di risposta. I fatti nella risposta li inserisce il server dopo l'esecuzione della scrittura: il modello non scrive mai "fatto" da solo.
4. Whisper: usare il parametro `prompt` (limite 224 token) con i nomi dei piatti più usati, **ma misurarlo prima**: non ho trovato dati pubblici di efficacia.

## 1. Sistemi di memoria per utente

**Come funzionano (e dove falliscono)**

- **Mem0**: estrae fatti candidati, recupera memorie simili, un LLM sceglie ADD / UPDATE / DELETE / NONE. Vendor-reported: 92,5 su LoCoMo e 94,4 su LongMemEval, meno di 7.000 token per chiamata di retrieval (algoritmo di aprile 2026); 91% di latenza p95 in meno rispetto al full-context (1,44 s contro 17,12 s, paper 2025). Fonti: https://mem0.ai/library/agent-memory/ai-memory-benchmarks-in-2026 e https://mem0.ai/research. Un post di un praticante mostra il difetto chiave: il risolutore di conflitti lavora sul testo, perde l'ambito, scambia due preferenze valide in contesti diversi per una contraddizione e **cancella senza errore né log**. Mitigazione proposta: ambito esplicito nel testo del fatto e audit log di ogni cancellazione (https://dev.to/mukesh_13/mem0-auto-resolves-memory-conflicts-for-you-until-it-silently-deletes-one-you-still-need-4f4m). Una fonte terza dice che la V3 ha tolto la logica di conflitto (solo ADD, ranking al retrieval) **[non verificato]**.
- **Letta/MemGPT**: due livelli. I "core memory blocks" sono sempre nel prompt; l'archivio è cercato con tool call. Il "sleep-time" fa il consolidamento in background fuori dal percorso critico (https://docs.letta.com/guides/agents/architectures/memgpt). I guadagni citati sono su task di matematica, non di gestionale **[fonte secondaria]**.
- **LangMem**: memoria semantica (fatti), episodica, procedurale (regole che riscrivono il prompt). Scrittura "hot path" (aggiunge latenza) oppure in background dopo la conversazione (https://blog.langchain.com/langmem-sdk-launch). Ultima release trovata 0.0.30, ottobre 2025: API instabile **[non verificato]**.
- **Zep/Graphiti**: grafo temporale; un fatto contraddetto riceve `invalid_at`, non viene cancellato. Dichiarati 90,2% su LongMemEval a 162 ms (https://help.getzep.com/graphiti/graphiti/overview/), +18,5% di accuratezza e -90% latenza rispetto ai baseline (https://arxiv.org/abs/2501.13956). Nessuna replica indipendente trovata.
- **ChatGPT / Claude**: ChatGPT inietta "saved memories" modificabili più un riassunto della cronologia a ogni prompt; Claude usa ricerca su richiesta, con memoria isolata per progetto (https://blog.memoryplugin.com/claude-vs-chatgpt-vs-gemini-memory/, fonti discordanti sui dettagli).

**Profilo sempre in contesto vs RAG vs grafo, quando la conoscenza è piccola**

- ConvoMem (https://arxiv.org/html/2511.10523v1): sotto circa 150 interazioni il full-context fa 70-82% e Mem0 solo 30-45%; il retrieval conviene solo oltre i primi 30 scambi circa, nel loro setup.
- MemDelta, preprint 2026 (https://arxiv.org/pdf/2606.29914): con GPT-4o-mini RAG 47,2% contro full-context 49,8%, differenza non significativa (p=0,34). Cambiare solo il modello di embedding sposta di circa 6 punti. L'auto-memoria dell'agente è il metodo peggiore.
- I benchmark LoCoMo e LongMemEval misurano conversazioni lunghe (decine di migliaia di token): **non coprono il nostro caso** (2-4k token di preferenze). Mem0 stessa ammette che nessun benchmark testa isolamento per utente sotto carico (https://guide.mem0.ai/task/faq/best-platform-benchmarking-ai-memory-latency-token-efficiency).

**Raccomandazione.** Profilo in contesto. Costo: 3k token di profilo a $0,15 per milione = circa $0,00045 per messaggio ($0,000225 se in cache); trascurabile. Un RAG aggiunge un secondo ciclo (embedding + ricerca) e un modo di sbagliare in più per guadagnare nulla a questa scala. Il profilo ha tre sezioni:
- `alias`: soprannome -> id piatto, con `conferme`, `ultimo_uso`, `ambito`;
- `abitudini`: es. "dice sempre prezzi senza euro", "scrive 'esaurito' per nascondere";
- `errori_asr`: trascrizione ricorrente -> forma corretta.

Passare a ricerca solo se un profilo supera circa 6-8k token (ristoranti con centinaia di alias); per allora basta filtrare per categoria, senza vettori.

**Scartati**
- Mem0/Zep/Letta come servizio: l'LLM decide cancellazioni sulla memoria e in più c'è un fornitore da pagare; il nostro dominio ha già un'anagrafica piatti con id, quindi serve una tabella, non un grafo.
- Grafo: utile per relazioni temporali tra entità; qui i piatti sono entità note e le relazioni sono alias semplici.
- Decadimento a tempo: preferibile un decadimento per **non uso** (alias non usato per 90 giorni scende di stato), mai per età.

## 2. Apprendimento dal feedback senza fine-tuning

Base teorica: MemPrompt (https://arxiv.org/abs/2201.06009v2) conserva i casi in cui il modello ha frainteso più la correzione dell'utente e li recupera in seguito: accuratezza raddoppiata su compiti lessicali, ma con utenti simulati e correzioni esplicite. **Non ho trovato post-mortem di produzione né soglie di promozione pubblicate**: quelle sotto sono mie proposte da tarare, non pratiche consolidate.

**Segnali, dal più al meno forte**
1. Chiarimento esplicito: bot "intendi Carbonara?" -> "sì". Segnale forte.
2. Correzione dopo un'azione: "no, volevo la Amatriciana" entro pochi minuti.
3. Uso ripetuto dello stesso alias senza correzioni (implicito, debole).
4. Annullamento ("annulla") dopo un'azione: segnale **negativo**.

**Promozione proposta (macchina a stati nel server)**
- `candidato` (1 osservazione, non usato per eseguire; il bot chiede conferma);
- `attivo` dopo 2 conferme esplicite oppure 3 usi coerenti senza correzione;
- `fisso` solo se il titolare lo conferma una volta in modo esplicito;
- una correzione contraria porta a `in revisione` (non si cancella; si chiede al titolare di decidere).

**Rischi e difese**
- *Poisoning / false associazioni.* L'attacco MINJA mostra che chi interagisce solo via query può piantare record dannosi con >95% di successo di iniezione in condizioni ideali (https://arxiv.org/abs/2503.03704; versione realistica https://arxiv.org/pdf/2601.05504v1, difese poco chiare). Da noi gli utenti sono i titolari (fiducia alta), ma il rischio reale è l'**errore proprio**: una trascrizione sbagliata promossa ad alias. Difesa: un alias può puntare solo a piatti esistenti in anagrafica, mai testo libero; la lunghezza minima e la collisione con altri nomi bloccano la promozione automatica.
- *Perdita di ambito* (caso Mem0): ogni voce ha `ambito` (piatto, categoria, prezzo, disponibilità) e la risoluzione conflitti è nel server, non nell'LLM.
- *Audit.* Ogni modifica del profilo va in un log append-only con messaggio sorgente; il comando "cosa hai imparato?" mostra il profilo al titolare, che può cancellare.
- *Quota.* L'estrazione dei candidati non deve usare una seconda chiamata LLM per messaggio: estrarla dalla stessa risposta strutturata (campo `osservazioni`) o a lotto notturno.

## 3. Groq (verificato sulle docs ufficiali)

- **Prompt caching** (https://console.groq.com/docs/prompt-caching): attivo su `openai/gpt-oss-120b`, `gpt-oss-20b`, `gpt-oss-safeguard-20b`. Sconto 50% sugli input in cache ($0,075 contro $0,15 per milione), nessun costo aggiuntivo, nessuna configurazione. Serve un **prefisso identico**; prefisso minimo da 128 a 1024 token secondo il modello; scadenza 2 ore senza uso. I token in cache non contano nei rate limit (sono sottratti dopo l'elaborazione). Cambiare `tool_choice`/tool tra chiamate invalida la cache. Latenza: la pagina dice che migliora ma non dà cifre. Quindi: system prompt e schema fissi in testa, profilo del ristoratore **dopo**, messaggio per ultimo. Il profilo cambia raramente, per cui conviene metterlo prima della cronologia.
- **Prezzi** (aggregatori concordi, https://www.morphllm.com/groq-pricing; la pagina ufficiale non era leggibile): gpt-oss-120b $0,15 input / $0,60 output per milione. Whisper: large-v3 $0,111/ora, large-v3-turbo $0,04/ora, minimo fatturato 10 s per richiesta (https://console.groq.com/docs/speech-to-text). Quindi un vocale di 5 s costa come uno da 10 s: circa $0,0001. Nota: le fonti terze discordano su input/output ($0,75 in uno snapshot vecchio).
- **Limiti**: free per gpt-oss-120b 30 RPM, 1.000 RPD, 8.000 TPM, 200.000 TPD (https://benchlm.ai/free-tier/groq, 14/09/2026, terza parte). Con 8.000 TPM un profilo da 3k + prompt da 2k + risposta basta per circa 1-2 messaggi al minuto: **il free non regge più di pochi ristoranti**. Developer: riportato 1.000 RPM e 300.000 TPM, **tetto giornaliero non trovato** (https://fast.io/resources/groq-rate-limit/, tabella forse datata). Verificare nella console (Settings > Limits).
- **Whisper `prompt`**: max **224 token**, guida stile e ortografia di nomi propri e termini tecnici, deve essere nella stessa lingua dell'audio, non è un'istruzione. Il parametro `language` (es. `it`) migliora precisione e latenza. WER dichiarato: large-v3 10,3%, turbo 12% (stessa pagina). **Efficacia sui nomi di piatti: non ho dati**; da misurare con un set di vocali veri. Proposta: inserire i 30-40 alias/piatti più frequenti del ristorante (circa 150-200 token).
- **LoRA/fine-tuning**: Groq **non offre training**; serve solo adattatori LoRA creati altrove, solo per clienti Enterprise su richiesta (https://console.groq.com/docs/lora). Fuori portata, e comunque contrario all'obiettivo.
- **Structured outputs** (https://console.groq.com/docs/structured-outputs): `strict: true` (constrained decoding) supportato su gpt-oss-120b. Requisiti: tutte le proprietà in `required`, `additionalProperties: false`, opzionali come `["string","null"]`. **Non combinabile con tool use né streaming.** Affidabilità: nei forum Groq ci sono segnalazioni di `json_validate_failed` (circa 10% delle richieste in un utente, 0/5 su una prova con il 20b) e di tool call ignorate o malformate con gpt-oss (https://community.groq.com/t/gpt-oss-120b-ignoring-tools/385, https://community.groq.com/t/guaranteed-structured-output-is-not-working-bug-report/1306). Sono report utente, non confermati né risolti. **Conclusione: usare JSON schema, non tool calling**, e prevedere retry con fallback al parser deterministico.

## 4. Architettura "una chiamata" e anti-allucinazione

**Flusso**
1. Il server costruisce il prompt: prefisso statico + profilo + stato attuale del menu rilevante (solo categorie/piatti pertinenti) + messaggio.
2. Una chiamata, output strict: `{intento, operazioni:[{tipo, piatto_id, campo, valore}], chiarimento|null, osservazioni:[...], testo_template_id, slot:{...}}`.
3. Il server **valida** (id esistenti, prezzi in intervallo, permessi), **esegue** e legge il risultato dal database.
4. Il testo finale lo compone il server con template e valori letti dopo la scrittura ("Ho messo 8,50 per Carbonara") oppure, se si vuole tono naturale, una seconda chiamata solo se serve; nella prima il modello propone soltanto.

**Pattern "fatto quando non è fatto"**
- Letteratura recente: gli agenti dichiarano completate azioni senza la tool call corrispondente (es. allegato annunciato ma non allegato) e la mitigazione ricorrente è la **verifica esterna dello stato**, non la narrazione del modello (https://arxiv.org/pdf/2608.02645, https://arxiv.org/pdf/2607.11098). Gli stessi lavori notano che il retry da solo non risolve i dati obsoleti.
- Regola per Takomenu: il modello **non può produrre** le parole "fatto / aggiornato / nascosto" con un valore; il testo di conferma è generato solo dopo una lettura dal DB che combacia con l'operazione richiesta. Se la scrittura fallisce o il valore letto differisce, risposta di errore fissa.
- Invariante testabile: nessuna risposta contiene un'affermazione di esito senza una riga corrispondente nel log operazioni. Va inserita nella batteria avversaria già prevista per i bug del bot.
- Operazioni distruttive o ambigue (prezzo molto diverso dal precedente, nascondere categoria intera): conferma esplicita prima.

**Alternative scartate**
- Due chiamate (capire, poi rispondere): più token e quota (200k/giorno stretta) e un secondo punto di divergenza; tenuta solo come fallback per il tono.
- Tool calling: segnalazioni di instabilità su Groq, incompatibile con strict.
- Agente che modifica da solo il proprio profilo (stile MemGPT): niente audit e rischio di cancellazioni silenziose.

## 5. Piano minimo e cose da misurare

1. Tabella `profilo_ristoratore` (alias / abitudini / errori_asr, con stato, conferme, ambito) + log append-only.
2. Prefisso statico stabile; controllare nelle risposte Groq il campo dei token in cache e la riduzione di latenza.
3. Test Whisper con e senza `prompt`: 30 vocali veri per ristorante, WER sui nomi dei piatti.
4. Verificare nella console il tetto giornaliero Developer prima di passare di piano.
5. Misurare il tasso di `json_validate_failed` su 200 messaggi reali; soglia di accettazione 1% con fallback.
