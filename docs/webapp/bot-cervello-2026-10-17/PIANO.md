# Bot titolare «che ragiona per primo» · PIANO (17/10/2026)

Base: origin/main 3bd75b5 (online: edge operativa v108 f6f1e4bb…, read-edge v21, public d9c80a18, web aea28f62).
Ricerca a supporto: 00-SINTESI.md e 01–04 in questa cartella.

## Decisioni ritoccabili (in testa)
1. **Ordine**: il modello capisce per primo ogni messaggio (con contesto); le regole fisse diventano validatore + riserva (Groq giù / quota finita / JSON invalido).
2. **Contesto per chiamata**, in quest'ordine (per il caching Groq): scheda generale fissa → scheda ristoratore (menu compatto + memoria appresa) → ultimi ≤10 scambi / ≤30 min → operazioni in sospeso → messaggio.
3. **Una chiamata**: output JSON strict `{intent, actions[], clarify?, reply_draft}`; i fatti nella risposta (cosa è cambiato, prezzi da→a) li scrive il server dopo aver riletto il DB. Mai «fatto» senza riga scritta.
4. **Memoria appresa per ristoratore**: solo da segnali certi (risposta a chiarimento, correzione, conferma riepilogo), dopo la risposta, fuori dal percorso critico. Stati candidato → attivo (2 conferme o 3 usi coerenti) ; alias solo verso piatti esistenti; scrive solo il server; log append-only; «dimentica X». Nessun messaggio intero salvato (solo significati) finché non c'è informativa.
5. **Cronologia conversazione**: tabella nuova, solo testo minimo necessario, TTL 30 min / 10 scambi, poi cancellata (non è un registro).
6. **Glossario unico** cucina/servizio italiano+regionale (100–200 voci) nella scheda generale; niente rilevatore di dialetto.
7. **Whisper**: `prompt` con i nomi dei piatti del locale (≤224 token).
8. **Interruttore per ristorante** (`settings.botBrain`): acceso prima solo sul QA; per i clienti si accende al lancio insieme al piano Groq Developer (decisione Manuel 17/10).

## Perimetri (worktree disgiunti)
- **Q – correzioni rapide** (Tako-bot-quick, codex/bot-quick-1017): «togli» coerente (= nascondi, sempre), caso vocale di Manuel in batteria, nomi piatti nel prompt Whisper, riga «assistente automatico» al primo messaggio, annulla vero dopo modifica pubblicata. Deploy edge v109. ~1,5 h.
- **N – cervello** (Tako-bot-brain, codex/bot-brain-1017): moduli nuovi (contesto, prompt, schema, validatore, memoria appresa, cronologia), SQL additivo, integrazione nel route dietro interruttore DOPO il merge di Q. ~4–5 h.
- **E – banco di valutazione** (Tako-bot-eval, codex/bot-eval-1017): set conversazionale multi-turno (≥250 conversazioni, incl. i casi QA 17/10 e quelli di Manuel), giudice deterministico sullo stato finale del menu + invarianti, runner con tetto token, confronto bot attuale vs nuovo. ~2–3 h, poi usato da N.

## Goal / verifier / stop
- Banco E sul nuovo bot: 0 GRAVI (modifica sbagliata o non richiesta, scrittura su domanda, «fatto» non vero), MEDI ≤ 2% e sotto il bot attuale; task success ≥ bot attuale +10 punti sui multi-turno.
- Batterie round1–5c (riserva deterministica) restano 0/0/0; suite senza nuovi rossi rispetto alla base.
- Tempi sul QA: webhook→commit p50 ≤ 3 s comandi semplici, ≤ 4 s multi-azione.
- Token: rispettare il tetto giornaliero dei test (vedi sotto); Groq giù → riserva, nessun crash.
- Exit: max 5 giri banco→fix; se dopo 3 giri non batte il bot attuale → stop e report, interruttore resta spento.

## Quota Groq (vincolo critico)
Piano free condiviso coi ristoranti veri (~200k token/giorno, 8k/min). I test del cervello non possono usare la chiave del bot vero oltre il 30% (≤60k token/giorno) né la chiave traduzioni. Serve una chiave Groq dedicata ai test (altro account) — chiesta a Manuel. Senza, E/N lavorano con modello finto registrato (record/replay) + piccoli giri reali entro tetto.
