-- Migration 0010: grandfathering owner esistenti per il gate verifica email (2026-07-10).
-- Il gate al login (routes/auth.ts) blocca gli owner con email_verified=false quando
-- CLOUD_BASE_URL è configurata. Gli owner registrati PRIMA del gate non hanno mai
-- ricevuto un'email di verifica e non esistono su cloud_owners: senza questo UPDATE
-- resterebbero chiusi fuori dalla loro stessa appliance. Le installazioni nuove non
-- hanno ancora utenti → no-op. Idempotente.
UPDATE "users" SET "email_verified" = true WHERE "role" = 'owner' AND "email_verified" = false;
