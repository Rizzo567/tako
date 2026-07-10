// Demo menu seed — gives the two preview restaurants real content so the
// customer PWA and dashboard show a populated menu. Idempotent: skips a
// restaurant that already has a menu. Run: node seed-demo.mjs
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://tako:tako@localhost:5432/takodb')

const NINO = 'd1b96b1b-e4d4-4a64-bb8f-5f6f36d061fa' // Trattoria da Nino (#5963ee)
const PIZZA = '96ad8f24-9cf8-45b6-9ff4-ea6d925960ad' // Test Pizza (#ED7159)

// section -> items. item: [name, desc, price, allergens[], tags[], variants[[name,mod]]]
const NINO_MENU = {
  Antipasti: [
    ['Bruschetta al pomodoro', 'Pane casereccio, pomodorini, basilico, aglio', 6.5, ['glutine'], ['vegetariano']],
    ['Tagliere di salumi', 'Selezione di salumi toscani e crostini', 14, ['glutine'], []],
    ['Burrata pugliese', 'Burrata fresca con olio EVO e pepe', 9, ['latte'], ['vegetariano']],
  ],
  Primi: [
    ['Tagliatelle al ragu', 'Ragu di carne cotto otto ore', 12, ['glutine', 'uova'], ['signature']],
    ['Cacio e pepe', 'Pecorino romano e pepe nero', 11, ['glutine', 'latte'], ['vegetariano']],
    ['Risotto ai funghi porcini', 'Carnaroli mantecato con porcini', 13, ['latte'], ['vegetariano']],
  ],
  Secondi: [
    ['Tagliata di manzo', 'Controfiletto, rucola e grana', 18, ['latte'], []],
    ['Branzino al forno', 'Pescato del giorno con patate', 19, ['pesce'], []],
  ],
  Dolci: [
    ['Tiramisu della casa', 'Mascarpone, savoiardi, caffe', 6, ['glutine', 'latte', 'uova'], ['signature']],
    ['Panna cotta', 'Con coulis di frutti di bosco', 5.5, ['latte'], ['vegetariano']],
  ],
  Bevande: [
    ['Acqua naturale', '75cl', 2.5, [], [], [['Naturale', 0], ['Frizzante', 0]]],
    ['Vino della casa', 'Rosso o bianco', 5, [], [], [['Calice', 0], ['Mezzo litro', 7], ['Litro', 13]]],
    ['Birra artigianale', 'Bionda 50cl', 6, ['glutine'], []],
  ],
}

const PIZZA_MENU = {
  Pizze: [
    ['Margherita', 'Pomodoro, mozzarella, basilico', 7, ['glutine', 'latte'], ['vegetariano'], [['Normale', 0], ['Maxi', 3]]],
    ['Diavola', 'Pomodoro, mozzarella, salame piccante', 9, ['glutine', 'latte'], [], [['Normale', 0], ['Maxi', 3]]],
    ['Quattro formaggi', 'Mozzarella, gorgonzola, fontina, grana', 10, ['glutine', 'latte'], ['vegetariano'], [['Normale', 0], ['Maxi', 3]]],
    ['Marinara', 'Pomodoro, aglio, origano', 6, ['glutine'], ['vegano']],
  ],
  Bibite: [
    ['Coca-Cola', '33cl', 3, [], []],
    ['Acqua', '50cl', 1.5, [], [], [['Naturale', 0], ['Frizzante', 0]]],
  ],
}

async function seedRestaurant(restaurantId, menuName, data) {
  const existing = await sql`select id from menus where restaurant_id = ${restaurantId} limit 1`
  if (existing.length) {
    console.log(`skip ${menuName}: menu already exists`)
    return
  }
  const [menu] = await sql`
    insert into menus (restaurant_id, name, type, active, position)
    values (${restaurantId}, ${menuName}, 'main', true, 0) returning id`
  let sPos = 0
  for (const [sectionName, items] of Object.entries(data)) {
    const [section] = await sql`
      insert into menu_sections (menu_id, name, position, active)
      values (${menu.id}, ${sectionName}, ${sPos++}, true) returning id`
    let iPos = 0
    for (const [name, description, price, allergens, tags, variants] of items) {
      const [item] = await sql`
        insert into menu_items
          (section_id, restaurant_id, name, description, price, allergens, tags, available, featured, position, prep_time_minutes)
        values (${section.id}, ${restaurantId}, ${name}, ${description}, ${price},
                ${allergens}, ${tags}, true, ${tags.includes('signature')}, ${iPos++}, 10)
        returning id`
      for (const [vName, vMod] of variants ?? []) {
        await sql`insert into item_variants (item_id, name, price_modifier, available)
                  values (${item.id}, ${vName}, ${vMod}, true)`
      }
    }
  }
  console.log(`seeded ${menuName} for ${restaurantId}`)
}

await seedRestaurant(NINO, 'Menu', NINO_MENU)
await seedRestaurant(PIZZA, 'Menu Pizzeria', PIZZA_MENU)
await sql.end()
console.log('done')
