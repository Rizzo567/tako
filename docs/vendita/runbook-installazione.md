# Runbook installazione Tako — dal Mac spento al ristorante operativo

Checklist operativa per chi installa Tako di persona, da chiavetta, dal cliente. Spunta man
mano. **Non lasciare il locale prima del collaudo finale (sezione 10).** Tempo: **45–75 min**.

Principio (vedi `docs/setup-rete-ristorante.md`): **il Mac È il server**. Postgres, API
Fastify (:4317) e PWA cliente (:3002) girano in un'unica app Tauri; il core funziona anche
senza internet, il wifi serve solo a far arrivare i telefoni al Mac.

---

## 1. Prerequisiti — cosa portare (5 min di check prima di partire)

- [ ] **Chiavetta USB** con dentro: `Tako.app` **e** `scripts/install-usb-mac.sh`.
      Costruisci il `.app` sul TUO Mac: `cd apps/app && pnpm desktop:build`
      → esce in `src-tauri/target/release/bundle/macos/Tako.app` (vedi `RILASCIO.md`).
- [ ] **Le chiavi AI** già pronte su un foglietto/nota (Groq + Gemini), vedi sezione 5.
- [ ] **Cavo Ethernet USB-C→RJ45** (il server è più stabile via cavo che in wifi).
- [ ] **Il menu del cliente** in formato testo copiabile (Word/PDF/foto già trascritta a
      mano): **non c'è OCR da foto**, il testo va incollato (sezione 6).
- [ ] Accesso al **router del locale** (password admin) o piano B: hotspot dal Mac.
- [ ] IP stampante termica, se ne hanno una (sezione 8).

---

## 2. Installazione da USB (~5 min)

Lo script `scripts/install-usb-mac.sh` fa tutto: copia in `/Applications`, toglie la
quarantena Gatekeeper, firma ad-hoc gratuita, avvia. **Non serve Apple Developer** per
l'install hands-on: Gatekeeper blocca solo le app *scaricate*, non quelle installate così.

1. [ ] Inserisci la chiavetta nel Mac del cliente.
2. [ ] Apri **Terminale** e lancia: `sh /Volumes/<NOME_CHIAVETTA>/install-usb-mac.sh`
3. [ ] Lo script stampa i passi: `▶ copio in /Applications` → `▶ tolgo la quarantena`
       → `▶ firma ad-hoc` → `▶ avvio Tako`. Fine: `✓ Tako installato e avviato`.
4. [ ] Tako parte e genera da solo il **JWT_SECRET** (in `~/.tako/jwt-secret`, persistente —
       vedi `apps/server/src/bootstrap.ts`). Nessuna azione. Se dà "app danneggiata /
       sviluppatore non identificato" → sezione 11 (troubleshooting).

---

## 3. Primo avvio e setup ristorante (~10 min)

1. [ ] All'avvio compare la **Login** della dashboard staff (email/password del titolare).
2. [ ] Se il locale è collegato a un account Tako del sito: nella dashboard vai su
       **Dispositivi → Collega dispositivi → "Account proprietario (cloud)"**, incolla il
       **codice di collegamento** (generato sul sito Tako) e imposta una **password owner
       locale** (min 8 caratteri) per l'accesso offline (`routes/setup.ts`, `POST /setup/pair`).
       Se è un'installazione puramente locale, questa card non compare: procedi con
       email/password.
3. [ ] Imposta **nome del ristorante**, sale/tavoli e i dati base dalla dashboard.

---

## 4. Cartella `~/.tako` — dove vive la configurazione

Tutti i file di config stanno nella home utente del Mac, in `~/.tako/` (variabile
`TAKO_HOME`). Creata automaticamente al primo avvio. File rilevanti:

| File | A cosa serve | Chi lo legge |
|---|---|---|
| `jwt-secret` | sessioni staff, auto-generato | `bootstrap.ts` |
| `groq-key` | import menu da testo (AI) | `bootstrap.ts` |
| `gemini-key.txt` | foto AI dei piatti | `lib/dish-image-ai.ts` |

---

## 5. Chiavi AI (~5 min, opzionali ma consigliate)

Le chiavi si incollano in file dentro `~/.tako/`. **Senza chiavi il core funziona lo
stesso**: saltano solo import-testo AI e foto AI.

1. [ ] **Groq** (import menu da testo). Crea il file `~/.tako/groq-key` e incolla la chiave.
       Presa da `console.groq.com` → API Keys. Serve un riavvio dell'app per leggerla
       (`bootstrap.ts` la carica all'avvio se l'env non è già settato).
2. [ ] **Gemini** (foto AI piatti). Crea il file `~/.tako/gemini-key.txt` e incolla la
       chiave. Presa da `aistudio.google.com` → API Keys. **Non serve riavviare**: viene
       riletta a ogni generazione (`lib/dish-image-ai.ts`, funzione `geminiKey()`).
3. [ ] La qualità **Pro** delle foto (Nano Banana Pro) si sblocca solo con un codice
       firmato da Manuel, da incollare in **Gestione → foto AI → "Codice Pro"**. Senza
       codice si usa il modello base (flash): va benissimo per la vendita.

---

## 6. Menu — inserimento e import da testo (~10–20 min)

**Onestà: non c'è OCR da foto.** Il menu si inserisce a mano oppure si **incolla come
testo** e l'AI lo struttura (`06-screens-gestione.js`, "Importa menu da testo").

1. [ ] **Gestione → Menu**: crea le sezioni (Antipasti, Primi…), poi aggiungi i piatti.
2. [ ] Import rapido: pulsante **"Importa da testo"** → incolla il menu in formato libero
       (anche da Word/PDF o da una foto già trascritta a mano) → l'AI lo divide in sezioni
       e piatti con prezzi → controlla l'**anteprima** → conferma. Richiede la chiave Groq
       (sezione 5) e internet in quel momento.
3. [ ] Stesso meccanismo per il **magazzino/ingredienti** ("Importa ingredienti da testo").
4. [ ] Rivedi prezzi e nomi dopo l'import: l'AI è un acceleratore, non un oracolo.

---

## 7. QR e rete — LAN-first (~10 min, la parte critica)

Il QR al tavolo **non punta al cloud**: punta al Mac in LAN via `http://tako.local:3002`
(mDNS), con fallback su IP diretto. Dettaglio completo in `docs/setup-rete-ristorante.md`.

1. [ ] **IP stabile per il Mac**: imposta una **DHCP reservation** sul router (MAC address
       del Mac ⇒ IP fisso). Serve perché sia `tako.local` sia i fallback IP restino stabili.
2. [ ] **mDNS attivo**: dal Mac `ping tako.local` deve rispondere. iPhone e Android 12+ ok;
       Android vecchi usano il fallback IP.
3. [ ] **NIENTE client/AP isolation** sul wifi dei clienti (causa #1 di "il QR non apre").
       Consigliato un **SSID dedicato `Tako`**, stessa VLAN del Mac, isolation OFF.
4. [ ] **Se il wifi del locale fa schifo → hotspot dal Mac**: *Impostazioni → Generali →
       Condivisione → Condivisione Internet*, condividi da Ethernet verso Wi-Fi, SSID `Tako`,
       WPA2 + password robusta. Bypassa la rete del locale (sezione 4 di setup-rete).
5. [ ] **QR tavoli**: **Sala/Cassa → QR Codes** genera e scarica il PNG per ogni tavolo
       (`05-screens-sala-cassa.js`, `ScreenQR`). Se cambi rete/IP usa **"Aggiorna rete"** per
       rigenerare i QR con l'IP corrente.
6. [ ] **QR dashboard staff** (per i tablet): **Dispositivi → Collega dispositivi** mostra
       l'indirizzo `tako.local:3002` + IP LAN e un QR da inquadrare (`GET /system/info`).

---

## 8. PIN staff, tablet e stampante (~10 min)

1. [ ] **PIN staff**: **Gestione → Staff**, per ogni membro imposta un **PIN di 4 cifre**
       (campo opzionale, `06-screens-gestione.js` riga ~1054).
2. [ ] **Tablet**: sul tablet, sullo stesso wifi, apri l'indirizzo della sezione 7.6. In
       fondo alla schermata di login tocca **"Accesso rapido con PIN"** → scegli il membro →
       digita il PIN (`12-pin-login.js`, `POST /auth/pin-login`). 3 tentativi errati → lockout.
3. [ ] **Stampante termica** (se presente): **Gestione → Stampante**, inserisci **IP** e
       **porta**, poi **"Stampa di prova"**. Deve uscire lo scontrino di test.

---

## 9. Pairing WhatsApp (~5 min, opzionale — richiede internet)

Canale WhatsApp del titolare per comandare la dashboard via chat. **Gestione → WhatsApp**
(owner-only, `06-screens-gestione.js`, `WhatsAppPanel`):

1. [ ] Attiva il toggle **"Attiva canale WhatsApp"**.
2. [ ] Compare un **QR di collegamento**: sul telefono del ristorante → WhatsApp →
       **Impostazioni → Dispositivi collegati → Collega un dispositivo** → inquadra il QR.
3. [ ] Per autorizzare il **tuo** numero: dal tuo telefono scrivi al numero del ristorante
       `collega tako <CODICE>` (il codice è mostrato nella card, usa-e-getta). Rigenerabile.

---

## 10. COLLAUDO FINALE — obbligatorio (non saltarlo)

Non lasciare il locale prima di aver spuntato **tutte** queste voci:

- [ ] **IP stabile** confermato (DHCP reservation), IP annotato: `__________`.
- [ ] `ping tako.local` risponde dal Mac.
- [ ] **Percorso completo end-to-end**: prendi un **telefono vero**, inquadra il **QR di un
      tavolo** → si apre il **menu** → invia un **ordine** → l'ordine **arriva in cucina**
      (KDS/dashboard). Se questo giro non chiude, l'installazione NON è finita.
- [ ] QR testato da **almeno 2 telefoni** diversi (un iPhone e un Android).
- [ ] Almeno un telefono provato con `tako.local` e uno con **IP diretto** (fallback ok).
- [ ] **Dashboard staff** funziona sul Mac e su almeno un **tablet in LAN** (login PIN ok).
- [ ] **Stampante**: stampa di prova uscita (se presente).
- [ ] **Test internet staccato**: scollega l'uplink → ordini, menu, conti, cucina, dashboard
      continuano. Le funzioni cloud (WhatsApp/AI) risultano non disponibili: è previsto.
- [ ] **Mac non va in stop** durante il servizio (standby disattivato, alimentato).
- [ ] Consegnati al gestore: **SSID + password wifi**, **IP del Mac**, cosa fare se "il menu
      non si apre".

---

## 11. Troubleshooting rapido

- **"App danneggiata / sviluppatore non identificato"** → la quarantena non è stata tolta.
  Rilancia `install-usb-mac.sh` (fa `xattr -dr com.apple.quarantine` + firma ad-hoc).
  Manuale: `xattr -dr com.apple.quarantine /Applications/Tako.app`.
- **Il cliente inquadra il QR e non si apre il menu** → 1) telefono sul wifi giusto?
  2) **client/AP isolation** attiva (causa #1): spegnila o passa a hotspot Mac. 3) mDNS non
  risolve (Android vecchi): usa l'**IP diretto** `http://<IP>:3002`. 4) app Tauri avviata?
  Apri `http://localhost:3002` sul Mac. 5) Firewall del Mac: consenti le porte 3002/4317.
- **Rete che va e viene** → quasi sempre radio: canale congestionato (2.4: 1/6/11, o passa a
  5 GHz), copertura debole in sala, o il Mac va in stop. In dubbio → hotspot dal Mac.
- **Stampante muta** → verifica IP/porta in **Gestione → Stampante**, che sia sulla stessa
  LAN del Mac e accesa; rifai "Stampa di prova".
- **Import menu AI non struttura nulla** → manca la chiave `~/.tako/groq-key` o non c'è
  internet in quel momento. Controlla il file e riavvia l'app.
- **Chiave Gemini incollata ma le foto non migliorano** → ok senza riavvio; verifica il file
  `~/.tako/gemini-key.txt` e che ci sia internet. Il Pro richiede il codice firmato.

---

*Se telefono e Mac si vedono sulla stessa rete locale, Tako funziona. Tutto il resto è
contorno.*
