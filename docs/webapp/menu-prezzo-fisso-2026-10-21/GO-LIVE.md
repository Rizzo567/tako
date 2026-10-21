# GO-LIVE — Menu a prezzo fisso (ESEGUITO 21/10 notte: edge v137, lettura v28, worker 49846043, worker pubblico 037f6b68, Victoria migrata rev 61; PDF multipli spenti in attesa dei design di Manuel)

Ordine: (1) edge operativo + (2) funzione di lettura + (3) dashboard/pagina statica → controlli in sola lettura → (4) SOLO dopo, migrazione di Victoria.
Tutti i comandi da `cd /Users/manuel/Projects/Tako/Tako-bot-anthropic` (symlink `.env.web` presente). Rollback in `~/.config/tako-webapp/rollback-edge-20261021/`.

## 0. Prima di tutto (sola lettura)
```bash
node scripts/serverless/check-active.mjs                       # atteso v133 (ezbr cbf863d3…)
TAKO_CHECK_SLUG=tako-read-candidate node scripts/serverless/check-active.mjs   # atteso v27
CI=true npx wrangler deployments list --config deploy/cloudflare/wrangler.jsonc | tail -8   # atteso 3e44eedc…
```
Se le versioni sono diverse qualcuno ha deployato dopo: fermarsi e rifare il confronto.

## 1. Edge operativo
```bash
RB=~/.config/tako-webapp/rollback-edge-20261021
cp $RB/candidate-index-lunghi.ts $RB/rollback-v133.ts           # copia di rollback (= v133)
taskpolicy -b node scripts/serverless/build-operational-candidate.mjs && taskpolicy -b node scripts/serverless/verify-candidate-lazy-boot.mjs | head -c 120
cp release/serverless/candidate/index.ts $RB/candidate-index-prezzo-fisso.ts
node scripts/translations/deploy-projection.mjs                 # {"projectionDeploy":"PASS"}
node scripts/serverless/check-active.mjs                        # versione salita
```
## 2. Funzione di lettura (pagina pubblica)
```bash
cp $RB/read-candidate-index-vis.ts $RB/rollback-read-v27.ts
taskpolicy -b node scripts/serverless/build-read-candidate.mjs && cp release/serverless/read-candidate/index.ts $RB/read-candidate-index-prezzo-fisso.ts
node scripts/translations/deploy-projection.mjs --read
TAKO_CHECK_SLUG=tako-read-candidate node scripts/serverless/check-active.mjs
```
## 3. Dashboard e pagina statica
```bash
taskpolicy -b node scripts/build-cloudflare-web.mjs
CI=true npx wrangler deploy --config deploy/cloudflare/wrangler.jsonc   # annota la Version ID
```
## 4. Controlli in sola lettura
- `GET https://takoitalia.com/api/customer/restaurant/528e263c-…/menu` per Alla carta, Menu pranzo, Menu cena: 200, contenuti come prima (Victoria non è ancora migrata: deve essere IDENTICA).
- `/staff` 200, `/api/auth/me` 401, webhook senza firma 403, nessun errore nuovo in `tako_whatsapp_errors`.
- PDF (mai verificati sull'edge vero prima di questo passo): `GET /api/public/menu-pdf/token-inesistente` → 404; dalla dashboard del **QA** (26050ecd, mai Victoria) crea un documento in «I tuoi PDF», scaricalo (PDF valido, tempi < 10 s), crea il link fisso, aprilo da anonimo (200 `application/pdf`), revocalo (poi 404). Se la generazione sull'edge fallisce o va in timeout: rollback del solo operativo (la pagina pubblica resta).
## 5. Migrazione di Victoria (solo dopo 1–4 verdi)
```bash
OUT=~/.config/tako-webapp/victoria-prezzo-fisso-$(date +%Y%m%d-%H%M)
apps/server/node_modules/.bin/tsx scripts/victoria/fixed-price-migration.ts --plan --out $OUT     # backup.json + migrated.json + plan.json (lost deve essere 0)
# guarda plan.json (formule, sottomenu, piatti prima/dopo) e fai le foto «dopo» con scripts/verify-fixed-menu-render.mjs $OUT/migrated.json
apps/server/node_modules/.bin/tsx scripts/victoria/fixed-price-migration.ts --execute --out $OUT --expected-revision <revision di plan.json> --expected-host <host del DB>
```
Verifica pubblica dopo: pagine Menu pranzo / Menu cena di Victoria come nelle foto «dopo».
## Rollback
- Victoria: `apps/server/node_modules/.bin/tsx scripts/victoria/fixed-price-migration.ts --restore --out $OUT --expected-host <host del DB>` (ripubblica `backup.json` con mutateWorkspace).
- Dashboard: `npx wrangler rollback 3e44eedc-c6ea-424a-9c0c-5cc2d07512b0 --config deploy/cloudflare/wrangler.jsonc`
- Lettura: `cp $RB/rollback-read-v27.ts release/serverless/read-candidate/index.ts && node scripts/translations/deploy-projection.mjs --read`
- Operativo: `cp $RB/rollback-v133.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`

## Lezione (21/10)
La pagina pubblica sta nel worker **takomenu-public** (`deploy/cloudflare/wrangler-public.jsonc`, build `node scripts/build-public-menu-release.mjs docs/webapp/portfolio-rollout/public-manifest.json`), NON in takomenu-web. Ogni modifica a `apps/web` / `apps/web-static` per i clienti richiede quel deploy, PRIMA di migrare dati che la usano.

## Design PDF di Manuel (da collegare)
I PDF multipli sono pronti ma spenti (`TAKO_MENU_PDF_DOCUMENTS=1` per accenderli). Si innestano così:
- **Formato dei design:** un'immagine di sfondo per pagina, A4 verticale, 2480×3508 px (300 dpi), PNG, JPG o WebP. L'area centrale dove va il testo dev'essere libera e chiara; titoli e prezzi li scrive il generatore.
- **Dove si innestano:** come tema PDF in `design.pdfPresets[].config`, con `backgroundImageUrl` (immagine caricata negli asset del locale), `backgroundSize:'cover'`, margini (`marginTop/Right/Bottom/Left`) che coincidono con l'area libera, `font`, `textColor` e `headingColor` presi dal design. Il singolo PDF (`settings.pdfDocuments[].config`) può usare il tema.
- **Per accenderli:** impostare il secret, generare i 3 PDF di Victoria dal QA, fare il confronto con `supplied-menu-pdf.ts`, poi togliere quel file.
