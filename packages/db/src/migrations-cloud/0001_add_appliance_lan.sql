-- Migration cloud 0001: colonne LAN per il resolver QR stabile (/t/:applianceId).
-- L'heartbeat dell'appliance pubblica qui l'indirizzo LAN corrente; il resolver
-- reindirizza il telefono del cliente SOLO verso questi valori (RFC1918 / *.local,
-- validati lato codice). Colonne già presenti nello schema TS (schema/cloud/
-- restaurants.ts:30-32) ma mai migrate: senza di queste claim/heartbeat vanno in
-- errore Postgres a runtime (11 test pairing rossi).
ALTER TABLE "cloud_appliances" ADD COLUMN IF NOT EXISTS "lan_ip" text;
ALTER TABLE "cloud_appliances" ADD COLUMN IF NOT EXISTS "client_port" integer;
ALTER TABLE "cloud_appliances" ADD COLUMN IF NOT EXISTS "lan_host" text;
