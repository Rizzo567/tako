-- Migration 0008: incasso ASPORTO + fix IDOR sessione takeaway.
--  • orders.takeaway_session_id — id univoco (uuid) della sessione asporto (JWT)
--    che ha creato l'ordine: chiude l'IDOR su GET /customer/orders/:id (la sessione
--    asporto legge solo i propri ordini, non qualsiasi ordine takeaway del ristorante).
--  • orders.bill_id — conto dedicato dell'ordine asporto (1 ordine asporto = 1 conto),
--    così POST /bills/:id/payments può fare la cascade → ordine 'paid' anche senza tavolo.
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS + FK/INDEX creati solo se assenti, così i DB
-- già avviati non rompono.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "takeaway_session_id" uuid;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "bill_id" uuid;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_bill_id_bills_id_fk"
    FOREIGN KEY ("bill_id") REFERENCES "bills"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "orders_bill_id_idx" ON "orders"("bill_id");
