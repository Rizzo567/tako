/* ───────────────── Tema «Sobrio» — movimento e riquadri rapidi ─────────────────
   Tutto qui è usato solo con il tema Sobrio (UiCtx === "sobrio"). Misure del video in
   docs/webapp/tema-sobrio/RIFERIMENTO-VIDEO.md:
   - molla a smorzamento critico ω=13,8 (apertura, successo e chiusura: 13,3–14,3, RMS<0,01)
   - colore del contenitore: inseguimento esponenziale τ≈48 ms
   - contenuto: entra da +95 a +200 ms (apertura), esce in 60 ms con sfocatura (chiusura)
   Il file definisce solo funzioni: nessun accesso al DOM al caricamento. */

const SB = {
  omega: 13.8,          // rad/s → k = ω² ≈ 190, c = 2ω ≈ 27,6 (massa 1)
  colorTau: 48,         // ms, verso il fondo del riquadro (apertura)
  colorTauClose: 38,    // ms, verso il colore del pulsante (chiusura: 55 % a 16 ms, 91 % a 100 ms)
  contentDelay: 95, contentDur: 105,   // ms, ingresso contenuto in apertura
  exitDur: 60,          // ms, uscita contenuto (chiusura / cambio stato)
  labelOut: 30, labelInDelay: 80, labelInDur: 40,  // etichetta del pulsante dentro il contenitore
  reducedDur: 120,      // ms, dissolvenza con prefers-reduced-motion
};
const sbReduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; } };
const sbClamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sbLerp = (a, b, t) => a + (b - a) * t;
/* passo di una molla critica verso target; sotto-passi da 4 ms per stabilità */
function sbSpring(s, target, dtMs) {
  const k = SB.omega * SB.omega, c = 2 * SB.omega;
  let left = Math.min(dtMs, 64) / 1000;
  while (left > 0) {
    const h = Math.min(left, 0.004);
    const a = -k * (s.p - target) - c * s.v;
    s.v += a * h; s.p += s.v * h; left -= h;
  }
  return Math.abs(s.p - target) < 0.0008 && Math.abs(s.v) < 0.01;
}
function sbParseColor(str, fallback) {
  const m = /rgba?\(([^)]+)\)/.exec(str || "");
  if (!m) return fallback;
  const [r, g, b, a = 1] = m[1].split(",").map(x => parseFloat(x));
  if (a < 0.05) return fallback;
  return [r, g, b];
}
function sbChase(cur, target, dtMs, tau = SB.colorTau) {
  const f = 1 - Math.exp(-dtMs / tau);
  return cur.map((v, i) => v + (target[i] - v) * f);
}
const sbRgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
function sbRect(el) { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
function sbRadius(el, h) {
  try { const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; return Math.min(r, h / 2); } catch (_) { return 12; }
}

/* ── chi ha aperto il riquadro: ultimo elemento cliccabile premuto (clic, tocco, tastiera) ── */
const _sbTrigger = { el: null, t: 0, installed: false };
function sbFindClickable(node) {
  let el = node && node.nodeType === 1 ? node : node && node.parentElement;
  for (let i = 0; el && i < 8; i++, el = el.parentElement) {
    if (el.matches && el.matches("button, a[href], [role='button'], [data-morph-origin]")) return el;
    try { if (getComputedStyle(el).cursor === "pointer") return el; } catch (_) {}
  }
  return null;
}
function sbInstallTriggerTracker() {
  if (_sbTrigger.installed || typeof document === "undefined") return;
  _sbTrigger.installed = true;
  const rec = (e) => {
    const el = sbFindClickable(e.target);
    if (!el || el.closest("[data-sb-overlay]")) return;   // i click dentro un riquadro non sono origini
    _sbTrigger.el = el; _sbTrigger.t = performance.now();
  };
  document.addEventListener("pointerdown", rec, true);
  document.addEventListener("click", rec, true);
}
function sbTakeTrigger() {
  const el = _sbTrigger.el;
  if (!el || !el.isConnected || performance.now() - _sbTrigger.t > 1200) return null;
  return el;
}
function sbLabelClone(trigger) {
  const r = trigger.getBoundingClientRect();
  if (r.width * r.height > 40000) return null;     // card grandi: niente etichetta
  const c = trigger.cloneNode(true);
  c.removeAttribute("id"); c.removeAttribute("data-morph-id"); c.setAttribute("aria-hidden", "true"); c.setAttribute("tabindex", "-1");
  c.querySelectorAll("[id], [data-morph-id]").forEach(n => { n.removeAttribute("id"); n.removeAttribute("data-morph-id"); });
  c.style.opacity = "1"; c.style.width = r.width + "px"; c.style.height = r.height + "px"; c.style.flex = "none";
  return c;
}
const sbFocusables = (root) => [...root.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
  .filter(el => el.offsetParent !== null || el === document.activeElement);

/* ═══════════ Primitiva «pulsante → riquadro» (container morph) ═══════════
   Usata da Overlay (02-kit) quando il tema è Sobrio. Il contenuto resta impaginato nella
   posizione finale e viene rivelato da un ritaglio che insegue il «guscio» (il pulsante
   che cresce). Retargeting: aprire/chiudere durante l'animazione inverte la molla dal
   valore e dalla velocità correnti, senza code né blocchi. */
function MorphOverlay({ open, onClose, children, anchor = "center" }) {
  const [mounted, setMounted] = useState(open);
  const rootRef = useRef(null), wrapRef = useRef(null), shellRef = useRef(null), scrimRef = useRef(null), labelRef = useRef(null);
  const st = useRef(null);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  // in chiusura il chiamante spesso passa children=null: si tiene l'ultimo contenuto
  const lastChildren = useRef(children); if (open && children) lastChildren.current = children;
  if (!st.current) st.current = { p: 0, v: 0, target: 0, raf: 0, last: 0, phaseT: 0, color: [255, 255, 255], trigger: null, origin: null, originR: 16, originBg: [10, 10, 10], panelBg: [255, 255, 255], prevFocus: null, done: false, reduced: false, contentOp: 0, exitFrom: 1, triggerOpacity: "" };

  const finishClose = useCallback(() => {
    const s = st.current;
    cancelAnimationFrame(s.raf); s.raf = 0;
    if (s.trigger) { s.trigger.style.opacity = s.triggerOpacity; }
    const back = s.trigger && s.trigger.isConnected ? s.trigger : s.prevFocus;
    s.trigger = null; s.origin = null;
    setMounted(false);
    if (back && back.focus) { try { back.focus({ preventScroll: true }); } catch (_) {} }
  }, []);

  const frame = useCallback((now) => {
    const s = st.current; const wrap = wrapRef.current, shell = shellRef.current;
    if (!wrap || !shell) { s.raf = 0; return; }
    const dt = s.last ? now - s.last : 16; s.last = now;
    const t = now - s.phaseT;
    const opening = s.target === 1;
    const panel = wrap.firstElementChild || wrap;
    const pr = sbRect(panel), wr = sbRect(wrap);
    if (s.reduced || !s.origin) {
      // dissolvenza semplice (reduced motion o apertura senza pulsante d'origine)
      const dur = s.reduced ? SB.reducedDur : 180;
      const k = sbClamp(t / dur);
      const op = opening ? Math.max(s.exitFrom === 1 ? 0 : s.contentOp, k) : (1 - k) * s.exitFrom;
      s.contentOp = op;
      wrap.style.opacity = op; wrap.style.clipPath = ""; wrap.style.filter = "";
      wrap.style.transform = s.reduced ? "" : `scale(${0.97 + 0.03 * op})`;
      shell.style.display = "none";
      if (scrimRef.current) scrimRef.current.style.opacity = op;
      if (k >= 1) { if (opening) { wrap.style.transform = ""; s.raf = 0; return; } finishClose(); return; }
      s.raf = requestAnimationFrame(frame); return;
    }
    const rest = sbSpring(s, s.target, dt);
    const p = sbClamp(s.p, 0, 1.02);
    // origine: rettangolo attuale del pulsante (segue resize/scroll), altrimenti l'ultimo noto
    let o = s.origin;
    if (s.trigger && s.trigger.isConnected) { const r = sbRect(s.trigger); if (r.w > 0) { o = r; s.origin = r; } }
    const x = sbLerp(o.x, pr.x, p), y = sbLerp(o.y, pr.y, p);
    const w = Math.max(0, sbLerp(o.w, pr.w, p)), h = Math.max(0, sbLerp(o.h, pr.h, p));
    const pR = sbRadius(panel, pr.h);
    const rad = Math.min(sbLerp(s.originR, pR, sbClamp(p)), h / 2, w / 2);
    s.color = sbChase(s.color, opening ? s.panelBg : s.originBg, dt, opening ? SB.colorTau : SB.colorTauClose);
    shell.style.display = "block";
    shell.style.transform = `translate(${x}px,${y}px)`;
    shell.style.width = w + "px"; shell.style.height = h + "px"; shell.style.borderRadius = rad + "px";
    shell.style.background = sbRgb(s.color);
    // ritaglio del contenuto sul guscio
    const top = y - wr.y, left = x - wr.x, right = (wr.x + wr.w) - (x + w), bottom = (wr.y + wr.h) - (y + h);
    wrap.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${rad}px)`;
    if (opening) {
      const k = sbClamp((t - SB.contentDelay) / SB.contentDur);
      s.contentOp = Math.max(s.contentOp, 1 - Math.pow(1 - k, 2));
      wrap.style.filter = "";
    } else {
      const k = sbClamp(t / SB.exitDur);
      s.contentOp = s.exitFrom * (1 - k);
      wrap.style.filter = `blur(${4 * k}px)`;
    }
    wrap.style.opacity = s.contentOp;
    if (labelRef.current) labelRef.current.style.opacity = opening ? Math.max(0, 1 - t / SB.labelOut) * (1 - sbClamp(p * 4)) : sbClamp((t - SB.labelInDelay) / SB.labelInDur);
    if (scrimRef.current) scrimRef.current.style.opacity = sbClamp(p);
    if (rest && opening && t > SB.contentDelay + SB.contentDur) {
      wrap.style.clipPath = ""; wrap.style.opacity = 1; wrap.style.filter = "";
      shell.style.display = "none"; s.raf = 0; s.done = true; return;
    }
    if (rest && !opening && t > SB.labelInDelay + SB.labelInDur) { finishClose(); return; }
    s.raf = requestAnimationFrame(frame);
  }, [finishClose]);

  const kick = useCallback(() => { const s = st.current; if (!s.raf) { s.last = 0; s.raf = requestAnimationFrame(frame); } }, [frame]);

  // apertura / chiusura / retargeting
  useEffect(() => {
    const s = st.current;
    if (open) {
      if (!mounted) { setMounted(true); return; }   // il layout effect sotto avvia l'apertura
      if (s.target !== 1) { s.target = 1; s.phaseT = performance.now(); s.exitFrom = s.contentOp; kick(); }
    } else if (mounted) {
      if (s.target !== 0) {
        s.target = 0; s.phaseT = performance.now(); s.exitFrom = s.contentOp; s.done = false;
        if (s.trigger && s.trigger.isConnected) {
          s.originBg = sbParseColor(getComputedStyle(s.trigger).backgroundColor, s.originBg);
          // restituisce il colore del pulsante, non quello del suo hover
        } else if (!s.origin) { /* nessuna origine: chiusura in dissolvenza */ }
        kick();
      }
    }
  }, [open, mounted, kick]);

  React.useLayoutEffect(() => {
    if (!mounted) return;
    const s = st.current, wrap = wrapRef.current, shell = shellRef.current;
    s.reduced = sbReduced();
    s.prevFocus = document.activeElement;
    const trig = sbTakeTrigger();
    s.trigger = trig; s.origin = null; s.done = false; s.contentOp = 0; s.exitFrom = 1;
    s.p = 0; s.v = 0; s.target = 1; s.phaseT = performance.now();
    const panel = wrap.firstElementChild || wrap;
    s.panelBg = sbParseColor(getComputedStyle(panel).backgroundColor, [255, 255, 255]);
    if (trig) {
      const cs = getComputedStyle(trig);
      s.origin = sbRect(trig);
      s.originR = sbRadius(trig, s.origin.h);
      s.originBg = sbParseColor(cs.backgroundColor, s.panelBg);
      s.color = s.originBg.slice();
      s.triggerOpacity = trig.style.opacity;
      const lab = sbLabelClone(trig);
      if (lab && labelRef.current) { labelRef.current.replaceChildren(lab); }
      if (!s.reduced) trig.style.opacity = "0";
    }
    wrap.style.opacity = 0;
    if (shell) {
      shell.style.display = s.origin && !s.reduced ? "block" : "none";
      // primo fotogramma: il guscio coincide col pulsante (niente buco mentre il pulsante sparisce)
      if (s.origin) { const o = s.origin; shell.style.transform = `translate(${o.x}px,${o.y}px)`; shell.style.width = o.w + "px"; shell.style.height = o.h + "px"; shell.style.borderRadius = s.originR + "px"; shell.style.background = sbRgb(s.color); }
    }
    kick();
    return () => { cancelAnimationFrame(s.raf); s.raf = 0; if (s.trigger) s.trigger.style.opacity = s.triggerOpacity; };
  }, [mounted]);

  // tastiera: Esc chiude, Tab resta nel riquadro; focus iniziale sul primo controllo
  useEffect(() => {
    if (!mounted) return;
    const wrap = wrapRef.current;
    const t = setTimeout(() => {
      if (!wrap || !open) return;
      if (wrap.contains(document.activeElement)) return;
      const f = sbFocusables(wrap);
      const pref = f.find(el => el.matches("input, select, textarea")) || f[0];
      if (pref) try { pref.focus({ preventScroll: true }); } catch (_) {}
    }, 60);
    const onKey = (e) => {
      if (!wrap || st.current.target !== 1) return;
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCloseRef.current && onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const f = sbFocusables(wrap); if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (!wrap.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey, true); };
  }, [mounted, open]);

  if (!mounted) return null;
  const pos = {
    center: { alignItems: "center", justifyContent: "center" },
    right: { alignItems: "stretch", justifyContent: "flex-end" },
    bottom: { alignItems: "flex-end", justifyContent: "stretch" },
  }[anchor] || { alignItems: "center", justifyContent: "center" };
  const closing = !open;
  return ReactDOM.createPortal(
    <div ref={rootRef} data-sb-overlay="" style={{ position: "absolute", inset: 0, zIndex: 120, display: "flex", pointerEvents: closing ? "none" : "auto", ...pos }}>
      <div ref={scrimRef} onClick={onClose} style={{ position: "absolute", inset: 0, background: "var(--scrim, rgba(10,10,10,.06))", opacity: 0 }} />
      <div ref={shellRef} className="sb-morph-shell" aria-hidden="true" style={{ display: "none", boxShadow: "var(--sh-pop)" }}>
        <div ref={labelRef} className="sb-morph-label" />
      </div>
      <div ref={wrapRef} role="dialog" aria-modal="true" className="sb-dialog" style={{ position: "relative", maxHeight: "100%", display: "flex", opacity: 0, pointerEvents: "none" }}>{open ? children : (children || lastChildren.current)}</div>
    </div>,
    document.querySelector(".screen") || document.body
  );
}

/* ═══════════ Pulsante → pagina (Sala, Cucina, Menu) ═══════════
   Controller unico a livello di modulo: App monta <PageMorphLayer/>; il pulsante chiama
   sbPageMorphGo(id, el, go). Al ritorno sulla Panoramica il contenitore rientra nel
   pulsante [data-morph-id=id]. */
const _sbPage = { s: { p: 0, v: 0 }, target: 0, raf: 0, last: 0, t0: 0, to: null, origin: null, originR: 16, originBg: [10, 10, 10], pageBg: [255, 255, 255], color: [10, 10, 10], label: null, subs: new Set(), btn: null, btnOpacity: "", reduced: false, contentOp: 0 };
function sbPageNotify() { _sbPage.subs.forEach(f => f()); }
function sbPageMorphGo(id, el, go) {
  const P = _sbPage;
  P.reduced = sbReduced();
  if (el) {
    const cs = getComputedStyle(el);
    P.origin = sbRect(el); P.originR = sbRadius(el, P.origin.h);
    P.originBg = sbParseColor(cs.backgroundColor, [255, 255, 255]);
    P.label = sbLabelClone(el);
    if (P.target !== 1 && P.s.p < 0.01) P.color = P.originBg.slice();
    P.btn = el; P.btnOpacity = el.style.opacity; el.style.opacity = "0";
  }
  P.to = id; P.target = 1; P.t0 = performance.now(); P.contentOp = P.s.p > 0.5 ? 1 : 0;
  go(id);
  sbPageNotify();
}
function sbPageBack(go) { go("dashboard"); }
/* chiamata da App quando la rotta cambia: torna nel pulsante se si rientra in Panoramica */
function sbPageRouteChanged(prev, route) {
  const P = _sbPage;
  if (!P.to) return;
  if (route === "dashboard" && prev === P.to) { P.target = 0; P.t0 = performance.now(); P.btn = null; sbPageNotify(); }
  else if (route !== P.to && route !== "dashboard") { P.to = null; P.target = 0; P.s.p = 0; P.s.v = 0; sbPageNotify(); }
}
function useSbPage() { const [, f] = useState(0); useEffect(() => { const cb = () => f(x => x + 1); _sbPage.subs.add(cb); return () => _sbPage.subs.delete(cb); }, []); return _sbPage; }

/* Avvolge la schermata corrente. ghost = Panoramica sotto il contenitore durante l'andata. */
function PageMorphLayer({ route, ghost, children, onBack, mobile }) {
  const P = useSbPage();
  const layerRef = useRef(null), shellRef = useRef(null), labelRef = useRef(null);
  const [animating, setAnimating] = useState(false);
  const frame = useCallback((now) => {
    const layer = layerRef.current, shell = shellRef.current;
    if (!layer || !shell) { P.raf = 0; return; }
    const dt = P.last ? now - P.last : 16; P.last = now;
    const t = now - P.t0;
    const fwd = P.target === 1;
    const lr = sbRect(layer);
    // il pulsante in Panoramica (al ritorno è un nuovo elemento: lo cerco per id)
    if (!fwd && !P.btn) {
      const b = document.querySelector(`[data-morph-id="${P.to}"]`);
      if (b) { P.btn = b; P.btnOpacity = b.style.opacity; b.style.opacity = "0"; P.origin = sbRect(b); P.originBg = sbParseColor(getComputedStyle(b).backgroundColor, P.originBg); }
    }
    if (P.btn && P.btn.isConnected) { const r = sbRect(P.btn); if (r.w > 0) P.origin = r; }
    const o = P.origin || { x: lr.x + lr.w / 2 - 40, y: lr.y + 20, w: 80, h: 36 };
    if (P.reduced) {
      const k = sbClamp(t / SB.reducedDur);
      shell.style.display = "none"; layer.style.clipPath = "";
      layer.style.opacity = fwd ? k : 1;
      if (k >= 1) { P.s.p = P.target; P.raf = 0; if (!fwd) { if (P.btn) P.btn.style.opacity = P.btnOpacity; P.to = null; } setAnimating(false); return; }
      P.raf = requestAnimationFrame(frame); return;
    }
    const rest = sbSpring(P.s, P.target, dt);
    const p = sbClamp(P.s.p);
    const x = sbLerp(o.x, lr.x, p), y = sbLerp(o.y, lr.y, p), w = sbLerp(o.w, lr.w, p), h = sbLerp(o.h, lr.h, p);
    const rad = Math.min(sbLerp(P.originR, 0, p), h / 2);
    P.color = sbChase(P.color, fwd ? P.pageBg : P.originBg, dt, fwd ? SB.colorTau : SB.colorTauClose);
    shell.style.display = "block";
    shell.style.zIndex = fwd ? 1 : 3;
    shell.style.transform = `translate(${x}px,${y}px)`; shell.style.width = w + "px"; shell.style.height = h + "px";
    shell.style.borderRadius = rad + "px"; shell.style.background = sbRgb(P.color);
    if (fwd) {
      const top = y - lr.y, left = x - lr.x, right = lr.x + lr.w - x - w, bottom = lr.y + lr.h - y - h;
      layer.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${rad}px)`;
      const k = sbClamp((t - SB.contentDelay) / SB.contentDur);
      P.contentOp = Math.max(P.contentOp, 1 - Math.pow(1 - k, 2));
      layer.style.opacity = P.contentOp;
    } else { layer.style.clipPath = ""; layer.style.opacity = 1; }
    if (labelRef.current) labelRef.current.style.opacity = fwd ? Math.max(0, 1 - t / SB.labelOut) : sbClamp((t - SB.labelInDelay) / SB.labelInDur);
    if (rest && (fwd ? t > SB.contentDelay + SB.contentDur : t > SB.labelInDelay + SB.labelInDur)) {
      shell.style.display = "none"; layer.style.clipPath = ""; layer.style.opacity = 1; P.raf = 0;
      if (!fwd) { if (P.btn) P.btn.style.opacity = P.btnOpacity; P.btn = null; P.to = null; }
      setAnimating(false); return;
    }
    P.raf = requestAnimationFrame(frame);
  }, []);
  // avvio/retarget quando il controller cambia bersaglio
  React.useLayoutEffect(() => {
    const active = P.to && ((P.target === 1 && route === P.to && P.s.p < 0.999) || (P.target === 0 && route === "dashboard" && P.s.p > 0.001));
    if (!active) return;
    if (labelRef.current) labelRef.current.replaceChildren(...(P.label ? [P.label] : []));
    if (layerRef.current && P.target === 1 && P.s.p < 0.01) { layerRef.current.style.opacity = 0; }
    try { P.pageBg = sbParseColor(getComputedStyle(layerRef.current).backgroundColor, [255, 255, 255]); } catch (_) {}
    if (P.target === 0 && P.s.p >= 0.999) P.color = P.pageBg.slice();
    setAnimating(true);
    if (!P.raf) { P.last = 0; P.raf = requestAnimationFrame(frame); }
  });
  useEffect(() => () => { cancelAnimationFrame(P.raf); P.raf = 0; if (P.btn) P.btn.style.opacity = P.btnOpacity; }, []);
  const showGhost = animating && P.target === 1 && ghost;
  const showBack = P.to && route === P.to && onBack;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", zIndex: 0 }}>
      {showGhost && <div aria-hidden="true" inert="" style={{ position: "absolute", inset: 0, zIndex: 0, display: "flex", flexDirection: "column", pointerEvents: "none", overflow: "hidden" }}>{ghost}</div>}
      <div ref={shellRef} className="sb-morph-shell" aria-hidden="true" style={{ display: "none", position: "fixed" }}><div ref={labelRef} className="sb-morph-label" /></div>
      <div ref={layerRef} className="sb-page" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", zIndex: 2, background: "var(--bg)" }}>
        {showBack && <button className="press" onClick={onBack} aria-label="Torna alla Panoramica"
          style={{ position: "absolute", zIndex: 30, bottom: mobile ? 96 : 18, left: 18, boxShadow: "inset 0 0 0 1px var(--hairline), 0 4px 14px -6px rgba(0,0,0,.18)", display: "inline-flex", alignItems: "center", gap: 4, height: 30, padding: "0 12px 0 8px", borderRadius: 999, background: "#fff", color: "var(--ink)", fontSize: 13, fontWeight: 500 }}>
          <Icon name="chevL" size={16} />Panoramica</button>}
        {children}
      </div>
    </div>
  );
}

/* ═══════════ Microinterazioni ═══════════ */
/* Scambio di etichetta sul posto: la vecchia sale e si sfoca, la nuova arriva dal basso. */
function SwapText({ k, children, down = false, style }) {
  const [items, setItems] = useState(() => [{ k, node: children, out: false, id: 0 }]);
  const idRef = useRef(0);
  const last = useRef(k);
  useEffect(() => {
    if (last.current === k) { setItems(it => it.map(x => x.out ? x : { ...x, node: children })); return; }
    last.current = k;
    const id = ++idRef.current;
    setItems(it => [...it.filter(x => !x.out).map(x => ({ ...x, out: true })), { k, node: children, out: false, id }]);
    const t = setTimeout(() => setItems(it => it.filter(x => !x.out)), 130);
    return () => clearTimeout(t);
  }, [k, children]);
  return <span className={"sb-swap" + (down ? " down" : "")} style={style}>{items.map(x => <span key={x.id} className={x.out ? "out" : (x.id ? "in" : "")} aria-hidden={x.out || undefined}>{x.node}</span>)}</span>;
}
function Spinner({ size = 15 }) {
  return <svg className="sb-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: "none" }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.4" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
}
/* «Copia» → «✓ Copiato» sul posto, torna dopo 1,9 s come nel video */
function CopyPill({ text, label = "Copia", style }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1900); return () => clearTimeout(t); }, [done]);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setDone(true); } catch (_) { toast(text || "Link non disponibile"); } };
  return <button className="press" onClick={copy} aria-live="polite"
    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 30, padding: "0 13px", borderRadius: 999, background: "#fff", boxShadow: "inset 0 0 0 1px var(--hairline)", fontSize: 13, fontWeight: 500, color: done ? "#15803d" : "var(--ink)", transition: "color .1s", ...style }}>
    <SwapText k={done ? "y" : "n"}>{done ? <><Icon name="check" size={14} stroke={2.2} />Copiato</> : <><Icon name="copy" size={14} />{label}</>}</SwapText>
  </button>;
}
/* Contenitore che cambia misura con la molla del video quando cambia `k`:
   il vecchio contenuto esce sfocato in 60 ms, il nuovo entra (stagger nei figli .sb-enter). */
function SizeMorph({ k, children, style, className }) {
  const outer = useRef(null), inner = useRef(null);
  const prev = useRef({ k, node: children });
  const [leaving, setLeaving] = useState(null);
  const anim = useRef({ s: { p: 1, v: 0 }, raf: 0, from: null, to: null, last: 0 });
  const lastSize = useRef(null);   // misura al commit precedente (durante un'animazione: quella corrente)
  React.useLayoutEffect(() => {
    if (prev.current.k === k) { prev.current = { k, node: children }; return; }
    const o = outer.current, i = inner.current; if (!o || !i) return;
    const from = lastSize.current || { w: o.offsetWidth, h: o.offsetHeight };
    const old = prev.current; prev.current = { k, node: children };
    setLeaving({ node: old.node, w: from.w, h: from.h, id: Date.now() });
    o.style.width = ""; o.style.height = "";
    const to = { w: o.offsetWidth, h: o.offsetHeight };
    const A = anim.current;
    if (sbReduced()) { return; }
    // retarget: se stava già animando, parte dalla misura attuale
    A.from = from; A.to = to; A.s = { p: 0, v: A.raf ? A.s.v : 0 }; A.last = 0;
    o.style.width = from.w + "px"; o.style.height = from.h + "px"; o.style.overflow = "hidden";
    const step = (now) => {
      const dt = A.last ? now - A.last : 16; A.last = now;
      const rest = sbSpring(A.s, 1, dt);
      const cw = sbLerp(A.from.w, A.to.w, A.s.p), ch = sbLerp(A.from.h, A.to.h, A.s.p);
      o.style.width = cw + "px"; o.style.height = ch + "px"; lastSize.current = { w: cw, h: ch };
      if (rest) { o.style.width = ""; o.style.height = ""; o.style.overflow = ""; A.raf = 0; lastSize.current = { w: o.offsetWidth, h: o.offsetHeight }; return; }
      A.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(A.raf); A.raf = requestAnimationFrame(step);
  }, [k]);
  React.useLayoutEffect(() => { const o = outer.current; if (o) lastSize.current = { w: o.offsetWidth, h: o.offsetHeight }; });
  useEffect(() => { if (!leaving) return; const t = setTimeout(() => setLeaving(null), 90); return () => clearTimeout(t); }, [leaving]);
  useEffect(() => () => cancelAnimationFrame(anim.current.raf), []);
  return <div ref={outer} className={className} style={{ position: "relative", ...style }}>
    {leaving && <div key={leaving.id} className="sb-leave" aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", width: leaving.w, height: leaving.h, transform: "translate(-50%,-50%)", pointerEvents: "none" }}>{leaving.node}</div>}
    <div ref={inner} key={k} style={{ display: "flow-root" }}>{children}</div>
  </div>;
}

/* ═══════════ Riquadri rapidi della Panoramica ═══════════ */
const SB_CARD = { background: "#fff", borderRadius: 24, boxShadow: "var(--sh-pop)", margin: 16, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", overflow: "hidden" };
const SB_PANEL = { background: "#fafafa", borderRadius: 16, boxShadow: "inset 0 0 0 1px #f0f0f0" };
const SB_LABEL = { fontSize: 12, color: "var(--ink-3)", margin: "0 0 8px 2px" };
function SbHeader({ title, onClose }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 14px 12px 18px" }}>
    <h3 style={{ flex: 1, fontSize: 15, fontWeight: 500, letterSpacing: "-.01em" }}>{title}</h3>
    <button className="press" onClick={onClose} aria-label="Chiudi" style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", color: "var(--ink-2)" }}><Icon name="x" size={18} /></button>
  </div>;
}
function SbPrimary({ children, k, onClick, disabled, busy, style }) {
  // durante l'invio resta focalizzabile (aria-disabled), così tastiera e lettori di schermo non perdono il punto
  return <button className="press" data-kind="brand" data-focus="primary" onClick={busy ? undefined : onClick} disabled={disabled} aria-disabled={busy || undefined} aria-busy={busy || undefined}
    style={{ width: "100%", height: 40, borderRadius: 999, fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center",
      background: disabled ? "#e5e5e5" : busy ? "#262626" : "var(--btn-brand-bg, #0a0a0a)", color: disabled ? "#737373" : "#fff", transition: "background-color .1s, color .1s", cursor: disabled ? "default" : "pointer", ...style }}>
    <SwapText k={k}>{children}</SwapText>
  </button>;
}
function SbSecondary({ children, onClick, disabled, style, k }) {
  return <button className="press" data-kind="soft" onClick={onClick} disabled={disabled}
    style={{ flex: 1, height: 36, borderRadius: 999, fontSize: 14, fontWeight: 500, background: "var(--btn-soft-bg, #fff)", boxShadow: "inset 0 0 0 1px #e5e5e5", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
    {k != null ? <SwapText k={k}>{children}</SwapText> : children}
  </button>;
}
function SbStepper({ value, set, min = 1, max = 99, label }) {
  const b = { width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", background: "#fff", boxShadow: "inset 0 0 0 1px #e5e5e5", color: "var(--ink)" };
  const prev = useRef(value); const down = value < prev.current; useEffect(() => { prev.current = value; });
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }} role="group" aria-label={label}>
    <button className="press" style={b} onClick={() => set(Math.max(min, value - 1))} disabled={value <= min} aria-label={"Meno " + label}><Icon name="minus" size={14} /></button>
    <span className="num" style={{ minWidth: 20, textAlign: "center", fontSize: 14, fontWeight: 500 }}><SwapText k={String(value)} down={down}>{value}</SwapText></span>
    <button className="press" style={b} onClick={() => set(Math.min(max, value + 1))} disabled={value >= max} aria-label={"Più " + label}><Icon name="plus" size={14} /></button>
  </div>;
}
function SbTableChips({ tables, value, onPick }) {
  if (!tables.length) return <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "6px 2px" }}>Nessun tavolo: creane uno da Sala › Configurazione.</div>;
  return <div className="scroll" style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 112, overflowY: "auto", padding: 1 }} role="radiogroup" aria-label="Tavolo">
    {tables.map(t => { const on = value === t.n; return <button key={t._id || t.n} className="press" role="radio" aria-checked={on} onClick={() => onPick(t)}
      style={{ minWidth: 40, height: 30, padding: "0 11px", borderRadius: 999, fontSize: 13, fontWeight: 500, background: on ? "#0a0a0a" : "#fff", color: on ? "#fff" : "var(--ink)", boxShadow: on ? "none" : "inset 0 0 0 1px #e5e5e5", transition: "background-color .12s, color .12s" }}>{t.n}</button>; })}
  </div>;
}
function SbSuccess({ mark, title, sub, children }) {
  return <div style={{ width: 292, padding: "22px 18px 18px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
    <div className="sb-enter" style={{ position: "relative", animationDelay: "100ms", marginBottom: 12 }}>
      <span className="num" style={{ width: 42, height: 42, borderRadius: 999, display: "grid", placeItems: "center", background: "#f5f5f5", boxShadow: "inset 0 0 0 1px #e5e5e5", fontSize: 15, fontWeight: 500 }}>{mark}</span>
      <span className="sb-badge-in" style={{ position: "absolute", right: -5, bottom: -3, width: 18, height: 18, borderRadius: 999, background: "#15803d", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 0 0 2px #fff" }}><Icon name="check" size={11} stroke={3} /></span>
    </div>
    <div className="sb-enter" style={{ animationDelay: "100ms", fontSize: 15, fontWeight: 500, lineHeight: 1.35, letterSpacing: "-.01em" }}>{title}</div>
    <div className="sb-enter" style={{ animationDelay: "120ms", fontSize: 12.5, color: "#525252", marginTop: 4 }}>{sub}</div>
    <div className="sb-enter" style={{ animationDelay: "166ms", display: "flex", gap: 8, width: "100%", marginTop: 16 }}>{children}</div>
  </div>;
}
const sbErrMsg = (e) => (e && e.message && !/Failed to fetch|NetworkError|Load failed/i.test(e.message)) ? translateMsg(e.message) : "Connessione non riuscita. Controlla la rete e riprova.";
function SbError({ msg }) {
  if (!msg) return null;
  return <div role="alert" className="sb-enter" style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12.5, color: "#b91c1c", margin: "10px 2px 0" }}><Icon name="alert" size={14} style={{ marginTop: 1 }} />{msg}</div>;
}
const sbAllTables = () => (ROOMS || []).flatMap(r => (r.tables || []).map(t => ({ ...t, sala: r.nome || r.name })));

/* ── Nuovo conto: tavolo, coperti, «Apri conto». Non c'è un'API per annullare un conto
   (niente DELETE /bills): la card di successo offre «Vai alla cassa» + «Fatto». ── */
function QuickNewBill({ onClose, go }) {
  const tables = useMemo(sbAllTables, []);
  const [table, setTable] = useState(null);
  const [covers, setCovers] = useState(2);
  const [phase, setPhase] = useState("form");    // form | sending | done
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const inflight = useRef(false);
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);
  const pick = (t) => { setTable(t); setCovers(c => (t.posti && c === 2 ? Math.min(t.posti, 99) : c)); setErr(""); };
  const submit = async () => {
    if (!table || inflight.current) return;
    inflight.current = true; setPhase("sending"); setErr("");
    const started = Date.now();
    try {
      const bill = await window.TakoActions.billCreate({ tableNumber: String(table.n), covers: Number(covers) || 1 });
      const existed = bill && bill.createdAt && new Date(bill.createdAt).getTime() < started - 5000;
      if (!alive.current) { toast(existed ? `Conto già aperto · Tavolo ${table.n}` : `Conto aperto · Tavolo ${table.n}`, { type: "success" }); window.takoReload && window.takoReload(); return; }
      setResult({ existed, n: table.n, covers: bill && bill.covers || covers, sala: table.sala });
      setPhase("done");
      window.takoReload && window.takoReload();
    } catch (e) {
      if (!alive.current) { toast(sbErrMsg(e), { type: "error" }); return; }
      setErr(sbErrMsg(e)); setPhase("form");
    } finally { inflight.current = false; }
  };
  const busy = phase === "sending";
  const cardRef = useRef(null);
  useEffect(() => { if (phase === "done") { const b = cardRef.current && [...cardRef.current.querySelectorAll("[data-focus=primary]")].pop(); if (b) b.focus({ preventScroll: true }); } }, [phase]);
  return <div style={SB_CARD} data-sb-quick="conto" ref={cardRef}>
    <SizeMorph k={phase === "done" ? "done" : "form"}>
      {phase === "done" && result ? (
        <SbSuccess mark={result.n} title={<>{result.existed ? "Conto già aperto" : "Conto aperto"}<br />Tavolo {result.n}</>}
          sub={`${result.covers} ${result.covers === 1 ? "coperto" : "coperti"}${result.sala ? " · " + result.sala : ""}`}>
          <SbSecondary onClick={() => { onClose(); go("cassa"); }}>Vai alla cassa</SbSecondary>
          <SbPrimary k="fatto" onClick={onClose} style={{ flex: 1, height: 36, width: "auto" }}>Fatto</SbPrimary>
        </SbSuccess>
      ) : (
        <div style={{ width: 360, maxWidth: "calc(100vw - 32px)" }}>
          <SbHeader title="Nuovo conto" onClose={onClose} />
          <div style={{ padding: "0 8px 8px" }}>
            <div style={{ ...SB_PANEL, padding: "12px 12px 12px" }}>
              <div style={SB_LABEL}>Tavolo</div>
              <SbTableChips tables={tables} value={table && table.n} onPick={pick} />
            </div>
            <div style={{ ...SB_PANEL, display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 8px 14px", marginTop: 8 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>Coperti</div><div style={{ fontSize: 12, color: "#525252" }}>{table ? `Tavolo ${table.n}${table.posti ? " · " + table.posti + " posti" : ""}` : "Scegli prima il tavolo"}</div></div>
              <SbStepper value={covers} set={setCovers} label="coperti" />
            </div>
            <div style={{ height: 1, background: "#f0f0f0", margin: "12px 6px" }} />
            <SbPrimary k={busy ? "busy" : table ? "go" : "pick"} onClick={submit} disabled={!table} busy={busy}>
              {busy ? <><Spinner />Invio…</> : table ? `Apri conto · Tavolo ${table.n}` : "Apri conto"}
            </SbPrimary>
            <SbError msg={err} />
          </div>
        </div>
      )}
    </SizeMorph>
  </div>;
}

/* ── Comanda: tavolo, ricerca piatti con quantità, «Invia in cucina».
   Annullabile davvero: PATCH /orders/:id/cancel (stessa API della lista Ordini). ── */
function QuickComanda({ onClose, go }) {
  const tables = useMemo(sbAllTables, []);
  const dishes = useMemo(() => (MENU || []).flatMap(s => (s.piatti || []).map(p => ({ ...p, sezione: s.sezione }))), []);
  const [table, setTable] = useState(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState({});      // _id → qty
  const [phase, setPhase] = useState("form"); // form | sending | done | undoing
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState(null);
  const inflight = useRef(false);
  const keyRef = useRef(null);
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);
  const add = (id, d) => { setErr(""); setNote(""); setCart(c => { const n = { ...c }; const v = (n[id] || 0) + d; if (v <= 0) delete n[id]; else n[id] = Math.min(v, 99); return n; }); keyRef.current = null; };
  const lines = Object.entries(cart).map(([id, qty]) => ({ d: dishes.find(x => x._id === id), qty })).filter(x => x.d);
  const count = lines.reduce((a, x) => a + x.qty, 0);
  const total = lines.reduce((a, x) => a + x.qty * (x.d.prezzo || 0), 0);
  const shown = useMemo(() => { const s = q.trim().toLowerCase(); return (s ? dishes.filter(d => d.nome.toLowerCase().includes(s) || (d.sezione || "").toLowerCase().includes(s)) : dishes).slice(0, 40); }, [q, dishes]);
  const submit = async () => {
    if (!table || !count || inflight.current) return;
    inflight.current = true; setPhase("sending"); setErr(""); setNote("");
    // una chiave per questa comanda: un retry o un doppio invio non la duplica
    if (!keyRef.current) keyRef.current = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const order = await window.TakoActions.staffOrder({ tableId: table._id, tableNumber: String(table.n), type: "table", items: lines.map(x => ({ menuItemId: x.d._id, quantity: x.qty })), idempotencyKey: keyRef.current });
      if (!alive.current) { toast(`Comanda T${table.n} inviata in cucina`, { type: "success", icon: "kitchen" }); window.takoReload && window.takoReload(); return; }
      setResult({ id: order && order.id, n: table.n, count, total });
      setPhase("done");
      window.takoReload && window.takoReload();
    } catch (e) {
      if (!alive.current) { toast(sbErrMsg(e), { type: "error" }); return; }
      setErr(sbErrMsg(e)); setPhase("form");
    } finally { inflight.current = false; }
  };
  const undo = async () => {
    if (!result || !result.id || inflight.current) return;
    inflight.current = true; setPhase("undoing"); setErr("");
    try {
      await window.TakoAPI.patch(`/orders/${result.id}/cancel`);
      if (!alive.current) return;
      keyRef.current = null; setNote(`Comanda del tavolo ${result.n} annullata. Puoi correggerla e reinviarla.`); setPhase("form");
      window.takoReload && window.takoReload();
    } catch (e) { if (alive.current) { setErr(sbErrMsg(e)); setPhase("done"); } }
    finally { inflight.current = false; }
  };
  const busy = phase === "sending";
  const success = phase === "done" || phase === "undoing";
  const primaryLabel = busy ? <><Spinner />Invio…</> : !table ? "Scegli il tavolo" : !count ? "Aggiungi i piatti" : <>Invia in cucina · <SwapText k={String(count)}>{count}</SwapText></>;
  const cardRef = useRef(null);
  useEffect(() => { if (phase === "done" || (phase === "form" && note)) { const b = cardRef.current && [...cardRef.current.querySelectorAll("[data-focus=primary]:not(:disabled)")].pop(); if (b) b.focus({ preventScroll: true }); } }, [phase]);
  return <div style={SB_CARD} data-sb-quick="comanda" ref={cardRef}>
    <SizeMorph k={success ? "done" : "form"} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {success && result ? (
        <SbSuccess mark={result.n} title={<>Inviata in cucina<br />Tavolo {result.n}</>} sub={`${result.count} ${result.count === 1 ? "piatto" : "piatti"} · ${euro(result.total)}`}>
          <SbSecondary onClick={undo} disabled={phase === "undoing"} k={phase === "undoing" ? "u" : "a"}>{phase === "undoing" ? <><Spinner size={14} />Annullo…</> : "Annulla"}</SbSecondary>
          <SbPrimary k="fatto" onClick={onClose} style={{ flex: 1, height: 36, width: "auto" }}>Fatto</SbPrimary>
        </SbSuccess>
      ) : (
        <div style={{ width: 400, maxWidth: "calc(100vw - 32px)", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 32px)" }}>
          <SbHeader title={table ? `Comanda · Tavolo ${table.n}` : "Comanda"} onClose={onClose} />
          <div className="scroll" style={{ padding: "0 8px 8px", overflowY: "auto", minHeight: 0 }}>
            <div style={{ ...SB_PANEL, padding: 12 }}>
              <div style={SB_LABEL}>Tavolo</div>
              <SbTableChips tables={tables} value={table && table.n} onPick={(t) => { setTable(t); setErr(""); keyRef.current = null; }} />
            </div>
            {lines.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 2px 0" }} aria-label="Piatti scelti">
              {lines.map(x => <span key={x.d._id} className="sb-chip-in" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 6px 0 11px", borderRadius: 999, background: "#f5f5f5", fontSize: 13, fontWeight: 500 }}>
                <span className="num"><SwapText k={String(x.qty)}>{x.qty}×</SwapText></span>{x.d.nome}
                <button className="press" onClick={() => add(x.d._id, -x.qty)} aria-label={"Togli " + x.d.nome} style={{ width: 20, height: 20, borderRadius: 999, display: "grid", placeItems: "center", color: "#525252" }}><Icon name="x" size={12} /></button>
              </span>)}
            </div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", margin: "10px 0 6px", borderRadius: 999, boxShadow: "inset 0 0 0 1px #e5e5e5", color: "var(--ink-3)" }}>
              <Icon name="search" size={15} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca un piatto" aria-label="Cerca un piatto" style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13.5, color: "var(--ink)", fontFamily: "inherit" }} />
            </div>
            <div role="list" aria-label="Piatti">
              {shown.length === 0 && <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "10px 4px" }}>{dishes.length ? "Nessun piatto trovato." : "Il menu è vuoto: aggiungi piatti da Menu."}</div>}
              {shown.map(d => { const qty = cart[d._id] || 0; return <div key={d._id} role="listitem" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px 7px 8px", borderRadius: 12, background: qty ? "#f5f5f5" : "transparent", opacity: d.disp ? 1 : .45, transition: "background-color .12s" }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nome}</div><div style={{ fontSize: 12, color: "#737373" }}>{d.sezione} · {euro(d.prezzo || 0)}</div></div>
                {!d.disp ? <span style={{ fontSize: 12, color: "#737373" }}>Esaurito</span> : qty ? <SbStepper value={qty} set={(v) => add(d._id, v - qty)} min={0} label={d.nome} />
                  : <button className="press" onClick={() => add(d._id, 1)} aria-label={"Aggiungi " + d.nome} style={{ height: 30, padding: "0 12px", borderRadius: 999, background: "#fff", boxShadow: "inset 0 0 0 1px #e5e5e5", fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="plus" size={13} />Aggiungi</button>}
              </div>; })}
            </div>
          </div>
          <div style={{ padding: "8px 8px 8px", borderTop: "1px solid #f0f0f0" }}>
            {note && <div className="sb-enter" style={{ fontSize: 12.5, color: "#525252", margin: "0 4px 8px" }}>{note}</div>}
            <SbPrimary k={busy ? "busy" : !table ? "t" : !count ? "c" : "go"} onClick={submit} disabled={!table || !count} busy={busy}>{primaryLabel}</SbPrimary>
            {count > 0 && !err && <div style={{ fontSize: 12, color: "#737373", textAlign: "center", marginTop: 6 }}>{count} {count === 1 ? "piatto" : "piatti"} · {euro(total)}</div>}
            <SbError msg={err} />
          </div>
        </div>
      )}
    </SizeMorph>
  </div>;
}

/* Scorciatoie della Panoramica nel tema Sobrio: pulsanti a pillola come «Share». */
function SobrioShortcuts({ go, role }) {
  const [quick, setQuick] = useState(null);
  const can = (id) => canNavigate(role, id);
  const close = () => setQuick(null);
  const morph = (id) => (e) => sbPageMorphGo(id, e.currentTarget, go);
  return <Card pad={18}>
    <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Scorciatoie</h3>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {can("cassa") && <Btn kind="brand" size="sm" icon="cassa" data-morph-id="quick-conto" onClick={() => setQuick("conto")}>Nuovo conto</Btn>}
      {can("comanda") && <Btn kind="brand" size="sm" icon="comanda" data-morph-id="quick-comanda" onClick={() => setQuick("comanda")}>Comanda</Btn>}
      {can("sala") && <Btn kind="soft" size="sm" icon="map" data-morph-id="sala" onClick={morph("sala")}>Sala live</Btn>}
      {can("kds") && <Btn kind="soft" size="sm" icon="kitchen" data-morph-id="kds" onClick={morph("kds")}>Cucina</Btn>}
      {role === "owner" && <Btn kind="soft" size="sm" icon="menu" data-morph-id="menu" onClick={(e) => { window.__takoOpenMenuSetup = true; sbPageMorphGo("menu", e.currentTarget, go); }}>Configura menu cliente</Btn>}
    </div>
    <Overlay open={quick === "conto"} onClose={close} anchor="center">{quick === "conto" && <QuickNewBill onClose={close} go={go} />}</Overlay>
    <Overlay open={quick === "comanda"} onClose={close} anchor="center">{quick === "comanda" && <QuickComanda onClose={close} go={go} />}</Overlay>
  </Card>;
}

/* Tema per utente: localStorage (nessun endpoint di preferenze utente nel server). */
const UI_THEMES = { classico: "Tako classico", sobrio: "Sobrio" };
function uiKey(userId) { return "tako-dash-ui:" + (userId || "anon"); }
function loadUi(userId) { try { const v = localStorage.getItem(uiKey(userId)); return v === "sobrio" ? "sobrio" : "classico"; } catch (_) { return "classico"; } }
function saveUi(userId, v) { try { localStorage.setItem(uiKey(userId), v); } catch (_) {} }

Object.assign(window, {
  SB, sbSpring, MorphOverlay, PageMorphLayer, sbPageMorphGo, sbPageBack, sbPageRouteChanged, sbInstallTriggerTracker,
  SwapText, Spinner, CopyPill, SizeMorph, QuickNewBill, QuickComanda, SobrioShortcuts, UI_THEMES, loadUi, saveUi,
});
