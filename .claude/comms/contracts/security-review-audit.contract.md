# Security Review Audit — T3 microtask 5

Verifica tenuta fix sicurezza maggio. Audit READ-ONLY. Data: 2026-06-13.
Stile caveman. Verdetti: REGGE / NON REGGE / PARZIALE.

---

## 1. PIN bcrypt — REGGE

- Creazione PIN: `apps/server/src/routes/staff.ts:30` → `bcrypt.hash(body.data.pin, 10)`. PIN salvato hashato.
- Verifica login PIN: `apps/server/src/routes/auth.ts:150-152` → se PIN inizia con `$2` usa `bcrypt.compare`, altrimenti confronto plaintext legacy.
- Password owner: `auth.ts:72` e `staff.ts:29` → `bcrypt.hash(pw, 12)`. Verifica `auth.ts:121` `bcrypt.compare`.
- Schema: `packages/db/src/schema/users.ts:11` campo `pin: text('pin')` (contiene hash).

CAVEAT (non bloccante): fallback plaintext a `auth.ts:152` (`candidate.pin === pin`) per PIN legacy non migrati.
Nuovo PIN sempre hashato, ma vecchi PIN plaintext nel DB verificano ancora in chiaro. Migrare e rimuovere il ramo plaintext.

## 2. IDOR ownership — PARZIALE

ORDERS — regge.
- `orders.ts:16,31,46,60,67,96,120` → ogni select/update/cancel filtra `eq(orders.restaurantId, req.user!.restaurantId)`. No cross-tenant.

MENU — buchi.
- OK: GET menu `menu.ts:34`, update item `menu.ts:131`, delete variant `menu.ts:171`, import `menu.ts:183,258` filtrano restaurantId.
- NON REGGE: `menu.ts:63-73` PATCH `/sections/:sectionId` aggiorna section senza verificare ownership (nessun join a menu/restaurant).
- NON REGGE: `menu.ts:79-90` DELETE `/sections/:sectionId` cancella section senza ownership.
- NON REGGE: `menu.ts:52-58` POST `/:menuId/sections` inserisce in menuId senza verificare che il menu sia del ristorante.
- NON REGGE: `menu.ts:141-148` PATCH `/items/:itemId/availability` update by itemId, no restaurantId filter.
- NON REGGE: `menu.ts:151-156` DELETE `/items/:itemId` cancella by itemId, no restaurantId filter.
- NON REGGE: `menu.ts:93-109` POST `/sections/:sectionId/items` crea item in sectionId arbitrario senza ownership della section.
- NON REGGE: `menu.ts:159-165` POST `/items/:itemId/variants` aggiunge variante a itemId arbitrario senza ownership.

Verdetto: autenticato OK ma manca enforcement per-tenant su section/item by-id. Staff di ristorante A puo mutare menu di ristorante B indovinando UUID.

## 3. MIME whitelist upload — PARZIALE

- `apps/server/src/routes/uploads.ts:10,24` → whitelist `image/jpeg|png|webp|gif`, rifiuta altro 400.
- Estensione derivata dalla whitelist (`MIME_TO_EXT`), filename random nanoid — no path traversal.
- Size limit 10MB in `index.ts:48`.
- NON REGGE (debole): valida solo `data.mimetype` (header client, falsificabile). NESSUN controllo magic bytes / sniff reale del contenuto.
  Attaccante puo caricare file arbitrario dichiarando `Content-Type: image/png`. File serviti statici da `/uploads/` (`index.ts:52`).

## 4. Socket auth — REGGE

- `apps/server/src/socket/handlers.ts:19-24` → `join:restaurant` richiede token, `verifyStaffToken` valida sessione DB non scaduta, e controlla `staff.restaurantId === restaurantId` (no join a room altrui).
- `verifyStaffToken` (`handlers.ts:5-14`) join sessions+users, filtra `expiresAt > now`.
- `join:table` (`handlers.ts:27-30`) unauthenticated BY DESIGN (cliente da QR), con type/length guard.
- CORS socket: origini whitelist `index.ts:86-96`.

CAVEAT: handshake non autenticato a livello connessione; auth avviene al join room. Accettabile (room sono il trust boundary). Chi conosce un restaurantId+tableId puo join `table:` room e vedere update di quel tavolo — basso rischio.

## 5. Bonus — stato P0 note

- TOKEN in localStorage: CONFERMATO. `apps/dashboard/src/lib/store.ts:22`, `lib/api.ts:10`, `app/comanda/layout.tsx:13` → `tako_token` in localStorage. Esposto a XSS. (P0 noto, in lavorazione T3.)
- CSP DISABILITATA: CONFERMATO. `apps/server/src/index.ts:34` → `helmet({ contentSecurityPolicy: false })`. Nessuna CSP. (P0 noto.)
- waiter-call SENZA AUTH: CONFERMATO. `apps/server/src/routes/customer.ts:258` POST `/waiter-call` no preHandler. Chiunque con restaurantId puo spammare chiamate cameriere a qualsiasi room. (P0 noto.)
- ai-chat SENZA AUTH: CONFERMATO. `apps/server/src/routes/customer.ts:274` POST `/ai-chat` no preHandler — endpoint AI agentico pubblico (puo riempire carrello/ordinare). Costo + abuso. (P0 noto.)
  NB: `apps/server/src/routes/ai.ts:10` (copilot staff) INVECE e protetto con `requireAuth` — OK.

---

## Riepilogo verdetti

| # | Area | Verdetto |
|---|------|----------|
| 1 | PIN bcrypt | REGGE (caveat fallback plaintext legacy) |
| 2 | IDOR ownership | PARZIALE (orders OK, menu sections/items by-id NON filtrano restaurantId) |
| 3 | MIME upload | PARZIALE (whitelist mimetype OK, no magic bytes) |
| 4 | Socket auth | REGGE |
| 5 | Bonus P0 | localStorage token, CSP off, waiter-call/ai-chat customer no-auth: tutti CONFERMATI |

Bloccanti nuovi (non gia tracciati): IDOR menu sezioni/item (#2).
