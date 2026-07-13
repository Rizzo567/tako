# Procedura — Update manuale di un cliente (di persona)

Finché il canale update remoto (Cloudflare R2) non è attivo, gli aggiornamenti si fanno
**a mano, sul posto o via desktop remoto**, con la chiavetta. Regola d'oro: **backup PRIMA di toccare qualsiasi cosa.**

Riferimenti codice verificati: `packages/db/src/embedded.ts` (backup/restore), `scripts/install-usb-mac.sh` (sostituzione .app).

---

## 0. Regola d'oro

Non aggiornare mai un cliente senza avere una **copia fredda del DB** verificata. L'update
sostituisce solo l'app (`Tako.app`); i **dati** stanno in `~/.tako/pgdata` e non vengono toccati
dallo script — ma una migrazione difettosa può alterarli. Il backup è la tua via di ritorno.

---

## 1. Backup PRIMA (copia a freddo)

Tako fa **da solo** un backup a copia fredda della data dir **a ogni avvio**, *prima* di far
partire Postgres (dir non in uso → copia consistente). Vedi `backupDataDirColdCopy()` in
`packages/db/src/embedded.ts`.

- **Percorso reale dei backup**: `~/.tako/backups/pgdata-YYYYMMDD-HHMMSS`
  (cartella `backups` accanto a `pgdata`, dentro `~/.tako/`).
- **Data dir viva**: `~/.tako/pgdata`.
- Rotazione: tiene gli **ultimi 5** backup (`TAKO_DB_KEEP_BACKUPS`, default 5).

**Backup manuale esplicito prima dell'update** (non fidarti solo dell'automatico):

1. **Chiudi Tako** completamente (Cmd+Q; verifica che il processo sia morto — la data dir deve essere libera).
2. Copia a freddo la data dir su un percorso sicuro (es. la chiavetta o il Desktop):
   ```
   cp -R ~/.tako/pgdata ~/tako-backup-pre-update-$(date +%Y%m%d-%H%M%S)
   ```
3. Verifica che la copia contenga il file `PG_VERSION` (è il marker di una data dir valida — lo
   stesso che il codice controlla). Se manca, **fermati**: la copia non è buona.
4. Annota da dove parti (versione app precedente): tieni da parte anche il vecchio `Tako.app` se ce l'hai.

> Nota: puoi disattivare il backup automatico con `TAKO_DB_BACKUP=0`, ma per un update **non farlo**: lascialo attivo.

---

## 2. Sostituzione dell'app

Usa lo stesso script dell'installazione — è idempotente e lavora **in place**.

1. Inserisci la chiavetta con la **nuova** `Tako.app` + `install-usb-mac.sh`.
2. Lancia:
   ```
   sh /Volumes/NOME_CHIAVETTA/install-usb-mac.sh
   ```
   Lo script: chiude Tako se aperto → `rsync -a --delete` della nuova app in `/Applications/Tako.app`
   (nessun doppione) → toglie quarantena → firma ad-hoc → **riavvia Tako**.
3. I **dati non vengono toccati**: `~/.tako/pgdata` sta fuori da `/Applications`.

---

## 3. Verifica migrazioni al riavvio

All'avvio, `maybeStartEmbeddedDb()` applica le migrazioni Drizzle in modo **idempotente**
(traccia quelle già applicate). Cosa controllare:

1. **L'app parte e la dashboard risponde.** Apri `http://localhost:3002` (PWA) e verifica la
   porta **4317** (Fastify) viva.
2. **Nei log** cerca `[db] migrazioni applicate`. Se una migrazione fallisce, il codice **spegne
   Postgres e rilancia l'errore**: l'app non parte "a metà". In quel caso → rollback (sezione 4).
3. **Smoke test**: apri un conto di prova, manda un ordine, verifica il KDS. Se tutto risponde,
   l'update è andato.

---

## 4. Rollback (se qualcosa va storto)

Il restore è una **sostituzione di cartella**, come documentato in `embedded.ts`
(«Restore manuale: chiudi Tako, sostituisci `pgdata` con una cartella `backups/pgdata-*`»).

1. **Chiudi Tako** (Cmd+Q) — la data dir deve essere libera.
2. Sposta via la data dir corrotta:
   ```
   mv ~/.tako/pgdata ~/.tako/pgdata-ROTTA-$(date +%Y%m%d-%H%M%S)
   ```
3. Ripristina l'ultima copia fredda buona (quella di sezione 1, o un `~/.tako/backups/pgdata-*`):
   ```
   cp -R ~/.tako/backups/pgdata-YYYYMMDD-HHMMSS ~/.tako/pgdata
   ```
   (oppure la copia manuale `~/tako-backup-pre-update-*`).
4. Se il problema è l'**app nuova**, reinstalla la **vecchia** `Tako.app` con lo stesso
   `install-usb-mac.sh` (chiavetta con il bundle precedente).
5. Riavvia Tako e rifai lo smoke test. Il DB torna com'era: le migrazioni della versione vecchia
   erano già applicate su quella copia, quindi riparte pulito.

> Se il rollback restaura una data dir da un backup, controlla che contenga `PG_VERSION`.
> Non copiare mai il file `postmaster.pid` in una data dir viva: il codice lo esclude apposta
> dai backup — se lo trovi in una copia, cancellalo prima di avviare.
