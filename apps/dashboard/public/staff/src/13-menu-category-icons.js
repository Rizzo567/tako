/* Icone delle categorie (Piatti), 14/10/2026.
   Stile del set della dashboard (Lucide: viewBox 24, tratto arrotondato, colore del testo), tratto 1.7 come l'ingranaggio della riga.
   Scelta: si normalizza il nome (minuscole, senza accenti, & → e) e vince la parola chiave che compare PRIMA nel nome
   («Pinse e apericena» → pinsa, «Caffè & Amari» → caffè); a parità di posizione vale l'ordine delle regole.
   «di pesce/di mare» trasforma antipasti e secondi in pesce. Nessuna corrispondenza → cloche neutra (fallback). */
const MW_CAT_ICON_PATHS={
 pizza:'M12 21 3.5 6.5A17 17 0 0 1 20.5 6.5ZM5.3 9.6A14 14 0 0 1 18.7 9.6M9 12.5a1 1 0 1 0 2 0 1 1 0 0 0-2 0M13 15.5a1 1 0 1 0 2 0 1 1 0 0 0-2 0M13.5 11.5h.01',
 pinsa:'M3 12c0-3.3 4-6 9-6s9 2.7 9 6-4 6-9 6-9-2.7-9-6ZM9 10.5h.01M14.5 10h.01M11.5 14h.01M16 13.5h.01M7.5 13.5h.01',
 burger:'M4 10.5C4 6.4 7.6 4 12 4s8 2.4 8 6.5ZM3 13.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1M4 16.5h16v.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3ZM10 7.5h.01M14 7.5h.01',
 sandwich:'M3 11a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3ZM3 13.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1M3 16h18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z',
 wrap:'M3 16.5a9 9 0 0 1 18 0ZM7 16.5a5 5 0 0 1 10 0M10 12.5h.01M14 12.5h.01',
 toast:'M6 21V10.6A4 4 0 0 1 8 3h8a4 4 0 0 1 2 7.6V21ZM9.5 15.5l5-5M9.5 11l2-2M12.5 17.5l2-2',
 bread:'M3 15.5a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM8 11.5l1.5 2.5M12 11v3M16 11.5 14.5 14',
 pasta:'M3 12h18a9 8 0 0 1-18 0ZM9.5 20h5M7 12c.6-2.6 2.6-4 5-4s4.4 1.4 5 4M16.5 3v5.5M15 3v2a1.5 1.5 0 0 0 3 0V3',
 soup:'M3 11h18a9 8 0 0 1-18 0ZM9.5 19h5M8.5 7.5c-.8-.8.8-1.7 0-2.5M12 7.5c-.8-.8.8-1.7 0-2.5M15.5 7.5c-.8-.8.8-1.7 0-2.5',
 meat:'M4 12.5C4 7.8 8 4 13 4c4.4 0 7 2.6 7 6 0 2.4-1.4 4-3.2 5.1-1.5.9-2.2 2.2-2.8 3.7-.5 1.3-1.8 2.2-3.5 2.2C7 21 4 17.3 4 12.5ZM8 12.5C8 10 10 8 13 8M13 12.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0',
 fish:'M6.5 12c1-3.5 5-6 8.5-6s6 2.5 7 6c-1 3.5-3.5 6-7 6s-7.5-2.5-8.5-6ZM7 10.7C7 8 5.6 6 2.7 5.5c-1 1.5-1 5 .3 6.5-1.3 1.5-1.3 5-.3 6.5C5.6 18 7 16 7 13.3M18 11.5h.01',
 sushi:'M4 8a8 3 0 0 1 16 0v8a8 3 0 0 1-16 0ZM4 8a8 3 0 0 0 16 0M9.5 8a2.5 1 0 0 0 5 0',
 poke:'M3 12h18a9 8 0 0 1-18 0ZM9.5 20h5M6.5 11a1.5 1.5 0 0 1 3 0M10.5 11a1.5 1.5 0 0 1 3 0M17 3l-3.5 7.5M21 4.5l-5 5.5',
 antipasti:'M4 20 19.5 4.5M6.3 15.5a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 0 0-4.4 0M11.3 10.5a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 0 0-4.4 0M18 3l3 3',
 cheese:'M3 11 14 5l7 6v8H3ZM3 11h18M7 15a1 1 0 1 0 2 0 1 1 0 0 0-2 0M14 15.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0',
 fries:'M6 10h12l-1.5 11h-9ZM8 10 7 4M11 10V3M14 10l1-6M17 10l1.5-4.5M7.5 14h9',
 salad:'M3 12h18a9 8 0 0 1-18 0ZM9.5 20h5M7 12c0-3 2-5.5 5-5.5M12 12c0-4 2.5-6.5 6-6.5-.2 3-1.8 5.4-4 6.5',
 carrot:'M2.3 21.7s9.9-3.5 12.7-6.4a4.5 4.5 0 0 0-6.4-6.4C5.8 11.8 2.3 21.7 2.3 21.7ZM8.6 14l-2-2M15.3 15l-2.4-2.5M22 9s-1.3-2-3.5-2C16.9 7 15 9 15 9s1.3 2 3.5 2S22 9 22 9ZM15 2s-2 1.3-2 3.5S15 9 15 9s2-1.8 2-3.5C17 3.3 15 2 15 2Z',
 vegan:'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10ZM2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12',
 mushroom:'M3 12.5a9 7.5 0 0 1 18 0ZM9 12.5v6a3 3 0 0 0 6 0v-6M8 8.5h.01M12 6.5h.01M16 8.5h.01',
 cake:'M4 21v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8M2.5 21h19M4 16c1.3 0 1.3 1 2.7 1s1.3-1 2.6-1 1.4 1 2.7 1 1.3-1 2.7-1 1.3 1 2.6 1 1.4-1 2.7-1M12 11V8M12 6a1.2 1.2 0 0 0 .1-2.6c-1 .8-1.2 2-.1 2.6Z',
 icecream:'M7 11l5 11 5-11M6.5 11h11M7 11a5 5 0 0 1 10 0M9.5 15h5',
 apple:'M12 7.5c-1.5-1-5-1.5-6.5 1.5S5 16.5 8 20c1.3 1.5 2.5 1.6 4 .8 1.5.8 2.7.7 4-.8 3-3.5 4-8 2.5-11S13.5 6.5 12 7.5ZM12 7.5c0-2 1-3.5 2.5-4.5',
 coffee:'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 10h1.5a2.5 2.5 0 0 1 0 5H17M3 21.5h16M8 6c-.7-.7.7-1.8 0-2.5M12 6c-.7-.7.7-1.8 0-2.5',
 tea:'M5 10h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6ZM17 12.5l3.5-3M5 11.5H3.8a1.8 1.8 0 0 0 0 3.6h1.6M8 10a3 3 0 0 1 6 0M11 7V5.5',
 croissant:'M2.5 17c0-6 4.3-10 9.5-10s9.5 4 9.5 10c-1.5-1.2-3.3-1.6-5-1.2-1.4-.4-2.8-.5-4.5-.5s-3.1.1-4.5.5c-1.7-.4-3.5 0-5 1.2ZM8.5 8.2l-1 7.6M12 7v8.5M15.5 8.2l1 7.6',
 brunch:'M12 3c4 0 8 2 8 6.5 0 3-2 3.5-2 6S16 21 12 21s-8-2-8-5.5c0-2.5 2-4 2-6S8 3 12 3ZM9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0',
 wine:'M8 2.5h8l.5 5.5a4.5 4.5 0 0 1-9 0ZM12 12.5v8.5M8.5 21h7M7.8 6.5h8.4',
 champagne:'M9.5 2.5h5l-.5 8.5a2 2 0 0 1-4 0ZM12 13v8M9 21h6M10 6.5h4M17 4.5h.01M18 8h.01M16.8 11h.01',
 beer:'M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2ZM15 10.5h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M5 8a2.5 2.5 0 0 1 2-4.2 3 3 0 0 1 5 0A2.5 2.5 0 0 1 15 8M8.5 11.5v6M11.5 11.5v6',
 cocktail:'M3 4h18l-9 9ZM12 13v8M8 21h8M10 7.5a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 0 0-2.6 0M12.5 6.8 16 2.5',
 spirits:'M4.5 6h15L18 20a1.5 1.5 0 0 1-1.5 1.3h-9A1.5 1.5 0 0 1 6 20ZM5.6 12h12.8M8.5 14.5h3v3h-3ZM13.2 15.2l2.4-1 1 2.4-2.4 1Z',
 soda:'M6 8l1.8 12.3A2 2 0 0 0 9.8 22h4.4a2 2 0 0 0 2-1.7L18 8M5 8h14M7 15a6.5 6.5 0 0 1 5 0 6.5 6.5 0 0 0 5 0M12 8l1-6h2',
 water:'M12 3c3.5 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.5 6-11ZM9 14.5a3 3 0 0 0 3 3',
 mocktail:'M6 7h11l-1.3 13.2a1.5 1.5 0 0 1-1.5 1.3H8.8a1.5 1.5 0 0 1-1.5-1.3ZM6.4 11.5h10.2M17 7c0-2.3 1.7-4 4-4 0 2.3-1.7 4-4 4Z',
 aperitivo:'M6 4h10c.7 1.4 1 2.6 1 4a6 6 0 0 1-12 0c0-1.4.3-2.6 1-4ZM11 14v7M7.5 21h7M5.3 8h11.4M16.5 4.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0',
 kids:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 10.5h.01M15 10.5h.01M9 14.5a4 4 0 0 0 6 0M11 3.1c-.5 1.6.6 2.9 2 2.4',
 hookah:'M9.5 3h5l-1 3h-3ZM12 6v4M12 10c-3 1-4.5 3-4.5 5.5a4.5 4.5 0 0 0 9 0c0-2.5-1.5-4.5-4.5-5.5ZM16.5 15c2.6 0 4.5 1.6 4.5 4.5M10 21h4',
 formula:'M9 3h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1ZM9 10h6M9 14h6M9 18h3',
 chef:'M6 14a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 6.6 3.1A4 4 0 0 1 18 14ZM6 14v7h12v-7M6 17.5h12',
 star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z',
 plus:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v8M8 12h8',
 info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 16v-4.5M12 8h.01',
 utensils:'M4 2.5v6.5a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V2.5M7.5 2.5v19M20 15V2.5a5 5 0 0 0-5 5V13a2 2 0 0 0 2 2h3Zm0 0v6.5',
 fallback:'M4 17a8 8 0 0 1 16 0ZM2.5 20h19M12 9V6.5M10.5 6.5h3'
};
/* Centratura ottica: spostamento del disegno (misurato col riquadro getBBox) perché il baricentro cada al centro della colonna. */
const MW_CAT_ICON_SHIFT={sandwich:[0,-1.5],bread:[0,-1.5],mushroom:[0,-1.3],icecream:[0,-2],champagne:[-1.5,0],spirits:[0,-1.7],mocktail:[-1.5,0],aperitivo:[-1.3,0],hookah:[-2.3,0],fallback:[0,-1.3]};
const MW_CAT_RULES=[
 ['kids',/bambin|\bkids?\b|junior|piccol|\bbaby\b|children/],
 ['hookah',/narghil|shisha|sheesha|hookah|tabacc/],
 ['vegan',/vegan|vegetarian|veggie|plant based|senza glutine|gluten free/],
 ['sushi',/sushi|uramaki|hosomaki|nigiri|sashimi|temaki|gunkan|\bmaki\b|giappones|japanese/],
 ['poke',/\bpoke\b|\bbowls?\b/],
 ['mocktail',/analcolic|non alcolic|no alcohol|alcohol free|alcol free|zero alcol|low alcol|senza alcol|mocktail|\bvirgin\b/],
 ['cocktail',/cocktail|gin tonic|negroni|spritz|mojito|mixolog|long drink|martini|margarita|\bsour\b/],
 ['aperitivo',/aperitiv|apericen|happy hour/],
 ['champagne',/bollicin|spumant|champagne|prosecco|franciacort|frizzant|\bbolle\b|sparkling|metodo classico/],
 ['wine',/\bvin[io]\b|\bvini\b|wine|calic|cantina|\bbianchi\b|\brossi\b|\brose\b|rosat|bottigli|barrique/],
 ['beer',/birr|\bbeers?\b|\bspina\b|\bipa\b|\blager\b|weiss/],
 ['spirits',/distillat|superalcol|whisk|\brum\b|grapp|cognac|brandy|vodka|tequila|mezcal|\bgin\b|\bamar[oi]\b|liquor|digestiv|dopo ?pasto|dopocena|bourbon|scotch|calvados|limoncell/],
 ['tea',/\bte\b|\bthe\b|\btea\b|tisan|infus|\bchai\b/],
 ['coffee',/\bcaff|coffee|espresso|cappuccin/],
 ['water',/\bacqu[ae]\b|\bwater\b|minerale/],
 ['soda',/bibit|bevand|soft drink|\bsoda\b|succh|\bjuices?\b|spremut|\bdrinks?\b|frullat|smoothie/],
 ['icecream',/gelat|ice ?cream|sorbett|granit|semifredd|frozen yogurt/],
 ['cake',/\bdolc|dessert|\bsweet|\btort[ae]\b|tiramis|cheesecake|pasticc|biscott|crostat/],
 ['apple',/frutta|\bfruits?\b|macedon/],
 ['brunch',/brunch|\buov[ao]\b|\beggs?\b/],
 ['toast',/toast|\bclub\b/],
 ['croissant',/colazion|breakfast|brioch|cornett|croissant/],
 ['pinsa',/\bpins[ae]\b/],
 ['pizza',/pizz|tranci|calzon|ripieg|al metro/],
 ['burger',/(ham)?burger/],
 ['wrap',/piadin|\bwraps?\b|kebab|kebap|\btacos?\b|\btacoz\b|burrit/],
 ['sandwich',/panin|sandwich|sfilatin|bagel|tramezz|focaccin/],
 ['bread',/focacc|bruschett|crostin|\bpane\b|\bbread\b/],
 ['soup',/zupp|minestr|vellutat|\bsoups?\b|\bbrodo\b/],
 ['pasta',/\bprim[io]\b|\bpasta\b|risott|gnocch|raviol|lasagn|spaghett|tagliatell|tortell/],
 ['fish',/pesce|\bmare\b|\bfish\b|seafood|\bcrud|ostric|tartare|carpacc|baccal|salmon/],
 ['meat',/\bsecond[io]\b|\bcarn[ei]\b|\bmeat\b|griglia|\bgrill|bistecc|\bsteak|\btagliata\b/],
 ['antipasti',/antipast|starter|appetizer|stuzzich|taglier|salumi/],
 ['cheese',/formagg|cheese|latticin/],
 ['fries',/fritt|sfizios|\bfries\b|patatin|\bchips\b|crocchett|arancin/],
 ['salad',/insalat|salad/],
 ['carrot',/contorn|verdur|vegetable|\bsides?\b/],
 ['mushroom',/fungh|porcin|tartuf|mushroom/],
 ['chef',/fuori menu|\bchef\b|\bcucina\b|specialita|della casa|consiglia/],
 ['star',/special|deluxe|luxury|premium|gourmet|signature/],
 ['formula',/formul|\bmenu\b|degustazion|piatto unico|propost|pranzo|\blunch\b|domenical|\bfisso\b|\bcombo\b|tasting|del giorno/],
 ['plus',/^ extra\b|aggiunt|supplement|\badd ons?\b|topping/],
 ['utensils',/copert|\bservizio\b|cover charge/],
 ['info',/^ (info|informazion|allergen|note)\b/]
];
function MW_CATEGORY_NORMALIZE(name){return ' '+String(name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' e ').replace(/[^a-z0-9]+/g,' ').trim()+' ';}
function MW_CATEGORY_ICON_KEY(name){
 const n=MW_CATEGORY_NORMALIZE(name);let best=null;
 for(const [key,re] of MW_CAT_RULES){const m=re.exec(n);if(m&&(!best||m.index<best.index))best={key,index:m.index};}
 if(best&&(best.key==='antipasti'||best.key==='meat')&&/pesce|\bmare\b|\bfish\b|seafood|\bcrud/.test(n))return 'fish';
 return best?best.key:'fallback';
}
function MenuCatalogCategoryIcon({name}){const key=MW_CATEGORY_ICON_KEY(name);return <span className="mw-cat-icon" data-icon={key} aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d={MW_CAT_ICON_PATHS[key]} transform={MW_CAT_ICON_SHIFT[key]?`translate(${MW_CAT_ICON_SHIFT[key].join(' ')})`:undefined}/></svg></span>;}
window.TakoCategoryIcons={normalize:MW_CATEGORY_NORMALIZE,key:MW_CATEGORY_ICON_KEY,paths:MW_CAT_ICON_PATHS,shift:MW_CAT_ICON_SHIFT};
