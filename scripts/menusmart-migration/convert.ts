import { createHash } from 'node:crypto';
import { workspaceSchema, type Workspace, type Schedule } from '../../apps/server/src/lib/menu-workspace-contract.js';
export const LANGUAGES = ['it', 'en', 'fr', 'de', 'es', 'pt', 'nl', 'pl', 'ru', 'ar', 'zh', 'ja'];
export type Row = Record<string, any>;
export type Source = Record<string, Row[]>;
export function stableId(key: string) { const h = createHash('sha256').update('tako:menusmart:v1:' + key).digest('hex').slice(0, 32); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20)}`; }
const order = (a: Row, b: Row) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || String(a.id).localeCompare(String(b.id));
const codes: Record<string, string> = { gluten: 'glutine', crustaceans: 'crostacei', eggs: 'uova', fish: 'pesce', peanuts: 'arachidi', soybeans: 'soia', soy: 'soia', milk: 'latte', nuts: 'frutta-a-guscio', celery: 'sedano', mustard: 'senape', sesame: 'sesamo', sulphites: 'solfiti', lupin: 'lupini', molluscs: 'molluschi' };
const traits: Record<string, string> = { gluten_free: 'senza-glutine', lactose_free: 'senza-lattosio', vegetarian: 'vegetariano', vegan: 'vegano', organic: 'biologico', frozen: 'surgelato', km_zero: 'locale', spicy_mild: 'piccante', spicy_medium: 'piccante', spicy_hot: 'piccante' };
const money = (v: unknown) => Number(v).toFixed(2).replace('.', ',') + ' €';
function translations(row: Row, descriptionSuffix = '') {
  const r: Record<string, any> = {}; for(const lang of new Set([...Object.keys(row.name_translations ?? {}), ...Object.keys(row.description_translations ?? {})])) {
    const name = row.name_translations?.[lang];
    if(!name)
      continue;
    r[lang] = { name, description: (row.description_translations?.[lang] ?? '') + descriptionSuffix, approved: true };
  } return r;
}
/** Exact source minute semantics: inclusive end, current weekday, no overnight wrap. */
export function sourceVisible(s: Row, day: number, minute: number) {
  const from = s.visible_from?.slice(0, 5), until = s.visible_until?.slice(0, 5), days = s.visible_days; const hasTime = !!(from && until), hasDays = Array.isArray(days) && days.length > 0; if(!hasTime && !hasDays)
    return true; const time = `${Math.floor(minute / 60)}`.padStart(2, '0') + ':' + `${minute % 60}`.padStart(2, '0'); const matches = (!hasDays || days.includes(day)) && (!hasTime || (time >= from && time <= until)); return s.hide_during ? !matches : matches;
}
export function schedule(s: Row): Schedule | undefined {
  if(!s.visible_from && !s.visible_days?.length)
    return; const windows: Schedule['windows'] = []; for(let day = 0; day < 7; day++) {
      let start = -1;
      for(let n = 0; n <= 1440; n++) {
        const yes = n < 1440 && sourceVisible(s, day, n);
        if(yes && start < 0)
          start = n;
        if(!yes && start >= 0) {
          const t = (m: number) => `${Math.floor(m / 60)}`.padStart(2, '0') + ':' + `${m % 60}`.padStart(2, '0');
          if(start === 0 && n === 1440)
            windows.push({ weekdays: [day], start: '00:00', end: '00:00' });
          else if(n === 1440) {
            windows.push({ weekdays: [day], start: t(start), end: '00:00' });
          }
          else
            windows.push({ weekdays: [day], start: t(start), end: t(n) });
          start = -1;
        }
      }
    } return { enabled: true, timezone: 'Europe/Rome', windows, from: null, until: null };
}
export function branding(r:Row){
 const color=(v:unknown,fallback:string)=>{if(typeof v!=="string")return fallback;if(/^#[0-9a-f]{6}$/i.test(v))return v;if(/^#[0-9a-f]{3}$/i.test(v))return '#'+v.slice(1).split('').map(x=>x+x).join('');const rgb=v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);return rgb?'#'+rgb.slice(1,4).map(x=>Math.min(255,Number(x)).toString(16).padStart(2,'0')).join(''):fallback};
 const accent=color(r.primary_color||r.accent_color,'#c9a227'),text=color(r.menu_text_color,'#ffffff'),price=color(r.menu_price_color,accent),description=color(r.menu_description_color,'#b3b3b3'),button=color(r.menu_button_color,accent);
 const font=/Cormorant|Playfair|serif/i.test(r.font_family??'')?'serif':'sans';
 const mode={name:{color:text,font},price:{color:price,font},description:{color:description,font}};
 const https=(v:unknown)=>typeof v==='string'&&v.startsWith('https://')?v:undefined;
 const socialLinks=Object.fromEntries(['website','instagram','facebook','tripadvisor'].flatMap(key=>https(r[key+'_url'])?[[key,r[key+'_url']]]:[]));
 return {logoUrl:r.logo_url??null,coverUrl:r.header_banner_url??null,backgroundImageUrl:r.background_url??null,background:'#181613',text,primary:button,font,standard:mode,centered:mode,link:mode,backgroundOverlayOpacity:Math.max(0,Math.min(1,Number(r.menu_gradient_opacity??85)/100)),logoSize:Math.max(24,Math.min(300,Number(r.logo_size??120))),categoryBackground:color(r.category_btn_color,'#181613'),categoryText:text,categoryActiveBackground:button,categoryActiveText:'#181613',headerBackground:color(r.header_bg_color,'#181613'),headerToolColor:button,categoryTitleStyle:{color:text,font},subcategoryTitleStyle:{color:text,font},socialLinks,reviewUrl:https(r.google_review_url)??null,layout:'list',headerTitle:r.name};
}
export function convertSource(source: Source) {
  const rows = (key: string) => source[key] ?? []; const mappings: Row[] = []; const warnings: Row[] = []; const restaurants = rows('public_restaurants').map(r => {
    const tenant = stableId('restaurant:' + r.id); const local = (key: string) => rows(key).filter(x => x.restaurant_id === r.id).sort(order); const cats = local('categories'), dishes = local('dishes'); const sourceMenus = local('menu_sections'); const menuDefs = sourceMenus.length ? sourceMenus : [{ id: 'orphan:' + r.id, name: 'Menu', visible: true }]; for(const c of cats) if(c.is_daily) warnings.push({kind:'daily-category',sourceId:c.id,rawPreserved:true});
    for(const d of dishes) if(d.scarcity_count!=null||d.image_position&&(d.image_position.x!==50||d.image_position.y!==50||d.image_position.scale!==1)) warnings.push({kind:'source-presentation-metadata',sourceId:d.id,fields:['scarcity_count','image_position'],rawPreserved:true});
    const placed = new Set<string>(); const menus = menuDefs.map((m, mi) => {
      const menuId = stableId(`${tenant}:menu:${m.id}`); mappings.push({ kind: 'menu', sourceId: m.id, targetId: menuId, tenant }); const chosen = cats.filter(c => c.menu_section_id === m.id || (c.additional_section_ids ?? []).includes(m.id) || (!c.menu_section_id && mi === 0)); const makeItem = (d: Row, c: Row) => {
        placed.add(d.id); const id = stableId(`${tenant}:${m.id}:item:${d.id}`); mappings.push({ kind: 'item', sourceId: d.id, targetId: id, tenant, menuId }); const allergens = rows('dish_allergens').filter(a => a.dish_id === d.id && a.confirmed === true).map(a => codes[rows('allergens').find(x => x.id === a.allergen_id)?.code]).filter(Boolean); const tags = [...(d.tags ?? [])]; for(const a of rows('dish_attribute_assignments').filter(a => a.dish_id === d.id && a.status === 'confirmed')) {
          const def = rows('dish_attributes').find(x => x.id === a.attribute_id);
          if(!def)
            throw Error('Unknown attribute');
          if(def.category === 'allergen') {
            const code = codes[def.code];
            if(!code)
              throw Error('Unknown allergen code');
            allergens.push(code);
          }
          else
            tags.push(traits[def.code] ?? def.name);
        } const rawPrice = Number(d.promo_price ?? d.price ?? 0), price = Math.max(0, rawPrice); let priceDisplay: string | null = rawPrice < 0 ? money(rawPrice) : null; if(rawPrice < 0)
          warnings.push({ kind: 'negative-price-display-preserved', sourceId: d.id, sourcePrice: rawPrice, financialRequiresReview: true }); if(d.price_secondary != null)
          priceDisplay = `${d.price_label ?? ''} ${money(price)} / ${d.price_secondary_label ?? ''} ${money(d.price_secondary)}`.trim();
        else if(d.price_label)
          priceDisplay = `${d.price_label} ${money(price)}`; if(c.hide_dish_prices)
          priceDisplay = ' '; if(d.promo_price != null)
          warnings.push({ kind: 'promotion', sourceId: d.id, listPrice: d.price, price }); return { id, name: d.name, description: d.description ?? null, price, priceDisplay, imageUrl: d.image_url ?? null, available: d.visible !== false, hidden: d.visible === false, featured: !!d.highlighted, allergens: [...new Set(allergens)], tags: [...new Set(tags)], translations: translations(d), displayMode: c.layout === 'centered' ? 'centered' : 'normal' };
      }; const sections = chosen.map(c => { const id = stableId(`${tenant}:${m.id}:category:${c.id}`); mappings.push({ kind: 'category', sourceId: c.id, targetId: id, tenant, menuId }); const suffix = c.category_price != null ? `\n${c.category_price_label ?? ''} ${money(c.category_price)}` : ''; return { id, name: c.name, description: (c.description ?? '') + suffix || null, parentSectionId: c.parent_category_id && chosen.some(p => p.id === c.parent_category_id) ? stableId(`${tenant}:${m.id}:category:${c.parent_category_id}`) : null, active: c.visible !== false, translations: translations(c, suffix), items: dishes.filter(d => d.category_id === c.id).map(d => makeItem(d, c)) }; }); const formulas = rows('lunch_menu_formulas').filter(f => f.menu_section_id === m.id).sort(order); if(formulas.length)
        sections.unshift({ id: stableId(`${tenant}:${m.id}:formulas`), name: 'Formule', description: null, parentSectionId: null, active: true, translations: {}, items: formulas.map(f => ({ id: stableId(`${tenant}:formula:${f.id}`), name: f.name, description: f.description ?? null, price: Number(f.price), translations: translations(f) })) } as any); return { id: menuId, name: m.name, description: m.fixed_price != null ? money(m.fixed_price) : null, active: m.visible !== false, type: /pranzo/i.test(m.name) ? 'lunch' : 'main', schedule: schedule(m), translations: translations(m), sections };
    }); const orphan = dishes.filter(d => !placed.has(d.id)); if(orphan.length)
      throw Error(`Unplaced dishes: ${r.slug} ${orphan.length}`); const foodTranslations: Record<string, Record<string, string>> = {}; for(const a of rows('allergens'))
      for(const [lang, label] of Object.entries(a.name_translations ?? {})) {
        (foodTranslations[lang] ??= {})[codes[a.code]] = String(label);
      }; const workspace: Workspace = workspaceSchema.parse({ languages: LANGUAGES, defaultLanguage: 'it', menus, foodTranslations, translationSettings: { protectedNames: [r.name], glossary: [] }, design: branding(r), pdf: { translationActive: true, includeUnavailable: true } }); return { sourceId: r.id, restaurantId: tenant, name: r.name, slug: r.slug, workspace, raw: { restaurant: r, menus: sourceMenus, categories: cats, dishes, formulas: rows('lunch_menu_formulas').filter(f => sourceMenus.some(m => m.id === f.menu_section_id)) } };
  }); return { restaurants, mappings, warnings, counts: { restaurants: restaurants.length, sourceMenus: rows('menu_sections').length, sourceCategories: rows('categories').length, sourceDishes: rows('dishes').length, itemPlacements: mappings.filter(m => m.kind === 'item').length, uniqueSourceDishIds: new Set(mappings.filter(m => m.kind === 'item').map(m => m.sourceId)).size, formulas: rows('lunch_menu_formulas').length }, raw: source };
}
