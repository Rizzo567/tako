-- Rollback di menu-day-presets.sql. ATTENZIONE: cancella preset, avvisi e cache traduzioni.
-- Il menu pubblicato (menu_workspaces) e le tabelle del menu non vengono toccati.
BEGIN;
DROP TABLE IF EXISTS menu_day_preset_runs;
DROP TABLE IF EXISTS menu_day_preset_settings;
DROP TABLE IF EXISTS menu_day_presets;
DROP TABLE IF EXISTS menu_owner_notices;
DROP TABLE IF EXISTS menu_text_translations;
COMMIT;
