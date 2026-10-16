// Translate standard menu titles only; preserve custom and already translated names.
const titles=['cena','pranzo','drinks','menu','eventi','caffetteria','cucina','pinse panini e toast','insalatone','aperitivo','pizze','menu domenicale','lo chef consiglia','pizzeria','dessert','caffe e amari','bibite','narghile','colazione'];
const translations:Record<string,string[]>={
 en:['Dinner','Lunch','Drinks','Menu','Events','Coffee','Kitchen','Pinsa, sandwiches and toast','Salads','Aperitif','Pizza','Sunday menu',"Chef’s recommendations",'Pizzeria','Desserts','Coffee and digestifs','Soft drinks','Shisha','Breakfast'],
 fr:['Dîner','Déjeuner','Boissons','Menu','Événements','Café','Cuisine','Pinsas, sandwichs et toasts','Salades','Apéritif','Pizzas','Menu du dimanche','Suggestions du chef','Pizzeria','Desserts','Café et digestifs','Boissons sans alcool','Chicha','Petit-déjeuner'],
 de:['Abendessen','Mittagessen','Getränke','Speisekarte','Veranstaltungen','Kaffee','Küche','Pinsa, Sandwiches und Toast','Salate','Aperitif','Pizza','Sonntagsmenü','Empfehlungen des Küchenchefs','Pizzeria','Desserts','Kaffee und Digestifs','Alkoholfreie Getränke','Shisha','Frühstück'],
 es:['Cena','Almuerzo','Bebidas','Menú','Eventos','Cafetería','Cocina','Pinsas, bocadillos y tostadas','Ensaladas','Aperitivo','Pizzas','Menú del domingo','Recomendaciones del chef','Pizzería','Postres','Café y digestivos','Refrescos','Cachimba','Desayuno'],
 pt:['Jantar','Almoço','Bebidas','Menu','Eventos','Cafetaria','Cozinha','Pinsas, sanduíches e tostas','Saladas','Aperitivo','Pizzas','Menu de domingo','Sugestões do chef','Pizzaria','Sobremesas','Café e digestivos','Refrigerantes','Narguilé','Pequeno-almoço'],
 nl:['Diner','Lunch','Dranken','Menu','Evenementen','Koffie','Keuken','Pinsa, broodjes en toast','Salades','Aperitief','Pizza','Zondagsmenu','Aanbevelingen van de chef','Pizzeria','Desserts','Koffie en digestieven','Frisdranken','Shisha','Ontbijt'],
 pl:['Kolacja','Lunch','Napoje','Menu','Wydarzenia','Kawa','Kuchnia','Pinsa, kanapki i tosty','Sałatki','Aperitif','Pizza','Menu niedzielne','Polecenia szefa kuchni','Pizzeria','Desery','Kawa i alkohole po posiłku','Napoje bezalkoholowe','Szisza','Śniadanie'],
 ru:['Ужин','Обед','Напитки','Меню','События','Кофе','Кухня','Пинса, сэндвичи и тосты','Салаты','Аперитив','Пицца','Воскресное меню','Рекомендации шефа','Пиццерия','Десерты','Кофе и дижестивы','Безалкогольные напитки','Кальян','Завтрак'],
 ar:['العشاء','الغداء','المشروبات','القائمة','الفعاليات','القهوة','المطبخ','بينسا وسندويشات وتوست','السلطات','المقبلات والمشروبات','البيتزا','قائمة الأحد','توصيات الشيف','مطعم البيتزا','الحلويات','القهوة ومشروبات ما بعد الطعام','المشروبات الغازية','الشيشة','الإفطار'],
 zh:['晚餐','午餐','饮品','菜单','活动','咖啡','厨房','品萨、三明治与吐司','沙拉','餐前酒','披萨','周日菜单','主厨推荐','披萨餐厅','甜点','咖啡与餐后酒','软饮料','水烟','早餐'],
 ja:['ディナー','ランチ','ドリンク','メニュー','イベント','コーヒー','料理','ピンサ・サンドイッチ・トースト','サラダ','アペリティーボ','ピザ','日曜メニュー','シェフのおすすめ','ピッツェリア','デザート','コーヒーと食後酒','ソフトドリンク','シーシャ','朝食']
};
export function menuNameCopy(name:string,language='it'):string{
 const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
 const aliases:Record<string,string>={'menu pranzo':'pranzo','menu cena':'cena','bevande':'drinks','beverage':'drinks','menu drinks':'drinks','caffe':'caffetteria','breakfast':'colazione'};
 if(language.split('-')[0]==='it')return (aliases[key]||key)==='drinks'?'Bevande':name;
 const index=titles.indexOf(aliases[key]||key);
 return index<0?name:translations[language.split('-')[0]]?.[index]||name;
}
