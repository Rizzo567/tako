/* Dati finti: nessun locale reale. Orologio finto: venerdì 16/10/2026.
   Pranzo e Cena sono in modalità settimanale; Drinks è menu unico (niente pulsante Preset). */
(function () {
  const s = (name, items) => ({ name, items: items.map(([n, d, p]) => ({ name: n, desc: d, price: p })) });
  const pranzo = {
    lun: [s('Primi', [['Pasta e fagioli', 'Borlotti, rosmarino, olio a crudo', 9], ['Risotto alla zucca', 'Zucca mantovana, salvia', 11]]), s('Secondi', [['Pollo arrosto', 'Con patate al forno', 13], ['Frittata di verdure', 'Zucchine e cipollotto', 10]]), s('Dolci', [['Crostata di frutta', 'Frolla al burro', 5]])],
    mar: [s('Primi', [['Lasagna al ragù', 'Ragù cotto sei ore', 11], ['Minestrone', 'Verdure di stagione', 8]]), s('Secondi', [['Polpette al sugo', 'Manzo e pane raffermo', 12], ['Merluzzo al forno', 'Pomodorini e olive', 14]]), s('Dolci', [['Panna cotta', 'Caramello salato', 5]])],
    mer: [s('Primi', [['Gnocchi al pomodoro', 'Basilico fresco', 10], ['Orzotto ai funghi', 'Porcini e timo', 11]]), s('Secondi', [['Arista al latte', 'Con purè', 13], ['Caprese', 'Bufala campana', 9]]), s('Dolci', [['Tiramisù', 'Savoiardi e mascarpone', 6]])],
    gio: [s('Primi', [['Carbonara', 'Guanciale, pecorino, tuorlo', 11], ['Pasta alla Norma', 'Melanzane, ricotta salata', 10]]), s('Secondi', [['Saltimbocca alla romana', 'Vitello, prosciutto, salvia', 14], ['Insalata di farro', 'Ceci, pomodori, feta', 9]]), s('Dolci', [['Torta della nonna', 'Crema e pinoli', 5]])],
    ven: [s('Primi', [['Spaghetti alle vongole', 'Vongole veraci, prezzemolo', 14], ['Pasta e ceci', 'Ceci, rosmarino', 9]]), s('Secondi', [['Baccalà in umido', 'Pomodoro e olive', 15], ['Frittura mista', 'Calamari e gamberi', 16]]), s('Dolci', [['Cannolo', 'Ricotta di pecora', 5]])],
    sab: [s('Primi', [['Tagliatelle al ragù', 'Pasta fresca all’uovo', 12], ['Ravioli burro e salvia', 'Ripieno di ricotta', 12]]), s('Secondi', [['Tagliata di manzo', 'Rucola e grana', 18], ['Parmigiana', 'Melanzane fritte', 11]]), s('Dolci', [['Tiramisù', 'Savoiardi e mascarpone', 6]])],
    dom: [],
    pesce: [s('Primi', [['Linguine allo scoglio', 'Cozze, vongole, gamberi', 16]]), s('Secondi', [['Grigliata di pesce', 'Pescato del giorno', 19]]), s('Dolci', [['Sorbetto al limone', 'Limoni di Amalfi', 4]])]
  };
  const cena = {
    lun: [s('Antipasti', [['Tagliere misto', 'Salumi e formaggi', 14]]), s('Secondi', [['Filetto al pepe verde', 'Patate al forno', 22]])],
    mar: [s('Antipasti', [['Bruschette', 'Pomodoro e basilico', 7]]), s('Secondi', [['Branzino al sale', 'Verdure grigliate', 20]])],
    mer: [s('Antipasti', [['Burrata', 'Pomodorini confit', 10]]), s('Secondi', [['Ossobuco', 'Risotto allo zafferano', 21]])],
    gio: [s('Antipasti', [['Carpaccio di manzo', 'Rucola e grana', 12]]), s('Secondi', [['Costata', 'Per due, 1 kg', 48]])],
    ven: [s('Antipasti', [['Polpo e patate', 'Prezzemolo e limone', 13]]), s('Secondi', [['Fritto di paranza', 'Pescato locale', 18]])],
    sab: [s('Antipasti', [['Fiori di zucca', 'Ripieni di ricotta', 9]]), s('Secondi', [['Agnello a scottadito', 'Patate novelle', 19]])],
    dom: []
  };
  const days = [['lun', 'Lun', 'Lunedì'], ['mar', 'Mar', 'Martedì'], ['mer', 'Mer', 'Mercoledì'], ['gio', 'Gio', 'Giovedì'], ['ven', 'Ven', 'Venerdì'], ['sab', 'Sab', 'Sabato'], ['dom', 'Dom', 'Domenica']];
  const presets = (src, extra) => days.map(([id, short, long]) => ({ id, short, label: long, sections: src[id] })).concat(extra || []);
  window.PP_DATA = {
    today: 'ven',
    menus: [
      { id: 'pranzo', name: 'Pranzo', weekly: true, onlinePreset: 'gio', presets: presets(pranzo, [{ id: 'pesce', short: 'Venerdì pesce', label: 'Venerdì pesce', sections: pranzo.pesce }]) },
      { id: 'cena', name: 'Cena', weekly: true, onlinePreset: 'ven', presets: presets(cena) },
      { id: 'drinks', name: 'Drinks', weekly: false, onlinePreset: null, presets: [], current: [s('Bibite', [['Acqua naturale', '75 cl', 2], ['Coca-Cola', '33 cl', 3]]), s('Vini', [['Calice di rosso', 'Montepulciano', 5]])] }
    ]
  };
})();
