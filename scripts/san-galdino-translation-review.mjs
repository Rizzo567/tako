import {readFile,writeFile} from 'node:fs/promises';
const path='/Users/manuel/.config/tako-webapp/san-galdino-import/translated.json';const p=JSON.parse(await readFile(path));
const names={
'Tagliere misto di affettati con gnocco fritto':{fr:'Planche de charcuteries variées avec gnocco fritto',es:'Tabla de embutidos variados con gnocco fritto',pl:'Deska wędlin z gnocco fritto'},
'Panfocaccia con burro salato, acciughe e pomodorini secchi':{fr:'Panfocaccia au beurre salé, aux anchois et aux tomates séchées'},
'Risotto alla milanese con funghi porcini':{fr:'Risotto à la milanaise aux cèpes',es:'Risotto a la milanesa con boletus'},
'Risotto alla milanese con ossobuco':{fr:'Risotto à la milanaise avec osso-buco',es:'Risotto a la milanesa con osobuco'},
'Ravioli della casa con salsa di gorgonzola e cotechino':{fr:'Raviolis maison à la sauce au gorgonzola et au cotechino'},
'Tagliatelle al grano saraceno con funghi porcini e mirtilli':{en:'Buckwheat tagliatelle with porcini mushrooms and blueberries',fr:'Tagliatelles au sarrasin, aux cèpes et aux myrtilles',es:'Tagliatelle de trigo sarraceno con boletus y arándanos'},
'Nodino di vitello alla piastra':{fr:'Côte de veau grillée'},
'Guancia di manzo brasato con polenta':{fr:'Joue de bœuf braisée avec polenta'},
'Stufato di cinghiale con polenta':{en:'Wild boar stew with polenta',fr:'Ragoût de sanglier avec polenta',es:'Estofado de jabalí con polenta'},
'Tagliere di formaggi misti con miele':{en:'Mixed cheese board with honey',fr:'Plateau de fromages variés avec miel',es:'Tabla de quesos variados con miel',pl:'Deska różnych serów z miodem'},
'Tortino con cuore caldo al cioccolato fondente':{en:'Dark chocolate cake with a warm molten centre',fr:'Fondant au chocolat noir au cœur chaud',pl:'Ciastko z gorącym płynnym środkiem z ciemnej czekolady'},
'Torta brisèe con mele zucchero di canna e cannella':{en:'Shortcrust apple tart with brown sugar and cinnamon',fr:'Tarte aux pommes sur pâte brisée, au sucre de canne et à la cannelle',pl:'Tarta na kruchym cieście z jabłkami, cukrem trzcinowym i cynamonem'},
'Crostata alla marmellata di frutti di bosco':{fr:'Tarte à la confiture de fruits des bois'},
'Torta di nocciole bio del piemonte con salsa allo zabaione':{en:'Organic Piedmont hazelnut cake with zabaglione sauce',fr:'Gâteau aux noisettes biologiques du Piémont avec sauce au sabayon',pl:'Ciasto z ekologicznych orzechów laskowych z Piemontu z sosem zabaglione'},
'The freddo alla pesca o limone ml 500 ml':{fr:'Thé glacé à la pêche ou au citron 500 ml',de:'Pfirsich- oder Zitroneneistee 500 ml',es:'Té helado de melocotón o limón 500 ml',pt:'Chá gelado de pêssego ou limão 500 ml',pl:'Herbata mrożona brzoskwiniowa lub cytrynowa 500 ml'}
};
const desc={
'crudo di Parma, coppa piacentina, guanciale, mortadella con pistacchi e salame':{en:'Parma ham, Coppa Piacentina, guanciale, mortadella with pistachios and salami',fr:'Jambon de Parme, coppa de Plaisance, guanciale, mortadelle aux pistaches et salami',de:'Parmaschinken, Coppa Piacentina, Guanciale, Mortadella mit Pistazien und Salami',es:'Jamón de Parma, coppa de Piacenza, guanciale, mortadela con pistachos y salami',pt:'Presunto de Parma, coppa de Piacenza, guanciale, mortadela com pistácios e salame',nl:'Parmaham, Coppa Piacentina, guanciale, mortadella met pistachenoten en salami',pl:'Szynka parmeńska, coppa piacentina, guanciale, mortadela z pistacjami i salami'},
'grana padano, taleggio, gorgonzola dolce e piccante':{en:'Grana Padano, Taleggio, mild and strong Gorgonzola',fr:'Grana Padano, Taleggio, gorgonzola doux et corsé',de:'Grana Padano, Taleggio, milder und kräftiger Gorgonzola',es:'Grana Padano, Taleggio, gorgonzola suave y fuerte',pt:'Grana Padano, Taleggio, gorgonzola suave e intenso',nl:'Grana Padano, Taleggio, milde en pittige Gorgonzola',pl:'Grana Padano, Taleggio, łagodna i pikantna gorgonzola',zh:'Grana Padano、Taleggio、温和与浓烈的Gorgonzola奶酪',ja:'グラナ・パダーノ、タレッジョ、マイルドと辛口のゴルゴンゾーラ'},
'accompagnato con una pallina di gelato e salsa ai frutti di bosco':{en:'Served with a scoop of ice cream and berry sauce',fr:'Accompagné d’une boule de glace et d’un coulis de fruits des bois',de:'Serviert mit einer Kugel Eis und Waldbeerensauce',pt:'Acompanhado de uma bola de gelado e molho de frutos silvestres',nl:'Geserveerd met een bolletje ijs en bosvruchtensaus',pl:'Podawane z gałką lodów i sosem z owoców leśnych'},
'accompagnato con una pallina di gelato':{en:'Served with a scoop of ice cream',fr:'Accompagné d’une boule de glace',de:'Serviert mit einer Kugel Eis',pt:'Acompanhado de uma bola de gelado',nl:'Geserveerd met een bolletje ijs',pl:'Podawane z gałką lodów'},
'aperol o campari, prosecco, seltz':{fr:'Aperol ou Campari, prosecco, eau de Seltz',es:'Aperol o Campari, prosecco, agua de seltz'}
};
let reviewed=0;for(const r of p.restaurants)for(const m of r.workspace.menus)for(const s of m.sections)for(const i of s.items){for(const [l,name] of Object.entries(names[i.name]||{})){i.translations[l].name=name;reviewed++}for(const [l,description] of Object.entries(desc[i.description]||{})){i.translations[l].description=description;reviewed++}}
await writeFile(path,JSON.stringify(p),{mode:0o600});console.log(JSON.stringify({reviewedFields:reviewed}));
