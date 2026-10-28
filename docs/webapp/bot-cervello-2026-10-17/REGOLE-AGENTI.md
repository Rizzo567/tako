# Regole comuni agenti (17/10/2026) — vincolanti

- Scritture SOLO sul QA «Tako · Verifica web» 26050ecd-2e55-4057-a4c5-bff2b449cd47; mai sui 21 clienti né Victoria. Ripristina il QA dopo ogni giro e verifica per hash.
- Il numero WhatsApp collegato al QA è quello vero di Manuel: le prove live vanno via webhook firmato (vedi docs/webapp/live-latenza-2026-10-17/REPORT-A.md), risposte solo nel TwiML, nessun messaggio deve arrivargli; ripristina proposta pendente e memoria «ultimo».
- Groq: chiave del bot (TAKO_CANDIDATE_GROQ_API_KEY / groq-key.txt) condivisa coi ristoranti veri → tetto test TOTALE di giornata 60k token tra tutti gli agenti; ognuno ha la sua quota indicata nel prompt. Stima prima, conta dopo, scrivi il consumo in token-log.md nella tua cartella. Se esiste ~/.config/tako-webapp/groq-key-test.txt usa QUELLA per i test (nessun tetto oltre 150k/giorno). MAI la chiave groq-key-traduzioni.txt (solo traduzioni). Mai stampare chiavi/password in log, commit o file.
- Deploy edge operativa: dal bundle ONLINE (check-active.mjs che deve passare), solo il tuo delta, diff sezione per sezione, rollback salvato in ~/.config/tako-webapp/rollback-edge-20261017/, deploy con node scripts/translations/deploy-projection.mjs (carica anche magick-wasm-0.0.44.js). Deno: niente Buffer globale. Un solo agente alla volta deploya l'edge: chi deploya lo annuncia nel suo report.
- SQL: solo migrazioni additive con up.sql + rollback.sql.
- Usa la tua sessione di login, non session.txt condiviso.
- Git: niente checkout/restore/stash/force-push; solo il tuo worktree; commit in italiano chiusi con «Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>». Fast-forward di origin/main solo se indicato nel prompt.
- Bot: ogni bug → batteria 150–200 frasi + invarianti; batterie con orologio fisso; mai indebolire un'aspettativa.
- Annota deviazioni in implementation-notes-<sigla>.md, esito in REPORT-<sigla>.md. Risposta finale breve.
