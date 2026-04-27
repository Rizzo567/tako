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
          {/* Mascot hugging plate behind */}
          <img src="assets/tako-hugplate.png" alt="Tako loves the menu" className="absolute -top-10 -right-8 w-44 mascot float-y z-0" />

          <div className="phone w-[340px] mx-auto relative z-10">
            <div className="phone-screen">
              {/* Chat header */}
              <div className="px-5 py-4 flex items-center gap-3 border-b-2" style={{ borderColor: 'rgba(42,31,26,0.08)' }}>
                <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: 'var(--coral)' }}>
                  <span className="text-white font-display font-black">T</span>
                </div>
                <div>
                  <div className="font-bold text-[color:var(--ink)]">Tako Assistant</div>
                  <div className="text-xs flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--mint)' }} /> online
                  </div>
                </div>
              </div>

              {/* Chat */}
              <div className="p-4 space-y-3 min-h-[360px]">
                {messages.slice(0, Math.min(step, messages.length)).map((m, i) => (
                  <div key={i} className={m.who === 'them' ? 'bubble-them text-sm pop-in' : 'bubble-me text-sm pop-in'}>
                    {m.text}
                  </div>
                ))}
                {step <= messages.length && step > 0 && step % 2 === 1 && step < messages.length && (
                  <div className="bubble-me text-sm inline-flex gap-1.5 items-center pop-in">
                    <span className="dot" style={{ background: 'var(--cream)' }} />
                    <span className="dot" style={{ background: 'var(--cream)' }} />
                    <span className="dot" style={{ background: 'var(--cream)' }} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t-2" style={{ borderColor: 'rgba(42,31,26,0.08)' }}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: 'var(--coral-tint)' }}>
                  <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>Chiedi qualcosa…</span>
                  <div className="ml-auto w-7 h-7 rounded-full grid place-items-center text-white" style={{ background: 'var(--coral)' }}>↑</div>
                </div>
              </div>
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

  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setDrawn(true);
    }, { threshold: 0.3 });
    io.observe(wrapRef.current);
    return () => io.disconnect();
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
    <section className="relative py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="chip mb-5 reveal">Dashboard Admin</span>
          <h2 className="text-5xl md:text-6xl reveal">Tutto sotto controllo. <br className="hidden md:block"/><span className="grad-text">In ogni schermo.</span></h2>
        </div>

        <div className="relative reveal" ref={wrapRef}>
          <div className="tablet-frame mx-auto max-w-5xl">
            <div className="bg-[color:var(--cream)] rounded-2xl overflow-hidden">
              {/* App chrome */}
              <div className="flex items-center justify-between px-6 py-4 border-b-2" style={{ borderColor: 'rgba(42,31,26,0.08)' }}>
                <div className="flex items-center gap-3">
                  <TakoLogo size={28} />
                  <span className="text-xs font-bold opacity-50">/ Trattoria da Nino</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="chip" style={{ padding: '4px 10px', fontSize: 11 }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--mint)', boxShadow: '0 0 0 3px rgba(127,196,168,0.3)' }} />
                    {stats.orders > 60 ? 12 : 11} tavoli aperti
                  </div>
                  <div className="w-8 h-8 rounded-full" style={{ background: 'var(--coral)' }} />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-5 p-6">
                {/* Stats */}
                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                  {[
                    { label: 'Incassi oggi', value: `€${stats.income.toLocaleString('it-IT')}`, delta: '+12%', color: 'var(--coral)' },
                    { label: 'Ordini', value: stats.orders, delta: '+5', color: 'var(--mint)' },
                    { label: 'Tempo medio', value: `${stats.time}m`, delta: '-2m', color: 'var(--sun)' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-2xl p-4 border-2" style={{ background: 'white', borderColor: 'var(--ink)' }}>
                      <div className="text-xs font-bold opacity-60 mb-2">{s.label}</div>
                      <div key={String(s.value)} className="font-display font-black text-3xl pop-in" style={{ animationDuration: '0.5s' }}>{s.value}</div>
                      <div className="text-xs font-bold mt-1" style={{ color: s.color }}>{s.delta} vs ieri</div>
                    </div>
                  ))}

                  {/* Animated Chart */}
                  <div className="col-span-3 rounded-2xl p-5 border-2 bg-white" style={{ borderColor: 'var(--ink)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-bold">Ordini per ora</div>
                      <div className="flex gap-1.5 text-[11px] font-bold">
                        {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((d,i)=>(
                          <span key={i} className="px-2 py-1 rounded-full transition-all" style={{
                            background: i === activeDay ? 'var(--coral)' : 'transparent',
                            color: i === activeDay ? 'white' : 'inherit',
                            transform: i === activeDay ? 'scale(1.1)' : 'scale(1)',
                          }}>{d}</span>
                        ))}
                      </div>
                    </div>
                    <svg viewBox="0 0 600 140" className="w-full h-32">
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#ED7159" stopOpacity="0.4"/>
                          <stop offset="1" stopColor="#ED7159" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d="M0,110 C50,90 90,40 150,55 C210,70 250,100 310,80 C370,60 410,20 470,30 C530,40 570,70 600,55 L600,140 L0,140 Z" fill="url(#grad)" style={{ opacity: drawn ? 1 : 0, transition: 'opacity 1.2s ease 0.6s' }}/>
                      <path
                        d="M0,110 C50,90 90,40 150,55 C210,70 250,100 310,80 C370,60 410,20 470,30 C530,40 570,70 600,55"
                        fill="none" stroke="#ED7159" strokeWidth="3" strokeLinecap="round"
                        style={{
                          strokeDasharray: 1400,
                          strokeDashoffset: drawn ? 0 : 1400,
                          transition: 'stroke-dashoffset 2s cubic-bezier(.6,.1,.3,1)',
                        }}
                      />
                      {[0,150,310,470,600].map((x,i)=>(
                        <circle key={i} cx={x} cy={[110,55,80,30,55][i]} r="5" fill="white" stroke="#ED7159" strokeWidth="3"
                          style={{ opacity: drawn ? 1 : 0, transition: `opacity 0.4s ease ${1.2 + i * 0.15}s` }}
                        />
                      ))}
                      {/* Pulsing dot following the line */}
                      <circle cx="470" cy="30" r="6" fill="var(--coral)">
                        <animate attributeName="r" values="6;10;6" dur="1.6s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/>
                      </circle>
                    </svg>
                  </div>
                </div>

                {/* Live orders */}
                <div className="rounded-2xl p-5 border-2 bg-white" style={{ borderColor: 'var(--ink)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold">Ordini live</div>
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--coral)', boxShadow: '0 0 0 4px rgba(237,113,89,0.25)' }} />
                  </div>
                  {orders.map((o, i) => (
                    <div key={`${o.t}-${i}-${orders[0].t}`} className="py-3 border-b-2 border-dashed last:border-0 pop-in" style={{ borderColor: 'rgba(42,31,26,0.1)', animationDuration: '0.5s' }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-sm">{o.t}</div>
                          <div className="text-xs opacity-60">{o.it}</div>
                        </div>
                        <span className="px-2 py-1 rounded-full text-[10px] font-black" style={{ background: o.col, color: 'white' }}>{o.s}</span>
                      </div>
                    </div>
                  ))}
                </div>
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
              <a href="#cta"
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

  return (
    <section className="relative py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 mb-14 items-center">
          <div className="flex justify-center reveal-l">
            <div className="relative">
              <img src="assets/tako-thumbsup.png" alt="Tako thumbs up" className="mascot w-72 float-y" />
              <div className="absolute -top-2 -right-2 chunky px-4 py-2 wiggle" style={{ background: 'var(--sun)' }}>
                <span className="font-display font-black">4.9 ★</span>
              </div>
            </div>
          </div>
          <div>
            <span className="chip mb-5 reveal">Recensioni</span>
            <h2 className="text-5xl md:text-6xl reveal">2.400 ristoratori,<br/><span className="grad-text">e contando.</span></h2>
            <p className="text-lg mt-4 max-w-lg reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
              Dalla pizzeria di quartiere alla catena con 12 sedi. Tako si adatta, scala e fa sorridere.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="chunky p-7 reveal-pop" style={{ transitionDelay: `${i*0.1}s` }}>
              <div className="flex gap-0.5 mb-4 text-[color:var(--sun)] text-xl">{'★★★★★'}</div>
              <p className="text-lg font-semibold leading-relaxed mb-5" style={{ color: 'var(--ink)' }}>"{r.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t-2 border-dashed" style={{ borderColor: 'rgba(42,31,26,0.12)' }}>
                <div className="w-12 h-12 rounded-full border-2 grid place-items-center font-display font-black" style={{ background: r.avatar, borderColor: 'var(--ink)' }}>
                  {r.name[0]}
                </div>
                <div>
                  <div className="font-bold">{r.name}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ——— Final CTA + Footer ——— */
function FinalCTA() {
  return (
    <section id="cta" className="relative py-28 px-6 overflow-hidden" style={{ background: 'var(--coral)' }}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 2px, transparent 2px)', backgroundSize: '32px 32px' }} />
      <div className="relative max-w-5xl mx-auto text-center">
        <div className="flex justify-center mb-6 reveal-pop">
          <img src="assets/tako-bell.png" alt="Tako with bell" className="mascot-hero w-64 bell-ring" style={{ filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.18))' }} />
        </div>
        <h2 className="text-5xl md:text-7xl mb-6 reveal" style={{ color: 'white' }}>
          Pronto a rivoluzionare<br/>il tuo ristorante?
        </h2>
        <p className="text-xl md:text-2xl mb-10 reveal" style={{ color: 'rgba(255,248,243,0.92)', fontWeight: 600 }}>
          30 giorni gratis. Nessuna carta richiesta. Setup in 10 minuti.
        </p>
        <div className="flex flex-wrap justify-center gap-4 reveal">
          <a href="#" className="px-8 py-4 text-lg rounded-full font-black border-2" style={{ background: '#2A1F1A', color: 'var(--cream)', borderColor: '#2A1F1A', boxShadow: '0 6px 0 rgba(0,0,0,0.3)' }}>
            Inizia gratis →
          </a>
          <a href="#" className="px-8 py-4 text-lg rounded-full font-black border-2" style={{ background: 'white', color: 'var(--ink)', borderColor: 'white' }}>
            Prenota una demo
          </a>
        </div>
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
            { t: 'Prodotto', items: ['Funzioni','Prezzi','AI Assistant','Integrazioni','Roadmap'] },
            { t: 'Risorse', items: ['Centro aiuto','Blog','API docs','Community','Stato sistema'] },
            { t: 'Azienda', items: ['Chi siamo','Careers','Contatti','Privacy','Termini'] },
          ].map((c, i) => (
            <div key={i}>
              <div className="font-display font-black mb-4">{c.t}</div>
              <ul className="space-y-2 text-sm opacity-70">
                {c.items.map((it, j) => (<li key={j}><a href="#" className="hover:opacity-100 hover:text-[color:var(--coral)] transition">{it}</a></li>))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t flex flex-wrap items-center justify-between gap-4 text-xs opacity-60" style={{ borderColor: 'rgba(255,248,243,0.12)' }}>
          <span>© 2026 Tako Srl · P.IVA 0123456789 · Made with 🐙 in Bologna</span>
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

window.AIAssistant = AIAssistant;
window.DashboardPreview = DashboardPreview;
window.Pricing = Pricing;
window.Testimonials = Testimonials;
window.FinalCTA = FinalCTA;
window.Footer = Footer;
