# REPORT R7.2 — deploy edge v113: FERMATO prima del deploy

**Esito: STOP al pre-deploy, nessun deploy.** Edge online: **v112** (ezbr `0b9bf80e6ba5…`, verificata con check-active prima e dopo). Nessuna scrittura su QA, clienti o Victoria; nessuna prova live; 0 token Groq; nessun messaggio Twilio inviato.

## Perché
Il diff sezione per sezione v112 → build del working tree (227ed34, index.ts sha256 `9f01e3e839fa…`, 1.440.406 byte) contiene, oltre ai moduli attesi, modifiche al **percorso a regole che usano i clienti a cervello spento**:

| Sezione | Atteso dal prompt | Nota |
|---|---|---|
| owner-brain-context/plan/route/switch, owner-brain-r (nuovo), owner-brain-price-checks (nuovo) | sì | fase R |
| twilio-menu-reading (nuovo), twilio-menu-phonetic (nuovo), twilio-menu-ai, routes/twilio-menu | sì | |
| twilio-menu-structure (nuovo) | no | fasi A/B (sposta/rinomina/categorie) |
| **twilio-menu-copy** | no | fase A: testi cambiati usati anche a cervello spento (es. `menuChanged` nella conferma, `createMissing`, `alreadyExists`, `whichDish`, `choosePrice*`, `holdPrice`) |
| **twilio-menu-nlu, twilio-menu-create, twilio-menu-hold** | no | fasi A/B |
| menu-full-flow, menu-day-presets | — | solo rinumerazione esbuild (`cap`→`cap2`, `finish`→`finish2`) |
| altre 20 sezioni | — | solo rinumerazione |

In `routes/twilio-menu.ts` diversi rami nuovi sono attivi proprio con `brainOff` (correzioni «no/anzi …», `unreadAsk` della lettura completa A8.0, spezzatura dei composti con virgola). Il «1679/1679 col cervello spento» della nota 49 è misurato rispetto a **6004b81** (dopo la fase A), non rispetto a v112: tra 329bbd4 (v112) e 6004b81 ci sono 13 commit su apps/server/src (fasi A e B). Quindi v113 **cambierebbe il comportamento dei 21 clienti**, contro PIANO §R riga 136 («con l'interruttore spento i clienti restano sul comportamento v112»). Per la regola 6 del prompt mi sono fermato.

## Cosa serve per ripartire (decisione di Manuel/coordinatore)
1. **Accettare** che fasi A+B vadano anche ai clienti col primo deploy (allora il criterio va riscritto: «clienti = 6004b81/HEAD a cervello spento», non v112), oppure
2. **Mettere dietro `botBrain`** le modifiche A/B del percorso a regole (copy compresi: testi nuovi solo a cervello acceso) e rimisurare round1–6* contro un ricostruito v112.

## Stato lasciato
- Online v112 invariata; rollback v112 già presente; bundle candidato salvato come `~/.config/tako-webapp/rollback-edge-20261017/candidate-index-v113-proposed-NOT-deployed.ts` (NON deployato).
- `.env.web` copiato da Tako-bot-brain (ignorato da git) per il deploy futuro.
- Prova live, conteggio Twilio, hash QA: **non eseguiti** (niente deploy). Token: 0 (`token-log.md`).
