# Setup rete ristorante — Appliance Tako

Manuale d'installazione per il tecnico. Obiettivo: far funzionare Tako in modo
affidabile anche in locali con internet pessima o wifi instabile.

Questo documento non è marketing. È una checklist operativa: leggilo mentre sei sul posto,
spunta man mano, non lasciare il locale prima di aver superato il collaudo finale (sezione 7).

---

## 1. Principio: il Mac È il server, internet è opzionale

Tako non è un servizio cloud. È un'appliance: **il Mac installato nel locale è il server**.
Su quel Mac girano, dentro un'unica app Tauri:

- **Postgres embedded** — il database di ordini, conti, menu.
- **Server Fastify** sulla porta **4317** — l'API/backend.
- **PWA cliente** (Next) sulla porta **3002** — il menu che il cliente apre al tavolo.
- **Dashboard staff** — usata sul Mac stesso e su eventuali tablet in LAN.

Conseguenze pratiche da tenere a mente per tutta l'installazione:

- **Il CORE gira 100% in locale.** Ordini, conti, menu, cucina, dashboard staff: nessuno
  di questi ha bisogno di internet. Girano sul Mac, contro il Postgres del Mac.
- **Sul Mac stesso non serve nemmeno il wifi.** Chi lavora direttamente sul Mac (dashboard
  staff) usa `localhost` e funziona anche a rete completamente staccata.
- **Il wifi locale serve a UNA sola cosa**: far arrivare i telefoni dei clienti (e i tablet
  staff) fino al Mac. Non serve per "andare su internet", serve per andare **dal telefono al
  Mac** sulla stessa rete.
- **Internet è opzionale.** Le funzioni che lo richiedono (WhatsApp, foto AI, report, auto-update)
  degradano in modo pulito e si possono disabilitare. Non bloccano il servizio (vedi sezione 5).

Il QR al tavolo **non punta al cloud**: punta al Mac in LAN, tramite il nome mDNS
`http://tako.local:3002/...`. Così il menu si apre senza toccare internet.

> Regola mentale dell'installatore: *se il telefono del cliente e il Mac si "vedono" sulla
> stessa rete locale, Tako funziona. Tutto il resto è contorno.*

---

## 2. Requisiti di rete minimi e checklist di installazione

Requisiti minimi perché il sistema sia stabile:

- Un router/access point che serva il wifi della sala.
- Il Mac raggiungibile a un indirizzo **stabile** (IP fisso nel tempo).
- **mDNS/Bonjour** funzionante sulla rete, così `tako.local` si risolve.
- Wifi **senza isolamento client** sulla rete a cui si collegano i telefoni dei clienti.

### Checklist di installazione rete

- [ ] **IP stabile per il Mac.** Imposta un **IP statico** sul Mac **oppure** — soluzione
  preferita — una **DHCP reservation** sul router (associa il MAC address del Mac a un IP
  fisso). Serve perché sia l'IP sia il nome `tako.local` restino stabili nel tempo: se
  domani il router assegna al Mac un IP diverso, i fallback su IP diretto smettono di funzionare.
  - Trova il MAC address del Mac: *Impostazioni di Sistema → Rete → (interfaccia) → Dettagli → Hardware*.
  - Sul router: sezione *DHCP / LAN → Static Lease / Address Reservation → associa MAC ⇒ IP*.
  - Annota l'IP assegnato (es. `192.168.1.50`): ti serve per i fallback e il troubleshooting.

- [ ] **mDNS / Bonjour attivo.** Il QR usa `tako.local`, che è un nome mDNS (Bonjour/Zeroconf).
  Verifica che sulla rete la risoluzione `.local` funzioni:
  - **iOS/iPhone**: supporta mDNS **sempre**, nativamente. Nessun problema.
  - **Android 12+**: supporta la risoluzione `.local`. OK.
  - **Android vecchi (pre-12)** e alcuni device economici: **potrebbero non risolvere `tako.local`**.
    Per questi si usa il **fallback su IP diretto** (`http://192.168.1.50:3002/...`). Vedi troubleshooting.
  - Alcuni router "isolano" o filtrano il traffico multicast/mDNS tra VLAN o SSID diversi:
    assicurati che il telefono e il Mac siano sulla **stessa rete/VLAN**.
  - Verifica veloce dal Mac: `ping tako.local` e `dns-sd -B _http._tcp` (deve rispondere).

- [ ] **NIENTE AP isolation / client isolation** sul wifi dei clienti. Vedi il punto dedicato qui sotto.

- [ ] **Access point vicino alla sala.** L'AP che serve i tavoli deve avere copertura piena
  in sala. Se il locale è grande o con muri spessi, valuta un AP dedicato in sala.

- [ ] **Canale wifi poco congestionato.**
  - **2.4 GHz**: più portata, attraversa meglio i muri, ma è molto affollato (interferenze da
    altri locali, microonde, bluetooth). Canali non sovrapposti: **1, 6, 11**.
  - **5 GHz**: molto meno congestionato e più veloce, ma portata minore e peggiore attraverso i
    muri. Ideale se l'AP è vicino ai tavoli.
  - Per una sala con molti telefoni contemporaneamente, **5 GHz** vicino alla sala è di norma la
    scelta migliore; tieni il 2.4 GHz come rete di ripiego per i device vecchi.
  - Usa un'app di analisi wifi (es. scanner canali) per scegliere il canale meno affollato sul posto.

- [ ] **Mac collegato via cavo Ethernet** al router, quando possibile. Per il **server** il cavo
  è più stabile del wifi: niente cali, niente roaming, latenza bassa. Se il Mac non ha porta
  Ethernet, usa un adattatore USB-C→Ethernet. Il wifi sul Mac resta comunque libero per lo
  scenario hotspot (sezione 4).

### Priorità di connessione consigliata per il Mac

1. **Ethernet al router** (server stabile) — preferito.
2. Wifi al router (se non c'è modo di tirare il cavo).
3. Mac come hotspot per i tavoli (sezione 4) — quando il wifi del locale è inaffidabile.

---

## 3. SSID dedicato "Tako" separato dal wifi ospiti

**Consiglio forte: crea un SSID dedicato, es. `Tako`, separato dal wifi ospiti del locale.**

Perché conviene:

- **Isolamento dai problemi del wifi ospiti.** Il "wifi clienti/ospiti" di molti locali è
  configurato con **client isolation attiva** (vedi sotto), captive portal, limiti di banda,
  reset periodici. Tutte cose che **rompono** il collegamento telefono→Mac. Un SSID dedicato
  lo configuri **tu** come serve a Tako.
- **Meno congestione.** Il traffico "naviga su internet" degli ospiti non pesa sulla rete che
  deve solo portare i telefoni al Mac.
- **Controllo del comportamento di rete.** Su un SSID tuo decidi tu: niente isolation, mDNS
  permesso, canale scelto, stessa VLAN del Mac.

Come impostarlo (indicativo, dipende dal router/AP):

1. Nel pannello del router/AP crea un nuovo SSID, es. `Tako` (o `Menu` / `Tavoli`).
2. Mettilo sulla **stessa rete/VLAN del Mac** (fondamentale: se è una VLAN separata, mDNS e il
   traffico telefono→Mac vengono bloccati).
3. **Disattiva client/AP isolation** su questo SSID.
4. Scegli un canale poco congestionato (sezione 2).
5. Metti una password semplice ma non banale (il QR del menu è pubblico, ma il wifi no).
6. Facoltativo: il cliente non ha bisogno di stare su `Tako` per aprire il menu **se** è
   comunque su una rete che vede il Mac. Ma tenerli sull'SSID `Tako` rende tutto più prevedibile.

> Nota: puoi anche stampare accanto al QR un piccolo avviso "Wifi: `Tako` — password: …",
> così il cliente si collega alla rete giusta prima di inquadrare.

---

## 4. Se il wifi del locale fa schifo: il Mac come Access Point (hotspot)

Quando il wifi del locale è inaffidabile, congestionato o non riesci a toccarne la configurazione,
la soluzione più robusta è **far diventare il Mac stesso l'access point** per i tavoli, con la
**Condivisione Internet** di macOS.

**Idea:** i telefoni dei clienti si collegano a un hotspot wifi **generato dal Mac**. Il traffico
telefono→Mac non passa più dal wifi ballerino del locale: va **direttamente** al Mac. Bypassi
completamente la rete del locale per la parte che conta.

```
[ Telefoni cliente ] --wifi--> [ Mac (hotspot + server Tako) ]
                                        |
                                  (uplink opzionale: Ethernet/altro wifi → internet)
```

Poiché il CORE di Tako è locale, questo hotspot **non ha nemmeno bisogno di dare internet** ai
telefoni: gli serve solo raggiungere il Mac. L'uplink internet è opzionale (per le funzioni cloud).

### Pro

- **Massima stabilità del collegamento telefono→Mac**: nessuna dipendenza dal wifi del locale.
- **Configurazione sotto il tuo controllo**: niente client isolation, niente captive portal.
- **Veloce da attivare**: non serve accedere al router del locale.
- Ottimo come **rete di servizio dedicata ai tavoli**.

### Contro e limiti

- **Serve una seconda interfaccia di rete per l'uplink.** Il Mac non può condividere internet
  *sulla stessa* interfaccia da cui lo riceve. Schema tipico: **uplink via Ethernet** (cavo al
  router) e **hotspot via Wi-Fi**. Se al Mac non serve internet, l'uplink può anche mancare
  (l'hotspot funziona lo stesso per il solo traffico LAN verso Tako).
- **Numero di dispositivi limitato.** L'hotspot software di macOS regge un numero modesto di
  client contemporanei (indicativamente un piccolo gruppo di device, non decine e decine).
  Per sale grandi con molti tavoli simultanei un **vero access point** dedicato è meglio.
- **Il Mac deve restare acceso, sveglio e col processo vivo.** Se il Mac va in stop, l'hotspot cade.
  Disattiva lo standby automatico (vedi sotto).
- **Sicurezza**: imposta **WPA2 e una password robusta** sull'hotspot. Chi si collega è sulla
  stessa rete del server.
- **mDNS sull'hotspot**: `tako.local` di norma si risolve (il Mac stesso annuncia Bonjour), ma se
  un device non risolve, resta il **fallback su IP** (tipicamente il Mac hotspot è tipo
  `192.168.2.1` — verificalo e annotalo).

### Passi indicativi su macOS (Condivisione Internet)

> I nomi esatti cambiano leggermente tra versioni di macOS. Il flusso è questo:

1. Collega l'**uplink** del Mac se vuoi anche internet: es. **cavo Ethernet** al router (o una
   chiavetta/tethering). Lascia libera la **Wi-Fi** del Mac: sarà quella dell'hotspot.
2. *Impostazioni di Sistema → Generali → Condivisione* (nelle versioni vecchie:
   *Preferenze di Sistema → Condivisione*).
3. Seleziona **Condivisione Internet**.
4. **"Condividi la tua connessione da"** → scegli l'interfaccia dell'**uplink** (es. *Ethernet*).
5. **"Ai computer che usano"** → spunta **Wi-Fi**.
6. **Opzioni Wi-Fi…**: imposta
   - **Nome rete (SSID)**: es. `Tako`
   - **Sicurezza**: **WPA2 Personal**
   - **Password**: una robusta (annotala, servirà accanto al QR)
7. Attiva la spunta **Condivisione Internet** (ON). Confermi l'avvio.
8. Verifica: da un telefono cerca la rete `Tako`, collegati, apri `http://tako.local:3002/...`
   (o l'IP del Mac hotspot). Deve aprirsi il menu.
9. **Impedisci lo stop del Mac**: *Impostazioni → Batteria/Risparmio energia* → disattiva lo
   stop automatico quando è alimentato (o usa `caffeinate` / `pmset`). Il Mac deve restare
   sempre attivo durante il servizio.

> Se la sala è grande e i tavoli molti, considera un **access point hardware dedicato** con
> l'SSID `Tako` (sezione 3) invece dell'hotspot del Mac: regge più device. L'hotspot del Mac è
> la soluzione "d'emergenza / locale piccolo" perfetta quando non puoi fidarti della rete esistente.

---

## 5. Cosa succede senza internet

Rassicurazione operativa: **staccare internet non ferma il servizio.** Il CORE è locale.

| Funzione | Senza internet | Note |
|---|---|---|
| **Ordini** (presa comande) | ✅ Funziona | Locale, contro Postgres del Mac |
| **Conti / pagamenti a registro** | ✅ Funziona | Locale |
| **Menu cliente al tavolo** (PWA via QR) | ✅ Funziona | Servito dal Mac in LAN (`tako.local:3002`) |
| **Cucina / KDS** | ✅ Funziona | Locale |
| **Dashboard staff** (Mac e tablet LAN) | ✅ Funziona | LAN; sul Mac stesso anche senza wifi |
| **Realtime in LAN** (aggiornamenti live tra device) | ✅ Funziona | Passa dal Mac, non dal cloud |
| **WhatsApp** (notifiche/copilot) | ⛔ Si disabilita | Richiede internet; degrada, non blocca |
| **Foto AI dei piatti** | ⛔ Si disabilita | Chiamata a servizio AI esterno |
| **Report AI** | ⛔ Si disabilita | Elaborazione esterna |
| **Auto-update dell'app** | ⛔ Si disabilita | Scarica update da internet |

Regole:

- Le funzioni ⛔ **degradano in modo pulito**: se non c'è rete, restano semplicemente non
  disponibili, senza errori bloccanti sul core.
- Se il locale è **permanentemente** senza internet, si possono **disabilitare** in
  configurazione, così non compaiono e non generano tentativi a vuoto.
- Nessuna funzione ⛔ è nel percorso critico di "prendere un ordine e mandarlo in cucina".

---

## 6. Troubleshooting rapido

### A) "Il cliente inquadra il QR e non si apre il menu"

Procedi in ordine:

1. **Il telefono è sul wifi giusto?** Deve essere sulla rete che vede il Mac (idealmente SSID
   `Tako`, o l'hotspot del Mac). Se è su rete dati mobile o su un altro wifi, non raggiunge il Mac.
2. **AP / client isolation attiva?** È la causa numero uno. Se la rete isola i device tra loro,
   il telefono non raggiunge il Mac anche se sono sullo stesso wifi. Disattiva l'isolation
   sull'SSID, o passa all'SSID `Tako` / hotspot del Mac (sezioni 3-4).
3. **mDNS non risolve `tako.local`?** Tipico su Android vecchi. Prova a inserire a mano nel
   browser del telefono l'**IP diretto** del Mac: `http://192.168.1.50:3002/...` (usa l'IP reale
   annotato in installazione). Se con l'IP funziona ma con `tako.local` no → è un problema mDNS:
   valuta di generare i QR direttamente sull'IP (richiede IP stabile: DHCP reservation, sezione 2).
4. **Il Mac / i servizi sono su?** Verifica sul Mac che l'app Tauri sia avviata e che risponda:
   apri `http://localhost:3002` (PWA) e controlla la porta **4317** (Fastify). Se il core è giù,
   riavvia l'app.
5. **Firewall del Mac** che blocca le connessioni in ingresso su 3002/4317? Verifica in
   *Impostazioni → Rete → Firewall* che l'app Tako sia consentita ad accettare connessioni.
6. **Stessa rete/VLAN?** Se il wifi clienti è su una VLAN separata dal Mac, il traffico non passa.
   Metti telefoni e Mac sulla stessa rete.

### B) "Va e viene ogni tot minuti / si stacca a intermittenza"

Quasi sempre è **radio/copertura**, non software:

1. **Congestione di canale**: troppi wifi vicini sullo stesso canale. Scansiona e sposta l'SSID
   `Tako` su un canale libero (2.4: 1/6/11; oppure passa a 5 GHz). Sezione 2.
2. **Copertura debole in sala**: l'AP è lontano o dietro muri spessi. Avvicina l'AP alla sala o
   aggiungine uno dedicato. In 5 GHz la portata è minore: verifica il segnale ai tavoli più lontani.
3. **Roaming/DHCP instabile** del router del locale: se non riesci a domarlo, passa all'**hotspot
   del Mac** (sezione 4): elimini la variabile "wifi del locale".
4. **Il Mac va in stop**: se cadono tutti i device insieme, il Mac potrebbe andare in standby.
   Disattiva lo stop automatico (sezione 4, passo 9). Preferisci il Mac **via Ethernet** al router.
5. **Troppi device per l'hotspot del Mac**: se stai usando l'hotspot e la sala è grande, potresti
   superare il numero di client gestibile. Passa a un AP hardware dedicato con SSID `Tako`.

---

## 7. Checklist finale di collaudo (prima di lasciare il locale)

Non lasciare il locale prima di aver spuntato **tutte** queste voci:

- [ ] **IP stabile** confermato: DHCP reservation (o IP statico) impostata, IP annotato: `__________`.
- [ ] **`tako.local` risolve** dal Mac (`ping tako.local` OK).
- [ ] **QR apre il menu da 3 telefoni diversi**, di cui almeno un **Android** e un **iPhone**.
- [ ] Almeno un telefono testato con **`tako.local`** e uno con **IP diretto** (fallback verificato).
- [ ] **Ordine di prova** partito da un telefono cliente → **arriva in cucina** (KDS/dashboard).
- [ ] **Dashboard staff** funziona sul **Mac** e su almeno **un tablet in LAN**.
- [ ] **Test internet staccato**: scollega l'uplink e verifica che **ordini, menu, conti, cucina,
      dashboard** continuino a funzionare. Le funzioni cloud (WhatsApp/AI/report/update) possono
      risultare non disponibili: è previsto.
- [ ] **AP isolation verificata OFF** sull'SSID usato dai clienti (telefono→Mac raggiungibile).
- [ ] **Canale wifi** scelto poco congestionato; copertura verificata **al tavolo più lontano**.
- [ ] **Mac non va in stop** durante il servizio (standby automatico disattivato, alimentato).
- [ ] **Mac via Ethernet** al router (se possibile) oppure hotspot Mac configurato e testato.
- [ ] **Firewall del Mac** consente le connessioni in ingresso all'app Tako (porte 3002 / 4317).
- [ ] Se si usa l'**hotspot del Mac**: SSID `Tako`, WPA2 + password robusta, avviato e testato;
      password annotata accanto al QR: `__________`.
- [ ] Dati consegnati al gestore: **SSID + password**, **IP del Mac**, cosa fare se "il menu non si apre".

---

*Fine documento. In caso di dubbio, ricorda il principio della sezione 1: se telefono e Mac si
vedono sulla stessa rete locale, Tako funziona.*
