# Security Review — Multi-Tenant Sweep (Epica T9-B)

Agent: security-review (READ-ONLY)
Date: 2026-06-13
Scope: apps/server/src/routes/{bills,tables,inventory,staff,stats,insights,print,restaurants}.ts
Goal: find authenticated by-id endpoints that read/mutate a resource WITHOUT filtering by req.user.restaurantId (IDOR / cross-tenant leak).

Schema facts used:
- bills, inventoryItems, menuItems, tables, orders, users, restaurants → HAVE restaurantId column.
- billPayments, inventoryMovements → CHILD tables (NO restaurantId). Must be gated via parent ownership check.

---

## FINDINGS — REAL

### SEC-T9B-001 — MEDIUM — bills.ts:31 — POST /bills
Cross-tenant order totals leak via client-supplied tableId.
- Code: `db.select().from(orders).where(and(eq(orders.tableId, body.data.tableId), inArray(orders.status, [...])))`
- Problem: tableId comes straight from request body with NO check that the table belongs to req.user.restaurantId. Attacker passes a foreign tableId → subtotal computed from another restaurant's orders. Bill itself is created under attacker's restaurantId (no foreign bill written), so impact = info-leak of another tenant's order totals + dangling foreign tableId on the bill row. Not a write into another tenant, hence MEDIUM not HIGH.
- Fix: gate the tableId first:
  `const [t] = await db.select().from(tables).where(and(eq(tables.id, body.data.tableId), eq(tables.restaurantId, req.user!.restaurantId))).limit(1); if (!t) return reply.code(404)...`
  then scope the orders query too: add `eq(orders.restaurantId, req.user!.restaurantId)` to the where().

---

## NON-PROBLEMS (verified safe)

- bills.ts:58 POST /:billId/payments — ownership checked (and(bills.id, bills.restaurantId)) BEFORE payment insert. billPayments insert by billId is gated. OK.
- bills.ts:64,68,71,87 — all downstream of the verified bill (bill.tableId, bill.id from owned row). OK.
- bills.ts:102 GET /:billId — and(eq(bills.id), eq(bills.restaurantId)). OK.
- bills.ts:11,111 — restaurantId filtered. OK.
- tables.ts ALL by-id endpoints (PATCH /:tableId, /:tableId/status, GET/POST /:tableId/qr*, DELETE /:tableId) — every where() uses and(eq(tables.id), eq(tables.restaurantId)). OK.
- inventory.ts:48 POST /:itemId/movements — ownership of item verified (and(id, restaurantId)) BEFORE movement insert + quantity update. The bare eq(inventoryItems.id, itemId) update at :58 is safe because it's downstream of the :48 guard. inventoryMovements has no restaurantId by design. OK.
- staff.ts PATCH/DELETE /:userId — and(eq(users.id), eq(users.restaurantId)); DELETE also blocks self-delete; both gated requireRole('owner'). OK.
- stats.ts /dashboard — every query filtered by restaurantId; orderItems pulled only for owned servedOrders ids. OK.
- insights.ts /menu, /menu/ai, PATCH /menu/:itemId/cost — :288 verifies and(eq(menuItems.id), eq(menuItems.restaurantId)) before the bare update at :294. AI route operates only on client data, no by-id DB read. OK.
- print.ts POST /order — reads restaurant by req.user.restaurantId directly; no client id. OK.
- restaurants.ts GET/PATCH /me — keyed on req.user.restaurantId directly, no by-id param. OK.

## SUMMARY
critical: 0 | high: 0 | medium: 1 | low: 0
Only 1 real finding (SEC-T9B-001, bills.ts:31). Everything else properly tenant-scoped.
