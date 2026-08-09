-- Migration cloud 0003: hostname PUBBLICO dell'appliance (Cloudflare Tunnel).
-- Secondo endpoint del dual-endpoint LAN-first dell'app owner: l'heartbeat firmata
-- pubblica qui l'hostname del tunnel, accanto alla rete LAN (lan_ip/lan_host/client_port
-- della 0001). L'app owner prova prima la LAN e ripiega su https://<remote_host>.
-- Il valore è validato lato codice (isValidRemoteHost in apps/server/src/lib/network.ts):
-- FQDN pubblico, mai *.local, mai IP nudi → nessun open-redirect e nessun endpoint LAN
-- spacciato per remoto. NULL = appliance LAN-only (degrado pulito).
ALTER TABLE "cloud_appliances" ADD COLUMN IF NOT EXISTS "remote_host" text;
