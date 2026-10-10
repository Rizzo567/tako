# Port nativo dell'app owner (F8.2+)

Decisione del 2026-08-14 (brain: `decisioni/2026-08-14-tako-ios-port-react-native.md`):
la WebView sulla PWA `/owner/` si sostituisce progressivamente con schermate
React Native vere, feel paragonabile a HearFlow. La PWA resta per i browser e
come ripiego per le schermate non ancora portate.

## Architettura (fase 1 — FATTA)

```
apps/app/
├── app/
│   ├── _layout.tsx          font di marca (Nunito + DM Sans) caricati qui
│   ├── index.tsx            decisione nativo/WebView + enroll nativo + ponte sessione
│   └── (tabs)/              tab bar RN: sala, ordini, cassa, oggi, altro
└── src/native/
    ├── session.ts           sessione device in AsyncStorage (chiave tako.app.session)
    ├── api.ts               client Bearer, busta {data|error}, paginazione meta
    ├── app.tsx              NativeAppProvider: endpoint + sessione + api + 401→logout
    ├── live.tsx             socket.io (stessi eventi della PWA, ricarica su riconnessione)
    ├── domain.ts            forme dei dati + mappe stato→tono (copia di owner-src)
    ├── kit.tsx              Card/Btn/Badge/StatTile/… in RN + mappa icone MCI
    ├── Screen.tsx           cornice: header col locale + badge rete + pull-to-refresh
    └── bootstrap.ts         ponte index→(tabs) (expo-router non passa props ai layout)
```

Flussi di sessione:
- **avvio**: endpoint risolto → sessione nativa in AsyncStorage? → tab RN; altrimenti WebView.
- **deep link `#enroll=`**: riscattato dal NATIVO (`POST /device/enroll`); se fallisce
  ripiega sulla PWA che sa mostrare l'errore.
- **ponte WebView→nativo**: `SESSION_BRIDGE_JS` rilancia `localStorage['tako.owner.session']`
  al guscio, che la importa e passa alle tab. Un logout nativo disattiva l'import
  per il processo corrente (`disableWebImport`), o rimbalzerebbe dentro.
- **logout/revoca/401**: `SessionGate` in `(tabs)/_layout` riporta alla radice.

Nota: la sessione nativa e quella della WebView sono lo STESSO token dopo un
import dal ponte, ma un enroll nativo crea un device token proprio. In
"Dispositivi" possono comparire due voci per lo stesso telefono: è corretto e
revocabile separatamente.

## Fasi restanti

Ordine per valore/difficoltà; ogni schermata si porta COMPLETA (dati live via
socket, stati vuoti, errori) e si verifica su simulatore contro i numeri
dell'API prima di passare alla successiva.

- **Fase 2 — il servizio**: `sala` (piantina/griglia tavoli, sheet dettaglio
  tavolo), `cassa` (conti aperti, chiusura). Le più usate durante il servizio.
- **Fase 3 — l'hub Altro**: sotto-schermate come stack expo-router
  (`altro/menu`, `altro/magazzino`, `altro/staff`, `altro/prenotazioni`,
  `altro/andamento`, `altro/notifiche`). `menu` richiede foto: servono
  `expo-image` con header Authorization o download autenticato via
  `expo-file-system` (le foto in `/uploads/*` vogliono il Bearer da remoto).
- **Fase 4 — copilot**: SSE via fetch streaming (in RN serve
  `react-native-sse` o polyfill: verificare prima di iniziare).
- **Fase 5 — pulizia**: quando tutte le schermate sono native, la WebView resta
  SOLO per l'enroll-ripiego; valutare rimozione di `react-native-webview` e del
  ponte. Il segnaposto di sala/cassa sparisce con la fase 2.

## Trappole note

- **La build Release ha il JS EMBEDDED** (`main.jsbundle` dentro Tako.app): con
  quella installata le modifiche JS non entrano MAI e Metro non riceve richieste
  — sembra "hot reload rotto", è la build sbagliata. Per lo sviluppo serve la
  Debug (`expo run:ios --configuration Debug`).
- **Debug + `EXPO_USE_PRECOMPILED_MODULES` non convivono** (SDK 56): il core RN
  arriva come XCFramework precompilato senza i simboli debug
  (`facebook::react::DebugStringConvertible` ecc.) che i pod compilati da
  sorgente (RNGestureHandler, webview…) referenziano in Debug → `ld: symbol(s)
  not found`. Fix: `"EXPO_USE_PRECOMPILED_MODULES": "false"` in
  `ios/Podfile.properties.json` + `pod install` (prima build da sorgente lunga).
- **Mai `rm -rf ios/build` da solo**: dentro c'è `build/generated/ios` (codegen
  RN richiesto dai target Pods). Dopo una pulizia serve SEMPRE `pod install`
  per rigenerarlo, o la build fallisce con "Build input file cannot be found …
  ReactCodegen".
- Metro nel monorepo serve il bundle su
  `/apps/app/node_modules/expo-router/entry.bundle?platform=ios&dev=true`
  (non `/index.bundle`): utile per verificare che il codice nuovo sia nel bundle
  (`grep tako.app.session`).

- I componenti kit usano i font caricati in `_layout.tsx`: aggiungerne uno nuovo
  = aggiungere il peso lì, o RN ripiega sul font di sistema SENZA errore.
- Le icone passano dalla mappa `ICONS` in `kit.tsx` (nomi della PWA → glifi
  MaterialCommunityIcons): mai nomi MCI crudi nelle schermate. `react-native-svg`
  (per gli SVG originali di `ui/icons.tsx`) vorrebbe una rebuild nativa: si
  decide alla fase 5, non prima.
- `resolveEndpoint` del guscio NON usa il token: `/health` è pubblico in LAN.
  Da remoto vale la semantica 404-è-vivo di `probeRemote` (vedi src/endpoint.ts).
- Il typecheck è il primo verifier: `pnpm --filter @tako/app typecheck`.
