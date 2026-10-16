import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=(await readFile('apps/dashboard/public/staff/src/13-menu-category-icons.js','utf8')).split('\n').filter(l=>!l.startsWith('function MenuCatalogCategoryIcon')&&!l.startsWith('window.')).join('\n');
const {key,paths,shift,rules}=new Function(src+';return {key:MW_CATEGORY_ICON_KEY,paths:MW_CAT_ICON_PATHS,shift:MW_CAT_ICON_SHIFT,rules:MW_CAT_RULES}')();
test('category icon matches normalized names, earliest keyword wins, fish qualifier, neutral fallback',()=>{
 const cases={'Pizze':'pizza','PINSE':'pinsa','Pinse e apericena':'pinsa','Panini e Piadine':'sandwich','Piadine arrotolate':'wrap','SMASH BURGER':'burger','I Primi Di Mare':'pasta','Secondi di pesce':'fish','Secondi di carne':'meat','Antipasti di mare':'fish','LE CRUDITÈ':'fish','FRITTI & SFIZIOSITÀ':'fries','Insalatone':'salad','Contorni':'carrot','Dolci e Frutta':'cake','GELATO':'icecream','Caffetteria':'coffee','Brioches':'croissant','Vini Rossi':'wine','BOLLICINE':'champagne','Birre alla Spina':'beer','Gin Tonic':'cocktail','Amari e Liquori':'spirits','BIBITE E ACQUA':'soda','Acqua':'water','ANALCOLICI':'mocktail','No - Alcohol Drinks':'mocktail','Per i Più Piccoli':'kids','OPZIONE VEGANA':'vegan','Sushi':'sushi','Poke bowl':'poke','Formule':'formula','MENU DEL GIORNO':'formula','Narghilè':'hookah','APERITIVO':'aperitivo','Brunch':'brunch','Toast':'toast','TÈ MAROCCHINO':'tea','Coperto':'utensils','Classico':'fallback','':'fallback'};
 for(const [name,expected] of Object.entries(cases))assert.equal(key(name),expected,name);
 for(const k of new Set(Object.values(cases)))assert.ok(paths[k],k);
 for(const k of Object.keys(shift))assert.ok(paths[k],k);
 for(const [k] of rules)assert.ok(paths[k],'icona mancante per la regola '+k);assert.ok(paths.fallback);
});
