// Piano di ristrutturazione dei menu (decisione 14/10/2026): menu fisso = "Menu" + "Drinks" (+ "Colazione" in testa se ci sono prodotti da colazione);
// proposta diversa a pranzo e cena = "Pranzo" + "Cena" + "Drinks". Niente menu vuoti, eventi passati,
// doppioni o bevande dentro il menu del cibo.
// Ogni destinazione: {name,type,keep:<menu esistente di cui conservare id/orari>,from:[[menu,sezioni|'*',{wrap,except}]]}.
// drop: sezioni eliminate con i loro piatti (elencati nel report), solo con motivo.
const food = (keep, from, extra = {}) => ({ name: 'Menu', type: 'main', keep, from, ...extra })
const drinks = (keep, from) => ({ name: 'Drinks', type: 'drinks', keep, from })
// Regola COLAZIONE (16/10/2026): brioches/cornetti/croissant, french toast, pancake, bagel e uova da brunch,
// pasticceria da banco del mattino MAI in "Menu": menu dedicato "Colazione", type 'main', sempre primo
// (restructure lo mette in testa e blocca il piano se una sezione da colazione resta altrove; vedi breakfast.mjs).
// keep può essere null: il menu viene creato. La caffetteria resta nei Drinks e (16/10/2026) viene anche copiata,
// con id nuovi, in "Colazione / Caffetteria" (restructure; disattivabile con breakfastCoffee:false nel piano).
const breakfast = (keep, from) => ({ name: 'Colazione', type: 'main', keep, from })
export const plans = {
  'Sahara Lounge': { targets: [food('Cena', [['Cena', '*'], ["NARGHILE'", '*', { wrap: 'Narghilè' }]]), drinks('Drinks', [['Drinks', '*', { except: ['DOLCI'] }]])], drop: [['Drinks', 'DOLCI', 'doppione dei Dolci già nel menu, senza allergeni']] },
  'Patanegra': { targets: [food('Pranzo', [['Pranzo', '*']])] },
  'La Plaza': { targets: [food('Cena', [['Cena', '*'], ['CAFFETTERIA', ['PASTICCERIA', 'GELATO']]]), drinks('Drinks', [['Drinks', '*'], ['CAFFETTERIA', ['CAFFETTERIA']]])] },
  'ZIO ARMANDO': { targets: [food('Cena', [['Cena', '*']])], rename: { 'PZZE SPECIAL': 'PIZZE SPECIAL' } },
  'Victoria Bar': { targets: [food('Cena', [['Cena', '*']]), drinks('Drinks', [['Drinks', '*']])] },
  "Panuzza's": { targets: [{ name: 'Pranzo', type: 'lunch', keep: 'Pranzo', from: [['Pranzo', '*']] }, { name: 'Cena', type: 'dinner', keep: 'Cena', from: [['Cena', '*']] }, drinks('Drinks', [['Drinks', '*']])] },
  'San Galdino': { targets: [food('Cena', [['Cena', '*']]), drinks('Drinks', [['Drinks', '*']])] },
  'Pesce & Farina': { targets: [food('Cena', [['Cena', '*']]), drinks('BIBITE', [['BIBITE', '*']])] },
  'Pupos Pizza': { targets: [food('Cena', [['Cena', '*', { except: ['Carta dei vini'] }]]), drinks('Drinks', [['Drinks', '*'], ['Cena', ['Carta dei vini']]])] },
  "L'Osterietta": { targets: [{ name: 'Pranzo', type: 'lunch', keep: 'Pranzo', from: [['Pranzo', '*'], ['MENÙ DOMENICALE', '*', { wrap: 'Menù domenicale' }]] }, { name: 'Cena', type: 'dinner', keep: 'Cena', from: [['Cena', '*']] }, drinks('Drinks', [['Drinks', '*']])] },
  'LA BOTTEGA DEL GUSTO': { targets: [{ name: 'Pranzo', type: 'lunch', keep: 'Pranzo', from: [['Pranzo', '*']] }, { name: 'Cena', type: 'dinner', keep: 'CUCINA', from: [['LO CHEF CONSIGLIA', '*', { wrap: 'Lo chef consiglia' }], ['CUCINA', '*'], ['PIZZERIA', '*'], ['DESSERT', '*']] }, drinks('Drinks', [['Drinks', '*'], ['CAFFE E AMARI', '*']])] },
  'Bim Bum Bar': { targets: [food('Cena', [['Cena', '*']]), drinks('Drinks', [['Drinks', '*']])] },
  'Il Poeta': { targets: [food('Cena', [['Cena', '*']]), drinks('Drinks', [['Drinks', '*']])] },
  'La Bakery no bakery. ': { targets: [breakfast(null, [['Cena', ['French toast', 'French toast salato', 'Bagel']]]), food('Cena', [['Cena', '*', { except: ['Bevande', 'French toast', 'French toast salato', 'Bagel'] }]]), drinks('Drinks', [['Cena', ['Bevande']]])] },
  'ClanDestino': { targets: [food('Cena', [['Cena', '*', { except: ['Bevande', 'Caffetteria'] }]]), drinks('Drinks', [['Cena', ['Bevande', 'Caffetteria']]])] },
  'PortoFranco': { targets: [{ name: 'Pranzo', type: 'lunch', keep: 'Pranzo', from: [['Pranzo', '*']] }, { name: 'Cena', type: 'dinner', keep: 'Cena', from: [['Cena', '*']] }, drinks('Drinks', [['Drinks', '*']])] },
  "L'AGORA": { targets: [{ name: 'Pranzo', type: 'lunch', keep: 'Pranzo', from: [['Pranzo', '*']] }, { name: 'Cena', type: 'dinner', keep: 'Cena', from: [['Cena', '*', { except: ['Caffetteria'] }], ['PIZZE', '*']] }, drinks('Drinks', [['Drinks', '*']])], drop: [['Cena', 'Caffetteria', 'identica alla Caffetteria già nei Drinks']] },
  'RISTORANTE GAUGUIN': { targets: [food('CUCINA', [['CUCINA', '*'], ['PIZZERIA', '*']]), drinks('BEVERAGE', [['BEVERAGE', '*']])] },
  'THE LAB': { targets: [food('Cena', [['Cena', ['PINSE', 'RIPIEGHI', 'FRITTI', 'DOLCINI']]]), drinks('Drinks', [['Cena', ['NEGRONI ADDICTED', 'COCKTAIL', 'LOW-ALCOL', 'Bevande', 'DISTILLATI']]])] },
  'DA ORI': {
    targets: [breakfast(null, [['CAFFETTERIA', ['Brioches']]]), food('CUCINA', [['CUCINA', '*'], ['PINSE, PANINI E TOAST', '*'], ['INSALATONE', '*'], ['APERITIVO', '*', { wrap: 'Aperitivo e apericena' }], ['CAFFETTERIA', ['Dolci']], ['EVENTI', ['FUORI MENU']]]), drinks('Drinks', [['Drinks', '*'], ['CAFFETTERIA', ['Caffè e Succhi', 'Amari e Liquori', 'Distillati Rum', 'Distillati Whisky']]])],
    drop: [['EVENTI', 'Festa del Cioccolato - Venerdì 9 Ottobre', 'evento del 9 ottobre, già passato'], ['EVENTI', 'Eventi Letterari', 'presentazione del 1 ottobre, già passata (sezione inattiva)'], ['EVENTI', 'SAN VALENTINO', 'sezione inattiva con un solo piatto nascosto'], ['EVENTI', 'EVENTI MUSICALI', 'sezione inattiva con un solo concerto nascosto, senza data'], ['Pranzo', '*', 'menu inattivo con due soli piatti nascosti, sezioni vuote']],
  },
  'TAPPA FISSA': { targets: [food('Cena', [['Cena', '*']])] },
}

// Secondo passaggio (solo nomi, sui dati già ristrutturati): node scripts/menu-structure/apply.mjs --plan=rename --apply
export const renamePlans = {
  'Pupos Pizza': { targets: [food('Menu', [['Menu', '*']]), drinks('Drinks', [['Drinks', '*']])], rename: { 'Le Classiche': 'Pizze classiche', 'Le Gourmet': 'Pizze gourmet', 'La Special': 'Pizza special' } },
}
