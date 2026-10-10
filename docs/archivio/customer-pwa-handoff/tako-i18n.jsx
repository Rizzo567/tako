// tako-i18n.jsx — per-iframe UI translations driven by the ?lang= param (it|en|es|de).
// IMPORTANT: only DISPLAY is translated. Cart/order data keeps the canonical Italian
// item.name, so orders posted to the dashboard always arrive in Italian.
(function () {
  const LANG = (window.LANG) || 'it';

  // ── UI chrome strings (include 'it' originals) ──
  const UI = {
    table:            { it: 'Tavolo', en: 'Table', es: 'Mesa', de: 'Tisch' },
    viewCart:         { it: 'Vedi carrello', en: 'View cart', es: 'Ver carrito', de: 'Warenkorb ansehen' },
    soldOut:          { it: 'Esaurito', en: 'Sold out', es: 'Agotado', de: 'Ausverkauft' },
    add:              { it: 'Aggiungi', en: 'Add', es: 'Añadir', de: 'Hinzufügen' },
    added:            { it: 'aggiunto', en: 'added', es: 'añadido', de: 'hinzugefügt' },
    allergens:        { it: 'Allergeni', en: 'Allergens', es: 'Alérgenos', de: 'Allergene' },
    choosePortion:    { it: 'Scegli la porzione', en: 'Choose your portion', es: 'Elige la ración', de: 'Portion wählen' },
    included:         { it: 'incluso', en: 'included', es: 'incluido', de: 'inklusive' },
    kitchenNotes:     { it: 'Note per la cucina', en: 'Notes for the kitchen', es: 'Notas para la cocina', de: 'Anmerkungen für die Küche' },
    notesPh:          { it: 'Es. senza cipolla, ben cotto…', en: 'e.g. no onion, well done…', es: 'Ej. sin cebolla, muy hecho…', de: 'z. B. ohne Zwiebel, gut durch…' },
    filterTitle:      { it: 'Filtra per allergeni', en: 'Filter by allergens', es: 'Filtrar por alérgenos', de: 'Nach Allergenen filtern' },
    filterSub:        { it: 'Nascondi i piatti che li contengono', en: 'Hide dishes that contain them', es: 'Oculta los platos que los contienen', de: 'Gerichte ausblenden, die sie enthalten' },
    reset:            { it: 'Azzera', en: 'Reset', es: 'Borrar', de: 'Zurücksetzen' },
    showDishes:       { it: 'Mostra piatti', en: 'Show dishes', es: 'Mostrar platos', de: 'Gerichte anzeigen' },
    done:             { it: 'Fatto', en: 'Done', es: 'Hecho', de: 'Fertig' },
    hidingWith:       { it: 'Nascondo i piatti con', en: 'Hiding dishes with', es: 'Ocultando platos con', de: 'Blende Gerichte aus mit' },
    yourOrder:        { it: 'Il tuo ordine', en: 'Your order', es: 'Tu pedido', de: 'Deine Bestellung' },
    cartEmpty:        { it: 'Il carrello è vuoto', en: 'Your cart is empty', es: 'Tu carrito está vacío', de: 'Dein Warenkorb ist leer' },
    cartEmptySub:     { it: 'Aggiungi qualcosa di buono dal menù.', en: 'Add something tasty from the menu.', es: 'Añade algo rico del menú.', de: 'Füge etwas Leckeres aus dem Menü hinzu.' },
    backToMenu:       { it: 'Torna al menù', en: 'Back to menu', es: 'Volver al menú', de: 'Zurück zum Menü' },
    orderNotesPh:     { it: "Note per tutto l'ordine (es. portate insieme)", en: 'Notes for the whole order (e.g. bring together)', es: 'Notas para todo el pedido (ej. traer junto)', de: 'Anmerkungen zur Bestellung (z. B. zusammen servieren)' },
    total:            { it: 'Totale', en: 'Total', es: 'Total', de: 'Gesamt' },
    confirmOrder:     { it: 'Conferma ordine', en: 'Confirm order', es: 'Confirmar pedido', de: 'Bestellung bestätigen' },
    navMenu:          { it: 'Menù', en: 'Menu', es: 'Menú', de: 'Menü' },
    navOrder:         { it: 'Ordine', en: 'Order', es: 'Pedido', de: 'Bestellung' },
    navAssistant:     { it: 'Assistente', en: 'Assistant', es: 'Asistente', de: 'Assistent' },
    noActiveOrder:    { it: 'Nessun ordine attivo', en: 'No active order', es: 'Sin pedidos activos', de: 'Keine aktive Bestellung' },
    noActiveOrderSub: { it: 'Quando ordini, qui segui tutto in tempo reale.', en: 'Once you order, follow everything here in real time.', es: 'Cuando pidas, sigue todo aquí en tiempo real.', de: 'Sobald du bestellst, verfolgst du hier alles in Echtzeit.' },
    goToMenu:         { it: 'Vai al menù', en: 'Go to menu', es: 'Ir al menú', de: 'Zum Menü' },
    orderWord:        { it: 'Ordine', en: 'Order', es: 'Pedido', de: 'Bestellung' },
    summary:          { it: 'Riepilogo', en: 'Summary', es: 'Resumen', de: 'Übersicht' },
    notePre:          { it: 'Nota:', en: 'Note:', es: 'Nota:', de: 'Notiz:' },
    addMore:          { it: 'Aggiungi altro', en: 'Add more', es: 'Añadir más', de: 'Mehr hinzufügen' },
    language:         { it: 'Lingua', en: 'Language', es: 'Idioma', de: 'Sprache' },
    languageSub:      { it: 'Scegli la lingua del menù', en: 'Choose your menu language', es: 'Elige el idioma del menú', de: 'Sprache des Menüs wählen' },
    callWaiter:       { it: 'Chiama il cameriere', en: 'Call the waiter', es: 'Llamar al camarero', de: 'Kellner rufen' },
    waiterDone:       { it: 'Fatto!', en: 'Done!', es: '¡Hecho!', de: 'Fertig!' },
    waiterComing:     { it: 'arriviamo subito al tavolo', en: "we'll be right at table", es: 'llegamos enseguida a la mesa', de: 'wir kommen sofort an Tisch' },
    waiterHelp:       { it: 'Ho bisogno di aiuto', en: 'I need help', es: 'Necesito ayuda', de: 'Ich brauche Hilfe' },
    waiterHelpSub:    { it: 'Un cameriere arriva al tavolo', en: 'A waiter will come to your table', es: 'Un camarero vendrá a la mesa', de: 'Ein Kellner kommt an den Tisch' },
    waiterBill:       { it: 'Vorrei il conto', en: "I'd like the bill", es: 'Quiero la cuenta', de: 'Die Rechnung, bitte' },
    waiterBillSub:    { it: 'Prepariamo il conto del tavolo', en: "We'll prepare the table's bill", es: 'Preparamos la cuenta de la mesa', de: 'Wir bereiten die Rechnung vor' },
    waiterWater:      { it: 'Acqua, per favore', en: 'Water, please', es: 'Agua, por favor', de: 'Wasser, bitte' },
    waiterWaterSub:   { it: "Portiamo dell'acqua", en: "We'll bring some water", es: 'Traemos agua', de: 'Wir bringen Wasser' },
    toastOrderSent:   { it: 'Ordine inviato in cucina!', en: 'Order sent to the kitchen!', es: '¡Pedido enviado a la cocina!', de: 'Bestellung an die Küche gesendet!' },
    toastOrderReady:  { it: 'Il tuo ordine è pronto! 🛎️', en: 'Your order is ready! 🛎️', es: '¡Tu pedido está listo! 🛎️', de: 'Deine Bestellung ist fertig! 🛎️' },
  };

  // ── menu category names ──
  const CAT = {
    antipasti: { en: 'Starters', es: 'Entrantes', de: 'Vorspeisen' },
    primi:     { en: 'First courses', es: 'Primeros', de: 'Erste Gänge' },
    pizze:     { en: 'Pizzas', es: 'Pizzas', de: 'Pizzen' },
    dolci:     { en: 'Desserts', es: 'Postres', de: 'Desserts' },
    bevande:   { en: 'Drinks', es: 'Bebidas', de: 'Getränke' },
  };

  // ── item name overrides (iconic Italian dish names are kept; generics translated) ──
  const INAME = {
    i14: { en: 'Still water', es: 'Agua natural', de: 'Stilles Wasser' },
    i15: { en: 'Craft beer', es: 'Cerveza artesanal', de: 'Craft-Bier' },
    i16: { en: 'House wine', es: 'Vino de la casa', de: 'Hauswein' },
  };

  // ── item descriptions ──
  const IDESC = {
    i1:  { en: 'Toasted country bread, cherry tomatoes, basil and EVO oil.', es: 'Pan casero tostado, tomatitos, albahaca y AOVE.', de: 'Geröstetes Landbrot, Kirschtomaten, Basilikum und natives Olivenöl.' },
    i2:  { en: 'Beef meatballs in our slow ragù, served with crostini.', es: 'Albóndigas de ternera en nuestro ragú lento, con crostini.', de: 'Rindfleischbällchen in langsamem Ragù, mit Crostini serviert.' },
    i3:  { en: 'Apulian burrata, 18-month cured ham, focaccia.', es: 'Burrata de Apulia, jamón curado 18 meses, focaccia.', de: 'Burrata aus Apulien, 18 Monate gereifter Rohschinken, Focaccia.' },
    i4:  { en: 'Selection of local cured meats and cheeses, honey and preserves.', es: 'Selección de embutidos y quesos locales, miel y mermeladas.', de: 'Auswahl lokaler Wurst- und Käsesorten, Honig und Kompott.' },
    i5:  { en: 'Gragnano spaghetti, fresh clams, garlic, parsley.', es: 'Espaguetis de Gragnano, almejas frescas, ajo, perejil.', de: 'Gragnano-Spaghetti, frische Venusmuscheln, Knoblauch, Petersilie.' },
    i6:  { en: 'Creamy Carnaroli rice, fresh porcini, 24-month Parmigiano.', es: 'Arroz Carnaroli cremoso, boletus frescos, Parmigiano 24 meses.', de: 'Cremiger Carnaroli-Reis, frische Steinpilze, 24 Monate Parmigiano.' },
    i7:  { en: 'Egg pasta, meat ragù, béchamel. Just like home.', es: 'Pasta al huevo, ragú de carne, bechamel. Como en casa.', de: 'Eiernudelteig, Fleischragù, Béchamel. Wie zu Hause.' },
    i8:  { en: 'Potato gnocchi, Genoese pesto, green beans and potatoes.', es: 'Ñoquis de patata, pesto genovés, judías verdes y patata.', de: 'Kartoffel-Gnocchi, Genueser Pesto, grüne Bohnen und Kartoffeln.' },
    i9:  { en: 'San Marzano tomato, fiordilatte, basil, EVO oil.', es: 'Tomate San Marzano, fiordilatte, albahaca, AOVE.', de: 'San-Marzano-Tomate, Fiordilatte, Basilikum, Olivenöl.' },
    i10: { en: 'Tomato, fiordilatte, spicy Calabrian salami.', es: 'Tomate, fiordilatte, salami picante de Calabria.', de: 'Tomate, Fiordilatte, scharfe kalabrische Salami.' },
    i11: { en: 'Fiordilatte, gorgonzola, fontina, Parmigiano.', es: 'Fiordilatte, gorgonzola, fontina, Parmigiano.', de: 'Fiordilatte, Gorgonzola, Fontina, Parmigiano.' },
    i12: { en: 'Our family recipe: ladyfingers, mascarpone, coffee.', es: 'Receta de la familia: bizcochos de soletilla, mascarpone, café.', de: 'Familienrezept: Löffelbiskuits, Mascarpone, Kaffee.' },
    i13: { en: 'Silky panna cotta, mixed-berry coulis.', es: 'Panna cotta sedosa, coulis de frutos del bosque.', de: 'Seidige Panna cotta, Waldbeeren-Coulis.' },
    i14: { en: '0.75 L bottle.', es: 'Botella 0,75 L.', de: 'Flasche 0,75 L.' },
    i15: { en: 'Unfiltered blonde from the local brewery.', es: 'Rubia sin filtrar de la cervecería local.', de: 'Ungefiltertes Helles aus der lokalen Brauerei.' },
    i16: { en: 'Red or white, by the glass.', es: 'Tinto o blanco, por copa.', de: 'Rot oder weiß, im Glas.' },
  };

  // ── tags ──
  const TAG = {
    'Vegetariano':    { en: 'Vegetarian', es: 'Vegetariano', de: 'Vegetarisch' },
    'Consigliato':    { en: 'Recommended', es: 'Recomendado', de: 'Empfohlen' },
    'Da condividere': { en: 'To share', es: 'Para compartir', de: 'Zum Teilen' },
    'Novità':         { en: 'New', es: 'Novedad', de: 'Neu' },
    'Piccante':       { en: 'Spicy', es: 'Picante', de: 'Scharf' },
  };

  // ── order-tracking steps ──
  const STEP = {
    ricevuto:   { label: { en: 'Received', es: 'Recibido', de: 'Erhalten' },        desc: { en: 'We received your order', es: 'Hemos recibido tu pedido', de: 'Wir haben deine Bestellung erhalten' } },
    confermato: { label: { en: 'Confirmed', es: 'Confirmado', de: 'Bestätigt' },     desc: { en: 'The restaurant confirmed it', es: 'El restaurante lo ha confirmado', de: 'Das Restaurant hat sie bestätigt' } },
    in_cucina:  { label: { en: 'In the kitchen', es: 'En cocina', de: 'In der Küche' }, desc: { en: 'Your dishes are being prepared', es: 'Tus platos se están preparando', de: 'Deine Gerichte werden zubereitet' } },
    pronto:     { label: { en: 'Ready', es: 'Listo', de: 'Fertig' },                 desc: { en: 'Your order is ready', es: 'Tu pedido está listo', de: 'Deine Bestellung ist fertig' } },
    servito:    { label: { en: 'Served', es: 'Servido', de: 'Serviert' },            desc: { en: 'Enjoy your meal!', es: '¡Buen provecho!', de: 'Guten Appetit!' } },
  };

  // ── allergen labels ──
  const ALLG = {
    glutine:   { en: 'Gluten', es: 'Gluten', de: 'Gluten' },
    latte:     { en: 'Milk', es: 'Leche', de: 'Milch' },
    uova:      { en: 'Eggs', es: 'Huevos', de: 'Eier' },
    pesce:     { en: 'Fish', es: 'Pescado', de: 'Fisch' },
    molluschi: { en: 'Molluscs', es: 'Moluscos', de: 'Weichtiere' },
    arachidi:  { en: 'Peanuts', es: 'Cacahuetes', de: 'Erdnüsse' },
    soia:      { en: 'Soy', es: 'Soja', de: 'Soja' },
    noci:      { en: 'Tree nuts', es: 'Frutos secos', de: 'Schalenfrüchte' },
    sedano:    { en: 'Celery', es: 'Apio', de: 'Sellerie' },
    senape:    { en: 'Mustard', es: 'Mostaza', de: 'Senf' },
    sesamo:    { en: 'Sesame', es: 'Sésamo', de: 'Sesam' },
    lupini:    { en: 'Lupin', es: 'Altramuces', de: 'Lupinen' },
  };

  const pick = (obj) => (obj && obj[LANG] != null) ? obj[LANG] : undefined;

  function tr(key) { const e = UI[key]; if (!e) return key; return e[LANG] != null ? e[LANG] : e.it; }
  function trCat(id, fb) { return pick(CAT[id]) || fb || id; }
  function trName(it) { if (!it) return ''; return pick(INAME[it.id]) || it.name; }
  function trDesc(it) { if (!it) return ''; return pick(IDESC[it.id]) || it.desc; }
  function trTag(tag) { return pick(TAG[tag]) || tag; }
  function trStep(step) {
    const o = STEP[step.id];
    return o ? { label: pick(o.label) || step.label, desc: pick(o.desc) || step.desc } : { label: step.label, desc: step.desc };
  }
  function trAllg(id) {
    const m = (window.ALLERGEN_MAP && window.ALLERGEN_MAP[id]) ? window.ALLERGEN_MAP[id].label : id;
    return pick(ALLG[id]) || m;
  }
  function trLine(li) {
    const it = window.itemById && window.itemById(li.menuItemId);
    if (!it) return li.name;
    let base = trName(it);
    const sep = (li.name || '').indexOf(' · ');
    if (sep >= 0) base += li.name.slice(sep); // keep any (Italian) variant suffix
    return base;
  }

  Object.assign(window, { TAKO_LANG: LANG, tr, trCat, trName, trDesc, trTag, trStep, trAllg, trLine });
})();
