// Workspace di esempio che imita Victoria migrata al menu «a prezzo fisso» (21/10). Usato dai test PDF e
// per provare scripts/pdf-compare-victoria.mjs (node tests/fixtures/victoria-fixed-workspace.mjs > ws.json).
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const item = (n, name, price, extra = {}) => ({ id: id(n), name, price, translations: {}, variants: [], allergens: [], tags: [], additives: [], available: true, ...extra })
const section = (n, name, items, extra = {}) => ({ id: id(n), name, active: true, translations: {}, items, ...extra })
export const VICTORIA_IDS = {
 carta: id(1), drinks: id(2), pranzo: id(3), cena: id(4),
 pranzoPrimi: id(31), pranzoSecondi: id(32), pranzoContorni: id(33),
 cenaPrimi: id(41), cenaSecondi: id(42), cenaContorni: id(43), cenaDolci: id(44),
}
const I = VICTORIA_IDS, included = '¼ di vino oppure ½ l d\'acqua + caffè'
export function victoriaFixedWorkspace() {
 return {
  languages: ['it'], defaultLanguage: 'it',
  pdf: { showQr: false, showLogo: false },
  menus: [
   { id: I.carta, name: 'Alla carta', type: 'main', active: true, translations: {}, sections: [
    section(11, 'Antipasti di mare', [item(111, 'Bruschetta Victoria', 8, { description: 'pomodorini e gamberetti' }), item(112, 'Impepata di cozze', 10)]),
    section(12, 'Primi piatti', [item(121, 'Linguine allo scoglio', 16), item(122, 'Spaghetti alla carbonara', 10)]),
   ] },
   { id: I.drinks, name: 'Bevande', type: 'drinks', active: true, translations: {}, sections: [
    section(21, 'Bevande', [item(211, 'Birra media alla spina', 5.5), item(212, 'Acqua 1 L', 3)]),
   ] },
   { id: I.pranzo, name: 'Menu pranzo', type: 'lunch', active: true, translations: {}, pricing: 'fisso', included,
    formulas: [{ id: id(301), name: 'Completo', price: 12, note: 'primo + secondo con contorno', sectionIds: [I.pranzoPrimi, I.pranzoSecondi, I.pranzoContorni], translations: {} }],
    sections: [
     section(31, 'Primi', [item(3101, 'Pasta al pomodoro', 7), item(3102, 'Risotto ai funghi', 0)]),
     section(32, 'Secondi', [item(3201, 'Scaloppine al limone', 9.5)]),
     section(33, 'Contorni', [item(3301, 'Patatine fritte', 4)]),
    ] },
   { id: I.cena, name: 'Menu cena', type: 'dinner', active: true, translations: {}, pricing: 'fisso', included,
    formulas: [
     { id: id(401), name: 'Completo', price: 16.9, note: 'primo + secondo con contorno', sectionIds: [I.cenaPrimi, I.cenaSecondi, I.cenaContorni], translations: {} },
     { id: id(402), name: 'Solo primo', price: 9, note: null, sectionIds: [I.cenaPrimi], translations: {} },
     { id: id(403), name: 'Solo secondo', price: 10, note: 'con contorno', sectionIds: [I.cenaSecondi, I.cenaContorni], translations: {} },
    ],
    sections: [
     section(41, 'Primi', [item(4101, 'Gnocchi alla sorrentina', 11)]),
     section(42, 'Secondi', [item(4201, 'Tagliata rucola e grana', 20)]),
     section(43, 'Contorni', [item(4301, 'Insalata mista', 4)]),
     section(44, 'Dolci', [item(4401, 'Tiramisù della casa', 5)]),
    ] },
  ],
 }
}
if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(JSON.stringify(victoriaFixedWorkspace(), null, 1) + '\n')
