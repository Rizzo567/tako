# PDF da modello grafico — 23/10/2026 (branch feat/pdf-template-1023)

Un Menu con `paper.templateUrl` (immagine negli asset del locale + `paper.area` = zona vuota in frazioni) esce in PDF come:
modello a pagina intera + testo scritto dal sistema (Playfair Display, cifre allineate, compressione orizzontale 86 % come il riferimento):
riga prezzi («COMPLETO 16,90 €» grande, «MENU PRIMO 12 € · MENU SECONDO 14 €»), Sottomenu in maiuscolo con i piatti (iniziale maiuscola),
separatori oro col giglio vettoriale, «TUTTI I MENU COMPRENDONO» + «Compreso». Generato al volo → segue Pubblica e bot.

- Codice: `apps/server/src/lib/menu-paper-pdf.ts` (contenuto, impaginazione pura, render), `menu-paper-select.ts` (scelta leggera),
  route `/menu-workspace/pdf` e `renderPdfDocument` (il modello vince sul PDF fornito di Victoria; Menu senza modello invariati),
  font in `assets/fonts` + manifest + bucket privato `tako-pdf-fonts` (create-only, 3 file), `menu-ops` whitelist `paper`.
- Dashboard: matita del Menu → «Modello PDF» (carica/sostituisci/rimuovi; JPEG q95 ≤2 MP, zona vuota misurata nel browser); scheda PDF → nota, niente impaginazione.
- Limite (annotato): UNA pagina. Troppi piatti → prima gli spazi fino a 0,7×, poi testi+spazi fino a 0,5× (piatti ~11 pt); oltre, `fits=false` e il testo può toccare la cornice. Pochi piatti → spazi fino a 1,6× e blocco centrato sotto il primo separatore.

## Verifiche
- tsc server verde; `tests/menu-paper-pdf-1023.test.ts` 14/14 (3/5/8 piatti, prezzi interi/decimali, a capo, riduzione, limite, schema, ops); menu-ops 33/33.
- Render locale vs riferimento: `confronto-stessi-piatti-del-riferimento.png` (in brain/output/takomenu-pdf-template-2026-10-23).
- `scripts/verify-modello-pdf-1023.mjs` (SPA vera, API finta, 1280 + iPhone 390): 15/15.

## Deploy
- Edge v176 (bundle `candidate-index-pdf-template-1023.ts`, sha 7cc252d7) poi **v177** (`candidate-index-pdf-template-1023b.ts`, sha c00745ac, ezbr 98180266…): diff col v175 solo PDF/contratto/ops (+ rinomina cartella temporanea del bundler). Rollback: `cp ~/.config/tako-webapp/rollback-edge-20261022/rollback-v175.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs && node scripts/serverless/wait-edge-ready.mjs`.
- Smoke v176/v177: /api/auth/me 401, webhook senza firma 403. Numero fittizio +3900000231025 (qa-pdf-1023@example.com) collegato al QA via API e tolto. Batteria dal vivo v176 **38/39**, QA identico, max 9,7 s; unico KO = primo messaggio del numero nuovo riceve il benvenuto (non è il bot).
- QA: modello su «Menu del giorno» (fisso), Pubblica rev 4714; PDF pubblicato e anteprima 200 in ~2 s, 1 pagina, Playfair incorporato; PDF classico di un altro Menu 200 (prima prova del PDF sull'edge).
- Web `takomenu-web` **610fc643-034f-4122-bd80-175687376eca** (prima e6e2aa27). Rollback: `CI=true npx wrangler rollback e6e2aa27-60e6-4fb6-a0c3-db135423544d --config deploy/cloudflare/wrangler.jsonc`.
- **Victoria NON toccata**: bozza con modifica pendente (rev 136 vs pubblicato 135, 09:38: in Menu Giorno › Primi «linguine allo scoglio» spostata prima di «Pasta al pesto»). Pubblicare metterebbe online anche quella → fermo. Quando la bozza è pulita: `node scripts/victoria/pdf-modello-1023.mjs go`.

## Selettore Telefono / PDF + Stampa (23/10 pomeriggio)
- Menu → Piatti, riga Menu ▾ · Preset ▾: a destra la pillola «Telefono / PDF» (thumb che scivola, token standard/fast/exit, reduced motion) e «Stampa» (solo in PDF, dissolvenza; icona sola su telefono; sotto 390 px icone al posto del testo).
- PDF = PDF **pubblicato** del Menu scelto (`renderPublishedPdf`, preview:false; modello PDF se presente). Bozza pendente → riga «Ci sono modifiche non pubblicate…» e a Stampa il dialogo Pubblica e stampa / Stampa com’è / Annulla (Pubblica e stampa = Pubblica esistente, poi stampa il PDF nuovo; su iPhone «PDF aggiornato pronto» → Stampa, serve un nuovo tocco per il foglio iOS).
- Stampa: computer = iframe nascosto + print() (fallback nuova scheda); iPhone/iPad = navigator.share({files}) (AirPrint), altrimenti nuova scheda. L'editor resta montato in vista PDF (ritorno senza ricaricare).
- Codice: `apps/dashboard/public/staff/src/14-menu-pdf-view.js` (nuovo), `13-menu-workspace.js`, `sobrio.css`, `index.html`.
- Verifica: `scripts/verify-pdf-toggle-1023.mjs` (banco, 1280 + 390/430 DPR 3 + 375) **62/62**; screenshot in `toggle/`. Nota: sotto `taskpolicy -b` il rendering headless è troppo lento per campionare la pillola a metà corsa: lanciare a priorità normale.
- Web `takomenu-web` **af507eaf-7570-4484-9a5b-c43ca8927c5a** (prima 610fc643). Smoke: staff 200, /api/auth/me 401, menu-preview QA 200. Rollback: `CI=true npx wrangler rollback 610fc643-034f-4122-bd80-175687376eca --config deploy/cloudflare/wrangler.jsonc`.
