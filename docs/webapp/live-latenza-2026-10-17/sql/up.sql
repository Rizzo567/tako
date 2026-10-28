-- Latenza live B (17/10/2026). Parte dal Compito 2 (16/10): stessi 4 trigger immediati e stessa policy.
-- Cosa cambia:
--  1. I trigger immediati NON inviano più: accumulano in una variabile locale alla transazione
--     (tako.menu_live_acc) cosa è cambiato per ogni locale.
--  2. Un trigger di vincolo DIFFERITO (scatta al COMMIT, dopo tutte le istruzioni) invia UN solo messaggio
--     per locale per transazione, come prima, sul canale privato "menu-live:<id>".
--  3. Il messaggio resta {at,...} con evento 'v' (i telefoni col bundle vecchio rileggono come prima) e aggiunge:
--       k = gettone casuale del cambio;
--       d = delta GIÀ PUBBLICATO dei piatti (solo se il cambio è piccolo e non strutturale), es.
--           [{i:id piatto, m:id menu, n:nome, ds:descrizione, p:prezzo, t:traduzioni, h:nascosto, a:disponibile}]
--           oppure, per l'esaurito fuori dal workspace, [{i:id, a:false}].
--     Il delta viene SOLO da menu_workspaces.published (vecchio → nuovo) e da menu_items.available: mai dalla bozza.
--     Qualsiasi altra differenza (piatto nuovo/tolto, ordine, categoria, menu, aspetto, promo, varianti, …) → nessun d → rilettura.
-- Ogni errore è assorbito (WARNING): la scrittura non fallisce mai per colpa del live, neanche al commit.
-- Solo funzioni e trigger: nessuna tabella, nessun dato. Rollback: rollback.sql (ripristina le funzioni del Compito 2).
begin;

-- Delta tra due pubblicati. NULL = strutturale (rileggere). Massimo 20 piatti, niente promo/scarsità sui piatti cambiati.
-- Strutturale = piatto nuovo, oppure cambia qualcosa oltre a nome/descrizione/prezzo/traduzioni/nascosto/disponibile di piatti esistenti
-- (stesso ordine, a parte i piatti eliminati)
-- (i campi interni costPrice/kitchenStation/prepTimeMinutes/calories/featured non sono pubblici e vengono ignorati).
create or replace function public.tako_menu_live_delta(o jsonb, n jsonb) returns jsonb
language plpgsql stable set search_path = pg_catalog, public as $$
declare d jsonb; cnt int; special boolean; diff boolean;
  top constant text[] := array['menus','pdf','pdfPresets','translationSettings'];
  free constant text[] := array['name','description','price','translations','hidden','available','costPrice','kitchenStation','prepTimeMinutes','calories','featured'];
begin
  if o is null or n is null or jsonb_typeof(o->'menus') is distinct from 'array' or jsonb_typeof(n->'menus') is distinct from 'array' then return null; end if;
  if (o - top) is distinct from (n - top) then return null; end if;
  -- Menu e categorie: stessi oggetti (senza figli) nelle stesse posizioni.
  select exists(
    select 1 from jsonb_array_elements(o->'menus') with ordinality a(v, k) full join jsonb_array_elements(n->'menus') with ordinality b(v, k) on a.k = b.k
    where (a.v - 'sections') is distinct from (b.v - 'sections') or jsonb_array_length(a.v->'sections') is distinct from jsonb_array_length(b.v->'sections'))
  into diff;
  if diff then return null; end if;
  select exists(
    select 1 from (select m.k mk, a.k, a.v from jsonb_array_elements(o->'menus') with ordinality m(v, k), jsonb_array_elements(m.v->'sections') with ordinality a(v, k)) a
      join (select m.k mk, b.k, b.v from jsonb_array_elements(n->'menus') with ordinality m(v, k), jsonb_array_elements(m.v->'sections') with ordinality b(v, k)) b using (mk, k)
    where (a.v - 'items') is distinct from (b.v - 'items'))
  into diff;
  if diff then return null; end if;
  -- Piatti: stesse posizioni dopo aver tolto i piatti ELIMINATI dal pubblicato (un piatto nuovo = strutturale);
  -- differenze ammesse solo nei campi «free». Gli eliminati vanno nel delta come {i, m, a:false} (il telefono li toglie).
  with oa as (select m.k mk, s.k sk, i.k ik, m.v->>'id' mid, i.v from jsonb_array_elements(o->'menus') with ordinality m(v, k), jsonb_array_elements(m.v->'sections') with ordinality s(v, k), jsonb_array_elements(s.v->'items') with ordinality i(v, k)),
       na as (select m.k mk, s.k sk, i.k ik, m.v->>'id' mid, i.v from jsonb_array_elements(n->'menus') with ordinality m(v, k), jsonb_array_elements(m.v->'sections') with ordinality s(v, k), jsonb_array_elements(s.v->'items') with ordinality i(v, k)),
       gone as (select oa.mid, oa.v->'id' id from oa where not exists (select 1 from na where na.v->'id' = oa.v->'id')),
       oi as (select mk, sk, row_number() over (partition by mk, sk order by ik) ik, v from oa where not exists (select 1 from gone where gone.id = oa.v->'id')),
       ch as (select na.mid, oi.v ov, na.v nv from oi full join na using (mk, sk, ik) where oi.v is distinct from na.v)
  select count(*) + (select count(*) from gone),
         bool_or(ov is null or nv is null or (ov - free) is distinct from (nv - free)),
         coalesce(jsonb_agg(jsonb_build_object('i', nv->'id', 'm', mid, 'n', nv->'name', 'ds', coalesce(nv->'description', 'null'::jsonb), 'p', nv->'price',
                                               't', coalesce(nv->'translations', '{}'::jsonb), 'h', coalesce(nv->'hidden', 'false'::jsonb), 'a', coalesce(nv->'available', 'true'::jsonb))) filter (where ov is not null and nv is not null), '[]'::jsonb)
           || coalesce((select jsonb_agg(jsonb_build_object('i', id, 'm', mid, 'a', false)) from gone), '[]'::jsonb),
         coalesce(bool_or(coalesce(nv->'promo', 'null'::jsonb) <> 'null'::jsonb or coalesce(ov->'promo', 'null'::jsonb) <> 'null'::jsonb
                       or coalesce(nv->'scarcity', 'null'::jsonb) <> 'null'::jsonb or coalesce(ov->'scarcity', 'null'::jsonb) <> 'null'::jsonb), false)
    into cnt, diff, d, special from ch;
  if coalesce(diff, false) or special or cnt > 20 then return null; end if;
  return d;
exception when others then
  raise warning 'tako_menu_live_delta: %', sqlerrm;
  return null;
end $$;

-- Accumulatore della transazione: {"<rid>": {s:strutturale, w:delta workspace|null, wn:n° pubblicazioni, i:[id esauriti/riattivati], io:troppi, x:[id cancellati], done}}
create or replace function public.tako_menu_live_acc_merge(rid uuid, kind text, val jsonb) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare acc jsonb; cur jsonb; ids jsonb;
begin
  if rid is null then return; end if;
  acc := coalesce(nullif(current_setting('tako.menu_live_acc', true), ''), '{}')::jsonb;
  cur := coalesce(acc->(rid::text), '{}'::jsonb);
  if kind = 's' then
    cur := cur || '{"s":true}';
  elsif kind = 'w' then
    -- Due pubblicazioni nella stessa transazione: il delta della prima non vale più → strutturale.
    if cur ? 'w' then cur := cur || '{"s":true}'; end if;
    cur := cur || jsonb_build_object('w', coalesce(val, 'null'::jsonb));
  elsif kind in ('i', 'x') then
    if not coalesce((cur->>'io')::boolean, false) then
      ids := coalesce(cur->kind, '[]'::jsonb) || coalesce(val, '[]'::jsonb);
      if jsonb_array_length(ids) > 60 then cur := (cur - 'i' - 'x') || '{"io":true}'; else cur := cur || jsonb_build_object(kind, ids); end if;
    end if;
  end if;
  perform set_config('tako.menu_live_acc', jsonb_set(acc, array[rid::text], cur, true)::text, true);
exception when others then
  raise warning 'tako_menu_live_acc_merge: %', sqlerrm;
end $$;

-- Invio (al commit): un messaggio per locale per transazione.
create or replace function public.tako_menu_live_notify(rid uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare acc jsonb; cur jsonb; d jsonb; appear boolean; payload jsonb;
begin
  if rid is null then return; end if;
  acc := coalesce(nullif(current_setting('tako.menu_live_acc', true), ''), '{}')::jsonb;
  cur := coalesce(acc->(rid::text), '{}'::jsonb);
  if cur ? 'done' then return; end if;
  perform set_config('tako.menu_live_acc', jsonb_set(acc, array[rid::text], cur || '{"done":true}', true)::text, true);
  payload := jsonb_build_object('at', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'k', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
  begin
    if not coalesce((cur->>'s')::boolean, false) then
      if cur ? 'w' then
        -- Pubblicazione: il delta del pubblicato copre anche la disponibilità riscritta da mutateWorkspace.
        if jsonb_typeof(cur->'w') = 'array' and not (cur ? 'x') then d := cur->'w'; end if;
      elsif not coalesce((cur->>'io')::boolean, false) and (cur ? 'i' or cur ? 'x') then
        -- Solo disponibilità (PATCH «esaurito») o righe cancellate: stato FINALE delle righe al commit.
        select coalesce(jsonb_agg(jsonb_build_object('i', mi.id, 'a', false)) filter (where not mi.available), '[]'::jsonb), coalesce(bool_or(mi.available), false)
          into d, appear
          from menu_items mi where mi.restaurant_id = rid and mi.id in (select distinct (jsonb_array_elements_text(coalesce(cur->'i', '[]'::jsonb)))::uuid);
        -- Un piatto tornato disponibile va riletto (servono i suoi dati).
        if appear then d := null;
        else d := d || coalesce((select jsonb_agg(jsonb_build_object('i', x, 'a', false)) from (select distinct jsonb_array_elements(cur->'x') x) q), '[]'::jsonb);
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'tako_menu_live_notify delta: %', sqlerrm; d := null;
  end;
  if d is not null and length(d::text) <= 30000 then payload := payload || jsonb_build_object('d', d); end if;
  perform realtime.send(payload, 'v', 'menu-live:' || rid::text, true);
exception when others then
  raise warning 'tako_menu_live_notify: %', sqlerrm;
end $$;

-- Trigger immediati (stessi nomi e stessi trigger del Compito 2): ora solo accumulano.
create or replace function public.tako_menu_live_workspace_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  begin
    perform public.tako_menu_live_acc_merge(new.restaurant_id, 'w', public.tako_menu_live_delta(old.published, new.published));
  exception when others then raise warning 'tako_menu_live_workspace_trg: %', sqlerrm; end;
  return null;
end $$;

create or replace function public.tako_menu_live_items_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare r record;
begin
  begin
    if tg_op = 'DELETE' then
      for r in select o.restaurant_id rid, jsonb_agg(o.id) ids from old_rows o where o.available group by o.restaurant_id loop
        perform public.tako_menu_live_acc_merge(r.rid, 'x', r.ids);
      end loop;
    else
      for r in select n.restaurant_id rid, jsonb_agg(n.id) ids from new_rows n join old_rows o on o.id = n.id where o.available is distinct from n.available group by n.restaurant_id loop
        -- Oltre 60 piatti (pubblicazione completa) l'accumulatore tiene solo «troppi» (io).
        perform public.tako_menu_live_acc_merge(r.rid, 'i', r.ids);
      end loop;
    end if;
  exception when others then raise warning 'tako_menu_live_items_trg: %', sqlerrm; end;
  return null;
end $$;

create or replace function public.tako_menu_live_restaurant_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  begin
    perform public.tako_menu_live_acc_merge(new.id, 's', null);
  exception when others then raise warning 'tako_menu_live_restaurant_trg: %', sqlerrm; end;
  return null;
end $$;

-- Trigger differito: al commit, il primo evento del locale invia il messaggio (gli altri escono subito).
create or replace function public.tako_menu_live_commit_trg() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  begin
    if tg_table_name = 'restaurants' then perform public.tako_menu_live_notify(new.id);
    elsif tg_op = 'DELETE' then perform public.tako_menu_live_notify(old.restaurant_id);
    else perform public.tako_menu_live_notify(new.restaurant_id); end if;
  exception when others then raise warning 'tako_menu_live_commit_trg: %', sqlerrm; end;
  return null;
end $$;

revoke all on function public.tako_menu_live_delta(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.tako_menu_live_acc_merge(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.tako_menu_live_notify(uuid) from public, anon, authenticated;
revoke all on function public.tako_menu_live_workspace_trg() from public, anon, authenticated;
revoke all on function public.tako_menu_live_items_trg() from public, anon, authenticated;
revoke all on function public.tako_menu_live_restaurant_trg() from public, anon, authenticated;
revoke all on function public.tako_menu_live_commit_trg() from public, anon, authenticated;

drop trigger if exists tako_menu_live_commit_workspace on public.menu_workspaces;
create constraint trigger tako_menu_live_commit_workspace after update on public.menu_workspaces
  deferrable initially deferred for each row
  when (old.published_revision is distinct from new.published_revision or old.published is distinct from new.published)
  execute function public.tako_menu_live_commit_trg();
drop trigger if exists tako_menu_live_commit_items_update on public.menu_items;
create constraint trigger tako_menu_live_commit_items_update after update on public.menu_items
  deferrable initially deferred for each row
  when (old.available is distinct from new.available)
  execute function public.tako_menu_live_commit_trg();
drop trigger if exists tako_menu_live_commit_items_delete on public.menu_items;
create constraint trigger tako_menu_live_commit_items_delete after delete on public.menu_items
  deferrable initially deferred for each row
  when (old.available)
  execute function public.tako_menu_live_commit_trg();
drop trigger if exists tako_menu_live_commit_restaurant on public.restaurants;
create constraint trigger tako_menu_live_commit_restaurant after update on public.restaurants
  deferrable initially deferred for each row
  when (old.name is distinct from new.name or old.settings is distinct from new.settings or old.active is distinct from new.active)
  execute function public.tako_menu_live_commit_trg();
commit;
