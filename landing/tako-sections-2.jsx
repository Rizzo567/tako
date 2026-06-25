/* global React */
const { useEffect, useRef, useState } = React;

/* ——— AI Assistant section ——— */
function AIAssistant() {
  const [step, setStep] = useState(0);
  const messages = [
    { who: 'them', text: 'Ciao Tako! Il risotto ai funghi è senza glutine?' },
    { who: 'me', text: 'Ciao! Sì, il nostro risotto ai funghi porcini è 100% senza glutine. Usiamo brodo vegetale fatto in casa e nessun addensante. Vuoi che ti consigli un vino in abbinamento? 🍷' },
    { who: 'them', text: 'Sì, qualcosa di rosso ma non troppo strutturato.' },
    { who: 'me', text: 'Perfetto! Ti suggerisco il nostro Pinot Nero — 6€ al calice, leggero e fruttato. Si sposa benissimo con i funghi.' },
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setStep(s => (s + 1) % (messages.length + 2));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="ai" className="relative py-28 px-6 overflow-hidden" style={{ background: '#2A1F1A', color: '#FFF8F3' }}>
      {/* Floating dots bg */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(rgba(255,238,232,0.6) 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />

      <div className="relative max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div className="reveal-l">
          <span className="chip mb-5" style={{ background: 'rgba(255,238,232,0.1)', color: '#FFF8F3', borderColor: 'rgba(255,238,232,0.3)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--mint)' }} /> AI sempre in turno
          </span>
          <h2 className="text-5xl md:text-6xl mb-5" style={{ color: '#FFF8F3' }}>
            Risponde ai clienti.<br/>
            <span style={{ color: 'var(--coral)' }}>Conosce ogni piatto.</span>
          </h2>
          <p className="text-lg mb-8 max-w-lg opacity-80" style={{ fontWeight: 500 }}>
            Allergeni, ingredienti, abbinamenti, suggerimenti per intolleranze. Tako AI legge il tuo menu e risponde in tempo reale, in qualsiasi lingua. Tu pensi a cucinare.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            {['🌾 Allergie','🌶️ Piccantezza','🍷 Abbinamenti','🌱 Vegano','🧂 Sale','🌍 12 lingue'].map((t,i)=>(
              <span key={i} className="px-4 py-2 rounded-full font-bold text-sm" style={{ background: 'rgba(255,238,232,0.08)', border: '1px solid rgba(255,238,232,0.18)' }}>{t}</span>
            ))}
          </div>

          <a href="#cta" className="btn-coral px-8 py-4 text-lg inline-flex items-center gap-2">
            Attiva Tako AI <span aria-hidden>→</span>
          </a>
        </div>

        <div className="reveal-r relative">
          {/* Mascot davanti al telefono, leggermente più piccolo */}
          <img src="assets/tako-hugplate.png" alt="Tako loves the menu" className="absolute -bottom-6 -right-2 w-32 mascot float-y z-20" />

          <div className="phone w-[340px] mx-auto relative z-10">
            <div className="phone-screen" style={{ height: 680 }}>
              <iframe src="Tako App.html?bare&demo" title="App Tako — assistente AI" loading="lazy" scrolling="no" className="ai-frame" style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ——— Dashboard preview ——— */
function DashboardPreview() {
  const [stats, setStats] = useState({ income: 1842, orders: 63, time: 18 });
  const [drawn, setDrawn] = useState(false);
  const [activeDay, setActiveDay] = useState(5);
  const wrapRef = useRef(null);
  const dashRef = useRef(null);
  const [dashScale, setDashScale] = useState(0.44);

  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setDrawn(true);
    }, { threshold: 0.3 });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  // scale the embedded live dashboard to fit the column width
  useEffect(() => {
    const el = dashRef.current; if (!el) return;
    const fit = () => setDashScale(el.clientWidth / 1280);
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  // live updating stats
  useEffect(() => {
    const id = setInterval(() => {
      setStats((s) => ({
        income: s.income + Math.floor(Math.random() * 14 + 6),
        orders: s.orders + (Math.random() > 0.4 ? 1 : 0),
        time: 14 + Math.floor(Math.random() * 8),
      }));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // rotating active day
  useEffect(() => {
    const id = setInterval(() => {
      setActiveDay((d) => (d + 1) % 7);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const orderQueue = [
    { t: 'Tavolo 7', it: '2× Carbonara, 1× Vino', s: 'In cucina', col: 'var(--sun)' },
    { t: 'Tavolo 3', it: 'Risotto, Tiramisù', s: 'Pronto', col: 'var(--mint)' },
    { t: 'Asporto', it: 'Pizza Margherita', s: 'Nuovo', col: 'var(--coral)' },
    { t: 'Tavolo 11', it: 'Tagliata, Insalata', s: 'In cucina', col: 'var(--sun)' },
    { t: 'Tavolo 5', it: 'Spaghetti vongole', s: 'Nuovo', col: 'var(--coral)' },
  ];
  const [orders, setOrders] = useState(orderQueue.slice(0, 3));
  useEffect(() => {
    const id = setInterval(() => {
      setOrders((prev) => {
        const last = prev[prev.length - 1];
        const idx = orderQueue.findIndex((o) => o.t === last.t);
        const next = orderQueue[(idx + 1) % orderQueue.length];
        return [next, ...prev.slice(0, 2)];
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative py-28 px-6 hidden md:block">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="chip mb-5 reveal">Dashboard Admin</span>
          <h2 className="text-5xl md:text-6xl reveal">Tutto sotto controllo. <br className="hidden md:block"/><span className="grad-text">In ogni schermo.</span></h2>
        </div>

        <div className="relative reveal" ref={wrapRef}>
          <div className="tablet-frame mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden border-2" style={{ borderColor: 'var(--ink)', boxShadow: '8px 8px 0 var(--ink)' }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#2A1F1A' }}>
                <span className="w-3 h-3 rounded-full" style={{ background: '#ED7159' }} />
                <span className="w-3 h-3 rounded-full" style={{ background: '#F5C065' }} />
                <span className="w-3 h-3 rounded-full" style={{ background: '#7FC4A8' }} />
                <span className="ml-3 text-xs font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>dashboard.tako.it · Trattoria da Nino</span>
              </div>
              <div ref={dashRef} style={{ position: 'relative', width: '100%', height: Math.round(1000 * dashScale), overflow: 'hidden', background: '#F2EBE2' }}>
                <iframe src="Tako Dashboard.html?lockscroll" title="Dashboard Tako live" loading="lazy" scrolling="no" style={{ position: 'absolute', top: 0, left: 0, width: 1280, height: 1000, border: 0, pointerEvents: 'none', transformOrigin: 'top left', transform: 'scale(' + dashScale + ')' }} />
              </div>
            </div>
          </div>
            {/* Mascot peeking */}
          <img src="assets/tako-tablet.png" alt="Tako with tablet" className="absolute -bottom-8 -right-4 w-44 mascot float-y hidden md:block" />
          {/* Floating notification badges */}
          <div className="absolute -top-6 left-8 hidden md:block float-soft" style={{ animationDelay: '-1s' }}>
            <div className="px-4 py-2 rounded-full font-black text-sm border-2 shadow-lg" style={{ background: 'var(--mint)', color: 'white', borderColor: 'var(--ink)', boxShadow: '4px 4px 0 var(--ink)' }}>
              +€{18 + Math.floor(stats.income / 100)} →
            </div>
          </div>
          <div className="absolute top-1/3 -right-8 hidden md:block float-soft" style={{ animationDelay: '-2.2s' }}>
            <div className="px-4 py-2 rounded-full font-black text-sm border-2" style={{ background: 'var(--sun)', color: 'var(--ink)', borderColor: 'var(--ink)', boxShadow: '4px 4px 0 var(--ink)' }}>
              ★ 4.9 oggi
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ——— Pricing ——— */
function Pricing() {
  const plans = [
    { name: 'Starter', price: '€29', sub: '/mese', desc: 'Per piccoli ristoranti che iniziano.', features: ['Menu digitale & QR', 'Fino a 50 ordini/giorno', 'Dashboard base', '1 utente'], cta: 'Inizia gratis', highlight: false },
    { name: 'Pro', price: '€69', sub: '/mese', desc: 'Il piano scelto da 7 ristoratori su 10.', features: ['Tutto di Starter', 'Tako AI Assistant illimitata', 'Ordini illimitati', 'Multi-device & 5 utenti', 'Statistiche avanzate'], cta: 'Prova 30 giorni', highlight: true, badge: 'Più popolare' },
    { name: 'Catena', price: 'Su misura', sub: '', desc: 'Per gruppi e franchising.', features: ['Tutto di Pro', 'Multi-locale centralizzato', 'API & integrazioni', 'Onboarding dedicato', 'SLA 99.9%'], cta: 'Parla con noi', highlight: false },
  ];

  return (
    <section id="pricing" className="relative py-28 px-6" style={{ background: 'linear-gradient(180deg, #FFF8F3 0%, #FFEEE8 100%)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-end mb-14">
          <div>
            <span className="chip mb-5 reveal">Prezzi</span>
            <h2 className="text-5xl md:text-6xl reveal">Tako veste<br/><span className="grad-text">elegante.</span></h2>
            <p className="text-lg mt-4 max-w-lg reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
              Niente costi nascosti, niente sorprese. 30 giorni di prova gratis su ogni piano. Cancelli quando vuoi.
            </p>
          </div>
          <div className="flex justify-end reveal-r">
            <img src="assets/tako-bowtie.png" alt="Tako with bowtie" className="mascot w-56 wiggle" />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p, i) => (
            <div key={i}
              className={`relative p-8 rounded-3xl border-2 hover-rise reveal-pop ${p.highlight ? 'ring-coral' : 'chunky'}`}
              style={{
                background: p.highlight ? 'var(--coral)' : 'white',
                color: p.highlight ? 'white' : 'var(--ink)',
                borderColor: 'var(--ink)',
                transitionDelay: `${i*0.08}s`,
              }}
            >
              {p.badge && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-black border-2" style={{ background: '#2A1F1A', color: '#FFF8F3', borderColor: '#2A1F1A' }}>
                  ★ {p.badge}
                </span>
              )}
              <div className="text-sm font-bold opacity-70">{p.name}</div>
              <div className="flex items-baseline gap-1 mt-2 mb-3">
                <span className="font-display font-black text-5xl">{p.price}</span>
                <span className="font-bold opacity-70">{p.sub}</span>
              </div>
              <p className="opacity-80 mb-6 text-sm">{p.desc}</p>
              <ul className="space-y-3 mb-8">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm font-semibold">
                    <span className="w-5 h-5 rounded-full grid place-items-center text-[11px]" style={{ background: p.highlight ? 'rgba(255,255,255,0.25)' : 'var(--coral-tint)', color: p.highlight ? 'white' : 'var(--coral-deep)' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="demo.html"
                className={`block text-center py-3 rounded-full font-black border-2 transition`}
                style={p.highlight
                  ? { background: 'white', color: 'var(--coral-deep)', borderColor: 'white' }
                  : { background: 'var(--ink)', color: 'var(--cream)', borderColor: 'var(--ink)' }
                }
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ——— Testimonials ——— */
function Testimonials() {
  const reviews = [
    { name: 'Marco Belli', role: 'Trattoria da Nino, Bologna', text: 'In due settimane abbiamo dimezzato i tempi di servizio. I camerieri ora sorridono.', avatar: '#F5C065' },
    { name: 'Giulia Mazza', role: 'Sushi Onda, Milano', text: 'L\'AI risponde alle domande sugli ingredienti meglio del mio staff. E lavora il lunedì.', avatar: '#7FC4A8' },
    { name: 'Roberto Conti', role: 'Pizzeria Vesuvio, Napoli', text: 'Ho trovato Tako, ho cancellato 3 abbonamenti. Risparmio €180 al mese.', avatar: '#BDD9E8' },
  ];
  const Stack = window.ScrollCardStack;
  return (
    <Stack
      items={reviews}
      header={(
        <>
          <span className="chip mb-4">Recensioni</span>
          <h2 className="text-4xl md:text-6xl">2.400 ristoratori,<br/><span className="grad-text">e contando.</span></h2>
          <a href="Tako%20Pagine.html?p=blog" className="inline-flex items-center gap-2 mt-5 font-bold text-lg group" style={{ color: 'var(--coral-deep)' }}>
            Vai alle recensioni
            <span aria-hidden style={{ transition: 'transform .2s' }} className="group-hover:translate-x-1">→</span>
          </a>
        </>
      )}
      renderCard={(r) => (
        <div className="chunky p-6 md:p-10 max-w-md md:max-w-xl mx-auto text-center" style={{ background: '#fff' }}>
          <div className="flex justify-center gap-0.5 mb-4 text-[color:var(--sun)] text-2xl">★★★★★</div>
          <p className="text-lg md:text-2xl font-semibold leading-relaxed mb-6" style={{ color: 'var(--ink)' }}>"{r.text}"</p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 grid place-items-center font-display font-black flex-none" style={{ background: r.avatar, borderColor: 'var(--ink)' }}>
              {r.name[0]}
            </div>
            <div className="text-left">
              <div className="font-bold">{r.name}</div>
              <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>{r.role}</div>
            </div>
          </div>
        </div>
      )}
    />
  );
}

/* ——— Final CTA + Footer ——— */
function CtaContactForm() {
  const [sent, setSent] = useState(false);
  const field = { borderColor: 'rgba(42,31,26,.16)', background: '#FFFDFB' };
  const card = { background: '#fff', borderColor: '#2A1F1A', boxShadow: '0 10px 0 rgba(0,0,0,.18)' };
  return (
    <div className="max-w-xl mx-auto reveal">
      {sent ? (
        <div className="rounded-3xl p-9 text-center border-2" style={card}>
          <img src="assets/tako-thumbsup.png" alt="" className="w-24 mx-auto mb-3" />
          <h3 className="text-2xl mb-2" style={{ color: 'var(--ink)' }}>Messaggio ricevuto!</h3>
          <p style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Ti scriviamo via email entro un giorno lavorativo.</p>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="rounded-3xl p-7 md:p-8 text-left border-2" style={card}>
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="Nome" className="px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
            <input required type="email" placeholder="Email" className="px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
          </div>
          <input placeholder="Nome del ristorante" className="w-full mt-3 px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
          <textarea required rows="3" placeholder="Come possiamo aiutarti?" className="w-full mt-3 px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
          <button className="btn-coral w-full py-4 text-lg mt-4">Invia messaggio →</button>
        </form>
      )}
    </div>
  );
}

function FinalCTA() {
  return (
    <section id="cta" className="relative pt-12 pb-28 px-6 overflow-hidden" style={{ background: 'var(--coral)' }}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 2px, transparent 2px)', backgroundSize: '32px 32px' }} />
      <div className="relative max-w-5xl mx-auto text-center">
        <div className="flex justify-center reveal-pop" style={{ marginBottom: -26 }}>
          <img src="assets/tako-bell.png" alt="Tako with bell" className="mascot-hero w-64 bell-ring" style={{ filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.18))' }} />
        </div>
        <h2 className="text-5xl md:text-7xl mb-6 reveal" style={{ color: 'white' }}>
          Pronto a rivoluzionare<br/>il tuo ristorante?
        </h2>
        <p className="text-xl md:text-2xl mb-10 reveal" style={{ color: 'rgba(255,248,243,0.92)', fontWeight: 600 }}>
          Lasciaci un messaggio: ti rispondiamo via email entro un giorno lavorativo.
        </p>
        <CtaContactForm />
        <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm font-bold opacity-90" style={{ color: 'white' }}>
          <span>✓ 30 giorni di prova</span>
          <span>✓ Nessuna carta</span>
          <span>✓ Cancelli quando vuoi</span>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 pt-16 pb-10" style={{ background: '#2A1F1A', color: '#FFF8F3' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 pb-12">
          <div>
          <div className="flex items-center gap-2 mb-4">
            <img src="assets/tako-chef.png" alt="Tako" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <span className="font-display font-black text-2xl">Tako</span>
          </div>
            <p className="opacity-70 text-sm leading-relaxed">Il tuo ristorante, più smart. Ordini, menu e AI in un'unica app.</p>
          </div>
          {[
            { t: 'Prodotto', items: [['Funzioni','funzioni'],['AI Assistant','ai'],['Integrazioni','integrazioni'],['Roadmap','roadmap']] },
            { t: 'Risorse', items: [['Centro aiuto','aiuto'],['Blog','blog'],['API docs','api'],['Community','community'],['Stato sistema','stato']] },
            { t: 'Azienda', items: [['Chi siamo','chi-siamo'],['Careers','careers'],['Contatti','contatti'],['Privacy','privacy'],['Termini','termini']] },
          ].map((c, i) => (
            <div key={i}>
              <div className="font-display font-black mb-4">{c.t}</div>
              <ul className="space-y-2 text-sm opacity-70">
                {c.items.map((it, j) => (<li key={j}><a href={`Tako%20Pagine.html?p=${it[1]}`} className="hover:opacity-100 hover:text-[color:var(--coral)] transition">{it[0]}</a></li>))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t flex flex-wrap items-center justify-between gap-4 text-xs opacity-60" style={{ borderColor: 'rgba(255,248,243,0.12)' }}>
          <span className="inline-flex items-center gap-2 flex-wrap">
            © 2026 Tako Srl · P.IVA 0123456789 ·
            <a
              href="https://aikeautomation.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Powered by Aike"
              className="inline-flex items-center gap-1.5 font-medium transition-colors hover:opacity-100"
              style={{ color: 'inherit', textDecoration: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a855f7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit'; }}
            >
              <span>Powered by Aike</span>
              <img src="https://aikeautomation.com/assets/images/logo.png" alt="Aike" loading="lazy" style={{ height: 16, width: 'auto', display: 'block' }} />
            </a>
          </span>
          <div className="flex gap-4">
            <a href="#" className="hover:opacity-100">Twitter</a>
            <a href="#" className="hover:opacity-100">Instagram</a>
            <a href="#" className="hover:opacity-100">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ——— Booking / info request band (riusabile a fine pagina) ——— */
function BookingBand({
  title = <>Richiedi informazioni <span className="grad-text">o prenota una demo.</span></>,
  sub = 'Lasciaci i tuoi dati: ti ricontattiamo entro un giorno lavorativo per rispondere alle tue domande o fissare insieme una demo.',
  mascot = 'assets/tako-bell.png',
} = {}) {
  const [sent, setSent] = useState(false);
  const [intent, setIntent] = useState('info');
  const field = { borderColor: 'rgba(42,31,26,.16)', background: '#FFFDFB' };
  const intents = [
    { id: 'info', label: 'Voglio informazioni' },
    { id: 'demo', label: 'Prenota una demo' },
  ];
  return (
    <section className="relative overflow-hidden py-20 px-6" style={{ background: 'linear-gradient(180deg,#FFF8F3 0%,#FFEEE8 100%)' }}>
      <div className="absolute -right-28 top-6 w-[360px] h-[360px] blob-2 pointer-events-none" style={{ background: 'rgba(248,183,166,0.18)' }} />
      <div className="absolute -left-28 bottom-0 w-[320px] h-[320px] blob-1 pointer-events-none" style={{ background: 'rgba(189,217,232,0.18)' }} />
      <div className="relative max-w-5xl mx-auto grid lg:grid-cols-[1fr,1.1fr] gap-10 items-center">
        <div className="reveal-l">
          <span className="chip mb-5">Parliamone</span>
          <h2 className="text-4xl md:text-5xl mb-4">{title}</h2>
          <p className="text-lg max-w-md mb-7" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{sub}</p>
          <div className="flex flex-wrap gap-5 text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>
            <span className="inline-flex items-center gap-2"><span className="w-6 h-6 grid place-items-center rounded-full text-white text-xs" style={{ background: 'var(--coral)' }}>✓</span> Nessun impegno</span>
            <span className="inline-flex items-center gap-2"><span className="w-6 h-6 grid place-items-center rounded-full text-white text-xs" style={{ background: 'var(--coral)' }}>✓</span> Risposta in 1 giorno</span>
          </div>
          <img src={mascot} alt="" className="hidden lg:block w-32 mt-8 float-y" style={{ filter: 'drop-shadow(0 18px 26px rgba(217,83,58,.18))' }} />
        </div>

        <div className="reveal-r">
          {sent ? (
            <div className="chunky p-10 text-center">
              <img src="assets/tako-thumbsup.png" alt="" className="w-28 mx-auto mb-4" />
              <h3 className="text-2xl mb-2">Richiesta ricevuta! 🐙</h3>
              <p style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Ti ricontattiamo via email o telefono entro un giorno lavorativo.</p>
            </div>
          ) : (
            <form className="chunky p-7 md:p-8" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <div className="mb-4">
                <div className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>Cosa ti serve?</div>
                <div className="flex gap-2">
                  {intents.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setIntent(it.id)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                      style={intent === it.id
                        ? { background: 'var(--coral)', color: 'white', borderColor: 'var(--ink)', boxShadow: '0 4px 0 var(--coral-deep)' }
                        : { background: '#FFFDFB', color: 'var(--ink)', borderColor: 'rgba(42,31,26,.16)' }}
                    >{it.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input required placeholder="Nome" className="px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
                <input required type="email" placeholder="Email" className="px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <input type="tel" placeholder="Telefono" className="px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
                <input placeholder="Nome del ristorante" className="px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
              </div>
              <textarea rows="3" placeholder={intent === 'demo' ? 'Quando preferisci la demo? Raccontaci del tuo locale…' : 'Su cosa possiamo darti informazioni?'} className="w-full mt-3 px-4 py-3 rounded-xl border-2 font-semibold" style={field} />
              <button className="btn-coral w-full py-4 text-lg mt-4">{intent === 'demo' ? 'Prenota la demo →' : 'Invia richiesta →'}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

window.AIAssistant = AIAssistant;
window.DashboardPreview = DashboardPreview;
window.Pricing = Pricing;
window.Testimonials = Testimonials;
window.FinalCTA = FinalCTA;
window.Footer = Footer;
window.BookingBand = BookingBand;
