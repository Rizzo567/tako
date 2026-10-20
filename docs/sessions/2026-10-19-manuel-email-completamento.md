# Email essenziali: completamento

Branch codex/manuel-email-activation, PR #2. Lavoro isolato dai checkout Claude. Autorizzazione Manuel a continuare email e relativo rilascio; nessun messaggio ad altre sessioni.

## Scope finale

Manuel ha escluso pagamenti/abbonamenti, gestiti internamente. Rimangono sei varianti, senza job Stripe o solleciti prova. Catalogo locale anteprime aggiornato; vecchie prove commerciali archiviate fuori dal catalogo attivo.

## Implementazione

- Coda cifrata AES-GCM, snapshot immutabile, dedupe, claim fencing, retry max6 entro23h, pulizia ciphertext terminale.
- SQL additivo: outbox, richieste cambio email, eventi benvenuto; RLS runtime, nessuna lettura anon/authenticated.
- Benvenuto catturato solo da eventi futuri di collegamento/abilitazione, nessun backfill. Gestita email inserita dopo un placeholder.
- Reset e cambio password accodano conferma nello stesso commit. Cambio password invalida richieste email pendenti.
- Cambio email richiede password corrente; token hash monouso30min, fingerprint credenziale e lock coerenti. Conferma revoca sessioni e reset pendenti. Avviso vecchio indirizzo, conferma nuovo.
- GET conferma senza effetti per scanner; POST esplicito. Pagina impostazioni dedicata. Non aggiunto collegamento al menu profilo dashboard.
- API comunicazioni servizio: agenzia, destinatari selezionati, approved:true, max20; nessuna console grafica o invio operativo ai clienti.
- Cron pg_cron/pg_net ogni minuto, segreto Vault, gateway autentica richiesta. Nessun valore segreto nei commit.

## Rilascio

Base online v121 scaricata e confrontata; config segreti porta v122 a bundle invariato. Primo runtime v123 preserva gli altri154 moduli. Compatibilità header del bridge corretta in v124, solo runtime email; v125 aggiunge nonce per pagine HTML. Altri156 moduli byte-identici negli ultimi delta. Nessun deploy read-edge/takomenu-public.

v125 ACTIVE ezbr 3ef3072d5e69cf8197c145cfada35c30cb9c6c9b7d58f80ca7828ec586d7ae61.

Computer Use ha trovato che Supabase rende il GET HTML come text/plain e sostituisce CSP. Worker takomenu-web aggiornato dal contenuto realmente online: solo Content-Type/CSP di due percorsi fissi con nonce server. keep_assets e keep_bindings; binding verificati identici dopo primo upload e ancora da conservare in rilasci futuri. Base Worker SHA d8e271d41e5ea0b85db8c3ac3af2d4416c15d58bf6650e37d498a05fc6de97fb, finale cf2c5f983322fa9678ca090d3cdce5f62a5c79ea628f2c5b853c9faf3da91d3e. Nessun asset/front-end rebuild.

## Verifiche PASS

- 31 Vitest +4 Node gateway; typecheck server, sintassi bundle, diff check.
- Postgres reale/provider finto: concorrenza, dedupe, retry, mittente immutabile, guardie e pulizia payload.
- Live QA: password errata rifiutata; email vecchia mantenuta fino conferma; due email Delivered; GET scanner safe; conferme parallele200/400; vecchia sessione401; login nuovo indirizzo; password dashboard aggiornata e Delivered; token cambio email pendenti invalidati.
- Reset con coda:200, riuso400, conferma generata.
- Benvenuto catturato dal trigger futuro e Delivered; una sola copia. Nessun WhatsApp inviato.
- Cron reale autonomo: email tecnica sent al primo tentativo senza tick manuale, Delivered via Resend.
- Pagina impostazioni renderizzata correttamente via Computer Use, account corrente caricato.
- API email, /staff/ e /victoria-bar rispondono200; nessuna scrittura menu cliente.
- Credenziali e email QA ripristinate, sessioni QA revocate, telefono sintetico rimosso. Nessuna email ai clienti.

## Limiti

Delivered è conferma provider, non certificazione inbox/antispam universale. Non effettuati test Outlook/Apple Mail o dispositivo mobile fisico. Le comunicazioni servizio richiedono ancora operatore/API con contenuto approvato; niente invio indiscriminato. Nessun collegamento grafico nel profilo dashboard in questa fase. Eventi/metriche conservati per audit; non ruotare chiave outbox con messaggi pendenti.

Backup e prove sensibili soltanto in ~/.config/tako-webapp/email-automation-20261019/. Screenshot e rapporto utente nei Download, mai nel repository pubblico. Prima di altri deploy acquisire sempre bundle/config online correnti e preservare lavoro altrui.
