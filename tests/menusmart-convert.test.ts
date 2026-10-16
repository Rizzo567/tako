import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { convertSource, schedule, sourceVisible, stableId, branding, type Source } from '../scripts/menusmart-migration/convert.js';
import { scheduledVisible } from '../apps/server/src/lib/menu-workspace-schedule.js';
const folder = '/Users/manuel/.config/tako-webapp/menusmart-migration';
function load() {
  const s: Source = {}; for(const key of ['public_restaurants', 'categories', 'dishes', 'menu_sections', 'allergens', 'dish_allergens', 'dish_attributes', 'dish_attribute_assignments', 'lunch_menu_formulas', 'restaurant_languages'])
    s[key] = JSON.parse(readFileSync(join(folder, key + '.json'), 'utf8')); return s;
}
describe('MenuSmart conversion', () => {
  it('IDs are deterministic and UUID shaped', () => { expect(stableId('a')).toBe(stableId('a')); expect(stableId('a')).not.toBe(stableId('b')); expect(stableId('a')).toMatch(/^[a-f0-9-]{36}$/); });
  it('preserves source exact inclusive schedule including inverted days', () => {
    for(const row of [{ visible_from: '10:00', visible_until: '15:30', visible_days: [0], hide_during: true }, { visible_from: '22:00', visible_until: '02:00', visible_days: [1], hide_during: false }, { visible_days: [1, 2], hide_during: false }]) {
      const sc = schedule(row);
      for(let day = 0; day < 7; day++)
        for(let minute = 0; minute < 1440; minute++) {
          const date = new Date(Date.UTC(2026, 9, 11 + day, Math.floor(minute / 60) - 2, minute % 60));
          expect(scheduledVisible(sc, date)).toBe(sourceVisible(row, day, minute));
        }
    }
  });
  it.skipIf(!existsSync(join(folder, 'dishes.json')))('full snapshot preserves every source dish, names, descriptions, prices and raw fields', () => {
    const src = load(), out = convertSource(src); expect(out.counts.sourceDishes).toBe(2120); expect(out.counts.uniqueSourceDishIds).toBe(2120); expect(out.counts.restaurants).toBe(19); expect(out.counts.formulas).toBe(17); expect(new Set(out.mappings.filter(m => m.kind === 'category').map(m => m.sourceId)).size).toBe(322); expect(out.raw).toBe(src);
    const pata=out.restaurants.find(r=>r.slug==='patanegra')!;
    expect(out.mappings.filter(m=>m.kind==='item'&&m.tenant===pata.restaurantId)).toHaveLength(0);
    expect(pata.workspace.menus.flatMap(m=>m.sections.flatMap(c=>c.items))).toHaveLength(5);
    expect(out.warnings.some(w=>w.financialRequiresReview)).toBe(true); for(const r of out.restaurants) {
      expect(r.workspace.languages).toHaveLength(12);
      for(const m of r.workspace.menus)
        for(const c of m.sections)
          for(const item of c.items) {
            const map = out.mappings.find(x => x.targetId === item.id);
            if(!map)
              continue;
            const d = src.dishes.find(x => x.id === map.sourceId)!;
            expect(item.name).toBe(d.name);
            expect(item.description).toBe(d.description ?? null);
            expect(item.price).toBe(Math.max(0, Number(d.promo_price ?? d.price ?? 0)));
            expect(item.hidden).toBe(d.visible === false);
          const confirmed=src.dish_allergens.filter(a=>a.dish_id===d.id&&a.confirmed===true);
          expect(item.allergens.length).toBeGreaterThanOrEqual(confirmed.length);
          for(const lang of Object.keys(d.name_translations??{})) if(d.name_translations[lang]) expect(item.translations[lang]?.name).toBe(d.name_translations[lang]);
            if(Number(d.price) < 0)
              expect(item.priceDisplay).toBe('-0,50 €');
          }
    } expect(convertSource(src)).toEqual(out);
  });
  it('preserves source branding precedence and independent colors',()=>{const b=branding({name:"L'Osterietta",primary_color:'#f3b355',accent_color:'#000000',font_family:'Cormorant Garamond',menu_text_color:'#ffffff',menu_price_color:'#aabbcc',menu_description_color:'#112233',menu_button_color:'#ffeedd',menu_gradient_opacity:72,logo_size:80,header_banner_url:'https://example.com/banner.png',instagram_url:'https://instagram.com/test'});expect(b.primary).toBe('#ffeedd');expect(b.standard.price.color).toBe('#aabbcc');expect(b.standard.description.color).toBe('#112233');expect(b.standard.name.color).toBe('#ffffff');expect(b.font).toBe('serif');expect(b.backgroundOverlayOpacity).toBe(.72);expect(b.coverUrl).toBe('https://example.com/banner.png');expect(b.socialLinks.instagram).toBe('https://instagram.com/test');expect(branding({primary_color:'#f3b355',accent_color:'#000000'}).primary).toBe('#f3b355');expect(branding({}).standard.description.color).toBe('#b3b3b3')});
  it('pending declarations are not converted to active allergens', () => { const source: Source = { public_restaurants: [{ id: 'r', name: 'Test', slug: 'test' }], menu_sections: [{ id: 'm', restaurant_id: 'r', name: 'Menu' }], categories: [{ id: 'c', restaurant_id: 'r', menu_section_id: 'm', name: 'Cat' }], dishes: [{ id: 'd', restaurant_id: 'r', category_id: 'c', name: 'Dish', price: 1 }], allergens: [{ id: 'a', code: 'milk' }], dish_allergens: [{ dish_id: 'd', allergen_id: 'a', confirmed: false }], dish_attributes: [{ id: 'x', code: 'gluten', category: 'allergen' }], dish_attribute_assignments: [{ dish_id: 'd', attribute_id: 'x', status: 'pending_confirmation' }] }; expect(convertSource(source).restaurants[0].workspace.menus[0].sections[0].items[0].allergens).toEqual([]); });
});
