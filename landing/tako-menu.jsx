// tako-menu.jsx — menu view, item sheet, allergen filter, cart sheet
const { useState: uS, useEffect: uE, useRef: uR, useMemo: uM } = React;

/* dish placeholder tile */
function Dish({ name, size = 64, radius = 14 }) {
  const init = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(' ').filter(Boolean).slice(0, 1).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="dish-img" style={{ width: size, height: size, borderRadius: radius, ...dishStyle(name) }}>
      <span className="dish-mono" style={{ fontSize: size * 0.42 }}>{init}</span>
    </div>
  );
}

/* ───────────────── item detail sheet ───────────────── */
function ItemSheet({ item, open, onClose }) {
  const [qty, setQty] = uS(1);
  const [variant, setVariant] = uS(null);
  const [notes, setNotes] = uS('');
  uE(() => { if (open) { setQty(1); setVariant(item?.variants ? item.variants[0].id : null); setNotes(''); } }, [open, item]);
  const heroRef = uR(null);
  if (!item) return null;
  const v = item.variants ? item.variants.find(x => x.id === variant) : null;
  const unit = item.price + (v ? v.delta : 0);

  const add = () => {
    cart.add({ menuItemId: item.id, variantId: v ? v.id : null, name: item.name + (v && v.delta ? ` · ${v.name}` : ''), unitPrice: unit, quantity: qty, notes: notes.trim() });
    flyToCart(heroRef.current, dishStyle(item.name).background);
    onClose();
    toast(`${qty}× ${trName(item)} ${tr('added')}`, { type: 'success' });
  };

  return (
    <Sheet open={open} onClose={onClose} maxH="92%">
      <div style={{ padding: '0 0 18px' }}>
        {/* hero (shared-element feel) */}
        <div style={{ padding: '0 20px' }}>
          <div ref={heroRef} className="dish-img" style={{ width: '100%', height: 188, borderRadius: 20, ...dishStyle(item.name), animation: 'pop-soft .55s var(--spring)' }}>
            <span className="dish-mono" style={{ fontSize: 90, opacity: .9 }}>{item.name[0].toUpperCase()}</span>
            {item.tags?.length > 0 && (
              <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>{item.tags.map(t => <Tag key={t}>{trTag(t)}</Tag>)}</div>
            )}
          </div>
        </div>

        <div style={{ padding: '18px 20px 0' }}>
          <h3 style={{ fontSize: 23, fontWeight: 700 }}>{trName(item)}</h3>
          <p style={{ color: 'var(--ink-2)', fontSize: 14.5, lineHeight: 1.5, marginTop: 7 }}>{trDesc(item)}</p>

          {item.allergens.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{tr('allergens')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{item.allergens.map(a => <AllergenDot key={a} id={a} withLabel />)}</div>
            </div>
          )}

          {item.variants && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{tr('choosePortion')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.variants.map(opt => {
                  const on = variant === opt.id;
                  return (
                    <button key={opt.id} className="press-sm" onClick={() => setVariant(opt.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 14, textAlign: 'left',
                        background: on ? 'var(--brand-tint)' : 'var(--surface)', boxShadow: on ? 'inset 0 0 0 2px var(--brand)' : 'inset 0 0 0 1.5px var(--hairline)', transition: 'all .18s var(--out)' }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{opt.name}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: opt.delta ? 'var(--brand-deep)' : 'var(--ink-3)' }}>{opt.delta ? '+ ' + eur(opt.delta) : tr('included')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{tr('kitchenNotes')}</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={tr('notesPh')} rows={2}
              style={{ width: '100%', resize: 'none', border: 'none', outline: 'none', background: 'var(--surface)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)', borderRadius: 'var(--r-input)', padding: '12px 14px', fontSize: 14.5, color: 'var(--ink)' }} />
          </div>
        </div>
      </div>

      {/* sticky add bar */}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--raised)', borderTop: '1px solid var(--hairline)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Qty value={qty} onChange={q => setQty(Math.max(1, q))} min={1} size="lg" />
        <Btn full onClick={add} style={{ flex: 1 }}>
          <span style={{ flex: 1, textAlign: 'left' }}>{tr('add')}</span>
          <span className="tnum">{eur(unit * qty)}</span>
        </Btn>
      </div>
    </Sheet>
  );
}

/* ───────────────── allergen filter sheet ───────────────── */
function FilterSheet({ open, onClose, excluded, setExcluded }) {
  const toggle = (id) => setExcluded(excluded.includes(id) ? excluded.filter(x => x !== id) : [...excluded, id]);
  return (
    <Sheet open={open} onClose={onClose} title={tr('filterTitle')} sub={tr('filterSub')} leadIcon="filter">
      <div style={{ padding: '4px 20px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {ALLERGENS.map(a => {
          const on = excluded.includes(a.id);
          return (
            <button key={a.id} className="press-sm" onClick={() => toggle(a.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, textAlign: 'left',
                background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--ink)',
                boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--hairline)', transition: 'all .18s var(--out)' }}>
              <span style={{ fontSize: 18 }}>{a.emoji}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{trAllg(a.id)}</span>
              {on && <Icon name="x" size={15} />}
            </button>
          );
        })}
      </div>
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--raised)', borderTop: '1px solid var(--hairline)', padding: '12px 20px', display: 'flex', gap: 10 }}>
        {excluded.length > 0 && <Btn kind="ghost" onClick={() => setExcluded([])}>{tr('reset')}</Btn>}
        <Btn full onClick={onClose} style={{ flex: 1 }}>{excluded.length ? tr('showDishes') : tr('done')}</Btn>
      </div>
    </Sheet>
  );
}

/* ───────────────── menu view ───────────────── */
function MenuView({ onOpenCart }) {
  const c = useStore(cartStore);
  const count = cartCount(c.items), total = cartTotal(c.items);
  const animTotal = useCountUp(total);
  const [active, setActive] = uS(MENU[0].id);
  const [indStyle, setIndStyle] = uS({ x: 16, w: 78 });
  const [excluded, setExcluded] = uS([]);
  const [filterOpen, setFilterOpen] = uS(false);
  const [item, setItem] = uS(null);
  const [itemOpen, setItemOpen] = uS(false);
  const scrollRef = uR(null);
  const secRefs = uR({});
  const tabRefs = uR({});
  const lockRef = uR(0);

  const visibleSections = uM(() => MENU.map(s => ({
    ...s, items: s.items.filter(it => !it.allergens.some(a => excluded.includes(a))),
  })).filter(s => s.items.length), [excluded]);

  const onScroll = () => {
    if (Date.now() < lockRef.current) return;
    const top = scrollRef.current.scrollTop + 130;
    let cur = visibleSections[0]?.id;
    for (const s of visibleSections) { const el = secRefs.current[s.id]; if (el && el.offsetTop <= top) cur = s.id; }
    if (cur && cur !== active) setActive(cur);
  };
  const goTo = (id) => {
    const el = secRefs.current[id]; if (!el) return;
    lockRef.current = Date.now() + 650;
    setActive(id);
    scrollRef.current.scrollTo({ top: el.offsetTop - 104, behavior: 'smooth' });
  };
  uE(() => { // keep active tab in view + move sliding indicator
    const tab = tabRefs.current[active]; const strip = tab?.parentElement;
    if (tab) setIndStyle({ x: tab.offsetLeft, w: tab.offsetWidth });
    if (tab && strip) strip.scrollTo({ left: tab.offsetLeft - 60, behavior: 'smooth' });
  }, [active, excluded]);

  const openItem = (it) => { if (!it.available) return; setItem(it); setItemOpen(true); };

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
    <div ref={scrollRef} onScroll={onScroll} className="scroll" style={{ flex: 1, minHeight: 0 }}>
      {/* sticky tabs + filter */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(var(--surface) 72%, transparent)', paddingTop: 4 }}>
        <div className="scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 16px 10px', alignItems: 'center', position: 'relative' }}>
          <div aria-hidden style={{ position: 'absolute', top: 6, left: 0, height: 35, width: indStyle.w, transform: `translateX(${indStyle.x}px)`, background: 'var(--ink)', borderRadius: 999, transition: 'transform .44s var(--spring), width .44s var(--spring)', zIndex: 0, pointerEvents: 'none' }} />
          {visibleSections.map(s => {
            const on = active === s.id;
            return (
              <button key={s.id} ref={el => tabRefs.current[s.id] = el} onClick={() => goTo(s.id)} className="press-sm"
                style={{ position: 'relative', zIndex: 1, flex: 'none', padding: '8px 15px', borderRadius: 999, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
                  background: 'transparent', color: on ? 'var(--surface)' : 'var(--ink-3)', transition: 'color .3s var(--out)' }}>{trCat(s.id, s.name)}</button>
            );
          })}
          <button onClick={() => setFilterOpen(true)} className="press-sm" aria-label="Filtra allergeni"
            style={{ position: 'relative', zIndex: 1, flex: 'none', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, fontSize: 14, fontWeight: 700,
              background: excluded.length ? 'var(--brand)' : 'var(--raised)', color: excluded.length ? 'var(--on-brand)' : 'var(--ink-2)', boxShadow: 'var(--sh-1)' }}>
            <Icon name="filter" size={16} />{excluded.length ? excluded.length : ''}
          </button>
        </div>
      </div>

      {excluded.length > 0 && (
        <div style={{ margin: '0 16px 4px', padding: '9px 14px', borderRadius: 12, background: 'var(--brand-wash)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--brand-deep)', fontWeight: 600 }}>
          <Icon name="info" size={15} /> {tr('hidingWith')} {excluded.map(e => trAllg(e).toLowerCase()).join(', ')}.
        </div>
      )}

      <div style={{ padding: '4px 16px 0' }}>
        {visibleSections.map((s, si) => (
          <section key={s.id} ref={el => secRefs.current[s.id] = el} style={{ paddingTop: si === 0 ? 6 : 22 }}>
            <h2 className="serif" style={{ fontSize: 27, marginBottom: 12, paddingLeft: 2 }}>{trCat(s.id, s.name)}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {s.items.map((it, i) => (
                <button key={it.id} onClick={() => openItem(it)} disabled={!it.available} className={it.available ? 'press-sm' : ''}
                  style={{ display: 'flex', gap: 14, textAlign: 'left', alignItems: 'stretch', background: 'var(--raised)', borderRadius: 'var(--r-card)',
                    padding: 12, boxShadow: 'var(--sh-1)', opacity: it.available ? 1 : .58, cursor: it.available ? 'pointer' : 'default',
                    animation: 'item-in .55s var(--spring) both', animationDelay: (si * 0.05 + i * 0.06) + 's' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{trName(it)}</span>
                      {it.tags?.slice(0, 1).map(t => <Tag key={t}>{trTag(t)}</Tag>)}
                    </div>
                    <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.45, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{trDesc(it)}</p>
                    <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="tnum" style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{eur(it.price)}</span>
                      <div style={{ display: 'flex', gap: 1 }}>{it.allergens.slice(0, 5).map(a => <AllergenDot key={a} id={a} />)}</div>
                    </div>
                  </div>
                  <div style={{ position: 'relative', flex: 'none' }}>
                    <Dish name={trName(it)} size={86} radius={14} />
                    {!it.available
                      ? <span style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(42,31,26,.66)', backdropFilter: 'saturate(.4)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, letterSpacing: '.03em' }}>{tr('soldOut')}</span>
                      : <span className="press" style={{ position: 'absolute', right: -6, bottom: -6, width: 30, height: 30, borderRadius: 999, background: 'var(--brand)', color: 'var(--on-brand)', display: 'grid', placeItems: 'center', boxShadow: 'var(--sh-2)' }}><Icon name="plus" size={17} stroke={2.6} /></span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div style={{ height: count > 0 ? 156 : 96 }} />
    </div>

      {/* floating cart bar */}
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-b) + 84px)', zIndex: 30, pointerEvents: count ? 'auto' : 'none',
        transform: count ? 'translateY(0) scale(1)' : 'translateY(120%) scale(.95)', opacity: count ? 1 : 0, transition: 'all .42s var(--spring)' }}>
        <button onClick={onOpenCart} className="press"
          style={{ width: '100%', height: 58, borderRadius: 18, background: 'var(--brand)', color: 'var(--on-brand)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px 0 16px', boxShadow: '0 14px 30px -8px var(--brand), 0 6px 16px rgba(42,31,26,.18)' }}>
          <span key={count} style={{ minWidth: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, animation: 'pop-soft .4s var(--spring)' }}>{count}</span>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1, textAlign: 'left' }}>{tr('viewCart')}</span>
          <span className="tnum" style={{ fontWeight: 700, fontSize: 16, background: 'rgba(255,255,255,.16)', padding: '8px 14px', borderRadius: 12 }}>{eur(animTotal)}</span>
        </button>
      </div>

      <ItemSheet item={item} open={itemOpen} onClose={() => setItemOpen(false)} />
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} excluded={excluded} setExcluded={setExcluded} />
    </div>
  );
}

/* ───────────────── cart sheet ───────────────── */
function CartSheet({ open, onClose, onConfirm }) {
  const c = useStore(cartStore);
  const items = c.items, total = cartTotal(items);
  const animTotal = useCountUp(total);
  const [notes, setNotes] = uS(c.orderNotes || '');
  uE(() => { cartStore.set({ orderNotes: notes }); }, [notes]);

  return (
    <Sheet open={open} onClose={onClose} title={tr('yourOrder')} sub={items.length ? `${tr('table')} ${sessionStore.get().tableNumber}` : null} leadIcon="bag" maxH="90%">
      {items.length === 0 ? (
        <div style={{ padding: '20px 30px 40px', textAlign: 'center' }}>
          <img src="assets/tako-pasta.png" alt="" className="anim-float" style={{ width: 150, margin: '0 auto', filter: 'drop-shadow(0 16px 26px rgba(217,83,58,.18))' }} />
          <h3 style={{ fontSize: 19, fontWeight: 700, marginTop: 8 }}>{tr('cartEmpty')}</h3>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginTop: 6, marginBottom: 20 }}>{tr('cartEmptySub')}</p>
          <Btn onClick={onClose} icon="arrowLeft">{tr('backToMenu')}</Btn>
        </div>
      ) : (
        <>
          <div style={{ padding: '4px 20px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(li => (
              <div key={li.key} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--hairline)', animation: 'rise-fade .35s var(--out) both' }}>
                <Dish name={trLine(li)} size={52} radius={12} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.3 }}>{trLine(li)}</p>
                  {li.notes && <p style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>“{li.notes}”</p>}
                  <p className="tnum" style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 3, fontWeight: 600 }}>{eur(li.unitPrice)}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <Qty value={li.quantity} onChange={q => cart.setQty(li.key, q)} min={0} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 6 }}>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={tr('orderNotesPh')} rows={2}
                style={{ width: '100%', resize: 'none', border: 'none', outline: 'none', background: 'var(--surface)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)', borderRadius: 'var(--r-input)', padding: '12px 14px', fontSize: 14, color: 'var(--ink)' }} />
            </div>
          </div>
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--raised)', borderTop: '1px solid var(--hairline)', padding: '12px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{tr('total')}</span>
              <span className="serif tnum" style={{ fontSize: 26 }}>{eur(animTotal)}</span>
            </div>
            <Btn full onClick={onConfirm} icon="check">{tr('confirmOrder')}</Btn>
          </div>
        </>
      )}
    </Sheet>
  );
}

Object.assign(window, { MenuView, CartSheet, Dish });
