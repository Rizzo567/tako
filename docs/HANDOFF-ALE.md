# Takomenu: passaggio tecnico a Manuel e Ale

Aggiornato il 16 ottobre 2026. Questo repository contiene il sistema completo, non solo il sito marketing. Branch di consegna: `codex/takomenu-handoff-2026-10-16`.

## Inizia qui

1. Clona `https://github.com/Rizzo567/tako.git` e seleziona il branch di consegna.
2. Leggi `AGENTS.md`, questo documento e `docs/PROMPT-ALE.txt`.
3. Usa Node 22.13 o successivo compatibile (Vite richiede almeno 22.12) e pnpm 9.0.0. Esegui `corepack enable` e `pnpm install --frozen-lockfile`.
4. Crea un branch personale `codex/ale-<attivita>` dalla consegna, prima di modificare codice.
5. Esegui i controlli sotto e riferisci i risultati reali. Non avviare script di pubblicazione, import clienti o migrazione solo per configurare il clone.

## Mappa del sistema

| Percorso | Responsabilità |
| --- | --- |
| `apps/dashboard/public/staff` | Dashboard staff/agenzia, gestione locali e menu, editor e anteprime |
| `apps/web/src` | Menu cliente, onboarding preview, claim, interfacce pubbliche |
| `apps/web-static` | Frontend Vite portabile che riutilizza i componenti web e la dashboard |
| `apps/server/src` | Backend Fastify, autenticazione, API, WhatsApp/Twilio, onboarding, PDF, traduzioni, import e upload |
| `packages/db` | Schemi e accesso database |
| `packages/types` | Tipi condivisi |
| `scripts/serverless` | Build edge e SQL delle funzionalità aggiuntive; alcuni script operano su produzione |
| `deploy/cloudflare` | Worker, routing dashboard/API/menu pubblico |
| `supabase/functions` | Sorgenti dei probe; i bundle operativi sono generati dagli script |
| `tests` | Test unitari, integrazione, frontend e contratti |
| `docs/design` | Copia portabile del contratto motion; i video originali non sono inclusi |

Non confondere il control-plane cloud storico con la webapp multi-tenant Takomenu. La configurazione `.env.example` documenta entrambi: DB e segreti hanno ambiti distinti.

## Controlli senza credenziali

```sh
pnpm --filter @tako/web exec tsc --noEmit
pnpm --filter @tako/server exec tsc --noEmit
node scripts/build-static-web.mjs
pnpm exec vitest run tests/onboarding-whatsapp-fix-1016.test.ts tests/onboarding-menu-merge.test.ts tests/onboarding-lifecycle.test.ts tests/onboarding-invariant-1016.test.ts
node --test tests/web/menu-category-pages.test.mjs tests/web/menu-macrocategories.test.mjs
```

Questi comandi non richiedono il DB di produzione. `pnpm test` comprende anche test di integrazione che possono richiedere servizi attivi: un fallimento di ambiente non equivale automaticamente a una regressione.

Per vedere il frontend: `pnpm --filter @tako/web-static dev`, porta 5147. Senza API configurate, le funzioni che dipendono da login e dati remoti non possono essere certificate.

La build pubblica completa usa `node scripts/build-public-menu-release.mjs docs/webapp/portfolio-rollout/public-manifest.json`: il manifest è una fotografia di menu già pubblici, con asset inclusi e percorsi relativi. Non è un backup amministrativo né il database aggiornato. I nuovi locali non sono necessariamente presenti nella fotografia.

## Accessi e stato reale

Git trasferisce sorgenti, test, configurazioni prive di segreti e asset. I destinatari personali degli avvisi WhatsApp sono ora variabili `TAKO_WHATSAPP_ALERT_PHONE` e `TAKO_WHATSAPP_USAGE_PHONE`: lasciate vuote, le notifiche sono disattivate. Prima di un futuro deploy vanno configurate nel servizio se si vogliono mantenere gli avvisi; questa consegna non cambia il servizio già online. Non trasferisce account dei ristoratori, database vivo, login dashboard, sessioni WhatsApp, credenziali Supabase/Twilio/Cloudflare o impostazioni personali degli agenti.

Per un backend completo usare `.env.example` come schema e fornire valori tramite segreti dell'ambiente autorizzato. `pnpm webapp` legge `.env.web` ignorato da Git e avvia API 5131, cliente 5132 e gateway 5137. Preferire dati sintetici e un database di sviluppo. Gli script storici che leggono `~/.config/tako-webapp` richiedono configurazione personale: non sono autonomamente utilizzabili dopo il clone.

Non chiedere di incollare segreti nella chat o nel codice. Non cambiare gli accessi a servizi reali senza autorizzazione. Per il lavoro in cloud collegare questo repository all'ambiente di sviluppo; la condivisione di una pagina ChatGPT da sola non abilita le API.

## Stato del prodotto e limiti

Il 16 ottobre sono stati osservati via WhatsApp reale problemi su richieste multiple, rettifiche di prezzo e frasi “mantieni” che possono produrre duplicati o dubbi inutili. Successivamente il codice locale contiene ulteriori correzioni e test: non presumere che ogni esito negativo del mattino sia ancora riproducibile, né che ogni correzione sia stata ricollaudata in produzione. Riprodurre il caso sul codice attuale e distinguere test simulati da conversazioni reali.

Regola richiesta per il ristoratore: fino a 3 modifiche esecuzione automatica e riepilogo; oltre 3 riepilogo e conferma scritta. Onboarding e aggiornamenti del proprietario sono flussi distinti. Copy breve, comprensibile, senza emoji e con parole importanti in grassetto WhatsApp.

Le bozze WhatsApp scadono dopo 10 minuti senza attività. Fuori onboarding, il numero di prova può essere collegato a un locale reale: non inviare comandi di modifica senza verificare destinazione e sessione. QA solo in nuove bozze private; nessun invito, pubblicazione o modifica clienti implicita.

Panuzza è stato aggiornato da foto con 13 voci prezzate; bevande dimostrative rimosse. Rimossi i piccoli pulsanti di sottocategoria nel renderer condiviso: conservare categorie principali e titoli delle sezioni. I dati reali aggiornati restano nel backend, non nel clone Git.

## Lavorare insieme

Una attività per branch, commit piccoli e PR con cosa cambia e verifiche. Prima di intervenire, `git fetch` e controllare i cambiamenti degli altri. Niente reset, force-push o deploy automatici di lavoro altrui. Condividere esiti e decisioni nel repository: le chat private di Manuel e Ale non si sincronizzano da sole.

La repo è pubblica al momento della consegna: non caricare dump, sessioni, recap privati, screenshot WhatsApp o password. I materiali locali di QA esclusi dal commit non sono necessari al codice. Le frasi sintetiche dei test live sono conservate in fixture dedicata senza numero dell'agenzia.

## Prossima fase commerciale

Preparare circa 50 ristoranti esclusivamente fuori Lombardia, con evidenza di menu quotidiano o aggiornato ogni 2–3 giorni. Ricerca in corso, non contatti effettuati. Registrare URL, data ed evidenza; non inventare menu, prezzi o frequenza. Preparare demo di presentazione prima delle chiamate e offrire 30 giorni gratis; prezzo successivo da definire. Non citare l'eventuale offerta agency. Assegnare un responsabile per evitare contatti doppi.
