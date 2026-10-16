# Migrazione traduzioni — esecuzione privata e ripresa

Eseguire dal repository:

```sh
pnpm --filter @tako/server exec tsx ../../scripts/menusmart-migration/translate.ts --dry-run
pnpm --filter @tako/server exec tsx ../../scripts/menusmart-migration/translate.ts
```

Input predefinito: `~/.config/tako-webapp/menusmart-migration-converted-20261011-v2/converted.json`.
Output accanto all'input: `translated.json`, `translation-cache.json`, `translation-status.json`, tutti 0600, aggiornati atomicamente. Percorsi input/output diversi sono i primi due argomenti. Nessun accesso database: il risultato conserva gli asset URL dell'input; applicare soltanto i campi traduzioni se gli asset sono già stati importati separatamente.

## Regole

- 12 lingue comuni. Italiano è fonte; le altre 11 ricevono traduzioni mancanti.
- Testi già presenti restano identici, anche nomi manuali con descrizione mancante. Qualunque campo generato rende l'entità `approved:false`; non si autocertificano traduzioni.
- Cache SHA256 per lingua + nome/descrizione sorgente; riuso di testi esistenti completi. Niente fallback italiano per simulare copertura.
- Gruppi sorgente condivisi a più lingue riducono input; massimo 40 destinazioni e budget caratteri per batch.
- Due worker con claim esclusivo per chiave, nessuna doppia traduzione concorrente; checkpoint serializzati.
- Modelli autorizzati stessa Groq Free: GPT-OSS 120B + GPT-OSS 20B in parallelo; Qwen 3.8 27B (preview, reasoning none) subentra a uno dei due solo dopo limite giornaliero, senza superare due worker contemporanei. Non si passa ad altro provider o piano.
- Output JSON schema strict + normalizzazione strutturale. ID esatti, unici e copertura completa richiesti, limiti testo, nomi protetti conservati. Due tentativi schema con dimezzamento batch; throttle per minuto segue Retry-After/attesa messaggio + 1,5s, massimo otto consecutivi. Quota giornaliera o errore definitivo pausa quel worker, checkpoint conservato.

## Verifiche 2026-10-11

Fonti ufficiali: https://console.groq.com/docs/rate-limits, https://console.groq.com/docs/models, https://console.groq.com/docs/reasoning, https://console.groq.com/docs/structured-outputs.

Free documentato per ciascuno dei tre modelli: 8K TPM, 200K TPD, 1000 RPD. Header reali di 20B mostrano 6861 token disponibili mentre 120B nello stesso periodo mostra 805: limiti TPM per modello indipendenti. Nessun acquisto o upgrade.

Fixture reale 20B: 39 righe JSON complete, nome Tako e prezzo conservati, 2171 token. Fixture Qwen: 39 righe distribuite su 11 lingue, 39 ID unici, Tako e `12,50 €` preservati in ogni descrizione, 2735 token. Questi controlli verificano struttura e vincoli; non certificano traduzioni umane di tutti i testi importati.

Test `tests/menusmart-translation.test.ts`: normalizzazione wrapper, conservazione nome manuale/prezzi/fonte, riuso cache senza lingue fittizie, deduplicazione tra locali.

Il processo termina `complete` solo se non restano richieste uniche. Stato `paused` non significa completo: riprendere dopo quota disponibile o correggere l'errore conservando la cache. `translation-usage.jsonl` registra usage reale delle chiamate successive alla sua introduzione, senza chiavi o contenuti menu; i primi spike precedenti non sono inclusi.

Quota effettiva Qwen osservata: OTPM 1000, non visibile nei normali header TPM 8000. Il worker Qwen usa quindi massimo 20 destinazioni, budget sorgenti brevi 1000 caratteri, completion 900 token; sorgenti individuali oltre 500 caratteri restano ai GPT-OSS. Il valore effettivo dell'account prevale sulla tabella generica.

Schema compatto: input [nome,descrizione,[[id,lingua],...]], output {translations:[[id,nome,descrizione],...]}. Il parser converte le triple e mantiene le verifiche di ID esatti, unici, campi non vuoti richiesti e limiti; riduce overhead ripetuto senza perdere i controlli.

Ottimizzazione GPT-OSS 20B: batch monolingua (fixture reale 40 righe: 1925 token, solo 37 reasoning; nei batch multilingua arrivava a circa 1100 reasoning/call). GPT-OSS 120B mantiene raggruppamento multi-target; max completion 2500 per 20B, 4000 per 120B, 900 per Qwen. SIGINT/SIGTERM completa la richiesta in corso e salva checkpoint prima di terminare.

Campi composti solo da numeri, punteggiatura e valute sono preservati dalla fonte, senza inviare una falsa traduzione italiana di testo naturale; ad esempio `(1,2) · 12,50 €` resta identico anche se il modello restituisce una descrizione vuota. I batch dimezzati dopo errore crescono nuovamente di cinque destinazioni dopo ogni successo, fino al limite del modello.

Un errore TPD può indicare una durata di ripresa breve (osservato 120B: 2m32s); rispettare il tempo indicato, non presumere che serva attendere fino al giorno successivo. La ripresa conserva cache e quota autorizzata, senza upgrade.
