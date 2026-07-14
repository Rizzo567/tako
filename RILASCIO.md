# RILASCIO Tako — cross-platform + auto-update

> Runbook operativo. Cosa ho cablato (fatto), cosa devi fare TU (account/segreti),
> come si taglia una release. Aggiornato 2026-07-11.

---

## 🚀 Vendere ORA senza comprare account (install da chiavetta)

Se installi TU di persona sul dispositivo del cliente, **la firma OS non serve**:
Gatekeeper/SmartScreen bloccano solo le app *scaricate*, non l'install hands-on.

**Mac** — build in locale + chiavetta:
1. `cd apps/app && pnpm desktop:build` → `src-tauri/target/release/bundle/macos/Tako.app`
2. Copia `Tako.app` **e** `scripts/install-usb-mac.sh` sulla chiavetta.
3. Sul Mac cliente: `sh /Volumes/<CHIAVETTA>/install-usb-mac.sh`
   → copia in /Applications, toglie la quarantena, firma ad-hoc (gratis), avvia.

**Windows** — l'`.exe` lo DEVE fare la CI (dal Mac non esce), ma **senza cert**:
1. Metti su GitHub solo il secret `TAURI_SIGNING_PRIVATE_KEY` (la chiave updater, gratis)
   + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` vuoto. (R2/Apple NON servono per la via USB.)
2. Taglia un tag → scarica l'installer da **Actions → run → Artifacts → `installers`**.
3. Su Windows cliente: doppio click → SmartScreen → "Ulteriori info → Esegui comunque".

**Auto-update nel modello USB:** su Mac funziona (firma ad-hoc → relaunch pulito) se
configuri R2 (punto 2 sotto). Su Windows non firmato l'update può ri-mostrare SmartScreen →
finché non hai il cert, aggiorna Windows **a mano via USB** (rifai i 2-3 passi).

Compri gli account OS **quando scali** a vendita remota/self-serve, non per partire.

---

## Cos'è fatto (codice, verificato su questo Mac)

- **Windows-proof del runtime**:
  - `apps/app/src-tauri/src/lib.rs` — alla chiusura su Windows usa `taskkill /F /T`
    per uccidere l'INTERO albero (node + Postgres figlio). Prima ammazzava solo node
    → Postgres orfano bloccava la data dir al riavvio. *(compila su mac: `cargo check` OK;
    il ramo Windows si verifica al primo build CI)*
  - `packages/db/src/embedded.ts` — `healStaleLock` ora ha il ramo Windows (`tasklist`
    invece di `ps`) → auto-guarigione del lock Postgres anche su Windows. *(tsc OK)*
  - `scripts/build-server-bundle.mjs` — il runtime node viene nominato `node.exe` su
    Windows (lib.rs lo cerca così).
- **Auto-update in-app** (`tauri-plugin-updater` + `tauri-plugin-dialog`):
  - all'avvio Tako controlla `https://updates.takoitalia.com/latest.json`, verifica la
    firma minisign e — su conferma dell'owner — scarica, installa e riavvia. Non blocca
    l'avvio; se la rete è giù, ignora. *(cargo check OK)*
  - **La firma updater è GRATIS** (keypair minisign, già generato). È diversa dai
    certificati OS a pagamento qui sotto.
- **CI GitHub Actions** (`.github/workflows/release.yml`): su tag `vX.Y.Z` builda
  macOS arm64 + macOS Intel + Windows x64, firma gli artifact updater e pubblica su
  Cloudflare R2. *(YAML valido; il generatore `latest.json` testato)*
- **ASR su Windows**: la dettatura locale (whisper.cpp) è solo-mac; su Windows fa
  fallback automatico a Groq (nessun crash). Ok al lancio.

## 🔑 Chiave updater (GIÀ generata — CUSTODISCILA)

- Privata: `~/Documents/tako creds/Tako-Credenziali/tako-updater.key` — **se la perdi,
  NESSUN update futuro potrà essere firmato. Backup offline.**
- Pubblica: già incollata in `tauri.conf.json` (`plugins.updater.pubkey`).

---

## Cosa devi fare TU (account + segreti) — in ordine

### 1. 🍎 Apple Developer — $99/anno (BLOCCA la vendita su Mac)
Senza notarizzazione, il `.app` su un ALTRO Mac dà "app danneggiata / sviluppatore
non identificato" e **non si apre**. Un cliente pagante non riesce nemmeno a lanciarla.
- Iscriviti: https://developer.apple.com/programs/ (serve 1–2 giorni per l'attivazione).
- Poi crea un certificato "Developer ID Application" + un app-specific password.
- Dammi un colpo: cablo firma+notarizzazione (i secret sono già predisposti nel workflow).

### 2. ☁️ Host degli update — ✅ FATTO (2026-07-14, niente R2, costo zero)
Gli update NON stanno su R2 (voleva la carta): stanno nelle **GitHub Release del repo
privato**, servite dal Worker Cloudflare gratuito **`tako-updates`**
(`infra/updates-worker`) su `updates.takoitalia.com`.
- La CI a ogni tag crea la release e ci carica installer + `latest.json`.
- Il Worker legge l'ultima release col secret `GITHUB_TOKEN` e la serve alle app
  (binari = 302 verso URL firmato GitHub; il token non esce mai).
- ⚠️ Il secret `GITHUB_TOKEN` del Worker è il token della `gh` CLI di Manuel: se fai
  `gh auth logout` gli update muoiono → sostituiscilo con un fine-grained PAT
  (solo repo `tako`, permesso Contents read) e `wrangler secret put GITHUB_TOKEN`
  da `infra/updates-worker`.

### 3. 🔐 GitHub → Secrets — ✅ FATTO (2026-07-14)
Sul repo `Rizzo567/tako`:
| Secret | Valore | Stato |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | contenuto INTERO di `tako-updater.key` | ✅ |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | vuoto (la key è senza password) | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | account id Cloudflare | ✅ (non più usato dalla CI, innocuo) |

Opzionali (per firma Mac, dopo il punto 1): `APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`,
`APPLE_TEAM_ID`.

### 4. 🪟 Windows code-signing — opzionale ma consigliato (~200–500€/anno)
Senza, all'installazione Windows mostra SmartScreen "editore sconosciuto" (l'utente può
comunque procedere con "Ulteriori info → Esegui"). Con un cert OV/EV il warning sparisce.
- Fornitori: Sectigo, DigiCert, SSL.com (OV più economico; EV toglie del tutto lo
  SmartScreen ma costa di più e serve token hardware/cloud).
- Quando ce l'hai, lo cablo in CI (`signCommand` nel bundle Windows).

---

## Come si taglia una release

1. Bump versione in **`apps/app/src-tauri/tauri.conf.json`** (`version`) — es. `0.2.0`.
2. Commit + tag: `git tag v0.2.0 && git push origin v0.2.0`.
3. La CI builda mac (arm+intel) + win, firma e pubblica su R2. ~15–25 min.
4. Le app installate, al prossimo avvio, vedono l'update e propongono di installarlo.

**Primo rilascio (baseline):** taglia `v0.1.0` PRIMA di distribuire l'app ai clienti, così
la versione installata combacia e i tag successivi (`v0.2.0`…) fanno scattare l'update.

---

## Verità sui tempi (secca)

- **Non puoi vendere "firmato" domani**: senza Apple Developer il `.app` non si apre su
  altri Mac. Tempo reale = attivazione Apple ($99, 1–2 gg) + io cablo la firma.
- **Windows** esce dalla CI appena metti i secret (punti 2–3). Firma OS Windows =
  facoltativa, si aggiunge dopo (punto 4).
- **Auto-update** funziona già oggi lato codice; si accende quando esiste il bucket R2 +
  il primo tag.
