-- Costo dei trigger live sulle scritture, SOLO sul QA e in transazioni annullate (ROLLBACK): nessun dato resta.
-- 300 piatti sintetici del QA (come un locale grande, Osterietta ~277), poi le stesse istruzioni di una pubblicazione.
\timing on
begin;
insert into menu_items(id,section_id,restaurant_id,name,price,available,position)
  select gen_random_uuid(), (select s.id from menu_sections s join menus m on m.id=s.menu_id where m.restaurant_id='26050ecd-2e55-4057-a4c5-bff2b449cd47' limit 1),
         '26050ecd-2e55-4057-a4c5-bff2b449cd47', 'sintetico '||g, 10, true, g from generate_series(1,300) g;
explain (analyze, timing, costs off, summary off) update menu_items set available=false where restaurant_id='26050ecd-2e55-4057-a4c5-bff2b449cd47';
explain (analyze, timing, costs off, summary off) update menu_items set available=true where restaurant_id='26050ecd-2e55-4057-a4c5-bff2b449cd47';
explain (analyze, timing, costs off, summary off) update menu_workspaces set published_revision=published_revision+1 where restaurant_id='26050ecd-2e55-4057-a4c5-bff2b449cd47';
rollback;
