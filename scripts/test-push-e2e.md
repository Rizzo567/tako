# Collaudo notifiche push su telefono vero (F3.3)

Da fare **una volta su un iPhone e una su un Android**. Serve l'appliance accesa **con
internet** (senza, il fast-fail spegne tutto: è corretto, ma qui non si verifica nulla)
e il telefono già arruolato col QR.

## La checklist — 5 passi

1. **Installa**: apri `http://tako.local:4317/owner/` in sala → *Condividi → Aggiungi a Home* (iPhone) o *Installa app* (Android) → riapri Tako **dall'icona**.
2. **Attiva**: *Altro → Notifiche → Attiva le notifiche* → concedi il permesso → il badge diventa **Attive**.
3. **Prova**: *Altro → Notifiche → Provane una* → la notifica arriva entro pochi secondi.
4. **Ad app chiusa**: chiudi Tako (swipe via dal multitasking), fai un ordine dal QR di un tavolo → la notifica «Nuovo ordine · Tavolo N» arriva **col telefono bloccato**.
5. **Tap**: tocca la notifica → Tako si apre **sugli Ordini** (e se era già aperta, ci salta senza ricaricare).

## Se un passo fallisce

- **Passo 1, iPhone** — Web Push richiede **iOS 16.4+** e la PWA sulla schermata Home:
  in Safari il pulsante *Attiva* non compare, al suo posto c'è la guida all'installazione.
- **Passo 2, badge "Bloccate"** — il permesso è stato negato una volta: da codice non si
  può più richiedere. Si riattiva solo da *Impostazioni → Tako → Notifiche*.
- **Passo 3, «l'appliance non ha internet»** — non è un bug dell'app: `GET /api/system/connectivity`
  dice `online: false`. Le push riprendono da sole quando torna la linea.
- **Passo 4, niente notifica ma il passo 3 funzionava** — è il caso da segnare: annota
  modello, versione OS e ora. È la misura che decide se aprire **F5.4** (wrapper Expo con
  APNs). Nel frattempo il fallback affidabile resta il **briefing WhatsApp**.
- **Passo 5, si apre la sezione sbagliata** — `node scripts/test-owner-push.mjs` verifica
  la stessa logica senza telefono: se è verde, il problema è nel payload del server
  (`apps/server/src/lib/push.ts`, campo `url`).

## Due settimane di misura (piano §6, rischio R3)

Le push iOS sono storicamente inaffidabili. Il criterio non è un'impressione: per due
settimane, ogni volta che una notifica **attesa** non arriva, si annota una riga. Se le
mancate superano il 10% su iPhone, si apre F5.4 invece di continuare a limare la PWA.
