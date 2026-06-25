/* global React */
/* tako-extra-shell.jsx — shell + primitivi + router per le pagine del footer
   (Prodotto / Risorse / Azienda). Le pagine sono registrate in window.TAKO_PAGES
   dai file di contenuto, poi montate leggendo ?p=<slug>. */

const { useState: xS, useEffect: xE } = React;

const LANDING = 'Tako%20Landing.html';
const TRIAL = 'Tako%20Demo.html';
const pageUrl = (slug) => 'Tako%20Pagine.html?p=' + slug;

window.TAKO_PAGES = window.TAKO_PAGES || {};

/* ─────────── nav (chiaro, testo ink) ─────────── */
function ExtraNav() {
  const [scrolled, setScrolled] = xS(false);
  xE(() => {
    const f = () => setScrolled(window.scrollY > 20);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const links = [
    { href: pageUrl('funzioni'), label: 'Funzioni' },
    { href: LANDING + '#how', label: 'Come funziona' },
    { href: pageUrl('chi-siamo'), label: 'Chi siamo' },
  ];
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'glass py-3' : 'py-5'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <a href={LANDING} className="cursor-pointer flex items-center gap-2">
          <img src="assets/tako-chef.png" alt="Tako" style={{ width: 42, height: 42, objectFit: 'contain' }} className="logo-bob" />
          <span className="font-display font-black text-2xl tracking-tight" style={{ color: 'var(--ink)' }}>Tako</span>
        </a>
        <nav className="hidden md:flex items-center gap-7 font-bold text-[15px]">
          {links.map((l, i) => (
            <a key={i} href={l.href} className="transition hover:opacity-100 opacity-80" style={{ color: 'var(--ink)' }}>{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href={LANDING} className="hidden md:inline-block font-bold text-[15px]" style={{ color: 'var(--ink)' }}>Accedi</a>
          <a href={TRIAL} className="btn-coral px-5 py-2.5 text-[14px]">Prova gratis</a>
        </div>
      </div>
    </header>
  );
}

/* ─────────── hero di pagina (molto animato) ─────────── */
function PageHero({ kicker, title, sub, mascot }) {
  return (
    <section className="relative overflow-hidden pt-36 pb-24 px-6" style={{ background: 'linear-gradient(180deg, #FFEEE8 0%, #FFF8F3 100%)' }}>
      <div className="absolute -top-28 -left-24 w-[420px] h-[420px] blob-1 pointer-events-none" style={{ background: 'rgba(248,183,166,0.5)' }} />
      <div className="absolute top-8 -right-32 w-[480px] h-[480px] blob-2 pointer-events-none" style={{ background: 'rgba(189,217,232,0.45)' }} />
      <div className="absolute -bottom-44 left-1/3 w-[360px] h-[360px] blob-1 pointer-events-none" style={{ background: 'rgba(245,192,101,0.26)' }} />
      <Bubbles count={12} />
      <img src="assets/tako-pasta.png" alt="" className="hidden md:block absolute left-7 top-44 w-24 swim pointer-events-none" style={{ filter: 'drop-shadow(0 16px 22px rgba(217,83,58,.18))' }} />
      <img src="assets/tako-bowtie.png" alt="" className="hidden md:block absolute right-10 bottom-16 w-24 float-y pointer-events-none" style={{ animationDelay: '.7s', filter: 'drop-shadow(0 16px 22px rgba(217,83,58,.18))' }} />
      <svg className="hidden md:block absolute right-[22%] top-28 w-16 h-16 spin-slow pointer-events-none" viewBox="0 0 100 100"><circle cx="50" cy="10" r="4" fill="var(--coral)"/><circle cx="90" cy="50" r="3" fill="var(--sun)"/><circle cx="50" cy="90" r="5" fill="var(--mint)" opacity=".7"/><circle cx="10" cy="50" r="3" fill="var(--coral-deep)"/></svg>
      <div className="relative max-w-5xl mx-auto text-center">
        {kicker && <span className="chip mb-6 reveal-pop">{kicker}</span>}
        <h1 className="text-5xl md:text-7xl leading-[0.98] reveal" style={{ transitionDelay: '.08s' }}>{title}</h1>
        {sub && (
          <p className="text-lg md:text-2xl mt-6 max-w-2xl mx-auto reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500, transitionDelay: '.16s' }}>{sub}</p>
        )}
        {mascot && <img src={mascot} alt="" className="mascot w-36 mx-auto mt-10 float-y reveal-pop" style={{ transitionDelay: '.24s' }} />}
      </div>
      <div className="wave-divider absolute -bottom-1 inset-x-0"><svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 Q360,80 720,40 T1440,40 L1440,80 L0,80 Z" fill="#FFF8F3"/></svg></div>
    </section>
  );
}

/* ─────────── band / section wrapper ─────────── */
function Band({ children, tint, id, narrow, bubbles }) {
  const bg = tint === 'cream' ? '#FFF8F3'
    : tint === 'tint' ? 'linear-gradient(180deg,#FFF8F3 0%,#FFEEE8 100%)'
    : tint === 'coral' ? 'var(--coral)'
    : '#FFFFFF';
  const dark = tint === 'coral';
  return (
    <section id={id} className="relative overflow-hidden py-20 px-6" style={{ background: bg }}>
      {!dark && <div className="absolute -right-28 top-6 w-[360px] h-[360px] blob-2 pointer-events-none" style={{ background: 'rgba(248,183,166,0.16)' }} />}
      {!dark && <div className="absolute -left-28 bottom-0 w-[320px] h-[320px] blob-1 pointer-events-none" style={{ background: 'rgba(189,217,232,0.16)' }} />}
      {bubbles && <Bubbles count={8} />}
      <div className={`relative ${narrow ? 'max-w-3xl' : 'max-w-6xl'} mx-auto`}>{children}</div>
    </section>
  );
}

function SectionHead({ chip, title, sub, light }) {
  return (
    <div className="text-center mb-12">
      {chip && <span className="chip mb-4 reveal">{chip}</span>}
      <h2 className="text-4xl md:text-5xl reveal" style={light ? { color: '#fff' } : null}>{title}</h2>
      {sub && <p className="text-lg mt-4 max-w-2xl mx-auto reveal" style={{ color: light ? 'rgba(255,248,243,.9)' : 'var(--ink-soft)', fontWeight: 500 }}>{sub}</p>}
    </div>
  );
}

/* ─────────── feature/benefit grid ─────────── */
function CardGrid({ items, cols = 3 }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-6`}>
      {items.map((c, i) => (
        <div key={i} className="chunky p-7 hover-rise reveal-pop" style={{ transitionDelay: `${i * 0.06}s` }}>
          {c.icon && <div className="w-14 h-14 rounded-2xl grid place-items-center text-3xl mb-5 border-2" style={{ background: c.color || 'var(--coral-tint)', borderColor: 'var(--ink)' }}>{c.icon}</div>}
          <h3 className="text-2xl mb-2">{c.title}</h3>
          <p className="text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{c.desc}</p>
        </div>
      ))}
    </div>
  );
}

/* ─────────── chips / tag rows ─────────── */
function ChipRow({ items }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {items.map((t, i) => (
        <span key={i} className="chip reveal-pop" style={{ transitionDelay: `${i * 0.03}s` }}>{t}</span>
      ))}
    </div>
  );
}

/* ─────────── FAQ accordion ─────────── */
function FAQList({ items }) {
  const [open, setOpen] = xS(0);
  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {items.map((q, i) => (
        <div key={i} className="chunky overflow-hidden reveal" style={{ transitionDelay: `${i * 0.04}s` }}>
          <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 text-left p-5">
            <span className="font-display font-black text-lg" style={{ color: 'var(--ink)' }}>{q.q}</span>
            <span className="text-2xl leading-none" style={{ color: 'var(--coral)', transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
          </button>
          {open === i && <div className="px-5 pb-5 -mt-1 text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{q.a}</div>}
        </div>
      ))}
    </div>
  );
}

/* ─────────── timeline (roadmap) ─────────── */
function Timeline({ items }) {
  return (
    <div className="relative max-w-3xl mx-auto">
      <div className="absolute left-[26px] top-2 bottom-2 w-1 rounded-full" style={{ background: 'var(--coral-soft)' }} />
      <div className="space-y-8">
        {items.map((it, i) => (
          <div key={i} className="relative flex gap-6 reveal-l" style={{ transitionDelay: `${i * 0.07}s` }}>
            <div className="relative z-10 flex-none w-14 h-14 rounded-full grid place-items-center font-display font-black text-white border-2" style={{ background: it.done ? 'var(--mint)' : 'var(--coral)', borderColor: 'var(--ink)', boxShadow: '3px 3px 0 var(--ink)' }}>
              {it.done ? '✓' : it.q}
            </div>
            <div className="chunky p-6 flex-1">
              <div className="text-xs font-bold tracking-wider mb-1" style={{ color: 'var(--coral-deep)' }}>{it.tag}</div>
              <h3 className="text-xl mb-2">{it.title}</h3>
              <p className="text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── stat row ─────────── */
function StatRow({ items }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {items.map((s, i) => (
        <div key={i} className="text-center reveal-pop" style={{ transitionDelay: `${i * 0.06}s` }}>
          <div className="font-display font-black text-5xl md:text-6xl grad-text">{s.n}</div>
          <div className="mt-2 font-bold" style={{ color: 'var(--ink-soft)' }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

/* ─────────── legal doc ─────────── */
function LegalDoc({ updated, sections }) {
  return (
    <div className="max-w-3xl mx-auto">
      {updated && <p className="text-sm mb-10 reveal" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Ultimo aggiornamento: {updated}</p>}
      <div className="space-y-8">
        {sections.map((s, i) => (
          <div key={i} className="reveal" style={{ transitionDelay: `${i * 0.03}s` }}>
            <h2 className="text-2xl mb-3" style={{ color: 'var(--ink)' }}>{i + 1}. {s.h}</h2>
            <p className="text-[16px] leading-relaxed" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{s.p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── contact form ─────────── */
function ContactForm() {
  const [sent, setSent] = xS(false);
  return sent ? (
    <div className="chunky p-10 text-center max-w-xl mx-auto">
      <img src="assets/tako-thumbsup.png" alt="" className="w-28 mx-auto mb-4" />
      <h3 className="text-2xl mb-2">Messaggio ricevuto! 🐙</h3>
      <p style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Ti rispondiamo entro un giorno lavorativo.</p>
    </div>
  ) : (
    <form className="chunky p-8 max-w-xl mx-auto" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <input required placeholder="Nome" className="px-4 py-3 rounded-xl border-2 font-semibold" style={{ borderColor: 'rgba(42,31,26,.16)', background: '#FFFDFB' }} />
        <input required type="email" placeholder="Email" className="px-4 py-3 rounded-xl border-2 font-semibold" style={{ borderColor: 'rgba(42,31,26,.16)', background: '#FFFDFB' }} />
      </div>
      <input placeholder="Nome del ristorante" className="w-full mt-4 px-4 py-3 rounded-xl border-2 font-semibold" style={{ borderColor: 'rgba(42,31,26,.16)', background: '#FFFDFB' }} />
      <textarea required rows="4" placeholder="Come possiamo aiutarti?" className="w-full mt-4 px-4 py-3 rounded-xl border-2 font-semibold" style={{ borderColor: 'rgba(42,31,26,.16)', background: '#FFFDFB' }} />
      <button className="btn-coral w-full py-4 text-lg mt-5">Invia messaggio →</button>
    </form>
  );
}

/* ─────────── CTA band ─────────── */
function CtaBand({ title = 'Pronto a provare Tako?', sub = '30 giorni gratis. Nessuna carta richiesta.' }) {
  return (
    <Band tint="coral" bubbles>
      <div className="text-center">
        <img src="assets/tako-bell.png" alt="" className="w-40 mx-auto mb-6 reveal-pop bell-ring" />
        <h2 className="text-4xl md:text-6xl mb-4 reveal" style={{ color: '#fff' }}>{title}</h2>
        <p className="text-xl mb-8 reveal" style={{ color: 'rgba(255,248,243,.92)', fontWeight: 600 }}>{sub}</p>
        <a href={TRIAL} className="inline-block px-8 py-4 text-lg rounded-full font-black border-2 reveal" style={{ background: '#2A1F1A', color: 'var(--cream)', borderColor: '#2A1F1A', boxShadow: '0 6px 0 rgba(0,0,0,0.3)' }}>Inizia gratis →</a>
      </div>
    </Band>
  );
}

Object.assign(window, { ExtraNav, PageHero, Band, SectionHead, CardGrid, ChipRow, FAQList, Timeline, StatRow, LegalDoc, ContactForm, CtaBand, pageUrl, LANDING_URL: LANDING, TRIAL_URL: TRIAL });

/* ─────────── router + mount ─────────── */
function useRobustReveal2() {
  xE(() => {
    const sel = '.reveal, .reveal-l, .reveal-r, .reveal-pop, .tentacle-path';
    const inView = (el) => { const r = el.getBoundingClientRect(); return r.top < (window.innerHeight * 0.92) && r.bottom > 0; };
    const sweep = () => document.querySelectorAll(sel).forEach((el) => { if (inView(el)) el.classList.add('in'); });
    requestAnimationFrame(sweep);
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12 });
      document.querySelectorAll(sel).forEach((el) => io.observe(el));
    }
    const onScroll = () => sweep();
    window.addEventListener('scroll', onScroll, { passive: true });
    const t = setTimeout(() => document.body.classList.add('tk-ready'), 2600);
    return () => { io && io.disconnect(); window.removeEventListener('scroll', onScroll); clearTimeout(t); };
  });
}

function NotFound() {
  return (
    <PageHero kicker="404" title={<span>Pagina <span className="grad-text">non trovata</span></span>} sub="Questo tentacolo non porta da nessuna parte. Torna alla home e riprova." />
  );
}

function ExtraApp() {
  useRobustReveal2();
  const slug = new URLSearchParams(location.search).get('p') || 'funzioni';
  const page = window.TAKO_PAGES[slug];
  xE(() => {
    document.title = 'Tako — ' + (page ? page.title : 'Pagina');
    window.scrollTo(0, 0);
  }, [slug]);
  return (
    <>
      <Navbar />
      <main key={slug}>{page ? page.render() : <NotFound />}</main>
      <Footer />
    </>
  );
}

window.mountTakoPages = function () {
  ReactDOM.createRoot(document.getElementById('root')).render(<ExtraApp />);
};
