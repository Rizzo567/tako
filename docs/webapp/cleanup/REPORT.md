# Pulizia Tako: solo webapp (10 ottobre 2026)

Branch `codex/tako-webapp`, partenza dal checkpoint `992be94`. Niente push.

## Commit
| Commit | Contenuto |
|---|---|
| `8bc15ae` | Rimozione app nativa: Expo/Tauri, PWA owner, kit di collaudo, prototipo, script desktop/USB, auto-update |
| `1f7160f` | Rimozione appliance: runtime solo `TAKO_MODE=web`, più il control-plane `TAKO_MODE=cloud` |
| `c880ece` | Pulizia server: codice morto, `escapeHtml` in un solo punto, dipendenze inutili |
| `4103768` | Pulizia dashboard: tolta la shell Next legacy, resta solo la SPA staff |
| `84c6fad` | Pulizia web: `applyBrand` in un solo punto, helper e asset morti |
| `555ebf0` | Script e documenti: storico in `docs/archivio`, documenti allineati alla sola webapp |
| `06992b8` | Screenshot before/after e ultimi commenti corretti |

## Numeri
| | Prima (`992be94`) | Dopo |
|---|---|---|
| File tracciati | 1.104 | ~694 (+ screenshot) |
| Righe tracciate | 471.978 | 344.579 |
| Byte tracciati | 110,4 MB | 65,2 MB |
| Cartella del repo su disco | 18 GB | 5,2 GB (~12,8 GB recuperati: `apps/app` con le build 13 GB, APK + chiavetta USB 265 MB) |
| Pacchetti nel lockfile | | −458, nessun pacchetto nuovo |

Per area (file / righe): `apps/server/src` 91→69 / 16.358→11.532 · `apps/dashboard/public/staff/src` 19→19 / 7.856→7.324 · `packages` 70→59 / 5.143→3.907 · `scripts` 31→14 / 4.485→1.324 · `tests` 58→48 / 6.821→5.022 · `apps/web/src` 41→41 / 8.134→8.109.

## Cosa è stato rimosso
- **App nativa**: `apps/app` (Expo + Tauri), `Tako Dashboard App/`, `collaudo-vm-kit/`, `infra/updates-worker`, `release.yml`, PWA owner (`owner-src`, `public/owner`, statico `/owner`), script `build-owner-app`, `build-server-bundle`, `deploy-desktop`, `install-usb-mac`, `make-latest-json`, `test-owner-*`, APK e `Tako-USB`, striscia di trascinamento Tauri nello staff.
- **Appliance**:
  - DB e file locali: Postgres embedded a runtime, `pg-portable`, seed e vecchi `migrate-*` del DB locale, `~/.tako` (segreti su file), bonifica del server orfano.
  - Rete locale: TLS self-signed, mDNS `tako.local`, tunnel, gate remoto, heartbeat, `cloud-client`.
  - Accessi: `cloud-verify`, `/api/setup`, `/internal/shutdown`, PIN (route, `PinLogin`, campo nascosto), riscatto `/device/enroll`.
  - Funzioni: push owner (`web-push`), dettatura ASR locale (socket, whisper, worklet, script di setup), **stampa termica LAN** (`printer`, `escpos`, `/api/print`, auto-stampa), QR LAN-first (`network.ts`).
  - Cloud: `/api/pair` e resolver `/t/:applianceId`.
  - Infrastruttura: `docker-compose*`, `.env.production.example`, Dockerfile del server locale, CI Windows, script `tako`, `qr-demo`, `demo-foto`, `web-server-wrapper`; dipendenze `multicast-dns`, `selfsigned`, `web-push`.
- **Ridondanze**:
  - shell Next legacy di `apps/dashboard` e le sue 13 dipendenze;
  - `@anthropic-ai/sdk`, `@types/bcryptjs`, `bcryptjs` (db), `clsx`, `tailwind-merge`;
  - codice morto: `checkMonotonicTs`, reset Redis, `hasStyleRef`, `cn`, `PRESS`, `leaveTableSocket`, `rls.ts`, `rls-check`;
  - 5 PNG non referenziati, Dockerfile web non usato, `tmp/`, `Tako Ads - Memoria copia.md`;
  - documenti solo app/appliance. Lo storico utile è in `docs/archivio/`.

## Duplicati unificati
- `escapeHtml`: 3 copie → 1, esportata da `cloud/email`.
- `applyBrand`: 2 copie (`CustomerApp`, `TakeawayApp`) → `apps/web/src/lib/utils.ts`.
- `isPrivateLanIPv4`: 2 copie, sparite con l'appliance.
- Gate di confine web: era inline in `index.ts`, ora è `webBoundary()` in `lib/web-runtime.ts`, testato con Fastify reale.
- Lasciati così: i blocchi transazionali di `reservations.ts` (gestiscono la concorrenza con parametri diversi), `Header`/`BottomNav` di tavolo e asporto (markup diverso, rischio UI), le licenze OFL dei font.

## Cosa è stato tenuto e perché
- **Schermate staff che citano l'appliance** (Dispositivi/codice telefono, Collegamenti, righe QR «tako.local»/«IP diretto», Stampante, WhatsApp): restano identiche per il vincolo UI. Per questo restano `enroll-code` e `/devices`. I vecchi prefissi rispondono con lo stesso 404 `NOT_AVAILABLE_WEB` di prima.
- **Codice WhatsApp/Baileys**: nel repo ma non montato, com'era già nel web.
- **Login con `local_owner_secret_hash`**: serve ai titolari importati dall'appliance.
- **Schema DB e migrazioni** delle tabelle solo appliance: toglierle richiede una migrazione sul DB remoto, vietata qui.
- **`embedded-postgres`**: solo devDependency per i DB isolati dei test.
- **13 test legacy dello stack :3001** più `helpers` e `test-ai-*`: già rossi prima, restano rossi con la stessa causa.
- **Strumenti di migrazione dati**, `landing/`, cloud, `deploy/render`, `deploy/web`, `.claude/`.
- **Fuori dal repo**: `~/.tako` non toccato.

## Gate prima / dopo
| Gate | Prima | Dopo |
|---|---|---|
| Install / TypeScript server, web, db | verdi | verdi |
| Vitest | 23 file / 129 test verdi; 22 legacy rossi | 22 file / 118/118 verdi; 13 legacy rossi (stessa causa) |
| Test Node | 54/54 | 54/54 |
| Test cloud | 76/76 | 53/53 (tolto il pairing) |
| Build staff / Build Next | verde / non rieseguita prima delle modifiche | verde / verde dopo ogni blocco web o lockfile |
| Lint | rosso (3.374 errori, 3.370 in `release/`) | 0 errori, 280 warning |
| Webapp + smoke HTTP | attiva | attiva, smoke 31/31 |
| `mdfind Tako.app` | 1 | 0 |

## Confronto screenshot
9 viste × desktop 1440 / mobile 390 emulato, Chrome headless, orario congelato, animazioni azzerate, tenant QA in sola lettura. Script ripetibili: `scripts/qa-screenshots.mjs` e `scripts/qa-screenshot-diff.mjs`.
- 14 viste su 18 identiche al pixel.
- Le altre 4 differiscono di 2–14 pixel di antialias (barra del grafico in home, maniglie dei campi PDF, avatar, login mobile). È lo stesso rumore misurato ripetendo il "before" due volte senza modifiche.
- Il primo scatto "after" è caduto durante un breve calo di rete del Mac (DNS di Supabase); la serie è stata rifatta.

## Domande aperte per Manuel
1. Togliere le schermate staff dell'appliance? Cambia la UI.
2. Tenere il codice WhatsApp/Baileys come base per la versione web o cancellarlo (si recupera da `992be94`)?
3. Riprogettare la stampa delle comande per il web (stampa dal browser o bridge locale) o lasciarla fuori?
4. Portare i 13 test legacy sull'harness con Postgres isolato o eliminarli?
5. Fare una migrazione che tolga le tabelle e colonne solo appliance?
6. Al prossimo deploy del cloud i QR stampati con `api.takoitalia.com/t/...` daranno 404: va bene?
7. Eliminare `~/.tako` dopo il cutover?
