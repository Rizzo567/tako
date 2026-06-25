// tako-app.jsx — splash, app shell (header + nav + views + overlays), theme, tweaks, mount
const { useState: aS, useEffect: aE, useRef: aR } = React;

// keyframe per le animazioni-al-click (WAAPI: affidabili, indipendenti dai re-render)
const KF_RING = [{transform:'rotate(0deg)'},{transform:'rotate(-15deg)',offset:.15},{transform:'rotate(12deg)',offset:.32},{transform:'rotate(-8deg)',offset:.5},{transform:'rotate(5deg)',offset:.68},{transform:'rotate(-2deg)',offset:.84},{transform:'rotate(0deg)'}];
const KF_HOP = [{transform:'translateY(0) scale(1)'},{transform:'translateY(-8px) scale(1.07)',offset:.4},{transform:'translateY(0) scale(.96)',offset:.72},{transform:'translateY(0) scale(1)'}];
const KF_WIGGLE = [{transform:'rotate(0deg)'},{transform:'rotate(-8deg)',offset:.25},{transform:'rotate(7deg)',offset:.5},{transform:'rotate(-3deg)',offset:.75},{transform:'rotate(0deg)'}];

/* ───────────────── iPhone 14 Pro frame ───────────────── */
function PhoneStatusBar() {
  const c = '#1a1512';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 32px 0', height: 52, boxSizing: 'border-box' }}>
      <span style={{ fontFamily: '-apple-system, "SF Pro", system-ui', fontWeight: 600, fontSize: 16, color: c, letterSpacing: '.2px', minWidth: 54 }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="7.5" width="3" height="4.5" rx=".7" fill={c}/><rect x="4.5" y="5" width="3" height="7" rx=".7" fill={c}/><rect x="9" y="2.5" width="3" height="9.5" rx=".7" fill={c}/><rect x="13.5" y="0" width="3" height="12" rx=".7" fill={c}/></svg>
        <svg width="16" height="12" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill={c}/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill={c}/><circle cx="8.5" cy="10.5" r="1.4" fill={c}/></svg>
        <svg width="26" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="19" height="9" rx="2" fill={c}/><path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function PhoneFrame({ children }) {
  const [scale, setScale] = aS(1);
  aE(() => {
    const fit = () => {
      const s = Math.min(1, (window.innerHeight - 36) / 852, (window.innerWidth - 36) / 393);
      setScale(s > 0 ? s : 1);
    };
    fit();
    requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center', flex: 'none' }}>
      <div style={{ position: 'relative', width: 393, height: 852, borderRadius: 56, background: '#08070a', padding: 4,
        boxShadow: '0 50px 110px rgba(0,0,0,.55), 0 0 0 2px #2b2b30, 0 0 0 5px #0a0a0c, inset 0 0 2px 1px rgba(255,255,255,.08)' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 52, overflow: 'hidden', background: 'var(--surface)' }}>
          {children}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 55, pointerEvents: 'none' }}><PhoneStatusBar /></div>
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 125, height: 36, borderRadius: 20, background: '#000', zIndex: 60 }} />
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, borderRadius: 99, background: 'rgba(0,0,0,.26)', zIndex: 60, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────── theme math ───────────────── */
function _rgb(h) { h = (h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); }
function _mix(a, b, w) { const f = (x, y) => Math.round(x + (y - x) * w); return `rgb(${f(a[0], b[0])},${f(a[1], b[1])},${f(a[2], b[2])})`; }
function _lum(c) { const s = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * s[0] + .7152 * s[1] + .0722 * s[2]; }
function applyTheme(brand) {
  const r = document.documentElement, c = _rgb(brand), W = [255, 255, 255], K = [20, 12, 10];
  r.style.setProperty('--brand', brand);
  r.style.setProperty('--brand-deep', _mix(c, K, .2));
  r.style.setProperty('--brand-tint', _mix(c, W, .82));
  r.style.setProperty('--brand-wash', _mix(c, W, .9));
  r.style.setProperty('--on-brand', _lum(c) > 0.62 ? '#2A1F1A' : '#FFFFFF');
}

/* ───────────────── faux QR ───────────────── */
function QRTako() {
  const N = 21, cells = [];
  const eye = (x, y) => { for (const [ox, oy] of [[0, 0], [N - 7, 0], [0, N - 7]]) { const dx = x - ox, dy = y - oy; if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) { const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6; const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4; return ring || core ? 1 : 0; } } return -1; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const e = eye(x, y); cells.push(e >= 0 ? e : (((x * 31 + y * 17 + x * y * 7) % 3 === 0) ? 1 : 0)); }
  return (
    <div style={{ width: 134, height: 134, background: '#fff', borderRadius: 18, padding: 12, boxShadow: 'var(--sh-2)', display: 'grid', gridTemplateColumns: `repeat(${N},1fr)`, gap: 0 }}>
      {cells.map((v, i) => <span key={i} style={{ background: v ? 'var(--ink)' : 'transparent', borderRadius: 1 }} />)}
    </div>
  );
}

/* ───────────────── splash / landing ───────────────── */
function Splash({ onEnter }) {
  const reduce = useReducedMotion();
  const A = (d) => reduce ? {} : { animation: `rise-fade .7s var(--spring) both`, animationDelay: d };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 30px calc(var(--safe-b) + 30px)', position: 'relative', overflow: 'hidden' }}>
      <Bubbles count={11} color="var(--brand-tint)" />
      <div style={{ position: 'relative', width: 200, height: 190, ...(reduce ? {} : { animation: 'pop-in .8s var(--spring) both' }) }}>
        {!reduce && [0, 1].map(i => <span key={i} style={{ position: 'absolute', inset: '28% 18%', borderRadius: 999, background: 'var(--brand-tint)', animation: `pulse-ring 3s ${i * 1.5}s ease-out infinite` }} />)}
        <img src="assets/tako-hello.png" alt="Tako" className="anim-bob" style={{ position: 'relative', width: 200, filter: 'drop-shadow(0 22px 34px rgba(217,83,58,.28))' }} />
      </div>

      <h1 className="serif" style={{ fontSize: 58, lineHeight: 1, marginTop: 6, letterSpacing: '-.01em', ...A('.15s') }}>Tako</h1>
      <p style={{ fontSize: 16.5, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 14, maxWidth: 280, ...A('.28s') }}>
        Scansiona il <b style={{ color: 'var(--ink)' }}>QR sul tuo tavolo</b> per sfogliare il menù e ordinare. Niente app da scaricare.
      </p>

      <div style={{ marginTop: 30, ...A('.42s') }}><QRTako /></div>

      <div style={{ marginTop: 30, width: '100%', maxWidth: 320, ...A('.54s') }}>
        <Btn full onClick={onEnter} icon="arrowRight" style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
          <span style={{ flex: 1, textAlign: 'left' }}>Simula la scansione</span>
        </Btn>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 14 }}>Demo · Trattoria da Mauro · Tavolo 7</p>
      </div>
    </div>
  );
}

/* ───────────────── header (ridisegnato: niente barra piena, controlli "glass" leggeri) ───────────────── */
function GlassIconBtn({ img, onClick, badge, label, text, idle, clickKf, imgOrigin }) {
  return (
    <button onClick={(e) => { const im = e.currentTarget.querySelector('img'); if (im && clickKf) { try { im.animate(clickKf, { duration: 850, easing: 'ease-in-out' }); } catch (_) {} } onClick && onClick(); }} aria-label={label} className="press-sm"
      style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
      <span style={{ position: 'relative', width: 46, height: 46, display: 'grid', placeItems: 'center' }}>
        <img src={img} alt="" style={{ width: 42, height: 42, objectFit: 'contain', display: 'block', animation: idle, transformOrigin: imgOrigin || '50% 85%', filter: 'drop-shadow(0 5px 7px rgba(42,31,26,.24))' }} />
        {badge > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px var(--surface)' }}>{badge}</span>
        )}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1 }}>{text}</span>
    </button>
  );
}

function Header({ onCart, onWaiter, count, compact }) {
  return (
    <header style={{ flex: 'none', overflow: 'hidden', background: 'var(--surface)', position: 'relative', zIndex: 30,
      maxHeight: compact ? 0 : 'calc(var(--safe-t) + 94px)', transition: 'max-height .45s var(--spring)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, padding: 'calc(var(--safe-t) + 8px) 14px 12px',
        transform: compact ? 'translateY(-84px)' : 'none', opacity: compact ? 0 : 1, transition: 'transform .45s var(--spring), opacity .3s ease' }}>
        <GlassIconBtn img="assets/nav/m-bell.png" onClick={onWaiter} label="Chiama cameriere" text="Cameriere" idle="wiggle 3.6s ease-in-out infinite" clickKf={KF_RING} imgOrigin="50% 14%" />
        <GlassIconBtn img="assets/nav/m-bag.png" onClick={onCart} badge={count} label="Carrello" text="Carrello" idle="float-soft 4.4s ease-in-out infinite" clickKf={KF_HOP} imgOrigin="50% 85%" />
      </div>
    </header>
  );
}

/* ───────────────── bottom nav (si rimpicciolisce + nasconde le scritte allo scroll) ───────────────── */
function BottomNav({ view, setView, aiEnabled, orderActive, compact, merging }) {
  const items = [
    { id: 'menu', icon: 'bowl', label: tr('navMenu') },
    { id: 'tracking', icon: 'clock', label: tr('navOrder'), dot: orderActive },
    aiEnabled && { id: 'chat', icon: 'sparkles', label: tr('navAssistant') },
  ].filter(Boolean);
  const idx = Math.max(0, items.findIndex(i => i.id === view)); const n = items.length;
  const pad = compact ? 4 : 6;
  const spring = 'var(--spring)';
  const [playId, setPlayId] = aS(null);
  const NAV_IMG = { menu: 'assets/nav/m-menu.png', tracking: 'assets/nav/m-order.png', chat: 'assets/tako-phone.png' };
  const NAV_DUR = { menu: 3.6, tracking: 4.2, chat: 3.9 };
  const NAV_KF = { tracking: KF_WIGGLE };   // solo le icone con mp4 hanno animazione al click
  const isz = compact ? 28 : 32;
  return (
    <nav style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(var(--safe-b) + 14px)', zIndex: 40, display: 'flex', padding: pad, borderRadius: compact ? 18 : 22,
      transition: `padding .42s ${spring}, border-radius .42s ${spring}, box-shadow .42s ${spring}, border-color .42s ${spring}`,
      background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)',
      border: merging ? '1px solid transparent' : '1px solid rgba(255,255,255,0.55)', boxShadow: merging ? 'none' : '0 12px 34px rgba(42,31,26,.22), inset 0 1px 0 rgba(255,255,255,.75), inset 0 -1px 0 rgba(255,255,255,.2)' }}>
      {items.map(it => {
        const on = view === it.id;
        return (
          <button key={it.id} onClick={(e) => { setView(it.id); const im = e.currentTarget.querySelector('img'); if (im && NAV_KF[it.id]) { try { im.animate(NAV_KF[it.id], { duration: 800, easing: 'ease-in-out' }); } catch (_) {} } }} className="press-sm"
            style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 0 : 3, padding: compact ? '6px 0' : '4px 0', color: on ? 'var(--brand)' : 'var(--ink-3)', transition: `color .3s, padding .42s ${spring}, gap .42s ${spring}` }}>
            <span style={{ position: 'relative', transition: `transform .3s ${spring}`, transform: on ? 'translateY(-1px) scale(1.08)' : 'none' }}>
              <img src={NAV_IMG[it.id]} alt=""
                style={{ width: isz, height: isz, objectFit: 'contain', display: 'block', transition: `width .42s ${spring}, height .42s ${spring}`,
                  animation: `bob ${NAV_DUR[it.id]}s ease-in-out infinite`,
                  transformOrigin: '50% 85%', filter: 'drop-shadow(0 4px 5px rgba(42,31,26,.18))' }} />
              {it.dot && <span style={{ position: 'absolute', top: -2, right: -3, width: 9, height: 9, borderRadius: 999, background: 'var(--ok)', boxShadow: '0 0 0 2px var(--surface)', animation: 'badge-pop 1.6s ease-in-out infinite' }} />}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, overflow: 'hidden', maxHeight: compact ? 0 : 16, opacity: compact ? 0 : 1, transform: compact ? 'translateY(-4px)' : 'none', transition: `max-height .4s ${spring}, opacity .25s ease, transform .4s ${spring}` }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ───────────────── app ───────────────── */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brand": "#ED7159",
  "aiEnabled": true,
  "tableNumber": 7,
  "screen": "splash"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const c = useStore(cartStore);
  const o = useStore(orderStore);
  const count = cartCount(c.items);
  const [cartOpen, setCartOpen] = aS(false);
  const [waiterOpen, setWaiterOpen] = aS(false);
  const [demoView, setDemoView] = aS('menu');
  const [mergePhase, setMergePhase] = aS(0);          // 0 idle · 2 fusione barra+riquadro
  const launchCart = () => {                           // "Vedi carrello" -> fusione barra+riquadro, poi apre
    setMergePhase(2);
    setTimeout(() => {
      setCartOpen(true);
      setTimeout(() => setMergePhase(0), 380);
    }, 470);
  };
  const [navCompact, setNavCompact] = aS(false);

  const SP = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const bare = SP.has('bare');   // no device bezel / tweaks — fill the iframe
  const demo = SP.has('demo');   // auto-navigate the menu (for landing showcase)
  const sync = SP.has('sync');   // scripted order → postMessage to dashboard (showcase)
  const tableNo = Number(SP.get('table')) || Number(t.tableNumber) || 7;  // showcase: per-iframe table number
  const startDelay = Number(SP.get('delay')) || 0;                         // showcase: stagger each table's loop
  const scripted = demo || sync;

  const view = scripted ? demoView : t.screen;
  const setView = scripted ? setDemoView : ((v) => setTweak('screen', v));
  const orderActive = !!o.orderId && stepIndex(o.status) < ORDER_STEPS.length - 1;

  // bottom nav: scroll giù → compatta (icone più piccole, scritte nascoste); scroll su → torna piena.
  aE(() => { setNavCompact(false); }, [view]);
  aE(() => {
    let el = null, prev = 0, raf = 0, lastFlip = 0;
    const onScroll = () => {
      const top = el.scrollTop;
      const maxTop = el.scrollHeight - el.clientHeight;
      const dy = top - prev; prev = top;
      if (top <= 16) { setNavCompact(false); return; }
      if (maxTop > 0 && top >= maxTop - 14) return;   // zona fondo: non toggla (evita tremolio da rimbalzo + reflow)
      if (Math.abs(dy) < 7) return;
      const now = Date.now();
      if (now - lastFlip < 240) return;               // cooldown anti-flicker
      lastFlip = now;
      setNavCompact(dy > 0);
    };
    const attach = () => {
      el = document.querySelector('.app main .scroll');
      if (!el) { raf = requestAnimationFrame(attach); return; }
      prev = el.scrollTop;
      el.addEventListener('scroll', onScroll, { passive: true });
    };
    attach();
    return () => { if (raf) cancelAnimationFrame(raf); if (el) el.removeEventListener('scroll', onScroll); };
  }, [view]);

  aE(() => { applyTheme(t.brand); sessionStore.set({ primaryColor: t.brand }); }, [t.brand]);
  aE(() => { sessionStore.set({ aiEnabled: t.aiEnabled, tableNumber: tableNo }); }, [t.aiEnabled, tableNo]);
  aE(() => { if (!t.aiEnabled && view === 'chat') setView('menu'); }, [t.aiEnabled]);

  // order-ready notification (browser push + in-app)
  aE(() => {
    const f = () => {
      toast(tr('toastOrderReady'), { type: 'success', icon: 'bell', duration: 5000 });
      try { if (window.Notification && Notification.permission === 'granted') new Notification('Tako · ' + sessionStore.get().restaurantName, { body: 'Il tuo ordine è pronto al tavolo ' + sessionStore.get().tableNumber + '!' }); } catch (e) {}
    };
    window.addEventListener('tako:order-ready', f);
    return () => window.removeEventListener('tako:order-ready', f);
  }, []);

  // demo mode: scripted auto-navigation tour (menu → categorie → assistente → ordine), in loop
  aE(() => {
    if (!demo) return;
    let cancelled = false;
    const timers = [];
    const wait = (ms) => new Promise(r => { const id = setTimeout(r, ms); timers.push(id); });
    const tapText = (re) => {
      const b = [...document.querySelectorAll('.app button')].find(x => re.test((x.textContent || '').trim()));
      if (b) b.click();
    };
    const scrollMenu = (dir, ms) => new Promise(res => {
      const start = performance.now();
      const iv = setInterval(() => {
        if (cancelled) { clearInterval(iv); return res(); }
        const sc = document.querySelector('.app .scroll');
        if (sc && sc.scrollHeight > sc.clientHeight + 4) sc.scrollTop += dir * 2.4;
        if (performance.now() - start > ms) { clearInterval(iv); return res(); }
      }, 28);
      timers.push(iv);
    });
    (async function loop() {
      while (!cancelled) {
        setDemoView('menu'); await wait(700);
        await scrollMenu(1, 2600); await wait(500);
        tapText(/^Primi$/); await wait(1900);
        await scrollMenu(1, 1800); await wait(400);
        tapText(/^Pizze$/); await wait(1900);
        tapText(/^Dolci$/); await wait(1700);
        await scrollMenu(-1, 2600); await wait(500);
        setDemoView('chat'); await wait(1100);
        tapText(/consigli/i); await wait(4200);
        setDemoView('tracking'); await wait(3200);
      }
    })();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [demo]);

  // sync mode: scripted order (add to cart → checkout) that notifies the dashboard via postMessage
  aE(() => {
    if (!sync) return;
    let cancelled = false;
    const timers = [];
    const wait = (ms) => new Promise(r => { const id = setTimeout(r, ms); timers.push(id); });
    const STATION = { antipasti: 'Cucina', primi: 'Cucina', pizze: 'Pizzeria', dolci: 'Cucina', bevande: 'Bar' };
    const BASKETS = [
      [{ id: 'i9', qty: 1 }, { id: 'i5', qty: 2 }],                          // pizza + spaghetti
      [{ id: 'i5', qty: 1 }, { id: 'i12', qty: 2 }, { id: 'i14', qty: 2 }],  // spaghetti + tiramisù + acqua
      [{ id: 'i9', qty: 2 }, { id: 'i12', qty: 1 }, { id: 'i14', qty: 1 }],  // pizza + tiramisù + acqua
    ];
    const BASKET = BASKETS[tableNo % BASKETS.length];
    const scrollMenu = (dir, ms) => new Promise(res => {
      const start = performance.now();
      const iv = setInterval(() => {
        if (cancelled) { clearInterval(iv); return res(); }
        const sc = document.querySelector('.app .scroll');
        if (sc && sc.scrollHeight > sc.clientHeight + 4) sc.scrollTop += dir * 2.2;
        if (performance.now() - start > ms) { clearInterval(iv); return res(); }
      }, 28);
      timers.push(iv);
    });
    const post = (type, data) => { try { if (window.parent) window.parent.postMessage({ source: 'tako-app', type, ...data }, '*'); } catch (e) {} };
    const callWaiter = async (kind, label) => {
      setWaiterOpen(true);
      await wait(950);
      if (cancelled) return;
      const btn = document.querySelector('.app button[data-kind="' + kind + '"]');
      if (btn) btn.click();                    // visual: option tapped + confirmation
      const table = tableNo;
      post('waiter-call', { call: { tavolo: table, kind, motivo: label } });
      await wait(2500);                        // sheet shows confirmation, then auto-closes
      setWaiterOpen(false);
    };
    (async function loop() {
      if (startDelay) { await wait(startDelay); if (cancelled) return; }
      while (!cancelled) {
        // ─── 1. ORDINE ───
        cart.clear();
        orderStore.set({ orderId: null, status: null, items: [], notes: '', placedAt: null });
        setWaiterOpen(false); setCartOpen(false);
        setDemoView('menu');
        await wait(1400);
        for (let k = 0; k < BASKET.length; k++) {           // aggiunge i piatti uno a uno
          if (cancelled) return;
          const b = BASKET[k];
          const it = itemById(b.id);
          if (it) {
            const v = it.variants ? it.variants[0] : null;
            cart.add({ menuItemId: it.id, variantId: v ? v.id : null, name: it.name, unitPrice: it.price, quantity: b.qty, notes: '' });
          }
          await scrollMenu(1, 740);
          await wait(540);
        }
        await wait(650);
        setCartOpen(true);                                  // apre il carrello
        await wait(2400);
        const lines = cartStore.get().items.map(x => ({ ...x }));
        const orderId = placeOrder();                       // invia l'ordine
        setCartOpen(false);
        setDemoView('tracking');
        const table = tableNo;
        post('order-placed', { cycleStart: true, order: {
          orderId, tavolo: table,
          items: lines.map(li => {
            const mi = itemById(li.menuItemId);
            return { nome: li.name, qty: li.quantity, prezzo: Math.round(li.unitPrice), station: STATION[mi ? mi.sectionId : ''] || 'Cucina', note: li.notes || '', stato: 'attesa' };
          }),
        }});
        await wait(4800);
        if (cancelled) return;
        // ─── 2. CHIAMATA · Ho bisogno di aiuto ───
        await callWaiter('help', 'Ho bisogno di aiuto');
        await wait(1300); if (cancelled) return;
        // ─── 3. CHIAMATA · Vorrei il conto ───
        await callWaiter('bill', 'Vorrei il conto');
        await wait(1300); if (cancelled) return;
        // ─── 4. CHIAMATA · Acqua, per favore ───
        await callWaiter('water', 'Acqua, per favore');
        await wait(2800);
        // ricomincia da capo
      }
    })();
    return () => { cancelled = true; timers.forEach(id => { clearTimeout(id); clearInterval(id); }); };
  }, [sync]);

  const confirmOrder = () => {
    placeOrder();
    setCartOpen(false);
    setView('tracking');
    toast(tr('toastOrderSent'), { type: 'success' });
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  };

  const entered = scripted ? true : (view !== 'splash');

  const inner = (
    <div className="app" style={bare ? { position: 'relative', '--safe-t': '40px', '--safe-b': '14px' } : { position: 'relative', '--safe-t': '52px', '--safe-b': '22px' }}>
      {!entered ? (
        <Splash onEnter={() => setView('menu')} />
      ) : (
        <>
          <Header count={count} compact={navCompact} onCart={() => setCartOpen(true)} onWaiter={() => setWaiterOpen(true)} />
          <main style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div key={view} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, animation: 'rise-fade .34s var(--out)' }}>
              {view === 'menu' && <MenuView onOpenCart={launchCart} compact={navCompact} mergePhase={mergePhase} />}
              {view === 'tracking' && <TrackingView goMenu={() => setView('menu')} />}
              {view === 'chat' && <ChatView goTracking={() => setView('tracking')} />}
            </div>
          </main>
          <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 'calc(var(--safe-t) + 10px)', zIndex: 25, pointerEvents: 'none', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0, #000 42%, transparent 100%)', maskImage: 'linear-gradient(to bottom, #000 0, #000 42%, transparent 100%)' }} />
          <BottomNav view={view} setView={setView} aiEnabled={t.aiEnabled} orderActive={orderActive} compact={navCompact} merging={mergePhase > 0} />
          <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} onConfirm={confirmOrder} />
          <WaiterSheet open={waiterOpen} onClose={() => setWaiterOpen(false)} />
        </>
      )}
      <Toaster />
    </div>
  );

  return (
    <>
      {bare
        ? <div className="stage stage--bare">{inner}</div>
        : <div className="stage"><PhoneFrame>{inner}</PhoneFrame></div>}

      {!bare && (
      <TweaksPanel title="Tweaks">
        <TweakSection label="Brand" />
        <TweakColor label="Colore primario" value={t.brand} options={['#ED7159', '#2A6FDB', '#1F8A5B', '#7A4FD0', '#E0A23C']} onChange={v => setTweak('brand', v)} />
        <TweakSection label="Sessione" />
        <TweakToggle label="Assistente AI" value={t.aiEnabled} onChange={v => setTweak('aiEnabled', v)} />
        <TweakNumber label="Numero tavolo" value={t.tableNumber} min={1} max={99} onChange={v => setTweak('tableNumber', v)} />
        <TweakSection label="Vai a" />
        <TweakRadio label="Schermata" value={t.screen} options={['splash', 'menu', 'tracking', 'chat']} onChange={v => setTweak('screen', v)} />
        <TweakButton label="Reset demo" onClick={() => { cart.clear(); orderStore.set({ orderId: null, status: null, items: [], notes: '', placedAt: null }); setTweak('screen', 'splash'); }}>Svuota carrello e ordine</TweakButton>
      </TweaksPanel>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
