-- Compito 2 (menu live, 16/10/2026). Solo oggetti nuovi: 4 funzioni, 4 trigger, 1 policy.
-- Al commit di una pubblicazione / disponibilità / impostazioni del locale, Realtime Broadcast
-- invia sul canale PRIVATO "menu-live:<restaurant_id>" un solo messaggio {at} (nessun dato di bozza).
-- Un messaggio per locale per transazione. Ogni errore è assorbito (WARNING): la scrittura non fallisce mai.
begin;
create or replace function public.tako_menu_live_notify(rid uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare sent text;
begin
  if rid is null then return; end if;
  sent := coalesce(current_setting('tako.menu_live_sent', true), '');
  if position(rid::text in sent) > 0 then return; end if;
  perform set_config('tako.menu_live_sent', sent || rid::text || ',', true);
  perform realtime.send(jsonb_build_object('at', (extract(epoch from clock_timestamp()) * 1000)::bigint), 'v', 'menu-live:' || rid::text, true);
exception when others then
  raise warning 'tako_menu_live_notify: %', sqlerrm;
end $$;

create or replace function public.tako_menu_live_workspace_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  begin
    perform public.tako_menu_live_notify(new.restaurant_id);
  exception when others then raise warning 'tako_menu_live_workspace_trg: %', sqlerrm; end;
  return null;
end $$;

create or replace function public.tako_menu_live_items_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare r uuid;
begin
  begin
    if tg_op = 'DELETE' then
      for r in select distinct o.restaurant_id from old_rows o where o.available loop perform public.tako_menu_live_notify(r); end loop;
    else
      for r in select distinct n.restaurant_id from new_rows n join old_rows o on o.id = n.id where o.available is distinct from n.available loop perform public.tako_menu_live_notify(r); end loop;
    end if;
  exception when others then raise warning 'tako_menu_live_items_trg: %', sqlerrm; end;
  return null;
end $$;

create or replace function public.tako_menu_live_restaurant_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  begin
    perform public.tako_menu_live_notify(new.id);
  exception when others then raise warning 'tako_menu_live_restaurant_trg: %', sqlerrm; end;
  return null;
end $$;

revoke all on function public.tako_menu_live_notify(uuid) from public, anon, authenticated;
revoke all on function public.tako_menu_live_workspace_trg() from public, anon, authenticated;
revoke all on function public.tako_menu_live_items_trg() from public, anon, authenticated;
revoke all on function public.tako_menu_live_restaurant_trg() from public, anon, authenticated;

create trigger tako_menu_live_workspace after update on public.menu_workspaces
  for each row when (old.published_revision is distinct from new.published_revision or old.published is distinct from new.published)
  execute function public.tako_menu_live_workspace_trg();
create trigger tako_menu_live_items_update after update on public.menu_items
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.tako_menu_live_items_trg();
create trigger tako_menu_live_items_delete after delete on public.menu_items
  referencing old table as old_rows
  for each statement execute function public.tako_menu_live_items_trg();
create trigger tako_menu_live_restaurant after update on public.restaurants
  for each row when (old.name is distinct from new.name or old.settings is distinct from new.settings or old.active is distinct from new.active)
  execute function public.tako_menu_live_restaurant_trg();

-- I telefoni (ruolo anon, chiave pubblicabile) possono SOLO ricevere sui canali menu-live:*; nessuna policy INSERT = nessuno può inviare.
drop policy if exists tako_menu_live_receive on realtime.messages;
create policy tako_menu_live_receive on realtime.messages for select to anon, authenticated
  using (realtime.topic() like 'menu-live:%' and extension = 'broadcast');
commit;
