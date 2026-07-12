'use client'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'

// i18n lato client per la PWA cliente. SOLO il display è tradotto: i nomi canonici
// italiani dei piatti restano nel carrello/ordine inviato al backend (la traduzione
// dei nomi/descrizioni piatto arriva a parte da /customer/menu-translations e viene
// applicata solo per il display in MenuView).

export type Lang =
  | 'it' | 'en' | 'es' | 'de' | 'fr' | 'pt' | 'nl'
  | 'pl' | 'ru' | 'tr' | 'ar' | 'zh' | 'ja' | 'ko'

export const SUPPORTED: Lang[] = ['it', 'en', 'es', 'de', 'fr', 'pt', 'nl', 'pl', 'ru', 'tr', 'ar', 'zh', 'ja', 'ko']

// Nomi nativi delle lingue (per il LanguageSheet).
export const LANG_NATIVE: Record<Lang, string> = {
  it: 'Italiano', en: 'English', es: 'Español', de: 'Deutsch',
  fr: 'Français', pt: 'Português', nl: 'Nederlands', pl: 'Polski',
  ru: 'Русский', tr: 'Türkçe', ar: 'العربية', zh: '中文',
  ja: '日本語', ko: '한국어',
}

// Lingue con direzione RTL.
export const RTL_LANGS: Lang[] = ['ar']

const LANG_KEY = 'tako-lang'

// ── stringhe UI (chrome) — 14 lingue, traduzioni native ──
export const UI = {
  table:            { it: 'Tavolo', en: 'Table', es: 'Mesa', de: 'Tisch', fr: 'Table', pt: 'Mesa', nl: 'Tafel', pl: 'Stolik', ru: 'Столик', tr: 'Masa', ar: 'طاولة', zh: '餐桌', ja: 'テーブル', ko: '테이블' },
  viewCart:         { it: 'Vedi carrello', en: 'View cart', es: 'Ver carrito', de: 'Warenkorb ansehen', fr: 'Voir le panier', pt: 'Ver carrinho', nl: 'Winkelmand bekijken', pl: 'Zobacz koszyk', ru: 'Посмотреть корзину', tr: 'Sepeti gör', ar: 'عرض السلة', zh: '查看购物车', ja: 'カートを見る', ko: '장바구니 보기' },
  soldOut:          { it: 'Esaurito', en: 'Sold out', es: 'Agotado', de: 'Ausverkauft', fr: 'Épuisé', pt: 'Esgotado', nl: 'Uitverkocht', pl: 'Wyprzedane', ru: 'Распродано', tr: 'Tükendi', ar: 'نفد', zh: '已售罄', ja: '売り切れ', ko: '품절' },
  add:              { it: 'Aggiungi', en: 'Add', es: 'Añadir', de: 'Hinzufügen', fr: 'Ajouter', pt: 'Adicionar', nl: 'Toevoegen', pl: 'Dodaj', ru: 'Добавить', tr: 'Ekle', ar: 'أضف', zh: '添加', ja: '追加', ko: '담기' },
  added:            { it: 'aggiunto', en: 'added', es: 'añadido', de: 'hinzugefügt', fr: 'ajouté', pt: 'adicionado', nl: 'toegevoegd', pl: 'dodano', ru: 'добавлено', tr: 'eklendi', ar: 'أُضيف', zh: '已添加', ja: '追加しました', ko: '담았어요' },
  allergens:        { it: 'Allergeni', en: 'Allergens', es: 'Alérgenos', de: 'Allergene', fr: 'Allergènes', pt: 'Alérgenos', nl: 'Allergenen', pl: 'Alergeny', ru: 'Аллергены', tr: 'Alerjenler', ar: 'مسببات الحساسية', zh: '过敏原', ja: 'アレルゲン', ko: '알레르기 유발 물질' },
  choosePortion:    { it: 'Scegli la porzione', en: 'Choose your portion', es: 'Elige la ración', de: 'Portion wählen', fr: 'Choisissez la portion', pt: 'Escolha a porção', nl: 'Kies je portie', pl: 'Wybierz porcję', ru: 'Выберите порцию', tr: 'Porsiyon seçin', ar: 'اختر الحصة', zh: '选择份量', ja: '分量を選ぶ', ko: '양 선택' },
  included:         { it: 'incluso', en: 'included', es: 'incluido', de: 'inklusive', fr: 'inclus', pt: 'incluído', nl: 'inbegrepen', pl: 'W cenie', ru: 'включено', tr: 'dahil', ar: 'مشمول', zh: '已含', ja: '込み', ko: '포함' },
  kitchenNotes:     { it: 'Note per la cucina', en: 'Notes for the kitchen', es: 'Notas para la cocina', de: 'Anmerkungen für die Küche', fr: 'Notes pour la cuisine', pt: 'Notas para a cozinha', nl: 'Opmerkingen voor de keuken', pl: 'Uwagi dla kuchni', ru: 'Пожелания для кухни', tr: 'Mutfak için notlar', ar: 'ملاحظات للمطبخ', zh: '给厨房的备注', ja: 'キッチンへのメモ', ko: '주방에 남길 메모' },
  notesPh:          { it: 'Es. senza cipolla, ben cotto…', en: 'e.g. no onion, well done…', es: 'Ej. sin cebolla, muy hecho…', de: 'z. B. ohne Zwiebel, gut durch…', fr: 'Ex. sans oignon, bien cuit…', pt: 'Ex. sem cebola, bem passado…', nl: 'Bijv. zonder ui, goed doorbakken…', pl: 'Np. bez cebuli, dobrze wysmażone…', ru: 'Напр. без лука, хорошо прожарено…', tr: 'Örn. soğansız, iyi pişmiş…', ar: 'مثال: بدون بصل، ناضج جيدًا…', zh: '例如：不要洋葱，全熟…', ja: '例：玉ねぎ抜き、よく焼き…', ko: '예: 양파 빼고, 완전히 익혀서…' },
  filterTitle:      { it: 'Filtra per allergeni', en: 'Filter by allergens', es: 'Filtrar por alérgenos', de: 'Nach Allergenen filtern', fr: 'Filtrer par allergènes', pt: 'Filtrar por alérgenos', nl: 'Filter op allergenen', pl: 'Filtruj według alergenów', ru: 'Фильтр по аллергенам', tr: 'Alerjenlere göre filtrele', ar: 'تصفية حسب مسببات الحساسية', zh: '按过敏原筛选', ja: 'アレルゲンで絞り込む', ko: '알레르기 유발 물질로 필터링' },
  filterSub:        { it: 'Nascondi i piatti che li contengono', en: 'Hide dishes that contain them', es: 'Oculta los platos que los contienen', de: 'Gerichte ausblenden, die sie enthalten', fr: 'Masquer les plats qui en contiennent', pt: 'Ocultar pratos que os contêm', nl: 'Verberg gerechten die ze bevatten', pl: 'Ukryj dania, które je zawierają', ru: 'Скрыть блюда, которые их содержат', tr: 'İçeren yemekleri gizle', ar: 'إخفاء الأطباق التي تحتوي عليها', zh: '隐藏含有它们的菜品', ja: 'それらを含む料理を隠す', ko: '해당 성분이 든 요리 숨기기' },
  reset:            { it: 'Azzera', en: 'Reset', es: 'Borrar', de: 'Zurücksetzen', fr: 'Réinitialiser', pt: 'Limpar', nl: 'Wissen', pl: 'Wyczyść', ru: 'Сбросить', tr: 'Sıfırla', ar: 'مسح', zh: '清除', ja: 'リセット', ko: '초기화' },
  showDishes:       { it: 'Mostra piatti', en: 'Show dishes', es: 'Mostrar platos', de: 'Gerichte anzeigen', fr: 'Voir les plats', pt: 'Mostrar pratos', nl: 'Toon gerechten', pl: 'Pokaż dania', ru: 'Показать блюда', tr: 'Yemekleri göster', ar: 'عرض الأطباق', zh: '显示菜品', ja: '料理を表示', ko: '요리 보기' },
  done:             { it: 'Fatto', en: 'Done', es: 'Hecho', de: 'Fertig', fr: 'Terminé', pt: 'Concluído', nl: 'Klaar', pl: 'Gotowe', ru: 'Готово', tr: 'Tamam', ar: 'تم', zh: '完成', ja: '完了', ko: '완료' },
  hidingWith:       { it: 'Nascondo i piatti con', en: 'Hiding dishes with', es: 'Ocultando platos con', de: 'Blende Gerichte aus mit', fr: 'Masquer les plats avec', pt: 'Ocultando pratos com', nl: 'Verberg gerechten met', pl: 'Ukrywam dania z', ru: 'Скрываю блюда с', tr: 'Şunları içeren yemekler gizli', ar: 'إخفاء الأطباق التي تحتوي على', zh: '隐藏含有以下成分的菜品', ja: '次を含む料理を非表示', ko: '다음이 든 요리 숨김' },
  yourOrder:        { it: 'Il tuo ordine', en: 'Your order', es: 'Tu pedido', de: 'Deine Bestellung', fr: 'Votre commande', pt: 'O seu pedido', nl: 'Je bestelling', pl: 'Twoje zamówienie', ru: 'Ваш заказ', tr: 'Siparişiniz', ar: 'طلبك', zh: '您的订单', ja: 'ご注文', ko: '내 주문' },
  cartEmpty:        { it: 'Il carrello è vuoto', en: 'Your cart is empty', es: 'Tu carrito está vacío', de: 'Dein Warenkorb ist leer', fr: 'Votre panier est vide', pt: 'O seu carrinho está vazio', nl: 'Je winkelmand is leeg', pl: 'Twój koszyk jest pusty', ru: 'Ваша корзина пуста', tr: 'Sepetiniz boş', ar: 'سلتك فارغة', zh: '您的购物车是空的', ja: 'カートは空です', ko: '장바구니가 비어 있어요' },
  cartEmptySub:     { it: 'Aggiungi qualcosa di buono dal menù.', en: 'Add something tasty from the menu.', es: 'Añade algo rico del menú.', de: 'Füge etwas Leckeres aus dem Menü hinzu.', fr: 'Ajoutez quelque chose de bon depuis le menu.', pt: 'Adicione algo delicioso do menu.', nl: 'Voeg iets lekkers toe uit het menu.', pl: 'Dodaj coś dobrego z menu.', ru: 'Добавьте что-нибудь вкусное из меню.', tr: 'Menüden lezzetli bir şeyler ekleyin.', ar: 'أضف شيئًا لذيذًا من القائمة.', zh: '从菜单中添加些美味的吧。', ja: 'メニューから美味しいものを追加しましょう。', ko: '메뉴에서 맛있는 걸 담아보세요.' },
  backToMenu:       { it: 'Torna al menù', en: 'Back to menu', es: 'Volver al menú', de: 'Zurück zum Menü', fr: 'Retour au menu', pt: 'Voltar ao menu', nl: 'Terug naar menu', pl: 'Wróć do menu', ru: 'Вернуться в меню', tr: 'Menüye dön', ar: 'العودة إلى القائمة', zh: '返回菜单', ja: 'メニューに戻る', ko: '메뉴로 돌아가기' },
  orderNotesPh:     { it: "Note per tutto l'ordine (es. portate insieme)", en: 'Notes for the whole order (e.g. bring together)', es: 'Notas para todo el pedido (ej. traer junto)', de: 'Anmerkungen zur Bestellung (z. B. zusammen servieren)', fr: 'Notes pour toute la commande (ex. apporter ensemble)', pt: 'Notas para todo o pedido (ex. trazer juntos)', nl: 'Opmerkingen voor de hele bestelling (bijv. samen brengen)', pl: 'Uwagi do całego zamówienia (np. podać razem)', ru: 'Пожелания ко всему заказу (напр. подать вместе)', tr: 'Tüm sipariş için notlar (ör. birlikte getirin)', ar: 'ملاحظات لكامل الطلب (مثال: أحضرها معًا)', zh: '整单备注（例如：一起上菜）', ja: '注文全体へのメモ（例：一緒に持ってきて）', ko: '주문 전체에 대한 메모 (예: 함께 내주세요)' },
  total:            { it: 'Totale', en: 'Total', es: 'Total', de: 'Gesamt', fr: 'Total', pt: 'Total', nl: 'Totaal', pl: 'Razem', ru: 'Итого', tr: 'Toplam', ar: 'الإجمالي', zh: '合计', ja: '合計', ko: '합계' },
  confirmOrder:     { it: 'Conferma ordine', en: 'Confirm order', es: 'Confirmar pedido', de: 'Bestellung bestätigen', fr: 'Confirmer la commande', pt: 'Confirmar pedido', nl: 'Bestelling bevestigen', pl: 'Potwierdź zamówienie', ru: 'Подтвердить заказ', tr: 'Siparişi onayla', ar: 'تأكيد الطلب', zh: '确认下单', ja: '注文を確定', ko: '주문 확정' },
  sending:          { it: 'Invio…', en: 'Sending…', es: 'Enviando…', de: 'Senden…', fr: 'Envoi…', pt: 'A enviar…', nl: 'Verzenden…', pl: 'Wysyłanie…', ru: 'Отправка…', tr: 'Gönderiliyor…', ar: 'جارٍ الإرسال…', zh: '提交中…', ja: '送信中…', ko: '보내는 중…' },
  navMenu:          { it: 'Menù', en: 'Menu', es: 'Menú', de: 'Menü', fr: 'Menu', pt: 'Menu', nl: 'Menu', pl: 'Menu', ru: 'Меню', tr: 'Menü', ar: 'القائمة', zh: '菜单', ja: 'メニュー', ko: '메뉴' },
  navOrder:         { it: 'Ordine', en: 'Order', es: 'Pedido', de: 'Bestellung', fr: 'Commande', pt: 'Pedido', nl: 'Bestelling', pl: 'Zamówienie', ru: 'Заказ', tr: 'Sipariş', ar: 'الطلب', zh: '订单', ja: '注文', ko: '주문' },
  navAssistant:     { it: 'Assistente', en: 'Assistant', es: 'Asistente', de: 'Assistent', fr: 'Assistant', pt: 'Assistente', nl: 'Assistent', pl: 'Asystent', ru: 'Помощник', tr: 'Asistan', ar: 'المساعد', zh: '助手', ja: 'アシスタント', ko: '어시스턴트' },
  hdrWaiter:        { it: 'Cameriere', en: 'Waiter', es: 'Camarero', de: 'Kellner', fr: 'Serveur', pt: 'Empregado', nl: 'Ober', pl: 'Kelner', ru: 'Официант', tr: 'Garson', ar: 'النادل', zh: '服务员', ja: '店員', ko: '직원' },
  hdrCart:          { it: 'Carrello', en: 'Cart', es: 'Carrito', de: 'Warenkorb', fr: 'Panier', pt: 'Carrinho', nl: 'Winkelmand', pl: 'Koszyk', ru: 'Корзина', tr: 'Sepet', ar: 'السلة', zh: '购物车', ja: 'カート', ko: '장바구니' },
  noActiveOrder:    { it: 'Nessun ordine attivo', en: 'No active order', es: 'Sin pedidos activos', de: 'Keine aktive Bestellung', fr: 'Aucune commande en cours', pt: 'Nenhum pedido ativo', nl: 'Geen actieve bestelling', pl: 'Brak aktywnego zamówienia', ru: 'Нет активных заказов', tr: 'Aktif sipariş yok', ar: 'لا يوجد طلب نشط', zh: '暂无进行中的订单', ja: '進行中の注文はありません', ko: '진행 중인 주문 없음' },
  noActiveOrderSub: { it: 'Quando ordini, qui segui tutto in tempo reale.', en: 'Once you order, follow everything here in real time.', es: 'Cuando pidas, sigue todo aquí en tiempo real.', de: 'Sobald du bestellst, verfolgst du hier alles in Echtzeit.', fr: 'Une fois commandé, suivez tout ici en temps réel.', pt: 'Quando fizer o pedido, acompanhe tudo aqui em tempo real.', nl: 'Zodra je bestelt, volg je hier alles in realtime.', pl: 'Gdy złożysz zamówienie, śledź wszystko tutaj na żywo.', ru: 'После заказа отслеживайте всё здесь в реальном времени.', tr: 'Sipariş verdiğinizde her şeyi burada canlı takip edin.', ar: 'عند الطلب، تابع كل شيء هنا مباشرةً.', zh: '下单后，在这里实时跟踪一切。', ja: '注文すると、ここですべてをリアルタイムで確認できます。', ko: '주문하면 여기서 모든 걸 실시간으로 확인할 수 있어요.' },
  goToMenu:         { it: 'Vai al menù', en: 'Go to menu', es: 'Ir al menú', de: 'Zum Menü', fr: 'Aller au menu', pt: 'Ir para o menu', nl: 'Naar het menu', pl: 'Przejdź do menu', ru: 'Перейти в меню', tr: 'Menüye git', ar: 'اذهب إلى القائمة', zh: '前往菜单', ja: 'メニューへ', ko: '메뉴로 가기' },
  orderWord:        { it: 'Ordine', en: 'Order', es: 'Pedido', de: 'Bestellung', fr: 'Commande', pt: 'Pedido', nl: 'Bestelling', pl: 'Zamówienie', ru: 'Заказ', tr: 'Sipariş', ar: 'الطلب', zh: '订单', ja: '注文', ko: '주문' },
  summary:          { it: 'Riepilogo', en: 'Summary', es: 'Resumen', de: 'Übersicht', fr: 'Récapitulatif', pt: 'Resumo', nl: 'Overzicht', pl: 'Podsumowanie', ru: 'Сводка', tr: 'Özet', ar: 'الملخص', zh: '摘要', ja: 'ご注文内容', ko: '요약' },
  notePre:          { it: 'Nota:', en: 'Note:', es: 'Nota:', de: 'Notiz:', fr: 'Note :', pt: 'Nota:', nl: 'Notitie:', pl: 'Uwaga:', ru: 'Примечание:', tr: 'Not:', ar: 'ملاحظة:', zh: '备注：', ja: 'メモ：', ko: '메모:' },
  addMore:          { it: 'Aggiungi altro', en: 'Add more', es: 'Añadir más', de: 'Mehr hinzufügen', fr: 'En ajouter', pt: 'Adicionar mais', nl: 'Meer toevoegen', pl: 'Dodaj więcej', ru: 'Добавить ещё', tr: 'Daha fazla ekle', ar: 'أضف المزيد', zh: '继续添加', ja: 'さらに追加', ko: '더 담기' },
  language:         { it: 'Lingua', en: 'Language', es: 'Idioma', de: 'Sprache', fr: 'Langue', pt: 'Idioma', nl: 'Taal', pl: 'Język', ru: 'Язык', tr: 'Dil', ar: 'اللغة', zh: '语言', ja: '言語', ko: '언어' },
  languageSub:      { it: 'Scegli la lingua del menù', en: 'Choose your menu language', es: 'Elige el idioma del menú', de: 'Sprache des Menüs wählen', fr: 'Choisissez la langue du menu', pt: 'Escolha o idioma do menu', nl: 'Kies de taal van het menu', pl: 'Wybierz język menu', ru: 'Выберите язык меню', tr: 'Menü dilini seçin', ar: 'اختر لغة القائمة', zh: '选择菜单语言', ja: 'メニューの言語を選択', ko: '메뉴 언어 선택' },
  callWaiter:       { it: 'Chiama il cameriere', en: 'Call the waiter', es: 'Llamar al camarero', de: 'Kellner rufen', fr: 'Appeler le serveur', pt: 'Chamar o empregado', nl: 'Ober roepen', pl: 'Zawołaj kelnera', ru: 'Позвать официанта', tr: 'Garsonu çağır', ar: 'نادِ النادل', zh: '呼叫服务员', ja: '店員を呼ぶ', ko: '직원 호출' },
  waiterDone:       { it: 'Fatto!', en: 'Done!', es: '¡Hecho!', de: 'Fertig!', fr: "C'est fait !", pt: 'Feito!', nl: 'Klaar!', pl: 'Gotowe!', ru: 'Готово!', tr: 'Tamam!', ar: 'تم!', zh: '完成！', ja: '完了！', ko: '완료!' },
  waiterComing:     { it: 'arriviamo subito al tavolo', en: "we'll be right at table", es: 'llegamos enseguida a la mesa', de: 'wir kommen sofort an Tisch', fr: 'nous arrivons à votre table', pt: 'chegamos já à mesa', nl: 'we komen zo naar je tafel', pl: 'zaraz podejdziemy do stolika', ru: 'сейчас подойдём к столику', tr: 'hemen masanıza geliyoruz', ar: 'سنأتي إلى طاولتك حالًا', zh: '马上到您的餐桌', ja: 'すぐにテーブルへ伺います', ko: '곧 테이블로 갈게요' },
  waiterHelp:       { it: 'Ho bisogno di aiuto', en: 'I need help', es: 'Necesito ayuda', de: 'Ich brauche Hilfe', fr: "J'ai besoin d'aide", pt: 'Preciso de ajuda', nl: 'Ik heb hulp nodig', pl: 'Potrzebuję pomocy', ru: 'Мне нужна помощь', tr: 'Yardıma ihtiyacım var', ar: 'أحتاج مساعدة', zh: '我需要帮助', ja: 'お手伝いをお願いします', ko: '도움이 필요해요' },
  waiterHelpSub:    { it: 'Un cameriere arriva al tavolo', en: 'A waiter will come to your table', es: 'Un camarero vendrá a la mesa', de: 'Ein Kellner kommt an den Tisch', fr: 'Un serveur vient à votre table', pt: 'Um empregado vem à mesa', nl: 'Een ober komt naar je tafel', pl: 'Kelner podejdzie do stolika', ru: 'Официант подойдёт к столику', tr: 'Bir garson masanıza gelir', ar: 'سيأتي نادل إلى الطاولة', zh: '服务员将来到您的餐桌', ja: '店員がテーブルに伺います', ko: '직원이 테이블로 와요' },
  waiterBill:       { it: 'Vorrei il conto', en: "I'd like the bill", es: 'Quiero la cuenta', de: 'Die Rechnung, bitte', fr: "Je voudrais l'addition", pt: 'Queria a conta', nl: 'Ik wil graag afrekenen', pl: 'Poproszę rachunek', ru: 'Счёт, пожалуйста', tr: 'Hesabı istiyorum', ar: 'أريد الفاتورة', zh: '我要买单', ja: 'お会計をお願いします', ko: '계산서 주세요' },
  waiterBillSub:    { it: 'Prepariamo il conto del tavolo', en: "We'll prepare the table's bill", es: 'Preparamos la cuenta de la mesa', de: 'Wir bereiten die Rechnung vor', fr: "Nous préparons l'addition de la table", pt: 'Preparamos a conta da mesa', nl: 'We maken de rekening van de tafel klaar', pl: 'Przygotujemy rachunek dla stolika', ru: 'Мы подготовим счёт для столика', tr: 'Masanın hesabını hazırlıyoruz', ar: 'نُحضّر فاتورة الطاولة', zh: '我们这就为您准备账单', ja: 'テーブルのお会計を準備します', ko: '테이블 계산서를 준비할게요' },
  waiterWater:      { it: 'Acqua, per favore', en: 'Water, please', es: 'Agua, por favor', de: 'Wasser, bitte', fr: "De l'eau, s'il vous plaît", pt: 'Água, por favor', nl: 'Water, alsjeblieft', pl: 'Woda poproszę', ru: 'Воды, пожалуйста', tr: 'Su, lütfen', ar: 'ماء، من فضلك', zh: '请给点水', ja: 'お水をお願いします', ko: '물 좀 주세요' },
  waiterWaterSub:   { it: "Portiamo dell'acqua", en: "We'll bring some water", es: 'Traemos agua', de: 'Wir bringen Wasser', fr: "Nous apportons de l'eau", pt: 'Trazemos água', nl: 'We brengen wat water', pl: 'Przyniesiemy wodę', ru: 'Мы принесём воды', tr: 'Su getiriyoruz', ar: 'سنُحضر بعض الماء', zh: '我们这就送水来', ja: 'お水をお持ちします', ko: '물을 가져다 드릴게요' },
  toastOrderSent:   { it: 'Ordine inviato in cucina!', en: 'Order sent to the kitchen!', es: '¡Pedido enviado a la cocina!', de: 'Bestellung an die Küche gesendet!', fr: 'Commande envoyée en cuisine !', pt: 'Pedido enviado para a cozinha!', nl: 'Bestelling naar de keuken gestuurd!', pl: 'Zamówienie wysłane do kuchni!', ru: 'Заказ отправлен на кухню!', tr: 'Sipariş mutfağa gönderildi!', ar: 'أُرسل الطلب إلى المطبخ!', zh: '订单已送至厨房！', ja: '注文をキッチンに送りました！', ko: '주문을 주방에 보냈어요!' },
  toastOrderReady:  { it: 'Il tuo ordine è pronto! 🛎️', en: 'Your order is ready! 🛎️', es: '¡Tu pedido está listo! 🛎️', de: 'Deine Bestellung ist fertig! 🛎️', fr: 'Votre commande est prête ! 🛎️', pt: 'O seu pedido está pronto! 🛎️', nl: 'Je bestelling is klaar! 🛎️', pl: 'Twoje zamówienie jest gotowe! 🛎️', ru: 'Ваш заказ готов! 🛎️', tr: 'Siparişiniz hazır! 🛎️', ar: 'طلبك جاهز! 🛎️', zh: '您的订单已就绪！🛎️', ja: 'ご注文の準備ができました！🛎️', ko: '주문이 준비됐어요! 🛎️' },
  toastWaiter:      { it: 'Cameriere avvisato! 🔔', en: 'Waiter notified! 🔔', es: '¡Camarero avisado! 🔔', de: 'Kellner benachrichtigt! 🔔', fr: 'Serveur prévenu ! 🔔', pt: 'Empregado avisado! 🔔', nl: 'Ober gewaarschuwd! 🔔', pl: 'Kelner powiadomiony! 🔔', ru: 'Официант вызван! 🔔', tr: 'Garson bilgilendirildi! 🔔', ar: 'تم إبلاغ النادل! 🔔', zh: '已通知服务员！🔔', ja: '店員に通知しました！🔔', ko: '직원에게 알렸어요! 🔔' },
  waiterError:      { it: 'Impossibile chiamare il cameriere. Riprova.', en: 'Could not call the waiter. Try again.', es: 'No se pudo llamar al camarero. Inténtalo de nuevo.', de: 'Kellner konnte nicht gerufen werden. Erneut versuchen.', fr: "Impossible d'appeler le serveur. Réessayez.", pt: 'Não foi possível chamar o empregado. Tente novamente.', nl: 'Kan de ober niet roepen. Probeer opnieuw.', pl: 'Nie udało się zawołać kelnera. Spróbuj ponownie.', ru: 'Не удалось позвать официанта. Попробуйте снова.', tr: 'Garson çağrılamadı. Tekrar deneyin.', ar: 'تعذّر نداء النادل. حاول مجددًا.', zh: '无法呼叫服务员，请重试。', ja: '店員を呼べませんでした。もう一度お試しください。', ko: '직원을 호출할 수 없어요. 다시 시도해 주세요.' },
  orderError:       { it: "Errore nell'invio. Riprova.", en: 'Sending failed. Try again.', es: 'Error al enviar. Inténtalo de nuevo.', de: 'Senden fehlgeschlagen. Erneut versuchen.', fr: "Échec de l'envoi. Réessayez.", pt: 'Erro ao enviar. Tente novamente.', nl: 'Verzenden mislukt. Probeer opnieuw.', pl: 'Błąd wysyłania. Spróbuj ponownie.', ru: 'Ошибка отправки. Попробуйте снова.', tr: 'Gönderim başarısız. Tekrar deneyin.', ar: 'فشل الإرسال. حاول مجددًا.', zh: '发送失败，请重试。', ja: '送信に失敗しました。もう一度お試しください。', ko: '전송 실패. 다시 시도해 주세요.' },
  orderItemsUnavailable: { it: 'Alcuni piatti non sono più disponibili: aggiorna il carrello.', en: 'Some dishes are no longer available: update your cart.', es: 'Algunos platos ya no están disponibles: actualiza el carrito.', de: 'Einige Gerichte sind nicht mehr verfügbar: Warenkorb aktualisieren.', fr: 'Certains plats ne sont plus disponibles : mettez à jour votre panier.', pt: 'Alguns pratos já não estão disponíveis: atualize o carrinho.', nl: 'Sommige gerechten zijn niet meer beschikbaar: werk je winkelmand bij.', pl: 'Niektóre dania są już niedostępne: zaktualizuj koszyk.', ru: 'Некоторых блюд больше нет: обновите корзину.', tr: 'Bazı yemekler artık mevcut değil: sepetinizi güncelleyin.', ar: 'بعض الأطباق لم تعد متوفرة: حدّث سلتك.', zh: '部分菜品已不可用：请更新购物车。', ja: '一部の料理は在庫切れです。カートを更新してください。', ko: '일부 요리가 더 이상 제공되지 않아요. 장바구니를 업데이트해 주세요.' },
  // chat
  chatOnline:       { it: 'online · risponde subito', en: 'online · replies instantly', es: 'en línea · responde al instante', de: 'online · antwortet sofort', fr: 'en ligne · répond aussitôt', pt: 'online · responde já', nl: 'online · reageert direct', pl: 'online · odpowiada od razu', ru: 'онлайн · отвечает сразу', tr: 'çevrimiçi · hemen yanıtlar', ar: 'متصل · يرد فورًا', zh: '在线 · 秒回', ja: 'オンライン · すぐ返信', ko: '온라인 · 즉시 응답' },
  chatPlaceholder:  { it: 'Scrivi un messaggio…', en: 'Write a message…', es: 'Escribe un mensaje…', de: 'Nachricht schreiben…', fr: 'Écrivez un message…', pt: 'Escreva uma mensagem…', nl: 'Schrijf een bericht…', pl: 'Napisz wiadomość…', ru: 'Напишите сообщение…', tr: 'Bir mesaj yazın…', ar: 'اكتب رسالة…', zh: '输入消息…', ja: 'メッセージを入力…', ko: '메시지를 입력하세요…' },
  chatError:        { it: 'Scusa, ho avuto un intoppo. Riprova tra un attimo.', en: 'Sorry, something went wrong. Try again in a moment.', es: 'Perdona, algo salió mal. Inténtalo en un momento.', de: 'Entschuldigung, etwas ist schiefgelaufen. Versuche es gleich erneut.', fr: 'Désolé, un souci est survenu. Réessayez dans un instant.', pt: 'Desculpe, houve um problema. Tente de novo daqui a pouco.', nl: 'Sorry, er ging iets mis. Probeer het zo opnieuw.', pl: 'Przepraszam, coś poszło nie tak. Spróbuj za chwilę.', ru: 'Извините, что-то пошло не так. Попробуйте через мгновение.', tr: 'Üzgünüm, bir sorun oldu. Birazdan tekrar deneyin.', ar: 'عذرًا، حدث خطأ ما. حاول بعد لحظة.', zh: '抱歉，出了点问题。请稍后再试。', ja: 'すみません、問題が発生しました。少ししてからもう一度お試しください。', ko: '죄송해요, 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' },
  addedToCart:      { it: 'Aggiunto al carrello', en: 'Added to cart', es: 'Añadido al carrito', de: 'Zum Warenkorb hinzugefügt', fr: 'Ajouté au panier', pt: 'Adicionado ao carrinho', nl: 'Toegevoegd aan winkelmand', pl: 'Dodano do koszyka', ru: 'Добавлено в корзину', tr: 'Sepete eklendi', ar: 'أُضيف إلى السلة', zh: '已加入购物车', ja: 'カートに追加しました', ko: '장바구니에 담았어요' },
  orderSent:        { it: 'Ordine inviato!', en: 'Order sent!', es: '¡Pedido enviado!', de: 'Bestellung gesendet!', fr: 'Commande envoyée !', pt: 'Pedido enviado!', nl: 'Bestelling verzonden!', pl: 'Zamówienie wysłane!', ru: 'Заказ отправлен!', tr: 'Sipariş gönderildi!', ar: 'أُرسل الطلب!', zh: '订单已发送！', ja: '注文を送信しました！', ko: '주문을 보냈어요!' },
  trackOrder:       { it: 'Traccia ordine', en: 'Track order', es: 'Seguir pedido', de: 'Bestellung verfolgen', fr: 'Suivre la commande', pt: 'Seguir pedido', nl: 'Bestelling volgen', pl: 'Śledź zamówienie', ru: 'Отследить заказ', tr: 'Siparişi takip et', ar: 'تتبّع الطلب', zh: '跟踪订单', ja: '注文を追跡', ko: '주문 추적' },
  waiterNotified:   { it: 'Il cameriere è stato avvisato.', en: 'The waiter has been notified.', es: 'El camarero ha sido avisado.', de: 'Der Kellner wurde benachrichtigt.', fr: 'Le serveur a été prévenu.', pt: 'O empregado foi avisado.', nl: 'De ober is gewaarschuwd.', pl: 'Kelner został powiadomiony.', ru: 'Официант вызван.', tr: 'Garson bilgilendirildi.', ar: 'تم إبلاغ النادل.', zh: '已通知服务员。', ja: '店員に通知しました。', ko: '직원에게 알렸어요.' },
} as const

export type UIKey = keyof typeof UI

// ── tag piatti ──
const TAG: Record<string, Record<Lang, string>> = {
  'Vegetariano':    { it: 'Vegetariano', en: 'Vegetarian', es: 'Vegetariano', de: 'Vegetarisch', fr: 'Végétarien', pt: 'Vegetariano', nl: 'Vegetarisch', pl: 'Wegetariańskie', ru: 'Вегетарианское', tr: 'Vejetaryen', ar: 'نباتي', zh: '素食', ja: 'ベジタリアン', ko: '채식' },
  'Consigliato':    { it: 'Consigliato', en: 'Recommended', es: 'Recomendado', de: 'Empfohlen', fr: 'Recommandé', pt: 'Recomendado', nl: 'Aanbevolen', pl: 'Polecane', ru: 'Рекомендуем', tr: 'Önerilen', ar: 'موصى به', zh: '推荐', ja: 'おすすめ', ko: '추천' },
  'Da condividere': { it: 'Da condividere', en: 'To share', es: 'Para compartir', de: 'Zum Teilen', fr: 'À partager', pt: 'Para partilhar', nl: 'Om te delen', pl: 'Do dzielenia', ru: 'На компанию', tr: 'Paylaşmalık', ar: 'للمشاركة', zh: '适合分享', ja: 'シェア向け', ko: '나눠 먹기' },
  'Novità':         { it: 'Novità', en: 'New', es: 'Novedad', de: 'Neu', fr: 'Nouveau', pt: 'Novidade', nl: 'Nieuw', pl: 'Nowość', ru: 'Новинка', tr: 'Yeni', ar: 'جديد', zh: '新品', ja: '新着', ko: '신메뉴' },
  'Piccante':       { it: 'Piccante', en: 'Spicy', es: 'Picante', de: 'Scharf', fr: 'Épicé', pt: 'Picante', nl: 'Pittig', pl: 'Ostre', ru: 'Острое', tr: 'Acılı', ar: 'حار', zh: '辣', ja: '辛口', ko: '매운맛' },
}

// ── etichette allergeni ──
const ALLG: Record<string, Record<Lang, string>> = {
  glutine:   { it: 'Glutine', en: 'Gluten', es: 'Gluten', de: 'Gluten', fr: 'Gluten', pt: 'Glúten', nl: 'Gluten', pl: 'Gluten', ru: 'Глютен', tr: 'Gluten', ar: 'الغلوتين', zh: '麸质', ja: 'グルテン', ko: '글루텐' },
  latte:     { it: 'Latte', en: 'Milk', es: 'Leche', de: 'Milch', fr: 'Lait', pt: 'Leite', nl: 'Melk', pl: 'Mleko', ru: 'Молоко', tr: 'Süt', ar: 'الحليب', zh: '奶', ja: '乳', ko: '우유' },
  uova:      { it: 'Uova', en: 'Eggs', es: 'Huevos', de: 'Eier', fr: 'Œufs', pt: 'Ovos', nl: 'Eieren', pl: 'Jaja', ru: 'Яйца', tr: 'Yumurta', ar: 'البيض', zh: '蛋', ja: '卵', ko: '달걀' },
  pesce:     { it: 'Pesce', en: 'Fish', es: 'Pescado', de: 'Fisch', fr: 'Poisson', pt: 'Peixe', nl: 'Vis', pl: 'Ryby', ru: 'Рыба', tr: 'Balık', ar: 'السمك', zh: '鱼', ja: '魚', ko: '생선' },
  molluschi: { it: 'Molluschi', en: 'Molluscs', es: 'Moluscos', de: 'Weichtiere', fr: 'Mollusques', pt: 'Moluscos', nl: 'Weekdieren', pl: 'Mięczaki', ru: 'Моллюски', tr: 'Yumuşakçalar', ar: 'الرخويات', zh: '软体动物', ja: '軟体動物', ko: '연체동물' },
  arachidi:  { it: 'Arachidi', en: 'Peanuts', es: 'Cacahuetes', de: 'Erdnüsse', fr: 'Arachides', pt: 'Amendoins', nl: "Pinda's", pl: 'Orzeszki ziemne', ru: 'Арахис', tr: 'Yer fıstığı', ar: 'الفول السوداني', zh: '花生', ja: 'ピーナッツ', ko: '땅콩' },
  soia:      { it: 'Soia', en: 'Soy', es: 'Soja', de: 'Soja', fr: 'Soja', pt: 'Soja', nl: 'Soja', pl: 'Soja', ru: 'Соя', tr: 'Soya', ar: 'الصويا', zh: '大豆', ja: '大豆', ko: '대두' },
  noci:      { it: 'Frutta a guscio', en: 'Tree nuts', es: 'Frutos secos', de: 'Schalenfrüchte', fr: 'Fruits à coque', pt: 'Frutos de casca rija', nl: 'Noten', pl: 'Orzechy', ru: 'Орехи', tr: 'Sert kabuklu yemişler', ar: 'المكسرات', zh: '坚果', ja: 'ナッツ類', ko: '견과류' },
  sedano:    { it: 'Sedano', en: 'Celery', es: 'Apio', de: 'Sellerie', fr: 'Céleri', pt: 'Aipo', nl: 'Selderij', pl: 'Seler', ru: 'Сельдерей', tr: 'Kereviz', ar: 'الكرفس', zh: '芹菜', ja: 'セロリ', ko: '셀러리' },
  senape:    { it: 'Senape', en: 'Mustard', es: 'Mostaza', de: 'Senf', fr: 'Moutarde', pt: 'Mostarda', nl: 'Mosterd', pl: 'Gorczyca', ru: 'Горчица', tr: 'Hardal', ar: 'الخردل', zh: '芥末', ja: 'マスタード', ko: '겨자' },
  sesamo:    { it: 'Sesamo', en: 'Sesame', es: 'Sésamo', de: 'Sesam', fr: 'Sésame', pt: 'Sésamo', nl: 'Sesam', pl: 'Sezam', ru: 'Кунжут', tr: 'Susam', ar: 'السمسم', zh: '芝麻', ja: 'ゴマ', ko: '참깨' },
  lupini:    { it: 'Lupini', en: 'Lupin', es: 'Altramuces', de: 'Lupinen', fr: 'Lupin', pt: 'Tremoço', nl: 'Lupine', pl: 'Łubin', ru: 'Люпин', tr: 'Acı bakla', ar: 'الترمس', zh: '羽扇豆', ja: 'ルピナス', ko: '루핀' },
}

// ── step di tracking (id semantico → status backend + label/desc tradotti) ──
export const ORDER_STEPS: { id: string; status: string[]; label: Record<Lang, string>; desc: Record<Lang, string> }[] = [
  { id: 'ricevuto',   status: ['pending'],
    label: { it: 'Ricevuto', en: 'Received', es: 'Recibido', de: 'Erhalten', fr: 'Reçu', pt: 'Recebido', nl: 'Ontvangen', pl: 'Otrzymano', ru: 'Получен', tr: 'Alındı', ar: 'تم الاستلام', zh: '已接收', ja: '受付済み', ko: '접수됨' },
    desc:  { it: 'Tako ha ricevuto il tuo ordine', en: 'We received your order', es: 'Hemos recibido tu pedido', de: 'Wir haben deine Bestellung erhalten', fr: 'Nous avons reçu votre commande', pt: 'Recebemos o seu pedido', nl: 'We hebben je bestelling ontvangen', pl: 'Otrzymaliśmy Twoje zamówienie', ru: 'Мы получили ваш заказ', tr: 'Siparişinizi aldık', ar: 'لقد استلمنا طلبك', zh: '我们已收到您的订单', ja: 'ご注文を受け付けました', ko: '주문을 접수했어요' } },
  { id: 'confermato', status: ['confirmed'],
    label: { it: 'Confermato', en: 'Confirmed', es: 'Confirmado', de: 'Bestätigt', fr: 'Confirmé', pt: 'Confirmado', nl: 'Bevestigd', pl: 'Potwierdzono', ru: 'Подтверждён', tr: 'Onaylandı', ar: 'تم التأكيد', zh: '已确认', ja: '確定済み', ko: '확인됨' },
    desc:  { it: 'Il ristorante ha confermato', en: 'The restaurant confirmed it', es: 'El restaurante lo ha confirmado', de: 'Das Restaurant hat sie bestätigt', fr: 'Le restaurant a confirmé', pt: 'O restaurante confirmou', nl: 'Het restaurant heeft bevestigd', pl: 'Restauracja potwierdziła', ru: 'Ресторан подтвердил', tr: 'Restoran onayladı', ar: 'أكّد المطعم الطلب', zh: '餐厅已确认', ja: 'レストランが確定しました', ko: '레스토랑이 확인했어요' } },
  { id: 'in_cucina',  status: ['preparing'],
    label: { it: 'In cucina', en: 'In the kitchen', es: 'En cocina', de: 'In der Küche', fr: 'En cuisine', pt: 'Na cozinha', nl: 'In de keuken', pl: 'W kuchni', ru: 'На кухне', tr: 'Mutfakta', ar: 'في المطبخ', zh: '制作中', ja: '調理中', ko: '조리 중' },
    desc:  { it: 'Lo chef sta preparando', en: 'Your dishes are being prepared', es: 'Tus platos se están preparando', de: 'Deine Gerichte werden zubereitet', fr: 'Vos plats sont en préparation', pt: 'Os seus pratos estão a ser preparados', nl: 'Je gerechten worden bereid', pl: 'Twoje dania są przygotowywane', ru: 'Ваши блюда готовятся', tr: 'Yemekleriniz hazırlanıyor', ar: 'يتم تحضير أطباقك', zh: '您的菜品正在制作', ja: 'お料理を準備しています', ko: '요리를 준비하고 있어요' } },
  { id: 'pronto',     status: ['ready'],
    label: { it: 'Pronto', en: 'Ready', es: 'Listo', de: 'Fertig', fr: 'Prêt', pt: 'Pronto', nl: 'Klaar', pl: 'Gotowe', ru: 'Готово', tr: 'Hazır', ar: 'جاهز', zh: '已就绪', ja: '準備完了', ko: '준비 완료' },
    desc:  { it: 'In arrivo al tuo tavolo', en: 'Your order is ready', es: 'Tu pedido está listo', de: 'Deine Bestellung ist fertig', fr: 'Votre commande est prête', pt: 'O seu pedido está pronto', nl: 'Je bestelling is klaar', pl: 'Twoje zamówienie jest gotowe', ru: 'Ваш заказ готов', tr: 'Siparişiniz hazır', ar: 'طلبك جاهز', zh: '您的订单已就绪', ja: 'ご注文の準備ができました', ko: '주문이 준비됐어요' } },
  { id: 'servito',    status: ['served', 'paid'],
    label: { it: 'Servito', en: 'Served', es: 'Servido', de: 'Serviert', fr: 'Servi', pt: 'Servido', nl: 'Geserveerd', pl: 'Podano', ru: 'Подано', tr: 'Servis edildi', ar: 'تم التقديم', zh: '已上菜', ja: '提供済み', ko: '서빙 완료' },
    desc:  { it: 'Buon appetito!', en: 'Enjoy your meal!', es: '¡Buen provecho!', de: 'Guten Appetit!', fr: 'Bon appétit !', pt: 'Bom apetite!', nl: 'Eet smakelijk!', pl: 'Smacznego!', ru: 'Приятного аппетита!', tr: 'Afiyet olsun!', ar: 'بالهناء والشفاء!', zh: '请慢用！', ja: 'どうぞお召し上がりください！', ko: '맛있게 드세요!' } },
]

export function stepIndexForStatus(status?: string | null): number {
  if (!status) return 0
  const i = ORDER_STEPS.findIndex(s => s.status.includes(status))
  return i < 0 ? 0 : i
}

export const coerceLang = (lang: string): Lang =>
  (SUPPORTED.includes(lang as Lang) ? (lang as Lang) : 'it')

// alias interno storico
const coerce = coerceLang

export function trTag(tag: string, lang: string): string {
  const e = TAG[tag]
  return e ? e[coerce(lang)] : tag
}
export function trAllergen(id: string, lang: string, fallback: string): string {
  const e = ALLG[id.toLowerCase()]
  return e ? e[coerce(lang)] : fallback
}
export function trStep(id: string, lang: string): { label: string; desc: string } {
  const s = ORDER_STEPS.find(x => x.id === id)
  const l = coerce(lang)
  return s ? { label: s.label[l], desc: s.desc[l] } : { label: id, desc: '' }
}

interface I18nCtx {
  lang: string
  setLang: (l: string) => void
  languages: string[]
  defaultLang: string
  t: (key: UIKey) => string
}

const Ctx = createContext<I18nCtx | null>(null)

export function I18nProvider({ restaurantId, children }: { restaurantId: string | null; children: ReactNode }) {
  const [languages, setLanguages] = useState<string[]>(['it'])
  const [defaultLang, setDefaultLang] = useState('it')
  const [lang, setLangState] = useState<string>('it')

  // Carica le lingue del ristorante e sceglie la lingua iniziale (salvata se valida, altrimenti default).
  useEffect(() => {
    if (!restaurantId) return
    api.get(`/customer/menu-languages?restaurantId=${restaurantId}`).then(r => {
      const langs: string[] = (r.data.data.languages ?? ['it']).map((l: string) => String(l).toLowerCase())
      const def: string = String(r.data.data.defaultLanguage ?? langs[0] ?? 'it').toLowerCase()
      setLanguages(langs.length ? langs : ['it'])
      setDefaultLang(def)
      const saved = typeof window !== 'undefined' ? localStorage.getItem(LANG_KEY)?.toLowerCase() : null
      setLangState(saved && langs.includes(saved) ? saved : def)
    }).catch(() => { setLanguages(['it']); setDefaultLang('it'); setLangState('it') })
  }, [restaurantId])

  // Direzione del documento: RTL per l'arabo, LTR per tutte le altre.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const dir = RTL_LANGS.includes(coerce(lang)) ? 'rtl' : 'ltr'
    document.documentElement.dir = dir
    document.documentElement.lang = coerce(lang)
    return () => { document.documentElement.dir = 'ltr' }
  }, [lang])

  const setLang = (l: string) => {
    const next = l.toLowerCase()
    setLangState(next)
    if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, next)
  }

  const value = useMemo<I18nCtx>(() => ({
    lang, setLang, languages, defaultLang,
    t: (key: UIKey) => UI[key][coerce(lang)],
  }), [lang, languages, defaultLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useI18n must be used within I18nProvider')
  return c
}
