# Checklist — Giorno dell'installazione

Da leggere sul posto, spuntando man mano. Obiettivo: uscire dal locale con Tako
che gira e il cliente autonomo. Guida rete completa: `docs/setup-rete-ristorante.md`.

---

## 1. Cosa portare (borsa d'installazione)

- [ ] **Chiavetta USB** con dentro, nella root:
  - `Tako.app` (il bundle desktop)
  - `install-usb-mac.sh` (lo script sta in `scripts/install-usb-mac.sh` del repo — copialo accanto al .app)
- [ ] **Cavo Ethernet** + **adattatore USB-C→Ethernet** (il Mac server va a cavo, non a wifi).
- [ ] **Router / access point** di scorta, se il wifi del locale è ballerino (piano B: Mac come hotspot, non serve hardware ma averlo aiuta).
- [ ] **Stampante termica ESC/POS** del cliente + cavo/rete: verifica che sia raggiungibile.
- [ ] **Cheat-sheet cartaceo** per lo staff (una pagina: come apre il menu, come si prende un ordine, cosa fare se "il menu non si apre").
- [ ] **Contratto** in doppia copia + penna.
- [ ] Etichette / QR già stampati per i tavoli (o stampante per generarli sul posto).
- [ ] Il tuo telefono **+ un secondo telefono Android vecchio** per testare il fallback mDNS.

---

## 2. Sequenza oraria consigliata

**0:00 — Sopralluogo rete (15 min).** Dov'è il router, c'è presa Ethernet vicino al Mac,
copertura wifi in sala. Decidi subito: Mac a cavo al router (preferito) oppure Mac hotspot.

**0:15 — Installa l'app (10 min).** Inserisci la chiavetta e lancia:
```
sh /Volumes/NOME_CHIAVETTA/install-usb-mac.sh
```
Lo script copia `Tako.app` in `/Applications` (in place), toglie la quarantena Gatekeeper,
applica firma ad-hoc e **avvia Tako**. Al primo avvio si inizializza Postgres embedded in
`~/.tako/pgdata` e applica le migrazioni: attendi che l'app sia pronta.

**0:25 — Rete stabile (30 min).** IP fisso al Mac (DHCP reservation sul router **o** IP statico),
verifica `ping tako.local`, SSID dedicato `Tako` senza client isolation. Segui la checklist
rete di `setup-rete-ristorante.md` sezione 2-4. **Annota l'IP del Mac.**

**0:55 — QR e menu (20 min).** Genera/attacca i QR ai tavoli. Inserisci qualche piatto reale
se il menu è vuoto. Collega la stampante termica.

**1:15 — I 3 test (sotto). Non saltarli.**

**1:40 — Consegna al cliente + firma contratto.**

---

## 3. I 3 test da NON saltare prima di andartene

1. **QR → ordine → comanda in cucina.**
   Da un telefono cliente (meglio due: un iPhone e un Android) inquadra il QR, ordina un piatto,
   verifica che l'ordine **arrivi sul KDS / dashboard staff** in tempo reale. Testa `tako.local`
   su uno e **IP diretto** (`http://IP_DEL_MAC:3002`) sull'altro: il fallback deve funzionare.

2. **Stampa.**
   Chiudi/manda in stampa una **comanda di cucina** e uno **scontrino di cortesia**: verifica
   testo leggibile, **taglio carta** e, se previsto, **apertura cassetto**. Ricorda: lo scontrino
   è di cortesia, NON fiscale (vedi `disclaimer-fiscale.md`).

3. **Riavvio completo del Mac.**
   Riavvia **davvero** il Mac (non solo l'app). Alla ripartenza verifica che: l'app Tako riparta,
   il DB embedded risalga (migrazioni idempotenti applicate), il QR riapra il menu, un ordine
   passi ancora. Questo prova che il locale sopravvive a un blackout / spegnimento serale.

> Bonus consigliato: **test internet staccato** — scollega l'uplink e verifica che ordini, menu,
> conti, cucina, dashboard continuino. Le funzioni cloud (WhatsApp/AI/report/update) restano giù: è previsto.

---

## 4. Cosa lasciare al cliente

- [ ] **Cheat-sheet cartaceo** per lo staff (uso quotidiano + "il menu non si apre → cosa fare").
- [ ] **Piano B scritto**: SSID + password rete, **IP del Mac** annotato, come riavviare l'app, come riavviare il Mac.
- [ ] **Contratto firmato** (una copia a lui, una a te).
- [ ] **Disclaimer fiscale** (`disclaimer-fiscale.md`): Tako affianca il registratore, non lo sostituisce.
- [ ] **Contatto supporto** (tuo numero WhatsApp) + orari in cui rispondi.
- [ ] Promemoria: il **Mac deve restare acceso, sveglio e alimentato** durante il servizio;
      standby automatico disattivato; meglio via Ethernet.
