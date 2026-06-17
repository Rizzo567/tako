/* global React */
const { useEffect, useRef, useState } = React;

/* ——— Reveal hook (IntersectionObserver) ——— */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal, .reveal-l, .reveal-r, .reveal-pop, .tentacle-path');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
}

/* ——— Logo ——— */
function TakoLogo({ size = 44 }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src="assets/tako-chef.png"
        alt="Tako"
        style={{ width: size, height: size, objectFit: 'contain' }}
        className="logo-bob"
      />
      <span className="font-display font-black text-2xl tracking-tight" style={{ color: 'var(--ink)' }}>Tako</span>
    </div>
  );
}

/* ——— Sticky Navbar ——— */
function Navbar({ page, setPage }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [
    { id: 'home', label: 'Home' },
    { id: 'how', label: 'Come funziona' },
    { id: 'restaurant', label: 'Lato ristoratore' },
    { id: 'customer', label: 'Lato cliente' },
  ];
  const go = (id) => (e) => { e.preventDefault(); setPage(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'glass py-3' : 'py-5'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <a href="#" onClick={go('home')} className="cursor-pointer"><TakoLogo /></a>
        <nav className="hidden md:flex items-center gap-7 font-bold text-[15px]" style={{ color: 'var(--ink)' }}>
          {links.map((l) => (
            <a
              key={l.id}
              href="#"
              onClick={go(l.id)}
              className="transition relative"
              style={{ color: page === l.id ? 'var(--coral-deep)' : 'var(--ink)' }}
            >
              {l.label}
              {page === l.id && (
                <span className="absolute -bottom-1.5 left-0 right-0 h-1 rounded-full" style={{ background: 'var(--coral)' }} />
              )}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="#" className="hidden md:inline-block font-bold text-[15px]" style={{ color: 'var(--ink)' }}>Accedi</a>
          <a href="#cta" onClick={go('home')} className="btn-coral px-5 py-2.5 text-[14px]">Prova gratis</a>
        </div>
      </div>
    </header>
  );
}

/* ——— Bubbles bg ——— */
function Bubbles({ count = 12 }) {
  const arr = Array.from({ length: count });
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {arr.map((_, i) => {
        const size = 12 + Math.random() * 28;
        const left = Math.random() * 100;
        const dur = 8 + Math.random() * 12;
        const delay = -Math.random() * 12;
        return (
          <span
            key={i}
            className="bubble"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ——— Hand-holding-phone (live app iframe behind hand PNG) ——— */
function HandPhone() {
  const stageRef = useRef(null);
  const slotRef = useRef(null);
  const APP_W = 390;

  useEffect(() => {
    const stage = stageRef.current, slot = slotRef.current;
    if (!stage || !slot) return;
    const fit = () => stage.style.setProperty('--hp-scale', (slot.clientWidth / APP_W).toString());
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slot);
    window.addEventListener('resize', fit, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  return (
    <div ref={stageRef} className="hp-stage sway">
      <div ref={slotRef} className="hp-slot">
        <iframe className="hp-live" src="hero-export/Tako App.html?bare=1&demo=1" scrolling="no" tabIndex="-1" title="App Tako — demo menù"></iframe>
      </div>
      <img className="hp-hand" src="hero-export/assets/hand-phone.png" alt="Mano che impugna lo smartphone con l'app Tako" />
    </div>
  );
}

/* ——— Hero ——— */
function Hero() {
  return (
    <section className="relative pt-32 pb-6 overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFEEE8 0%, #FFF8F3 100%)' }}>
      {/* decorative blobs */}
      <div className="absolute -top-20 -left-32 w-[480px] h-[480px] blob-1" style={{ background: 'rgba(248,183,166,0.55)', filter: 'blur(2px)' }} />
      <div className="absolute top-40 -right-40 w-[520px] h-[520px] blob-2" style={{ background: 'rgba(189,217,232,0.45)', filter: 'blur(2px)' }} />
      <Bubbles count={10} />

      <div className="relative max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <div className="reveal-l">
          <h1 className="text-6xl md:text-7xl lg:text-[88px] leading-[0.95] mb-6">
            Il tuo ristorante,<br/>
            <span className="grad-text">più smart.</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-xl" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
            Tako gestisce ordini, menu digitali e risponde ai tuoi clienti 24/7 con un'AI che conosce ogni piatto. Otto tentacoli, mille superpoteri.
          </p>
          <div className="flex flex-wrap gap-4 mb-10">
            <a href="#cta" className="btn-coral px-8 py-4 text-lg inline-flex items-center gap-2">
              Prova gratis 30 giorni
              <span aria-hidden>→</span>
            </a>
            <a href="#how" className="btn-ghost px-8 py-4 text-lg">Guarda la demo</a>
          </div>
          <div className="flex items-center gap-5 text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>
            <div className="flex -space-x-2">
              {['#ED7159','#F5C065','#7FC4A8','#BDD9E8'].map((c,i)=>(
                <div key={i} className="w-9 h-9 rounded-full border-2 border-white" style={{ background: c }} />
              ))}
            </div>
            <div>
              <div className="flex gap-0.5 text-[color:var(--sun)]">
                {'★★★★★'.split('').map((s,i)=>(<span key={i} className="star">{s}</span>))}
              </div>
              <span>2.400+ ristoratori già a bordo</span>
            </div>
          </div>
        </div>

        <div className="relative reveal-r" style={{ marginTop: -70 }}>
          <HandPhone />
        </div>
      </div>

      {/* Wavy bottom */}
      <div className="wave-divider absolute -bottom-1 inset-x-0">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 Q360,80 720,40 T1440,40 L1440,80 L0,80 Z" fill="#FFF8F3"/>
        </svg>
      </div>
    </section>
  );
}

/* ——— Trust marquee ——— */
function TrustTape() {
  const items = ['Trattoria da Nino', 'Sushi Onda', 'Pizzeria Vesuvio', 'Caffè del Porto', 'Osteria Marina', 'Burger Lab', 'Gelateria Sole', 'Ramen Tora'];
  return (
    <div className="overflow-hidden tape py-4">
      <div className="flex gap-12 marquee-track whitespace-nowrap">
        {[...items, ...items, ...items].map((t,i)=>(
          <span key={i} className="font-display font-black text-2xl flex items-center gap-12">
            {t}
            <span style={{ color: 'var(--coral)' }}>★</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ——— Features ——— */
function Features() {
  const cards = [
    { icon: '📲', title: 'Ordini digitali', desc: 'QR code al tavolo, ordini diretti in cucina. Zero attese, zero errori.', color: '#FFEEE8' },
    { icon: '📖', title: 'Menu interattivo', desc: 'Foto, allergeni, ingredienti e traduzioni in 12 lingue. Aggiorni in 2 click.', color: '#E8F4ED' },
    { icon: '🤖', title: 'AI Assistant', desc: 'Risponde ai clienti su intolleranze, abbinamenti e consigli. Sempre in turno.', color: '#FFF4E0' },
    { icon: '📊', title: 'Dashboard multi-device', desc: 'Da iPad, telefono o cassa: vedi tutto in tempo reale. Sincronizzato sempre.', color: '#EAF2F8' },
  ];
  return (
    <section id="features" className="relative py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="chip mb-5 reveal">Perché Tako</span>
          <h2 className="text-5xl md:text-6xl reveal">Quattro pinze. <span className="grad-text">Mille soluzioni.</span></h2>
          <p className="text-lg md:text-xl mt-4 max-w-2xl mx-auto reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
            Tutto quello che serve al tuo ristorante in un unico posto. Senza pagare 4 abbonamenti diversi.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((c, i) => (
            <div key={i} className="chunky p-7 hover-rise reveal-pop" style={{ transitionDelay: `${i*0.08}s` }}>
              <div className="w-14 h-14 rounded-2xl grid place-items-center text-3xl mb-5 border-2" style={{ background: c.color, borderColor: 'var(--ink)' }}>
                {c.icon}
              </div>
              <h3 className="text-2xl mb-2">{c.title}</h3>
              <p className="text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{c.desc}</p>
              <a href="#" className="mt-5 inline-flex items-center gap-1 font-bold text-sm" style={{ color: 'var(--coral-deep)' }}>
                Scopri di più <span aria-hidden>→</span>
              </a>
            </div>
          ))}
        </div>

        {/* Connecting tentacle SVG decoration */}
        <svg className="hidden lg:block absolute left-1/2 -translate-x-1/2 -bottom-10 w-[800px] pointer-events-none" viewBox="0 0 800 120">
          <path className="tentacle-path" d="M50,60 Q200,10 400,60 T750,60" />
        </svg>
      </div>
    </section>
  );
}

/* ——— Menu intelligente section (with chef Tako) ——— */
function MenuSmart() {
  const dishes = [
    { name: 'Spaghetti alle vongole', price: '€14', tags: ['🐚','🌶️'], color: '#FFE0CC' },
    { name: 'Risotto ai funghi porcini', price: '€16', tags: ['🌱'], color: '#E8F4ED' },
    { name: 'Tagliata di manzo', price: '€22', tags: ['🥩'], color: '#FFEEE8' },
    { name: 'Tiramisù della casa', price: '€7', tags: ['🍰'], color: '#FFF4E0' },
    { name: 'Polpo alla griglia', price: '€18', tags: ['🐙','🌶️'], color: '#FFE0D5' },
    { name: 'Branzino al sale', price: '€24', tags: ['🐟'], color: '#EAF2F8' },
  ];
  const [offset, setOffset] = useState(0);
  const [secondsAgo, setSecondsAgo] = useState(12);
  useEffect(() => {
    const id = setInterval(() => {
      setOffset((o) => (o + 1) % dishes.length);
      setSecondsAgo(2);
    }, 3200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const visible = [0, 1, 2, 3].map((i) => dishes[(offset + i) % dishes.length]);

  return (
    <section className="relative py-28 px-6" style={{ background: 'linear-gradient(180deg, #FFF8F3 0%, #FFEEE8 100%)' }}>
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div className="relative reveal-l order-2 md:order-1">
          <div className="absolute -top-6 -left-6 dot-grid w-32 h-32 rounded-3xl" />
          {/* Spinning sparkles around the card */}
          <svg className="absolute -top-8 -right-6 w-20 h-20 spin-slow pointer-events-none" viewBox="0 0 100 100">
            <circle cx="50" cy="10" r="4" fill="var(--coral)"/>
            <circle cx="90" cy="50" r="3" fill="var(--sun)"/>
            <circle cx="50" cy="90" r="5" fill="var(--mint)" opacity="0.7"/>
            <circle cx="10" cy="50" r="3" fill="var(--coral-deep)"/>
          </svg>

          <div className="relative chunky p-6 max-w-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold tracking-wider" style={{ color: 'var(--ink-soft)' }}>MENU DEL GIORNO</div>
                <div className="font-display font-black text-2xl">Trattoria da Nino</div>
              </div>
              <div className="chip" style={{ padding: '4px 10px', fontSize: 11 }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--coral)', boxShadow: '0 0 0 3px rgba(237,113,89,0.3)' }} />
                LIVE
              </div>
            </div>
            <div style={{ minHeight: 280 }}>
              {visible.map((d, i) => (
                <div
                  key={`${offset}-${i}`}
                  className="flex items-center justify-between py-3 border-b-2 border-dashed pop-in"
                  style={{ borderColor: 'rgba(42,31,26,0.12)', animationDelay: `${i * 0.08}s` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl border-2" style={{ background: d.color, borderColor: 'var(--ink)' }} />
                    <div>
                      <div className="font-bold">{d.name}</div>
                      <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>{d.tags.join(' ')}</div>
                    </div>
                  </div>
                  <div className="font-display font-black">{d.price}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--mint)', boxShadow: '0 0 0 4px rgba(127,196,168,0.3)' }} />
              Aggiornato {secondsAgo} secondi fa
            </div>
          </div>
        </div>

        <div className="reveal-r order-1 md:order-2">
          <div className="flex items-start gap-5 mb-6">
            <img src="assets/tako-chef.png" alt="Tako chef" className="mascot w-32 wiggle" />
            <span className="chip mt-3">Menu Intelligente</span>
          </div>
          <h2 className="text-5xl md:text-6xl mb-5">
            <span className="squiggle">Cucina</span> in cucina,<br/>
            non davanti al PC.
          </h2>
          <p className="text-lg mb-8 max-w-lg" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
            Modifica prezzi, esaurisci piatti e aggiungi specialità del giorno con un tocco. I tuoi clienti vedono sempre il menu giusto, in tempo reale.
          </p>
          <ul className="space-y-3">
            {['Allergeni e ingredienti automatici','Foto e descrizioni AI-assisted','Traduzione in 12 lingue','QR code stampabile incluso'].map((t,i)=>(
              <li key={i} className="flex items-center gap-3 font-bold">
                <span className="w-7 h-7 grid place-items-center rounded-full text-white" style={{ background: 'var(--coral)' }}>✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ——— How it works ——— */
function HowItWorks() {
  const steps = [
    { n: '1', title: 'Apri Tako', desc: 'Crea l\'account in 2 minuti. Importa il tuo menu da PDF o foglio Excel — al resto pensa l\'AI.', mascot: 'assets/tako-cloche.png', alt: 'Tako with cloche' },
    { n: '2', title: 'Scansiona & ordina', desc: 'I clienti scansionano il QR al tavolo, sfogliano il menu e ordinano. Tu ricevi tutto in cucina.', mascot: 'assets/tako-tablet.png', alt: 'Tako with tablet' },
    { n: '3', title: 'Servi e cresci', desc: 'Ordini gestiti, dati raccolti, clienti felici. Vedi cosa funziona e ottimizzi ogni settimana.', mascot: 'assets/tako-thumbsup.png', alt: 'Tako thumbs up' },
  ];

  return (
    <section id="how" className="relative py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <span className="chip mb-5 reveal">Come funziona</span>
          <h2 className="text-5xl md:text-6xl reveal">Tre passi. <span className="grad-text">Zero stress.</span></h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-8">
          {/* Curvy connecting line */}
          <svg className="hidden md:block absolute top-16 left-0 w-full h-32 pointer-events-none" viewBox="0 0 1200 100" preserveAspectRatio="none">
            <path className="tentacle-path" d="M180,50 Q400,0 600,50 T1020,50" stroke="#ED7159" strokeWidth="3" strokeDasharray="8 10" />
          </svg>

          {steps.map((s, i) => (
            <div key={i} className="relative reveal" style={{ transitionDelay: `${i*0.15}s` }}>
              <div className="flex flex-col items-center text-center">
                <div className="step-num mb-6 z-10">{s.n}</div>
                <div className="chunky p-6 w-full">
                  <img src={s.mascot} alt={s.alt} className="mascot w-40 mx-auto float-y mb-4" style={{ animationDelay: `${i*0.6}s` }} />
                  <h3 className="text-2xl mb-2">{s.title}</h3>
                  <p style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.TakoLogo = TakoLogo;
window.Navbar = Navbar;
window.Hero = Hero;
window.TrustTape = TrustTape;
window.Features = Features;
window.MenuSmart = MenuSmart;
window.HowItWorks = HowItWorks;
window.useReveal = useReveal;
