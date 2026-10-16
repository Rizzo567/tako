-- Rollback Compito 2 (menu live): rimuove SOLO gli oggetti aggiunti da up.sql. Nessun dato toccato.
begin;
drop trigger if exists tako_menu_live_workspace on public.menu_workspaces;
drop trigger if exists tako_menu_live_items_update on public.menu_items;
drop trigger if exists tako_menu_live_items_delete on public.menu_items;
drop trigger if exists tako_menu_live_restaurant on public.restaurants;
drop function if exists public.tako_menu_live_workspace_trg();
drop function if exists public.tako_menu_live_items_trg();
drop function if exists public.tako_menu_live_restaurant_trg();
drop function if exists public.tako_menu_live_notify(uuid);
drop policy if exists tako_menu_live_receive on realtime.messages;
commit;
