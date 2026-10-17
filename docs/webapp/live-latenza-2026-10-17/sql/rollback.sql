-- Rollback latenza live B (17/10/2026): torna ESATTAMENTE al Compito 2 (16/10).
-- Toglie i 4 trigger differiti e le 4 funzioni nuove, ripristina i corpi del Compito 2 delle 4 funzioni esistenti.
-- I 4 trigger immediati e la policy restano (sono del Compito 2). Nessun dato toccato.
begin;
drop trigger if exists tako_menu_live_commit_workspace on public.menu_workspaces;
drop trigger if exists tako_menu_live_commit_items_update on public.menu_items;
drop trigger if exists tako_menu_live_commit_items_delete on public.menu_items;
drop trigger if exists tako_menu_live_commit_restaurant on public.restaurants;
drop function if exists public.tako_menu_live_commit_trg();
drop function if exists public.tako_menu_live_acc_merge(uuid, text, jsonb);
drop function if exists public.tako_menu_live_delta(jsonb, jsonb);

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
commit;
