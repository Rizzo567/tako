// tako-kit.jsx — icons, motion hooks, bottom sheet (swipe), toaster, primitives
const { useState, useEffect, useRef, useCallback } = React;

/* ───────────────── icons (Lucide-style, 24×24 stroke) ───────────────── */
const ICONS = {
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M5 12h14M12 5v14',
  minus: 'M5 12h14',
  check: 'M20 6 9 17l-5-5',
  chevronLeft: 'm15 18-6-6 6-6',
  chevronRight: 'm9 18 6-6-6-6',
  chevronDown: 'm6 9 6 6 6-6',
  arrowRight: 'M5 12h14M13 5l7 7-7 7',
  arrowLeft: 'M19 12H5M11 19l-7-7 7-7',
  search: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.3-4.3',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4Z',
  droplet: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5 12 2.5C11.5 5 10 7.4 8 9S5 13 5 15a7 7 0 0 0 7 7Z',
  receipt: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1ZM8 7h8M8 11h8M8 15h5',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 7v5l3 2',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-4M12 8h.01',
  sparkles: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z',
  bowl: 'M3 11h18M4 11a8 8 0 0 0 16 0M12 3c-2 0-3 1.2-3 2.5S10 8 12 8M9 6l-.5-2.5',
  user: 'M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
  note: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z',
};
function Icon({ name, size = 22, stroke = 2, fill = 'none', style, className }) {
  const d = ICONS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
      style={{ display: 'block', flex: 'none', ...style }}>
      <path d={d} fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────── motion hooks ───────────────── */
function useReducedMotion() {
  const [r, setR] = useState(() => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const f = () => setR(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f);
  }, []);
  return r;
}
// mount/unmount transition: returns {mounted, active}
function useMountTransition(open, duration = 360) {
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(false);
  useEffect(() => {
    let t;
    if (open) { setMounted(true); t = setTimeout(() => setActive(true), 24); }
    else { setActive(false); t = setTimeout(() => setMounted(false), duration); }
    return () => clearTimeout(t);
  }, [open, duration]);
  return { mounted, active };
}

/* ───────────────── bottom sheet (backdrop + swipe-to-close) ───────────────── */
function Sheet({ open, onClose, children, title, sub, leadIcon, accent, contentClass = '', maxH = '90%' }) {
  const { mounted, active } = useMountTransition(open, 420);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  if (!mounted) return null;

  const down = (e) => { drag.current = { y: e.clientY, t: Date.now() }; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
  const move = (e) => { if (!drag.current) return; setDragY(Math.max(0, e.clientY - drag.current.y)); };
  const up = (e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    const v = dy / Math.max(1, Date.now() - drag.current.t);
    drag.current = null; setDragging(false);
    if (dy > 120 || v > 0.55) onClose(); else setDragY(0);
  };

  const shade = active ? Math.max(0, 1 - dragY / 420) : 0;
  const host = (typeof document !== 'undefined' && document.querySelector('.app')) || document.body;
  return ReactDOM.createPortal(
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,20,16,.42)', opacity: shade, transition: dragging ? 'none' : 'opacity .42s var(--out)', backdropFilter: 'blur(2px)' }} />
      <div role="dialog" aria-modal="true"
        style={{
          position: 'relative', background: 'var(--raised)', borderRadius: 'var(--r-sheet) var(--r-sheet) 0 0',
          boxShadow: 'var(--sh-sheet)', maxHeight: maxH, display: 'flex', flexDirection: 'column',
          transform: active ? `translateY(${dragY}px)` : 'translateY(101%)',
          transition: dragging ? 'none' : `transform .44s var(--spring)`,
          paddingBottom: 'calc(var(--safe-b) + 4px)', willChange: 'transform',
        }}>
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ flex: 'none', padding: '10px 0 4px', cursor: 'grab', touchAction: 'none' }}>
          <div style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--hairline)', margin: '0 auto' }} />
        </div>
        {title && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px 14px' }}>
            {leadIcon && (
              <span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: accent || 'var(--brand-tint)', color: accent ? '#fff' : 'var(--brand)' }}>
                <Icon name={leadIcon} size={20} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: 19, fontWeight: 700 }}>{title}</h3>
              {sub && <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{sub}</p>}
            </div>
            <IconBtn name="x" onClick={onClose} ghost />
          </div>
        )}
        <div className={'scroll ' + contentClass} style={{ overflowY: 'auto', minHeight: 0 }}>{children}</div>
      </div>
    </div>,
    host
  );
}

/* ───────────────── buttons ───────────────── */
function IconBtn({ name, onClick, size = 22, badge, ghost, style, label }) {
  return (
    <button aria-label={label || name} onClick={onClick} className="press"
      style={{ position: 'relative', width: 42, height: 42, borderRadius: 999, display: 'grid', placeItems: 'center',
        background: ghost ? 'transparent' : 'var(--raised)', color: 'var(--ink)', boxShadow: ghost ? 'none' : 'var(--sh-1)', ...style }}>
      <Icon name={name} size={size} />
      {badge > 0 && (
        <span key={badge} style={{ position: 'absolute', top: -2, right: -2, minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999,
          background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center',
          boxShadow: '0 0 0 2.5px var(--surface)', animation: 'badge-pop .45s var(--spring)' }}>{badge}</span>
      )}
    </button>
  );
}
function Btn({ children, onClick, kind = 'brand', full, disabled, icon, style }) {
  const styles = {
    brand: { background: disabled ? 'var(--ink-3)' : 'var(--brand)', color: 'var(--on-brand)', boxShadow: disabled ? 'none' : '0 8px 22px -8px var(--brand)' },
    soft: { background: 'var(--sunken)', color: 'var(--ink)' },
    ghost: { background: 'transparent', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)' },
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled} className="press"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: full ? '100%' : 'auto',
        height: 54, padding: '0 22px', borderRadius: 16, fontSize: 16, fontWeight: 700, transition: 'background .2s, box-shadow .2s',
        opacity: disabled ? .7 : 1, ...styles, ...style }}>
      {icon && <Icon name={icon} size={20} />}{children}
    </button>
  );
}

/* ───────────────── qty stepper ───────────────── */
function Qty({ value, onChange, min = 1, size = 'md' }) {
  const big = size === 'lg';
  const btn = big ? 40 : 30;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: big ? 6 : 2, background: 'var(--sunken)', borderRadius: 999, padding: 4 }}>
      <button className="press" aria-label="meno" onClick={() => onChange(Math.max(min - (min === 0 ? 0 : 0), value - 1))}
        style={{ width: btn, height: btn, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--raised)', color: value <= min ? 'var(--ink-3)' : 'var(--ink)', boxShadow: 'var(--sh-1)' }}>
        <Icon name="minus" size={big ? 18 : 15} />
      </button>
      <span key={value} className="tnum" style={{ minWidth: big ? 30 : 22, textAlign: 'center', fontWeight: 700, fontSize: big ? 18 : 15, animation: 'pop-in .3s var(--spring)' }}>{value}</span>
      <button className="press" aria-label="più" onClick={() => onChange(value + 1)}
        style={{ width: btn, height: btn, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--brand)', color: 'var(--on-brand)', boxShadow: 'var(--sh-1)' }}>
        <Icon name="plus" size={big ? 18 : 15} />
      </button>
    </div>
  );
}

/* ───────────────── toaster ───────────────── */
const _toast = { list: [], subs: new Set(), id: 0 };
function _emit() { _toast.subs.forEach(f => f()); }
function toast(msg, opts = {}) {
  const id = ++_toast.id;
  _toast.list = [..._toast.list, { id, msg, type: opts.type || 'default', icon: opts.icon }];
  _emit();
  setTimeout(() => dismissToast(id), opts.duration || 2800);
  return id;
}
function dismissToast(id) {
  _toast.list = _toast.list.map(t => t.id === id ? { ...t, leaving: true } : t); _emit();
  setTimeout(() => { _toast.list = _toast.list.filter(t => t.id !== id); _emit(); }, 260);
}
function Toaster() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); _toast.subs.add(f); return () => _toast.subs.delete(f); }, []);
  return (
    <div style={{ position: 'absolute', top: 'calc(var(--safe-t) + 12px)', left: 0, right: 0, zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none', padding: '0 16px' }}>
      {_toast.list.map(t => {
        const color = t.type === 'success' ? 'var(--ok)' : t.type === 'warn' ? 'var(--warn)' : t.type === 'error' ? 'var(--danger)' : 'var(--ink)';
        const ic = t.icon || (t.type === 'success' ? 'check' : t.type === 'error' ? 'info' : null);
        return (
          <div key={t.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 9, maxWidth: '92%', padding: '11px 16px 11px 13px', borderRadius: 14,
            background: 'var(--ink)', color: 'var(--surface)', fontSize: 14, fontWeight: 600, boxShadow: 'var(--sh-3)',
            transform: t.leaving ? 'translateY(-12px) scale(.96)' : 'translateY(0) scale(1)', opacity: t.leaving ? 0 : 1,
            transition: 'all .26s var(--out)', animation: t.leaving ? 'none' : 'rise-fade .3s var(--spring)' }}>
            {ic && <span style={{ color, display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: 999, background: 'rgba(255,255,255,.12)' }}><Icon name={ic} size={14} stroke={2.6} /></span>}
            <span>{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────── confetti burst ───────────────── */
function Confetti({ n = 14 }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const cols = ['var(--brand)', 'var(--ok)', 'var(--warn)', 'var(--brand-deep)'];
  return (
    <div style={{ position: 'absolute', top: 0, left: '50%', pointerEvents: 'none', zIndex: 5 }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ position: 'absolute', width: 7, height: 11, borderRadius: 2, background: cols[i % cols.length],
          left: (Math.random() * 200 - 100) + 'px', top: '-8px', animation: `confetti-fall ${0.9 + Math.random() * 0.7}s ${Math.random() * 0.2}s var(--out) forwards` }} />
      ))}
    </div>
  );
}

/* allergen pill */
function AllergenDot({ id, withLabel }) {
  const a = ALLERGEN_MAP[id]; if (!a) return null;
  return (
    <span title={a.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: withLabel ? 12.5 : 13,
      padding: withLabel ? '5px 10px 5px 8px' : 0, borderRadius: 999, background: withLabel ? 'var(--sunken)' : 'transparent', color: 'var(--ink-2)', fontWeight: 600 }}>
      <span style={{ fontSize: 14 }}>{a.emoji}</span>{withLabel && a.label}
    </span>
  );
}

/* tag chip */
function Tag({ children }) {
  const danger = children === 'Piccante';
  const novita = children === 'Novità';
  return (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.02em', padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', whiteSpace: 'nowrap',
      background: danger ? 'rgba(220,76,62,.1)' : novita ? 'var(--brand-tint)' : 'var(--sunken)',
      color: danger ? 'var(--danger)' : novita ? 'var(--brand-deep)' : 'var(--ink-2)' }}>{children}</span>
  );
}

/* ───────────────── fly-to-cart + count-up + bubbles ───────────────── */
function bounceCart() {
  const c = document.querySelector('button[aria-label="Carrello"]');
  if (c && c.animate) c.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.32) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 460, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}
function flyToCart(originEl, color) {
  const cart = document.querySelector('button[aria-label="Carrello"]');
  if (!originEl || !cart || matchMedia('(prefers-reduced-motion: reduce)').matches || !document.body.animate) { setTimeout(bounceCart, 120); return; }
  const a = originEl.getBoundingClientRect(), b = cart.getBoundingClientRect();
  const sx = a.left + a.width / 2, sy = a.top + a.height / 2, ex = b.left + b.width / 2, ey = b.top + b.height / 2;
  const dot = document.createElement('div');
  Object.assign(dot.style, { position: 'fixed', left: (sx - 16) + 'px', top: (sy - 16) + 'px', width: '32px', height: '32px', borderRadius: '999px', background: color || 'var(--brand)', zIndex: '99999', pointerEvents: 'none', boxShadow: '0 8px 20px rgba(42,31,26,.35)' });
  document.body.appendChild(dot);
  const mx = (sx + ex) / 2 + 30, my = Math.min(sy, ey) - 90;
  const an = dot.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
    { transform: `translate(${mx - sx}px,${my - sy}px) scale(1.15)`, opacity: 1, offset: .55 },
    { transform: `translate(${ex - sx}px,${ey - sy}px) scale(.18)`, opacity: .35, offset: 1 },
  ], { duration: 640, easing: 'cubic-bezier(.5,0,.35,1)' });
  an.onfinish = () => { dot.remove(); bounceCart(); };
}
function useCountUp(value, dur = 520) {
  const [v, setV] = useState(value); const ref = useRef(value);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.requestAnimationFrame) { ref.current = value; setV(value); return; }
    const from = ref.current, to = value, t0 = performance.now(); let raf;
    const tick = (t) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3); setV(from + (to - from) * e); if (p < 1) raf = requestAnimationFrame(tick); else ref.current = to; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return v;
}
function Bubbles({ count = 9, color }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="bubbles-layer" aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {Array.from({ length: count }).map((_, i) => { const s = 9 + ((i * 37) % 26); return (
        <span key={i} style={{ position: 'absolute', left: ((i * 53 + 7) % 96) + '%', bottom: '-34px', width: s, height: s, borderRadius: '50%',
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.85), ${color || 'var(--brand-tint)'})`, border: '1px solid rgba(255,255,255,.5)',
          animation: `bubble-rise ${9 + (i % 5) * 2.4}s ${(i % 6) * 1.1}s ease-in infinite` }} />
      ); })}
    </div>
  );
}

Object.assign(window, { Icon, IconBtn, Btn, Qty, Sheet, Toaster, toast, dismissToast, Confetti, AllergenDot, Tag, useReducedMotion, useMountTransition, flyToCart, bounceCart, useCountUp, Bubbles });
