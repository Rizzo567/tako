// Prepared integration for the original MenuSmart project. No live redirects enabled.
export const ENABLED_SLUGS = Object.freeze([]);
export const DESTINATIONS = Object.freeze({
  "l-osterietta-1": "https://takoitalia.com/r/6febb754-f7c9-5b42-adf1-a890f7894cfa/menu",
  "la-plaza": "https://takoitalia.com/r/430e082a-9d32-550e-a3ca-cc49a0876e82/menu",
  "portofranco": "https://takoitalia.com/r/ce60ff85-57da-577d-aa39-aed9016d3ac8/menu",
  "pupos-pizza": "https://takoitalia.com/r/6fb9e9c4-1ca7-50dc-afa5-1d8c79aeb019/menu",
  "l-agora": "https://takoitalia.com/r/d4eeeb77-30d5-5287-ad8b-63a96ee3d815/menu",
  "il-poeta": "https://takoitalia.com/r/91bb150e-42a0-5aea-ab58-3175bb33d3e9/menu",
  "la-bakery-no-bakery": "https://takoitalia.com/r/9a875d3c-36fe-5b13-aae5-0e268ce2507f/menu",
  "pesce-farina": "https://takoitalia.com/r/6047c131-32cd-5eca-a2ea-5f893b6fe1cf/menu",
  "la-bottega-del-gusto": "https://takoitalia.com/r/76beef6e-0356-570c-accc-14c52f4569e8/menu",
  "clandestino": "https://takoitalia.com/r/c86825fa-cf52-5f7e-a06b-0db7e39a849d/menu",
  "da-ori": "https://takoitalia.com/r/f1b13a69-b94f-5e8a-a381-3177a1b97728/menu",
  "sahara-lounge": "https://takoitalia.com/r/21c6a07d-e5bd-5762-a8cf-70c5bbd53ed4/menu",
  "patanegra": "https://takoitalia.com/r/2464d428-d5a2-579b-a79c-8e3df8f13137/menu",
  "bim-bum-bar": "https://takoitalia.com/r/84fe4d77-2d87-5187-aa94-9c01840e99de/menu",
  "ristorante-gauguin": "https://takoitalia.com/r/e4cadb75-fe32-542c-a06f-b9941095d391/menu",
  "the-lab": "https://takoitalia.com/r/ee92e6be-6953-5d95-a764-8d8e447892fc/menu",
  "san-galdino": "https://takoitalia.com/r/5f01b318-bbb9-4aaf-9c0e-d318eec98919/menu",
  "zio-armando": "https://takoitalia.com/r/492b6760-6d34-53f1-a280-4a4a8cead501/menu",
  "tappa-fissa": "https://takoitalia.com/r/ff3491b6-d220-56b5-a43f-7f049e93b7fa/menu"
});
const hosts = new Set(['menusmart.it', 'www.menusmart.it', 'clever-menu-co.lovable.app']);
const languages = new Set(['it','en','fr','de','es','pt','nl','pl','ru','ar','zh','ja']);
export function resolveMenuMigration(href, enabledSlugs = ENABLED_SLUGS) {
  try {
    const source = new URL(href);
    if(source.protocol !== 'https:' || !hosts.has(source.hostname) || source.port || source.username || source.password) return null;
    const match = source.pathname.match(/^\/menu\/([^/]+)\/?$/);
    if(!match) return null;
    const slug = decodeURIComponent(match[1]);
    if(!enabledSlugs.includes(slug) || !Object.hasOwn(DESTINATIONS,slug)) return null;
    const target = new URL(DESTINATIONS[slug]);
    if(target.origin !== 'https://takoitalia.com' || !/^\/r\/[0-9a-f-]{36}\/menu$/.test(target.pathname)) return null;
    const lang=source.searchParams.get('lang');
    if(languages.has(lang))target.searchParams.set('lang',lang);
    return target.toString();
  } catch { return null; }
}
