// Arricchimento del menu demo per la VETRINA di vendita (visite ai ristoratori).
//
// Cosa fa, in modo IDEMPOTENTE (rilanciabile senza duplicare nulla):
//   1. corregge i piatti a prezzo 0 e un refuso in descrizione
//   2. riempie le descrizioni mancanti (contorni, bevande, birre, vini)
//   3. aggiunge le varianti dove sono naturali (pizze, vino, birra alla spina)
//   4. imposta il costo ingredienti (cost_price) → food cost e menu engineering
//      hanno numeri veri da mostrare invece di zeri
//   5. scrive le traduzioni EN/DE/FR/ES in menu_item_translations
//      (i nomi dei piatti italiani restano in italiano — è così che funziona un
//       menu vero; a tradursi sono le descrizioni e i nomi generici)
//   6. accende le lingue nelle impostazioni del ristorante
//
// Uso:
//   DATABASE_URL='postgresql://tako:tako@127.0.0.1:54317/takodb' node seed-demo-vetrina.mjs
//   (54317 = Postgres embedded dell'app pacchettizzata; 5432 = pg-portable di dev)
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://tako:tako@127.0.0.1:54317/takodb')

const LANGS = ['en', 'de', 'fr', 'es']

// nome italiano → { price?, desc?, cost, variants?, en/de/fr/es: [nome, descrizione] }
// cost = costo ingredienti stimato (€). Volutamente vario: le pizze hanno food
// cost basso, le carni alto → la matrice del menu engineering mostra 4 quadranti
// veri e non una nuvola piatta.
const D = {
  'Bruschetta al pomodoro': {
    cost: 1.1,
    en: ['Bruschetta al pomodoro', 'Toasted bread, cherry tomatoes, garlic, basil and extra virgin olive oil'],
    de: ['Bruschetta al pomodoro', 'Geröstetes Brot, Kirschtomaten, Knoblauch, Basilikum und natives Olivenöl'],
    fr: ['Bruschetta al pomodoro', 'Pain grillé, tomates cerises, ail, basilic et huile d’olive vierge extra'],
    es: ['Bruschetta al pomodoro', 'Pan tostado, tomates cherry, ajo, albahaca y aceite de oliva virgen extra'],
  },
  'Tagliere di salumi e formaggi': {
    cost: 4.8,
    en: ['Cured meats and cheese board', 'Selection of cured meats, mixed cheeses and honey'],
    de: ['Wurst- und Käseplatte', 'Auswahl an Aufschnitt, gemischtem Käse und Honig'],
    fr: ['Planche de charcuterie et fromages', 'Sélection de charcuteries, fromages variés et miel'],
    es: ['Tabla de embutidos y quesos', 'Selección de embutidos, quesos variados y miel'],
  },
  'Burrata pugliese': {
    cost: 3.2,
    en: ['Burrata pugliese', 'Fresh 125g burrata with confit cherry tomatoes and basil'],
    de: ['Burrata pugliese', 'Frische Burrata (125 g) mit konfierten Kirschtomaten und Basilikum'],
    fr: ['Burrata pugliese', 'Burrata fraîche 125 g, tomates cerises confites et basilic'],
    es: ['Burrata pugliese', 'Burrata fresca de 125 g con tomates cherry confitados y albahaca'],
  },
  'Polpette al sugo': {
    cost: 2.0,
    en: ['Polpette al sugo', 'Beef meatballs in tomato sauce'],
    de: ['Polpette al sugo', 'Rindfleischbällchen in Tomatensauce'],
    fr: ['Polpette al sugo', 'Boulettes de bœuf à la sauce tomate'],
    es: ['Polpette al sugo', 'Albóndigas de ternera en salsa de tomate'],
  },
  'Frittura di calamari': {
    cost: 4.2,
    en: ['Fried calamari', 'Fresh fried squid with tartar sauce'],
    de: ['Frittierte Calamari', 'Frisch frittierte Tintenfischringe mit Sauce tartare'],
    fr: ['Friture de calamars', 'Calamars frais frits, sauce tartare'],
    es: ['Fritura de calamares', 'Calamares frescos fritos con salsa tártara'],
  },

  // Pizze: variante Normale / Maxi (+3)
  'Margherita': {
    cost: 1.4, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Margherita', 'Tomato, fiordilatte mozzarella, basil'],
    de: ['Margherita', 'Tomate, Fiordilatte-Mozzarella, Basilikum'],
    fr: ['Margherita', 'Tomate, mozzarella fiordilatte, basilic'],
    es: ['Margherita', 'Tomate, mozzarella fiordilatte, albahaca'],
  },
  'Marinara': {
    cost: 0.9, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Marinara', 'Tomato, garlic, oregano, extra virgin olive oil'],
    de: ['Marinara', 'Tomate, Knoblauch, Oregano, natives Olivenöl'],
    fr: ['Marinara', 'Tomate, ail, origan, huile d’olive vierge extra'],
    es: ['Marinara', 'Tomate, ajo, orégano, aceite de oliva virgen extra'],
  },
  'Napoli': {
    cost: 1.9, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Napoli', 'Tomato, mozzarella, anchovies, capers, oregano'],
    de: ['Napoli', 'Tomate, Mozzarella, Sardellen, Kapern, Oregano'],
    fr: ['Napoli', 'Tomate, mozzarella, anchois, câpres, origan'],
    es: ['Napoli', 'Tomate, mozzarella, anchoas, alcaparras, orégano'],
  },
  'Diavola': {
    cost: 2.1, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Diavola', 'Tomato, mozzarella, spicy salami'],
    de: ['Diavola', 'Tomate, Mozzarella, scharfe Salami'],
    fr: ['Diavola', 'Tomate, mozzarella, salami piquant'],
    es: ['Diavola', 'Tomate, mozzarella, salami picante'],
  },
  'Capricciosa': {
    cost: 2.9, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Capricciosa', 'Tomato, mozzarella, cooked ham, mushrooms, artichokes, olives'],
    de: ['Capricciosa', 'Tomate, Mozzarella, Kochschinken, Champignons, Artischocken, Oliven'],
    fr: ['Capricciosa', 'Tomate, mozzarella, jambon blanc, champignons, artichauts, olives'],
    es: ['Capricciosa', 'Tomate, mozzarella, jamón cocido, champiñones, alcachofas, aceitunas'],
  },
  'Quattro formaggi': {
    cost: 2.7, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Quattro formaggi', 'Mozzarella, gorgonzola, fontina, parmesan'],
    de: ['Quattro formaggi', 'Mozzarella, Gorgonzola, Fontina, Parmesan'],
    fr: ['Quattro formaggi', 'Mozzarella, gorgonzola, fontina, parmesan'],
    es: ['Quattro formaggi', 'Mozzarella, gorgonzola, fontina, parmesano'],
  },
  'Quattro stagioni': {
    cost: 2.9, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Quattro stagioni', 'Tomato, mozzarella, mushrooms, artichokes, ham, olives'],
    de: ['Quattro stagioni', 'Tomate, Mozzarella, Champignons, Artischocken, Schinken, Oliven'],
    fr: ['Quattro stagioni', 'Tomate, mozzarella, champignons, artichauts, jambon, olives'],
    es: ['Quattro stagioni', 'Tomate, mozzarella, champiñones, alcachofas, jamón, aceitunas'],
  },
  'Bufalina': {
    cost: 2.8, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Bufalina', 'Tomato, buffalo mozzarella, basil, extra virgin olive oil'],
    de: ['Bufalina', 'Tomate, Büffelmozzarella, Basilikum, natives Olivenöl'],
    fr: ['Bufalina', 'Tomate, mozzarella de bufflonne, basilic, huile d’olive vierge extra'],
    es: ['Bufalina', 'Tomate, mozzarella de búfala, albahaca, aceite de oliva virgen extra'],
  },
  'Tartufata': {
    cost: 4.4, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Tartufata', 'Truffle cream, mozzarella, porcini mushrooms, grana cheese flakes'],
    de: ['Tartufata', 'Trüffelcreme, Mozzarella, Steinpilze, Grana-Späne'],
    fr: ['Tartufata', 'Crème de truffe, mozzarella, cèpes, copeaux de grana'],
    es: ['Tartufata', 'Crema de trufa, mozzarella, boletus, virutas de grana'],
  },
  'Ortolana': {
    cost: 2.6, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Ortolana', 'Tomato, mozzarella, grilled seasonal vegetables'],
    de: ['Ortolana', 'Tomate, Mozzarella, gegrilltes Saisongemüse'],
    fr: ['Ortolana', 'Tomate, mozzarella, légumes grillés de saison'],
    es: ['Ortolana', 'Tomate, mozzarella, verduras de temporada a la parrilla'],
  },
  'Crudo e bufala': {
    cost: 4.1, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Crudo e bufala', 'White base, buffalo mozzarella, Parma ham, rocket, grana cheese'],
    de: ['Crudo e bufala', 'Weiße Basis, Büffelmozzarella, Rohschinken, Rucola, Grana'],
    fr: ['Crudo e bufala', 'Base blanche, mozzarella de bufflonne, jambon cru, roquette, grana'],
    es: ['Crudo e bufala', 'Base blanca, mozzarella de búfala, jamón crudo, rúcula, grana'],
  },
  'Salsiccia e friarielli': {
    cost: 3.3, variants: [['Normale', 0], ['Maxi', 3]],
    en: ['Salsiccia e friarielli', 'White base, mozzarella, sausage, Neapolitan broccoli rabe'],
    de: ['Salsiccia e friarielli', 'Weiße Basis, Mozzarella, Bratwurst, neapolitanischer Stängelkohl'],
    fr: ['Salsiccia e friarielli', 'Base blanche, mozzarella, saucisse, brocolis-rave napolitains'],
    es: ['Salsiccia e friarielli', 'Base blanca, mozzarella, salchicha, grelos napolitanos'],
  },

  'Spaghetti alle vongole': {
    cost: 4.6,
    en: ['Spaghetti alle vongole', 'Spaghetti, clams, garlic, parsley, white wine'],
    de: ['Spaghetti alle vongole', 'Spaghetti, Venusmuscheln, Knoblauch, Petersilie, Weißwein'],
    fr: ['Spaghetti alle vongole', 'Spaghettis, palourdes, ail, persil, vin blanc'],
    es: ['Spaghetti alle vongole', 'Espaguetis, almejas, ajo, perejil, vino blanco'],
  },
  'Pasta gamberetti e pomodorini': {
    cost: 4.3,
    en: ['Prawn and cherry tomato pasta', 'Fresh pasta, prawns, cherry tomatoes, parsley'],
    de: ['Pasta mit Garnelen und Kirschtomaten', 'Frische Pasta, Garnelen, Kirschtomaten, Petersilie'],
    fr: ['Pâtes aux crevettes et tomates cerises', 'Pâtes fraîches, crevettes, tomates cerises, persil'],
    es: ['Pasta con gambas y tomates cherry', 'Pasta fresca, gambas, tomates cherry, perejil'],
  },
  'Lasagna alla bolognese': {
    cost: 3.0,
    en: ['Lasagna alla bolognese', 'Pasta sheets, meat ragù, béchamel, parmesan'],
    de: ['Lasagne alla bolognese', 'Pastateig, Fleischragù, Béchamel, Parmesan'],
    fr: ['Lasagnes à la bolognaise', 'Pâte, ragù de viande, béchamel, parmesan'],
    es: ['Lasaña a la boloñesa', 'Láminas de pasta, ragú de carne, bechamel, parmesano'],
  },
  'Risotto ai funghi porcini': {
    cost: 3.4,
    en: ['Porcini mushroom risotto', 'Carnaroli rice, porcini mushrooms, grana cheese'],
    de: ['Steinpilz-Risotto', 'Carnaroli-Reis, Steinpilze, Grana'],
    fr: ['Risotto aux cèpes', 'Riz Carnaroli, cèpes, grana'],
    es: ['Risotto de boletus', 'Arroz Carnaroli, boletus, grana'],
  },
  'Gnocchi al pomodoro e basilico': {
    cost: 2.1,
    en: ['Gnocchi with tomato and basil', 'Potato gnocchi, tomato, basil'],
    de: ['Gnocchi mit Tomate und Basilikum', 'Kartoffelgnocchi, Tomate, Basilikum'],
    fr: ['Gnocchis tomate-basilic', 'Gnocchis de pomme de terre, tomate, basilic'],
    es: ['Ñoquis con tomate y albahaca', 'Ñoquis de patata, tomate, albahaca'],
  },

  'Tagliata di manzo': {
    cost: 7.6,
    en: ['Sliced beef steak', 'Sirloin, rocket, grana cheese flakes, balsamic reduction'],
    de: ['Aufgeschnittenes Rindersteak', 'Roastbeef, Rucola, Grana-Späne, Balsamico-Reduktion'],
    fr: ['Tagliata de bœuf', 'Faux-filet, roquette, copeaux de grana, réduction balsamique'],
    es: ['Tagliata de ternera', 'Solomillo bajo, rúcula, virutas de grana, reducción de balsámico'],
  },
  'Grigliata mista di carne': {
    cost: 6.8,
    en: ['Mixed grilled meat', 'Sausage, ribs, chicken, grilled vegetables'],
    de: ['Gemischte Grillplatte', 'Bratwurst, Rippchen, Hähnchen, gegrilltes Gemüse'],
    fr: ['Grillade mixte de viandes', 'Saucisse, travers de porc, poulet, légumes grillés'],
    es: ['Parrillada mixta de carne', 'Salchicha, costillas, pollo, verduras a la parrilla'],
  },
  'Frittura mista di pesce': {
    cost: 6.2,
    en: ['Mixed fried seafood', 'Squid, prawns, battered vegetables'],
    de: ['Gemischte Fischfrittüre', 'Tintenfisch, Garnelen, Gemüse im Teigmantel'],
    fr: ['Friture mixte de poisson', 'Calamars, crevettes, légumes en beignet'],
    es: ['Fritura mixta de pescado', 'Calamares, gambas, verduras rebozadas'],
  },
  'Cotoletta alla milanese': {
    cost: 4.9,
    en: ['Cotoletta alla milanese', 'Breaded veal cutlet with fries'],
    de: ['Cotoletta alla milanese', 'Paniertes Kalbsschnitzel mit Pommes'],
    fr: ['Cotoletta alla milanese', 'Escalope de veau panée avec frites'],
    es: ['Cotoletta alla milanese', 'Escalope de ternera empanada con patatas fritas'],
  },

  'Patatine fritte': {
    cost: 0.8, desc: 'Patate fritte croccanti, servite calde',
    en: ['French fries', 'Crispy fries, served hot'],
    de: ['Pommes frites', 'Knusprige Pommes, heiß serviert'],
    fr: ['Frites', 'Frites croustillantes, servies chaudes'],
    es: ['Patatas fritas', 'Patatas fritas crujientes, servidas calientes'],
  },
  'Insalata mista': {
    cost: 1.0,
    en: ['Mixed salad', 'Lettuce, tomato, carrots, sweetcorn'],
    de: ['Gemischter Salat', 'Blattsalat, Tomate, Karotten, Mais'],
    fr: ['Salade mixte', 'Salade, tomate, carottes, maïs'],
    es: ['Ensalada mixta', 'Lechuga, tomate, zanahoria, maíz'],
  },
  'Verdure grigliate': {
    price: 5.0, cost: 1.5,
    en: ['Grilled vegetables', 'Courgettes, aubergines, peppers'],
    de: ['Gegrilltes Gemüse', 'Zucchini, Auberginen, Paprika'],
    fr: ['Légumes grillés', 'Courgettes, aubergines, poivrons'],
    es: ['Verduras a la parrilla', 'Calabacín, berenjena, pimientos'],
  },

  'Tiramisù': {
    cost: 1.3,
    en: ['Tiramisù', 'Ladyfingers, mascarpone, coffee, cocoa'],
    de: ['Tiramisù', 'Löffelbiskuits, Mascarpone, Kaffee, Kakao'],
    fr: ['Tiramisù', 'Boudoirs, mascarpone, café, cacao'],
    es: ['Tiramisú', 'Bizcochos de soletilla, mascarpone, café, cacao'],
  },
  'Panna cotta': {
    price: 5.0, cost: 1.1,
    en: ['Panna cotta', 'With berry coulis or caramel sauce'],
    de: ['Panna cotta', 'Mit Waldbeersauce oder Karamell'],
    fr: ['Panna cotta', 'Coulis de fruits rouges ou caramel'],
    es: ['Panna cotta', 'Con coulis de frutos rojos o caramelo'],
  },
  'Cannolo siciliano': {
    cost: 1.2,
    en: ['Sicilian cannolo', 'Crisp shell, ricotta, chocolate chips'],
    de: ['Sizilianisches Cannolo', 'Knusprige Waffelrolle, Ricotta, Schokostückchen'],
    fr: ['Cannolo sicilien', 'Coque croustillante, ricotta, pépites de chocolat'],
    es: ['Cannolo siciliano', 'Barquillo crujiente, ricotta, pepitas de chocolate'],
  },
  'Tortino al cioccolato': {
    price: 6.0, cost: 1.4, desc: 'Cuore caldo di cioccolato fondente',
    en: ['Chocolate lava cake', 'Warm dark chocolate centre'],
    de: ['Schokoladenküchlein', 'Warmer Kern aus Zartbitterschokolade'],
    fr: ['Moelleux au chocolat', 'Cœur coulant de chocolat noir'],
    es: ['Coulant de chocolate', 'Corazón caliente de chocolate negro'],
  },

  'Acqua naturale 0,5L': {
    cost: 0.2, desc: 'Bottiglia da 0,5 L',
    en: ['Still water 0.5L', '0.5 L bottle'],
    de: ['Stilles Wasser 0,5 L', 'Flasche 0,5 L'],
    fr: ['Eau plate 0,5 L', 'Bouteille de 0,5 L'],
    es: ['Agua sin gas 0,5 L', 'Botella de 0,5 L'],
  },
  'Acqua frizzante 0,5L': {
    cost: 0.2, desc: 'Bottiglia da 0,5 L',
    en: ['Sparkling water 0.5L', '0.5 L bottle'],
    de: ['Sprudelwasser 0,5 L', 'Flasche 0,5 L'],
    fr: ['Eau gazeuse 0,5 L', 'Bouteille de 0,5 L'],
    es: ['Agua con gas 0,5 L', 'Botella de 0,5 L'],
  },
  'Coca-Cola / Fanta / Sprite 0,33L': {
    cost: 0.7, desc: 'Lattina da 0,33 L',
    en: ['Coca-Cola / Fanta / Sprite 0.33L', '0.33 L can'],
    de: ['Coca-Cola / Fanta / Sprite 0,33 L', 'Dose 0,33 L'],
    fr: ['Coca-Cola / Fanta / Sprite 0,33 L', 'Canette de 0,33 L'],
    es: ['Coca-Cola / Fanta / Sprite 0,33 L', 'Lata de 0,33 L'],
  },
  'Succhi di frutta': {
    cost: 0.6, desc: 'Pesca, albicocca, ananas, ACE',
    en: ['Fruit juices', 'Peach, apricot, pineapple, ACE'],
    de: ['Fruchtsäfte', 'Pfirsich, Aprikose, Ananas, ACE'],
    fr: ['Jus de fruits', 'Pêche, abricot, ananas, ACE'],
    es: ['Zumos de fruta', 'Melocotón, albaricoque, piña, ACE'],
  },
  'Caffè espresso': {
    cost: 0.25, desc: 'Miscela arabica della casa',
    en: ['Espresso', 'House arabica blend'],
    de: ['Espresso', 'Hauseigene Arabica-Mischung'],
    fr: ['Espresso', 'Mélange arabica maison'],
    es: ['Café espresso', 'Mezcla arábica de la casa'],
  },

  'Birra bionda alla spina 0,4L': {
    cost: 1.1, desc: 'Lager chiara alla spina', variants: [['Piccola 0,2L', -1.5], ['Media 0,4L', 0]],
    en: ['Draught lager 0.4L', 'Pale lager on tap'],
    de: ['Helles vom Fass 0,4 L', 'Helles Lagerbier vom Fass'],
    fr: ['Bière blonde pression 0,4 L', 'Lager blonde à la pression'],
    es: ['Cerveza rubia de barril 0,4 L', 'Lager rubia de barril'],
  },
  'Moretti 0,66L': {
    cost: 1.3, desc: 'Bottiglia da 0,66 L',
    en: ['Moretti 0.66L', '0.66 L bottle'],
    de: ['Moretti 0,66 L', 'Flasche 0,66 L'],
    fr: ['Moretti 0,66 L', 'Bouteille de 0,66 L'],
    es: ['Moretti 0,66 L', 'Botella de 0,66 L'],
  },
  'Birra artigianale IPA 0,33L': {
    cost: 2.2, desc: 'IPA di micro-birrificio, luppolata',
    en: ['Craft IPA 0.33L', 'Hoppy microbrewery IPA'],
    de: ['Craft-IPA 0,33 L', 'Hopfenbetontes IPA aus der Kleinbrauerei'],
    fr: ['IPA artisanale 0,33 L', 'IPA houblonnée de micro-brasserie'],
    es: ['IPA artesanal 0,33 L', 'IPA lupulada de microcervecería'],
  },

  'Vino della casa rosso/bianco 0,5L': {
    cost: 1.6, desc: 'Sfuso della casa, rosso o bianco',
    variants: [['Calice', -3.5], ['Mezzo litro', 0], ['Litro', 4]],
    en: ['House wine red/white 0.5L', 'House wine, red or white'],
    de: ['Hauswein rot/weiß 0,5 L', 'Offener Hauswein, rot oder weiß'],
    fr: ['Vin de la maison rouge/blanc 0,5 L', 'Vin de la maison, rouge ou blanc'],
    es: ['Vino de la casa tinto/blanco 0,5 L', 'Vino de la casa, tinto o blanco'],
  },
  'Chianti DOCG (bottiglia)': {
    cost: 6.5, desc: 'Sangiovese toscano, bottiglia 0,75 L',
    en: ['Chianti DOCG (bottle)', 'Tuscan Sangiovese, 0.75 L bottle'],
    de: ['Chianti DOCG (Flasche)', 'Toskanischer Sangiovese, 0,75-l-Flasche'],
    fr: ['Chianti DOCG (bouteille)', 'Sangiovese toscan, bouteille de 0,75 L'],
    es: ['Chianti DOCG (botella)', 'Sangiovese toscano, botella de 0,75 L'],
  },
  'Prosecco (bottiglia)': {
    cost: 5.5, desc: 'Extra dry, bottiglia 0,75 L',
    en: ['Prosecco (bottle)', 'Extra dry, 0.75 L bottle'],
    de: ['Prosecco (Flasche)', 'Extra dry, 0,75-l-Flasche'],
    fr: ['Prosecco (bouteille)', 'Extra dry, bouteille de 0,75 L'],
    es: ['Prosecco (botella)', 'Extra dry, botella de 0,75 L'],
  },
}

// Traduzione dei nomi di sezione (la PWA le mostra come intestazioni).
const SEZIONI = {
  'ANTIPASTI': { en: 'STARTERS', de: 'VORSPEISEN', fr: 'ENTRÉES', es: 'ENTRANTES' },
  'PIZZE CLASSICHE': { en: 'CLASSIC PIZZAS', de: 'KLASSISCHE PIZZEN', fr: 'PIZZAS CLASSIQUES', es: 'PIZZAS CLÁSICAS' },
  'PIZZE SPECIALI': { en: 'SPECIALITY PIZZAS', de: 'SPEZIAL-PIZZEN', fr: 'PIZZAS SPÉCIALES', es: 'PIZZAS ESPECIALES' },
  'PRIMI': { en: 'FIRST COURSES', de: 'ERSTE GÄNGE', fr: 'ENTRÉES DE PÂTES', es: 'PRIMEROS' },
  'SECONDI': { en: 'MAIN COURSES', de: 'HAUPTGÄNGE', fr: 'PLATS', es: 'SEGUNDOS' },
  'CONTORNI': { en: 'SIDES', de: 'BEILAGEN', fr: 'ACCOMPAGNEMENTS', es: 'GUARNICIONES' },
  'DOLCI': { en: 'DESSERTS', de: 'DESSERTS', fr: 'DESSERTS', es: 'POSTRES' },
  'BEVANDE': { en: 'DRINKS', de: 'GETRÄNKE', fr: 'BOISSONS', es: 'BEBIDAS' },
  'BIRRE': { en: 'BEERS', de: 'BIERE', fr: 'BIÈRES', es: 'CERVEZAS' },
  'VINI': { en: 'WINES', de: 'WEINE', fr: 'VINS', es: 'VINOS' },
}

const rep = { prezzi: 0, descrizioni: 0, costi: 0, varianti: 0, traduzioni: 0, sezioni: 0, mancanti: [] }

const items = await sql`select i.id, i.name, i.description, i.price, i.restaurant_id from menu_items i`

for (const it of items) {
  const d = D[it.name]
  if (!d) { rep.mancanti.push(it.name); continue }

  if (d.price != null && Number(it.price) !== d.price) {
    await sql`update menu_items set price = ${d.price}, updated_at = now() where id = ${it.id}`
    rep.prezzi++
  }
  const desc = d.desc ?? null
  if (desc && (!it.description || it.description.trim() === '')) {
    await sql`update menu_items set description = ${desc}, updated_at = now() where id = ${it.id}`
    rep.descrizioni++
  }
  // refuso nel dato originale: "fatta con uova" su un tortino
  if (it.description && /fatta con uova/i.test(it.description)) {
    await sql`update menu_items set description = ${d.desc ?? it.description.replace(/\s*fatta con uova/i, '')}, updated_at = now() where id = ${it.id}`
    rep.descrizioni++
  }

  if (d.cost != null) {
    await sql`update menu_items set cost_price = ${d.cost}, updated_at = now() where id = ${it.id}`
    rep.costi++
  }

  for (const [vName, vMod] of d.variants ?? []) {
    const [ex] = await sql`select id from item_variants where item_id = ${it.id} and name = ${vName} limit 1`
    if (ex) continue
    await sql`insert into item_variants (item_id, name, price_modifier, available) values (${it.id}, ${vName}, ${vMod}, true)`
    rep.varianti++
  }

  for (const lang of LANGS) {
    const t = d[lang]
    if (!t) continue
    await sql`
      insert into menu_item_translations (restaurant_id, item_id, lang, name, description)
      values (${it.restaurant_id}, ${it.id}, ${lang}, ${t[0]}, ${t[1] ?? null})
      on conflict (item_id, lang) do update set name = excluded.name, description = excluded.description, updated_at = now()`
    rep.traduzioni++
  }
}

// Nomi di sezione tradotti (colonna jsonb name_translations su menu_sections)
for (const [nome, tr] of Object.entries(SEZIONI)) {
  const r = await sql`update menu_sections set name_translations = ${sql.json(tr)} where name = ${nome}`
  rep.sezioni += r.count
}

// Lingue attive nelle impostazioni del ristorante
const [rest] = await sql`select id, settings from restaurants limit 1`
const s = { ...(rest.settings ?? {}) }
s.languages = ['it', 'en', 'de', 'fr', 'es']
s.defaultLanguage = 'it'
await sql`update restaurants set settings = ${sql.json(s)} where id = ${rest.id}`

console.log('--- VETRINA DEMO ---')
console.log('prezzi corretti    :', rep.prezzi)
console.log('descrizioni        :', rep.descrizioni)
console.log('costi ingredienti  :', rep.costi)
console.log('varianti create    :', rep.varianti)
console.log('traduzioni scritte :', rep.traduzioni)
console.log('sezioni tradotte   :', rep.sezioni)
console.log('lingue attive      :', s.languages.join(', '))
if (rep.mancanti.length) console.log('piatti senza mappatura:', rep.mancanti.join(' | '))

await sql.end()
