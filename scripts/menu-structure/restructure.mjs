// Ristruttura i workspace secondo plan.mjs. Puro: nessun accesso alla rete.
import {randomUUID} from 'node:crypto'
import {BREAKFAST_MENU,BREAKFAST_COFFEE_SECTION,misplacedBreakfast,isBreakfastMenuName,breakfastCoffeeSources,copyItemWithNewIds} from './breakfast.mjs'
const clone = v => structuredClone(v)
const itemsOf = (sections) => sections.flatMap(s => s.items)

export function restructure(workspace, plan, { newId = randomUUID } = {}) {
  const errors = [], removed = [], notes = []
  const w = clone(workspace), byName = new Map(w.menus.map(m => [m.name, m]))
  const used = new Set()
  const menu = name => { const m = byName.get(name); if (!m) errors.push(`menu inesistente: ${name}`); return m }
  const subtree = (m, root) => { const out = [root], queue = [root.id]; while (queue.length) { const id = queue.shift(); for (const s of m.sections) if (s.parentSectionId === id && !out.includes(s)) { out.push(s); queue.push(s.id) } } return out }
  const roots = m => m.sections.filter(s => !s.parentSectionId || !m.sections.some(p => p.id === s.parentSectionId))
  const pick = (m, selection, except = []) => {
    if (selection === '*') return roots(m).filter(s => !except.includes(s.name))
    return selection.map(name => { const s = m.sections.find(x => x.name === name); if (!s) errors.push(`sezione inesistente: ${m.name} / ${name}`); return s }).filter(Boolean)
  }
  // Sezioni eliminate per motivo esplicito.
  for (const [menuName, sectionName, reason] of plan.drop || []) {
    const m = menu(menuName); if (!m) continue
    for (const root of pick(m, sectionName === '*' ? '*' : [sectionName])) for (const s of subtree(m, root)) {
      if (used.has(s.id)) continue; used.add(s.id)
      for (const it of s.items) removed.push({ menu: menuName, section: s.name, item: it.name, hidden: !!it.hidden, reason })
    }
  }
  const targets = []
  // Colazione sempre prima (regola 16/10/2026); per il resto vale l'ordine del piano.
  const ordered = [...plan.targets].sort((a, b) => (b.name === BREAKFAST_MENU) - (a.name === BREAKFAST_MENU))
  for (const t of ordered) {
    // keep assente = menu nuovo (es. Colazione creata dove prima non c'era).
    const base = t.keep ? menu(t.keep) : { id: randomUUID(), name: t.name, description: null, type: t.type, active: true, translations: {}, sections: [] }
    if (!base) continue
    const next = { ...clone(base), name: t.name, type: t.type, active: true, sections: [] }
    if (base.name !== t.name) next.translations = {}
    for (const [menuName, selection, options = {}] of t.from) {
      const m = menu(menuName); if (!m) continue
      const chosen = pick(m, selection, options.except || [])
      let wrapper = null
      if (options.wrap) { wrapper = { id: randomUUID(), name: options.wrap, items: [], active: true, description: null, translations: {}, parentSectionId: null }; next.sections.push(wrapper) }
      for (const root of chosen) for (const s of subtree(m, root)) {
        if (used.has(s.id)) { errors.push(`sezione usata due volte: ${m.name} / ${s.name}`); continue }
        used.add(s.id)
        const copy = clone(s)
        if (s === root) copy.parentSectionId = wrapper ? wrapper.id : null
        next.sections.push(copy)
      }
    }
    targets.push(next)
  }
  // Tutto ciò che non è stato preso né eliminato deve essere vuoto.
  for (const m of w.menus) for (const s of m.sections) if (!used.has(s.id)) {
    if (s.items.length) errors.push(`sezione non assegnata con ${s.items.length} piatti: ${m.name} / ${s.name}`)
    else notes.push(`sezione vuota eliminata: ${m.name} / ${s.name}`)
  }
  for (const m of w.menus) if (!plan.targets.some(t => t.keep === m.name) && !m.sections.some(s => used.has(s.id)) ) notes.push(`menu eliminato: ${m.name}${m.sections.length ? '' : ' (vuoto)'}`)
  // Sezioni senza piatti nel proprio albero (anche nascosti) spariscono; i contenitori di sottocategorie restano.
  for (const t of targets) {
    for (let changed = true; changed;) {
      changed = false
      for (const s of [...t.sections]) {
        const tree = subtree(t, s)
        if (!itemsOf(tree).length) { t.sections = t.sections.filter(x => !tree.includes(x)); notes.push(`sezione vuota eliminata: ${t.name} / ${s.name}`); changed = true; break }
      }
    }
    for (const s of t.sections) if (plan.rename?.[s.name]) { notes.push(`rinominata: ${s.name} → ${plan.rename[s.name]}`); s.name = plan.rename[s.name] }
  }
  const finalMenus = targets.filter(t => { if (!itemsOf(t.sections).length) { notes.push(`destinazione vuota omessa: ${t.name}`); return false } return true })
  // Regola CAFFETTERIA (16/10/2026): se c'è il menu Colazione, la caffetteria calda delle bevande ci viene anche COPIATA
  // (id nuovi per piatto e varianti) in una sezione "Caffetteria" in fondo, stesso ordine; l'originale resta nelle bevande.
  // Idempotente: se Colazione ha già una sezione "Caffetteria" non copia nulla. plan.breakfastCoffee === false la disattiva.
  const copiedIds = new Set()
  const colazione = finalMenus.find(m => isBreakfastMenuName(m.name))
  if (colazione && plan.breakfastCoffee !== false) {
    if (colazione.sections.some(s => s.name.trim().toLowerCase() === BREAKFAST_COFFEE_SECTION.toLowerCase())) notes.push(`"${BREAKFAST_COFFEE_SECTION}" già presente in ${colazione.name}: nessuna copia`)
    else {
      const sources = breakfastCoffeeSources(finalMenus)
      if (sources.length) {
        const items = sources.map(x => { const c = copyItemWithNewIds(x.item, newId); copiedIds.add(c.id); return c })
        colazione.sections.push({ id: newId(), parentSectionId: null, name: BREAKFAST_COFFEE_SECTION, description: null, active: true, translations: {}, items })
        notes.push(`caffetteria copiata in ${colazione.name} / ${BREAKFAST_COFFEE_SECTION}: ${sources.map(x => x.item.name).join(', ')}`)
      }
    }
  }
  // Regola COLAZIONE: nessuna sezione da colazione fuori dal menu Colazione.
  for (const x of misplacedBreakfast(finalMenus)) errors.push(`colazione fuori da "${BREAKFAST_MENU}": ${x.menu} / ${x.section}`)
  // Invarianti: ogni piatto è identico nella nuova struttura oppure è tra quelli eliminati con motivo.
  const after = new Map(finalMenus.flatMap(m => itemsOf(m.sections)).filter(it => !copiedIds.has(it.id)).map(it => [it.id, it]))
  const allIds = finalMenus.flatMap(m => [m.id, ...m.sections.flatMap(s => [s.id, ...s.items.flatMap(it => [it.id, ...(it.variants || []).map(v => v.id)])])]); if (new Set(allIds).size !== allIds.length) errors.push('id duplicati dopo la copia della caffetteria')
  const droppedIds = new Set(), before = workspace.menus.flatMap(m => itemsOf(m.sections))
  for (const [menuName, sectionName] of plan.drop || []) { const m = workspace.menus.find(x => x.name === menuName); if (!m) continue; for (const s of m.sections) if (sectionName === '*' || s.name === sectionName || subtreeIds(m, sectionName).has(s.id)) for (const it of s.items) droppedIds.add(it.id) }
  for (const it of before) {
    if (droppedIds.has(it.id)) { if (after.has(it.id)) errors.push(`piatto eliminato ma ancora presente: ${it.name}`); continue }
    const a = after.get(it.id)
    if (!a) errors.push(`piatto perso: ${it.name}`)
    else if (JSON.stringify(a) !== JSON.stringify(it)) errors.push(`piatto modificato: ${it.name}`)
  }
  if (after.size + droppedIds.size !== before.length) errors.push(`conteggio piatti: prima ${before.length}, dopo ${after.size} + eliminati ${droppedIds.size}`)
  const ids = finalMenus.flatMap(m => m.sections.map(s => s.id)); if (new Set(ids).size !== ids.length) errors.push('id sezione duplicati')
  // Nessun riferimento rimasto a menu eliminati (PDF, preset, design).
  const gone = workspace.menus.map(m => m.id).filter(id => !finalMenus.some(m => m.id === id))
  const rest = JSON.stringify({ ...w, menus: undefined })
  for (const id of gone) if (rest.includes(id)) errors.push(`riferimento a menu eliminato fuori dai menu: ${id}`)
  return { workspace: { ...w, menus: finalMenus }, removed, notes, errors, copied: [...copiedIds] }
  function subtreeIds(m, rootName) { const root = m.sections.find(s => s.name === rootName); return root ? new Set(subtree(m, root).map(s => s.id)) : new Set() }
}

export function summary(w) {
  return w.menus.map(m => `${m.name} [${m.type}${m.active === false ? ', inattivo' : ''}]: ${m.sections.filter(s => !s.parentSectionId).map(s => s.name).join(' · ')} (${itemsOf(m.sections).length} piatti)`)
}
