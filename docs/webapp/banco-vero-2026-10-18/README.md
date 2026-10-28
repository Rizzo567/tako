# Banco vero · 18/10/2026

Questo banco raccoglie le conversazioni **reali** di Manuel con Tako su WhatsApp tra il 14 e il 17/10 (mittente …0927). Serve al task 4 del PIANO cervello Anthropic: confrontare Groq gpt-oss (fase R) e Anthropic Haiku 5.5 a strumenti sulle stesse conversazioni, usando lo stesso giudice.

- Casi: `tests/eval/cases/banco-vero.ts` (`BV_CASES`)
- Runner: `tests/eval/eval-banco-vero.test.ts`
- Adattatore Anthropic: `tests/eval/adapters/anthropic-bot.ts` (per ora solo l'interfaccia, segnata TODO)
- Fixture nuove in `tests/eval/fixtures/menus.ts`: `qamattina`, `qa1016`, `qa1323`, `collaudo`, `victoria`
- Famiglie `R_FAMILIES` in `tests/eval/types.ts`

## Come è stato costruito
1. **Raccolta da Twilio in sola lettura** (procedura della memoria `takomenu-vocali-da-twilio`). Ho preso i messaggi dal 14/10 in poi: 163 in entrata e 234 in uscita. Ho scaricato 63 allegati: 50 vocali e 13 immagini. I vocali sono stati trascritti in locale con whisper-cli (large-v3-turbo q8). Nessun invio.
2. **Divisione in sessioni.** Ho raggruppato i messaggi consecutivi della stessa prova. Sono rimasti fuori l'onboarding agenzia (Crea locale…, RIPRENDI, APPROVA), i codici collega/attiva e le foto, perché non riguardano il bot del titolare. Quando una sessione contiene un passaggio difficile, quel messaggio compare anche da solo, come conversazione a turno singolo.
3. **Menu iniziale ricostruito** com'era al momento di ogni sessione, a partire dalle risposte vere di Tako. Uso le fixture più le `mods` (prezzi, finiti, nascosti).
   - Per Victoria Bar le categorie sono vere, e sono veri anche i piatti citati in chat con i loro prezzi (Bruschetta Victoria 8, tagliate 20/24/20).
   - Il prezzo del Polpo (14) e gli altri piatti di Victoria sono **di comodo**.
4. **Stato finale atteso** scritto con le regole del titolare:
   - togli = nascondi;
   - elimina, cancella o «rimuovi completamente» = si cancella solo dopo «sì». Il «sì» non arriva mai in queste chat, quindi l'attesa è sempre una domanda e nessuna scrittura;
   - più parti incerte → una domanda ciascuna;
   - «no» pubblica le parti chiare;
   - «annulla» = annulla l'ultima pubblicazione;
   - mai prezzi che il titolare non ha detto.
5. **Intenzione ambigua** → `ask` (domanda attesa), con `note` che comincia con `AMBIGUO:` e spiega il motivo. Si contano con `isAmbiguous()`.

## Conversazioni per famiglia (92 in tutto, 149 messaggi del titolare, 9 ambigue)
| Famiglia | Conv. | Contenuto |
|---|---|---|
| bv-semplici | 26 | comandi singoli chiari e domande semplici: è l'insieme del criterio ≥ 97% |
| bv-domande | 10 | domande e saluti, nessuna scrittura |
| bv-multiple | 9 | più modifiche nello stesso messaggio, riepilogo, OK |
| bv-correzioni | 7 | «anzi no», «no, ho detto…», pasta al pesto e lasagna |
| bv-deixis | 4 | «quei due», «entrambi» (17:27–17:30) |
| bv-aggiunte | 6 | piatti nuovi con dati che mancano |
| bv-elimina | 5 | elimina o cancella → conferma |
| bv-categorie | 3 | categorie nuove dalla chat (Primi, Speciali, «primi pasti») |
| bv-annulla | 8 | ANNULLA dopo una pubblicazione, rimettere com'era |
| bv-dialetto | 5 | Victoria Bar 15/10 in dialetto |
| bv-asr | 5 | storpiature di Whisper (Bo/Bu, kenesac, «da domani») |
| bv-fuori | 4 | fuori perimetro (foto senza allegato, allergeni, due prezzi alternativi) |

## Come rilanciare
```
TAKO_EVAL=1 TAKO_EVAL_GROQ=oracle npx vitest run tests/eval/eval-banco-vero.test.ts   # risposte IA da oracolo
TAKO_EVAL=1 TAKO_EVAL_GROQ=off    npx vitest run tests/eval/eval-banco-vero.test.ts   # IA spenta
TAKO_EVAL=1 TAKO_EVAL_GROQ=replay ...                                                  # solo la cache
TAKO_EVAL=1 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_KEY_FILE=~/.config/tako-webapp/groq-key-test.txt \
  TAKO_EVAL_GROQ_MAX_TOKENS=60000 TAKO_EVAL_GROQ_MAX_TOKENS_PER_KEY=150000 npx vitest run tests/eval/eval-banco-vero.test.ts
```
- **Motore:** `TAKO_BV_BOT=nuovo` (predefinito: cervello acceso, Groq fase R), `attuale` oppure `anthropic`. Finché l'adattatore Anthropic non è pronto, `anthropic` viene saltato e il report lo dice.
- **Modo record:** senza `TAKO_EVAL_GROQ_KEY_FILE` si ferma, e rifiuta `groq-key.txt` e la chiave delle traduzioni.
- **Filtri:** `TAKO_EVAL_ONLY`, `TAKO_EVAL_FAMILY`, `TAKO_EVAL_OUT`.
- **Risultati** in `risultati/`: `results-*.json` (verdetti più `metriche`) e `summary-*.md`.
- **Metriche:**
  - successo totale;
  - successo sui semplici;
  - domande ogni 10 messaggi (anche quelle non attese);
  - conversazioni con almeno un GRAVE;
  - successo sulle ambigue;
  - latenza p50/p95;
  - token e chiamate IA.

## Primo giro sul codice attuale (branch codex/bot-fix-1017, motore «nuovo», nessuna chiamata Groq vera)
| Modo | Successo | Semplici | Domande ogni 10 messaggi | Conv. con GRAVI | Ambigue |
|---|---|---|---|---|---|
| oracolo | 83,7% | 96,2% (25/26) | 2,8 | 9 | 5/9 |
| Groq spento | 60,9% | 65,4% | 4,1 | 35 | 4/9 |

GRAVI all'oracolo:
- bv-semplici-005: «un c'è cchiù» non applicato;
- bv-multiple-006: «aumenta tutti di un euro» rifiutato;
- bv-correzioni-004: tiramisù a 7 invece di 10;
- bv-categorie-001: pesto e caviale creati in Piatti di prova;
- bv-asr-001/003/004/005: «da domani» scritto senza chiedere, Bo 50 → Bu 40 non corretto, rinomina senza conferma.

## Cosa manca
- **Adattatore Anthropic** (`ready:false`): bisogna intercettare `api.anthropic.com` con cache, record e tetto di spesa per giro, come fa `groq-cache`.
- **Giro col modello vero:** non l'ho fatto, perché le chiavi di test sono esaurite. La cache Groq per questi casi è vuota, quindi `replay` equivale a `off`.
- **Victoria Bar:** il menu è ricostruito solo in parte (polpo e riempitivi). Per un confronto fedele servirebbe l'export vero del menu del 14/10.
- **Attese da confermare con Manuel:**
  - «aumenta tutti di un euro»: per ora attesa = applicare con riepilogo;
  - «pasta al ragù a 10» quando il piatto esiste già: per ora attesa = domanda;
  - il nome «Piatto test QA» oppure «Test QA».
- **Fuori dal banco:** le foto (allegati immagine) e l'onboarding agenzia.
