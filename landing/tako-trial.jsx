/* global React */
/* tako-trial.jsx — pagina "Prova Gratis": hero = simulazione a tutto schermo
   (iframe → Tako Showcase.html) con titolo + CTA sovrapposti, sezione benefici
   "cosa include la prova", form di registrazione inline. Massimo movimento. */

const { useState: tS, useEffect: tE, useRef: tR } = React;

const TRIAL_LINK = 'demo.html';

/* ─────────── reveal robusto (scroll + IO + in-view immediato + safety net) ───────────
   Il pannello di anteprima può "congelare" transition/animation e ritardare
   l'IntersectionObserver: questo hook rivela gli elementi in vista subito, su scroll
   e via IO, e accende il safety-net dell'hero. */
function useRobustReveal() {
  tE(() => {
    const sel = '.reveal, .reveal-l, .reveal-r, .reveal-pop';
    const inView = (el) => { const r = el.getBoundingClientRect(); return r.top < (window.innerHeight * 0.9) && r.bottom > 0; };
    const sweep = () => document.querySelectorAll(sel).forEach((el) => { if (inView(el)) el.classList.add('in'); });
    requestAnimationFrame(sweep);
    const t1 = setTimeout(sweep, 300);
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((ents) => {
        ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.12 });
      document.querySelectorAll(sel).forEach((el) => io.observe(el));
    }
    const onScroll = () => sweep();
    window.addEventListener('scroll', onScroll, { passive: true });
    const tReady = setTimeout(() => document.body.classList.add('tk-ready'), 1500);
    return () => { io && io.disconnect(); window.removeEventListener('scroll', onScroll); clearTimeout(t1); clearTimeout(tReady); };
  });
}

/* ─────────── tema (primary tweakabile) ─────────── */
function applyTrialTheme(primary) {
  if (!primary) return;
  document.documentElement.style.setProperty('--coral', primary);
}

/* ─────────── barra di progresso scroll ─────────── */
function ScrollProgress() {
  const ref = tR(null);
  tE(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? (h.scrollTop || window.scrollY) / max : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  return <div className="scroll-prog" ref={ref} />;
}

/* ─────────── scroll helper (niente scrollIntoView) ─────────── */
function smoothTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 8;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

/* ─────────── navbar trial ─────────── */
function TrialNav() {
  const [scrolled, setScrolled] = tS(false);
  tE(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [
    { href: 'Tako%20Landing.html', label: 'Home' },
    { href: 'Tako%20Landing.html#how', label: 'Come funziona' },
    { href: 'Tako%20Landing.html', label: 'Lato ristoratore' },
    { href: 'Tako%20Landing.html', label: 'Lato cliente' },
  ];
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'glass-dark py-3' : 'py-5'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <a href="Tako%20Landing.html" className="cursor-pointer flex items-center gap-2">
          <img src="assets/tako-chef.png" alt="Tako" style={{ width: 44, height: 44, objectFit: 'contain' }} className="logo-bob" />
          <span className="font-display font-black text-2xl tracking-tight" style={{ color: 'var(--ink)' }}>Tako</span>
        </a>
        <nav className="hidden md:flex items-center gap-7 font-bold text-[15px]">
          {links.map((l, i) => (
            <a key={i} href={l.href} className="transition hover:opacity-100 opacity-80" style={{ color: 'var(--ink)' }}>{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="Tako%20Landing.html" className="hidden md:inline-block font-bold text-[15px]" style={{ color: 'var(--ink)' }}>Accedi</a>
          <button onClick={() => smoothTo('form')} className="btn-coral px-5 py-2.5 text-[14px]">Prova gratis</button>
        </div>
      </div>
    </header>
  );
}

/* ─────────── hero = simulazione interattiva + "apri la cassa" ───────────
   Stato iniziale: solo il MacBook (centrato), con cui si può interagire del tutto.
   Tenendo premuto "Prova ora" una linea traccia il bordo del pulsante; a fine carica
   il pulsante svanisce, si invia "reveal" alla simulazione → il Mac scivola a sinistra
   e i 4 iPhone entrano da destra con un pop cinematico. */
const HOLD_MS = 1150;

function HeroStage() {
  const [revealed, setRevealed] = tS(false);
  const mobile = typeof window !== 'undefined' && window.innerWidth <= 820;
  const frameRef = tR(null);
  const btnRef = tR(null);
  const ringRef = tR(null);
  const hold = tR({ raf: 0, start: 0, active: false, done: false });

  const setRing = (p) => { if (ringRef.current) ringRef.current.style.strokeDashoffset = String(100 * (1 - p)); };

  const fireReveal = () => {
    try { frameRef.current && frameRef.current.contentWindow.postMessage({ source: 'tako-trial', type: 'reveal' }, '*'); } catch (e) {}
  };

  const complete = () => {
    const h = hold.current;
    if (h.done) return;
    h.done = true; h.active = false; cancelAnimationFrame(h.raf);
    setRing(1);
    if (btnRef.current) btnRef.current.classList.add('opening');
    fireReveal();
    setTimeout(() => setRevealed(true), 540);
  };

  const tick = (ts) => {
    const h = hold.current;
    if (!h.active) return;
    if (!h.start) h.start = ts;
    const p = Math.min((ts - h.start) / HOLD_MS, 1);
    setRing(p);
    if (p >= 1) { complete(); return; }
    h.raf = requestAnimationFrame(tick);
  };

  const startHold = (e) => {
    e.preventDefault();
    const h = hold.current;
    if (h.done || h.active) return;
    h.active = true; h.start = 0;
    if (btnRef.current) btnRef.current.classList.add('holding');
    h.raf = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    const h = hold.current;
    if (h.done || !h.active) return;
    h.active = false; cancelAnimationFrame(h.raf);
    if (btnRef.current) btnRef.current.classList.remove('holding');
    let p = 1 - (parseFloat((ringRef.current && ringRef.current.style.strokeDashoffset) || '100') / 100);
    const back = () => { p -= 0.09; if (p <= 0) { setRing(0); return; } setRing(p); requestAnimationFrame(back); };
    back();
  };

  // La simulazione segnala la chiusura del Mac (click sulla base): ripristina il
  // pulsante "Prova ora" così l'utente può riaprire e rivedere l'animazione.
  tE(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (d && d.source === 'tako-sim' && d.type === 'closed') {
        hold.current = { raf: 0, start: 0, active: false, done: false };
        setRevealed(false);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <section className={`sim-wrap ${revealed ? 'is-revealed' : 'is-idle'}`} id="hero" data-screen-label="Hero — Simulazione">
      <div className="sim-stage">
        <iframe ref={frameRef} className="sim-frame" src={`Tako%20Showcase.html?sync&staged${mobile ? '&mobile' : ''}`} title="Simulazione Tako — dashboard interattiva e tavoli" loading="eager" scrolling="no" />
      </div>

      {!revealed && (
        <div className="open-zone">
          <button
            ref={btnRef}
            className="open-btn"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Tieni premuto per provare ora"
          >
            <svg className="open-ring" viewBox="0 0 264 76" preserveAspectRatio="none" aria-hidden="true">
              <rect className="ring-track" x="3" y="3" width="258" height="70" rx="35" />
              <rect ref={ringRef} className="ring-prog" x="3" y="3" width="258" height="70" rx="35" pathLength="100" />
            </svg>
            <span className="open-inner">
              <span className="open-label">Prova ora</span>
              <span className="open-hint">tieni premuto</span>
            </span>
          </button>
        </div>
      )}
    </section>
  );
}

/* ─────────── sezione benefici ─────────── */
const INCLUDES = [
  { icon: '🗓️', title: '30 giorni completi', desc: 'Tutte le funzioni del piano Pro, senza limiti e senza vincoli.', color: '#FFEEE8' },
  { icon: '💳', title: 'Nessuna carta', desc: 'Provi tutto senza inserire un solo dato di pagamento.', color: '#E8F4ED' },
  { icon: '🌍', title: 'Menu multilingua', desc: 'I clienti ordinano nella loro lingua, tu ricevi sempre in italiano.', color: '#EAF2F8' },
  { icon: '🤖', title: 'Tako AI inclusa', desc: "L'assistente che risponde ai clienti su piatti e allergeni, 24/7.", color: '#FFF4E0' },
  { icon: '📊', title: 'Dashboard completa', desc: 'Sala, ordini e incassi in tempo reale, su ogni dispositivo.', color: '#F3ECFB' },
  { icon: '⏱️', title: 'Setup in 10 minuti', desc: 'Importi il menu da PDF o Excel e sei subito online.', color: '#FFE9E0' },
];

function Includes() {
  return (
    <section id="includes" className="relative py-28 px-6" data-screen-label="Cosa include la prova" style={{ background: 'linear-gradient(180deg, #FFF8F3 0%, #FFEEE8 100%)' }}>
      <div className="absolute -top-40 -left-24 w-[440px] h-[440px] blob-1 pointer-events-none" style={{ background: 'rgba(248,183,166,0.5)', filter: 'blur(2px)', zIndex: 1 }} />
      <div className="absolute bottom-0 -right-28 w-[460px] h-[460px] blob-2 pointer-events-none" style={{ background: 'rgba(189,217,232,0.4)', filter: 'blur(2px)' }} />
      <Bubbles count={8} />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="chip mb-5 reveal">La prova gratuita</span>
          <h2 className="text-5xl md:text-6xl reveal">Tutto incluso. <span className="grad-text">Per 30 giorni.</span></h2>
          <p className="text-lg md:text-xl mt-4 max-w-2xl mx-auto reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
            Nessuna versione ridotta: durante la prova hai Tako al completo. Esattamente quello che hai appena visto nella simulazione.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {INCLUDES.map((c, i) => (
            <div key={i} className="chunky p-4 md:p-7 hover-rise reveal-pop" style={{ transitionDelay: `${i * 0.07}s` }}>
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl grid place-items-center text-xl md:text-3xl mb-2.5 md:mb-5 border-2" style={{ background: c.color, borderColor: 'var(--ink)' }}>{c.icon}</div>
              <h3 className="text-[15px] md:text-2xl mb-1 md:mb-2 leading-tight">{c.title}</h3>
              <p className="text-[12px] md:text-[15px] leading-snug" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── coriandoli ─────────── */
function burstConfetti() {
  const colors = ['#ED7159', '#F5C065', '#7FC4A8', '#BDD9E8', '#D9533A'];
  const root = document.createElement('div');
  root.className = 'cft-root';
  document.body.appendChild(root);
  const N = 90;
  for (let i = 0; i < N; i++) {
    const s = document.createElement('i');
    s.className = 'cft';
    const x = 50 + (Math.random() * 50 - 25);
    s.style.left = x + 'vw';
    s.style.top = '42vh';
    s.style.background = colors[i % colors.length];
    const dx = (Math.random() * 2 - 1) * 60;
    const dy = 60 + Math.random() * 50;
    const rot = Math.random() * 720 - 360;
    const dur = 1.1 + Math.random() * 1.1;
    s.style.setProperty('--dx', dx + 'vw');
    s.style.setProperty('--dy', dy + 'vh');
    s.style.setProperty('--rot', rot + 'deg');
    s.style.animationDuration = dur + 's';
    s.style.animationDelay = (Math.random() * 0.18) + 's';
    if (Math.random() > 0.5) s.style.borderRadius = '50%';
    root.appendChild(s);
  }
  setTimeout(() => root.remove(), 2800);
}

/* ─────────── form di registrazione ─────────── */
function SignupForm({ confetti }) {
  const [email, setEmail] = tS('');
  const [rest, setRest] = tS('');
  const [done, setDone] = tS(false);
  const [err, setErr] = tS('');

  const submit = (e) => {
    e.preventDefault();
    const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!rest.trim()) { setErr('Inserisci il nome del tuo ristorante.'); return; }
    if (!okMail) { setErr('Controlla la tua email.'); return; }
    setErr('');
    setDone(true);
    if (confetti) burstConfetti();
  };

  return (
    <section id="form" className="relative py-28 px-6 overflow-hidden" data-screen-label="Form registrazione" style={{ background: 'var(--coral)' }}>
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 2px, transparent 2px)', backgroundSize: '32px 32px' }} />
      <div className="absolute -top-16 -left-10 w-72 h-72 blob-2 pointer-events-none" style={{ background: 'rgba(255,255,255,0.16)' }} />

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        {/* left — pitch + mascotte */}
        <div className="text-white reveal-l">
          <span className="chip mb-5" style={{ background: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.5)', color: '#fff' }}>Attiva ora</span>
          <h2 className="text-5xl md:text-6xl mb-5" style={{ color: '#fff' }}>Accendi la tua<br />sala in 10 minuti.</h2>
          <p className="text-xl mb-8" style={{ color: 'rgba(255,248,243,0.92)', fontWeight: 600 }}>
            Lascia email e nome del locale: ti spediamo l'accesso e i QR dei tavoli. Da lì sei online.
          </p>
          <div className="flex items-center gap-5">
            <img src="assets/tako-hello.png" alt="Tako" className="w-32 float-y" style={{ filter: 'drop-shadow(0 18px 26px rgba(0,0,0,0.22))' }} />
            <ul className="space-y-2 font-bold" style={{ color: '#fff' }}>
              <li className="flex items-center gap-2"><span className="tick">✓</span> 30 giorni gratis</li>
              <li className="flex items-center gap-2"><span className="tick">✓</span> Nessuna carta richiesta</li>
              <li className="flex items-center gap-2"><span className="tick">✓</span> Cancelli quando vuoi</li>
            </ul>
          </div>
        </div>

        {/* right — card form / success */}
        <div className="reveal-r">
          <div className="form-card">
            {!done ? (
              <form onSubmit={submit} noValidate>
                <h3 className="text-3xl mb-1" style={{ color: 'var(--ink)' }}>Inizia la prova</h3>
                <p className="mb-6 text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Gratis per 30 giorni. Disdici quando vuoi.</p>

                <label className="fld-label">Nome del ristorante</label>
                <div className="fld">
                  <span className="fld-ic">🍽️</span>
                  <input type="text" value={rest} onChange={(e) => setRest(e.target.value)} placeholder="Trattoria da Nino" />
                </div>

                <label className="fld-label">Email di lavoro</label>
                <div className="fld">
                  <span className="fld-ic">✉️</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ciao@tuoristorante.it" />
                </div>

                {err && <div className="fld-err">{err}</div>}

                <button type="submit" className="btn-coral w-full py-4 text-lg mt-2 inline-flex items-center justify-center gap-2">
                  Inizia la prova gratis <span aria-hidden>→</span>
                </button>
                <p className="text-center mt-4 text-[13px]" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>
                  Registrandoti accetti i <a href="Tako%20Landing.html" style={{ color: 'var(--coral-deep)', fontWeight: 800 }}>Termini</a> e la Privacy.
                </p>
              </form>
            ) : (
              <div className="success">
                <img src="assets/tako-thumbsup.png" alt="Tako" className="success-mascot" />
                <div className="success-check">✓</div>
                <h3 className="text-3xl mt-2 mb-2" style={{ color: 'var(--ink)' }}>Benvenuto a bordo! 🎉</h3>
                <p className="text-[16px] mb-1" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>
                  Abbiamo spedito l'accesso a <b style={{ color: 'var(--ink)' }}>{email}</b>.
                </p>
                <p className="text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>
                  La prova di <b style={{ color: 'var(--coral-deep)' }}>{rest || 'il tuo locale'}</b> è attiva per 30 giorni.
                </p>
                <button onClick={() => { setDone(false); setEmail(''); setRest(''); }} className="btn-ghost px-6 py-3 mt-6">Registra un altro locale</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── root ─────────── */
const TRIAL_TWEAKS = /*EDITMODE-BEGIN*/{
  "primary": "#ED7159",
  "confetti": true
}/*EDITMODE-END*/;

function TrialApp() {
  const [t, setTweak] = useTweaks(TRIAL_TWEAKS);
  useRobustReveal();
  tE(() => { applyTrialTheme(t.primary); }, [t.primary]);

  return (
    <>
      <ScrollProgress />
      <Navbar />
      <main>
        <HeroStage />
        <Includes />
        <SignupForm confetti={t.confetti} />
      </main>
      <Footer />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Brand" />
        <TweakColor label="Colore primario" value={t.primary} options={['#ED7159', '#2A6FDB', '#1F8A5B', '#7A4FD0', '#E0A23C']} onChange={(v) => setTweak('primary', v)} />
        <TweakSection label="Effetti" />
        <TweakToggle label="Coriandoli all'invio" value={t.confetti} onChange={(v) => setTweak('confetti', v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<TrialApp />);
