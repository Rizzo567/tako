/* global React */
const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

/* ——— Page header (shared, animated) ——— */
function PageHeader({ kicker, title, subtitle, mascot }) {
  const [scrollY, setScrollY] = useStateP(0);
  useEffectP(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <section className="relative pt-36 pb-20 overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFEEE8 0%, #FFF8F3 100%)' }}>
      {/* parallax decorative blobs */}
      <div
        className="absolute -top-20 -left-32 w-[420px] h-[420px] blob-1"
        style={{ background: 'rgba(248,183,166,0.45)', filter: 'blur(2px)', transform: `translateY(${scrollY * 0.25}px)` }}
      />
      <div
        className="absolute top-20 -right-40 w-[480px] h-[480px] blob-2"
        style={{ background: 'rgba(189,217,232,0.4)', filter: 'blur(2px)', transform: `translateY(${scrollY * -0.18}px)` }}
      />
      {/* floating sparkles */}
      {[
        { l: '12%', t: '30%', d: 0 },
        { l: '78%', t: '20%', d: 1.4 },
        { l: '85%', t: '70%', d: 0.7 },
        { l: '8%', t: '75%', d: 2.1 },
      ].map((s, i) => (
        <div key={i} className="absolute float-soft" style={{ left: s.l, top: s.t, animationDelay: `-${s.d}s` }}>
          <svg width="22" height="22" viewBox="0 0 22 22"><path d="M11 0 L13 9 L22 11 L13 13 L11 22 L9 13 L0 11 L9 9 Z" fill="var(--coral)" opacity="0.7"/></svg>
        </div>
      ))}

      <div className="relative max-w-6xl mx-auto px-6 grid md:grid-cols-[1fr,auto] gap-10 items-center">
        <div className="reveal-l">
          <span className="chip mb-5">{kicker}</span>
          <h1 className="text-5xl md:text-7xl leading-[1] mb-5">{title}</h1>
          <p className="text-lg md:text-xl max-w-xl" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{subtitle}</p>
        </div>
        {mascot && (
          <div className="relative reveal-r">
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="w-64 h-64 rounded-full" style={{ background: 'rgba(237,113,89,0.15)', animation: 'pulse-ring 3s ease-out infinite' }} />
            </div>
            <img src={mascot} alt="Tako" className="relative w-56 md:w-64 float-y" style={{ transform: `translateY(${scrollY * -0.05}px)` }} />
          </div>
        )}
      </div>
      <div className="wave-divider absolute -bottom-1 inset-x-0">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 Q360,80 720,40 T1440,40 L1440,80 L0,80 Z" fill="#FFF8F3"/>
        </svg>
      </div>
    </section>
  );
}

/* ——— Animated counter ——— */
function Counter({ from = 0, to, suffix = '', prefix = '', duration = 1500, decimals = 0 }) {
  const [v, setV] = useStateP(from);
  const ref = useRefP(null);
  const started = useRefP(false);
  useEffectP(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setV(from + (to - from) * eased);
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <span ref={ref}>{prefix}{decimals ? v.toFixed(decimals) : Math.round(v)}{suffix}</span>;
}

/* ——— COME FUNZIONA PAGE ——— */
function HowPage() {
  const flow = [
    { n: '01', t: 'Crei il tuo Tako', d: 'Registrati in 2 minuti. Importa il menu da PDF, foglio Excel o foto — l\'AI lo struttura per te.', mascot: 'assets/tako-cloche.png', bg: '#FFEEE8', icon: '⚡', time: '2 min' },
    { n: '02', t: 'Configuri locale e tavoli', d: 'Aggiungi sale, tavoli, orari di servizio e personale. Stampi i QR code direttamente da Tako.', mascot: 'assets/tako-tablet.png', bg: '#E8F4ED', icon: '🪑', time: '10 min' },
    { n: '03', t: 'I clienti scansionano e ordinano', d: 'Sfogliano il menu in 12 lingue, chiedono all\'AI su allergeni e ingredienti, ordinano dal tavolo.', mascot: 'assets/tako-hello.png', bg: '#FFF4E0', icon: '📲', time: 'live' },
    { n: '04', t: 'Tu servi e cresci', d: 'Ordini in cucina in tempo reale, statistiche giornaliere, suggerimenti AI per migliorare il menu.', mascot: 'assets/tako-thumbsup.png', bg: '#EAF2F8', icon: '📈', time: 'sempre' },
  ];

  // active step (animated as user scrolls)
  const [activeStep, setActiveStep] = useStateP(0);
  const stepRefs = useRefP([]);
  useEffectP(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const idx = stepRefs.current.indexOf(e.target);
          if (idx !== -1) setActiveStep(idx);
        }
      });
    }, { threshold: 0.55 });
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <PageHeader
        kicker="Come funziona"
        title={<><span className="grad-text">Quattro passi</span><br/>per cambiare ristorante.</>}
        subtitle="Da zero a operativo in meno di 30 minuti. Tako fa il lavoro pesante — tu pensi solo a cucinare e accogliere."
        mascot="assets/tako-cloche.png"
      />

      {/* Sticky progress sidebar + scroll-linked steps */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-[200px,1fr] gap-12">
          {/* Sticky progress */}
          <div className="hidden md:block">
            <div className="sticky top-32">
              <div className="font-display font-black text-xs tracking-widest mb-5 opacity-60">PROGRESSO</div>
              <div className="relative pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-1 rounded-full" style={{ background: 'rgba(42,31,26,0.08)' }} />
                <div
                  className="absolute left-2 top-2 w-1 rounded-full transition-all duration-700"
                  style={{ height: `${(activeStep + 1) * 25}%`, background: 'var(--coral)' }}
                />
                {flow.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 mb-7 relative">
                    <span
                      className="absolute -left-6 w-5 h-5 rounded-full border-2 transition-all"
                      style={{
                        background: i <= activeStep ? 'var(--coral)' : 'white',
                        borderColor: 'var(--ink)',
                        transform: i === activeStep ? 'scale(1.4)' : 'scale(1)',
                        boxShadow: i === activeStep ? '0 0 0 6px rgba(237,113,89,0.2)' : 'none',
                      }}
                    />
                    <div className={`text-sm font-bold transition-opacity ${i <= activeStep ? 'opacity-100' : 'opacity-40'}`}>
                      <div style={{ color: 'var(--coral-deep)' }}>{s.n}</div>
                      <div>{s.t}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-32">
            {flow.map((s, i) => (
              <div
                key={i}
                ref={(el) => stepRefs.current[i] = el}
                className={`grid md:grid-cols-2 gap-10 items-center ${i % 2 ? 'md:[&>*:first-child]:order-2' : ''}`}
              >
                <div className={i % 2 ? 'reveal-r' : 'reveal-l'}>
                  <div className="flex items-baseline gap-4 mb-3">
                    <div className="font-display font-black text-7xl md:text-8xl" style={{ color: 'var(--coral)' }}>{s.n}</div>
                    <span className="chip" style={{ background: 'var(--ink)', color: 'var(--cream)', borderColor: 'var(--ink)' }}>{s.icon} {s.time}</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl mb-4">{s.t}</h2>
                  <p className="text-lg max-w-md mb-6" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{s.d}</p>
                  <div className="flex items-center gap-2">
                    {flow.map((_, j) => (
                      <span key={j} className="h-1.5 rounded-full transition-all" style={{
                        width: j === i ? 32 : 12,
                        background: j === i ? 'var(--coral)' : 'rgba(42,31,26,0.15)',
                      }} />
                    ))}
                  </div>
                </div>
                <div className={`relative ${i % 2 ? 'reveal-l' : 'reveal-r'}`}>
                  <div className="chunky p-10 grid place-items-center relative overflow-hidden" style={{ background: s.bg }}>
                    <div className="absolute inset-0 dot-grid opacity-20" />
                    <img src={s.mascot} alt={s.t} className="relative w-56 float-y" style={{ animationDelay: `${i*0.4}s` }} />
                    {/* Decorative orbiting dots */}
                    <svg className="absolute inset-0 pointer-events-none spin-slow" viewBox="0 0 200 200">
                      <circle cx="100" cy="20" r="4" fill="var(--coral)" />
                      <circle cx="180" cy="100" r="3" fill="var(--coral-deep)" opacity="0.6"/>
                      <circle cx="100" cy="180" r="5" fill="var(--sun)" opacity="0.8" />
                      <circle cx="20" cy="100" r="3" fill="var(--mint)" />
                    </svg>
                  </div>
                  {/* Time badge */}
                  <div className="absolute -top-4 -right-4 chunky px-4 py-2 wiggle" style={{ background: 'white' }}>
                    <span className="font-display font-black text-sm" style={{ color: 'var(--coral-deep)' }}>{s.icon} {s.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Big total time bar */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto chunky p-10 reveal-pop relative overflow-hidden" style={{ background: 'var(--coral)' }}>
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full opacity-30" style={{ background: 'white' }} />
          <div className="absolute -left-10 -bottom-20 w-40 h-40 rounded-full opacity-20" style={{ background: 'white' }} />
          <div className="relative text-white">
            <div className="font-display font-black text-xs tracking-widest opacity-80 mb-2">TEMPO TOTALE</div>
            <div className="font-display font-black text-7xl md:text-8xl mb-2">
              <Counter to={28} suffix=" min" />
            </div>
            <div className="text-lg opacity-90 font-semibold">Dal "ho appena scaricato Tako" al primo ordine. Cronometrato su 1.200 ristoratori.</div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6" style={{ background: 'var(--ink)', color: 'var(--cream)' }}>
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl mb-4 reveal" style={{ color: 'var(--cream)' }}>Setup garantito in 30 minuti.</h2>
          <p className="text-lg opacity-80 mb-8 reveal">Se ci metti di più, ti rimborsiamo il primo mese.</p>
          <a href="#" className="btn-coral px-8 py-4 text-lg inline-block reveal">Inizia ora →</a>
        </div>
      </section>
    </>
  );
}

/* ——— Live Tables (animated state changes) ——— */
function LiveTables() {
  const [tick, setTick] = useStateP(0);
  useEffectP(() => {
    const id = setInterval(() => setTick(t => t + 1), 1800);
    return () => clearInterval(id);
  }, []);
  const states = [
    { s: 'Libero', col: 'rgba(42,31,26,0.06)', txt: 'var(--ink)', dot: 'rgba(42,31,26,0.2)' },
    { s: 'In corso', col: 'var(--sun)', txt: 'var(--ink)', dot: 'var(--sun)' },
    { s: 'Pronto', col: 'var(--mint)', txt: 'white', dot: 'var(--mint)' },
    { s: 'Conto', col: 'var(--coral)', txt: 'white', dot: 'var(--coral)' },
  ];
  return (
    <div className="p-5 grid grid-cols-4 md:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => {
        const stateIdx = (i + tick) % 4;
        const st = states[stateIdx];
        return (
          <div key={i} className="rounded-2xl p-4 border-2 bg-white relative overflow-hidden transition-all" style={{ borderColor: 'var(--ink)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-black text-lg">T{i+1}</span>
              <span
                key={stateIdx}
                className="text-[10px] font-black px-2 py-0.5 rounded-full pop-in"
                style={{ background: st.col, color: st.txt, animationDuration: '0.4s' }}
              >{st.s}</span>
            </div>
            <div className="text-[11px] opacity-60 font-semibold">{stateIdx === 0 ? '—' : `${(i+1)*7}€ · ${i+2} cop.`}</div>
            <div className="mt-2 flex items-center gap-1 text-[10px] opacity-50">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot, boxShadow: stateIdx > 0 ? `0 0 0 3px ${st.dot}33` : 'none' }} />
              {stateIdx === 0 ? 'pronto' : 'aperto da ' + ((i+1) * 4) + 'm'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ——— Animated bar chart ——— */
function BarChart() {
  const [scrollY, setScrollY] = useStateP(0);
  const ref = useRefP(null);
  const [visible, setVisible] = useStateP(false);
  useEffectP(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const bars = [40, 65, 50, 80, 95, 70, 55];
  const days = ['L','M','M','G','V','S','D'];
  return (
    <div ref={ref} className="rounded-2xl p-5 border-2 bg-white" style={{ borderColor: 'var(--ink)' }}>
      <div className="flex justify-between items-end mb-3">
        <div>
          <div className="text-[11px] font-bold opacity-60">Settimana corrente</div>
          <div className="font-display font-black text-2xl">€ <Counter to={9842} duration={1800} /></div>
        </div>
        <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: 'var(--mint)', color: 'white' }}>+18%</span>
      </div>
      <div className="flex items-end gap-2 h-32">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full rounded-t-lg transition-all duration-1000" style={{
              height: visible ? `${b}%` : '0%',
              background: i === 4 ? 'var(--coral)' : 'rgba(237,113,89,0.4)',
              transitionDelay: `${i * 80}ms`,
            }} />
            <span className="text-[10px] font-bold opacity-60">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ——— Animated order ticker ——— */
function OrderTicker() {
  const orders = [
    { t: 'T7', it: 'Carbonara × 2', s: 'Nuovo', col: 'var(--coral)', time: '12s' },
    { t: 'T3', it: 'Tagliata, vino', s: 'Cucina', col: 'var(--sun)', time: '4m' },
    { t: 'T11', it: 'Tiramisù', s: 'Pronto', col: 'var(--mint)', time: '8m' },
    { t: 'Asporto', it: 'Pizza Margherita', s: 'Nuovo', col: 'var(--coral)', time: '2s' },
    { t: 'T5', it: 'Risotto porcini', s: 'Cucina', col: 'var(--sun)', time: '6m' },
  ];
  const [items, setItems] = useStateP(orders);
  useEffectP(() => {
    const id = setInterval(() => {
      setItems(prev => [prev[prev.length - 1], ...prev.slice(0, -1)]);
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-2xl p-5 border-2 bg-white" style={{ borderColor: 'var(--ink)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold">Ordini live</div>
        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--coral)', boxShadow: '0 0 0 4px rgba(237,113,89,0.25)' }} />
      </div>
      <div className="space-y-2">
        {items.slice(0, 4).map((o, i) => (
          <div key={`${o.t}-${i}-${items[0].t}`} className="flex items-center justify-between p-2 rounded-xl pop-in" style={{ background: 'rgba(255,238,232,0.4)', animationDuration: '0.5s' }}>
            <div className="min-w-0">
              <div className="font-bold text-sm">{o.t} <span className="opacity-50 font-mono text-[10px]">{o.time}</span></div>
              <div className="text-[11px] opacity-70 truncate">{o.it}</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: o.col, color: 'white' }}>{o.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ——— LATO RISTORATORE PAGE ——— */
function RestaurantPage() {
  const features = [
    { icon: '🧾', t: 'Ordini in cucina, in tempo reale', d: 'Ogni ordine arriva in cucina e al cameriere. Stato del piatto aggiornato live: in preparazione, pronto, servito.' },
    { icon: '📊', t: 'Statistiche che contano davvero', d: 'Piatti più venduti, orari di punta, ticket medio, margini. Capisci cosa funziona e cosa togliere dal menu.' },
    { icon: '👥', t: 'Gestione personale', d: 'Turni, mance, performance. Ogni cameriere vede solo i propri tavoli, ogni cuoco solo la propria postazione.' },
    { icon: '🔄', t: 'Aggiornamenti istantanei', d: 'Esaurito un piatto? Un tap e sparisce dal menu di tutti i tavoli. Nuova specialità? La aggiungi in 30 secondi.' },
    { icon: '🧂', t: 'Inventario integrato', d: 'Tako conta gli ingredienti consumati e ti avvisa quando è ora di ri-ordinare. Niente più mozzarella finita di sabato.' },
    { icon: '🧮', t: 'Conto e pagamento', d: 'Divisione automatica, mance suggerite, pagamenti contactless dal tavolo. Il cliente esce, tu chiudi il giorno in 1 click.' },
  ];

  const tabs = ['Sala','Cucina','Cassa','Statistiche'];
  const [tab, setTab] = useStateP(0);

  return (
    <>
      <PageHeader
        kicker="Lato ristoratore"
        title={<>La tua <span className="grad-text">cucina ha</span> un sistema operativo.</>}
        subtitle="Tako è il cervello che coordina ordini, cucina, sala e cassa. Tu vedi tutto, decidi tutto, in un'unica schermata."
        mascot="assets/tako-tablet.png"
      />

      {/* Big animated dashboard mockup with switchable tabs */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto reveal">
          <div className="tablet-frame">
            <div className="bg-[color:var(--cream)] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b-2" style={{ borderColor: 'rgba(42,31,26,0.08)' }}>
                <div className="flex items-center gap-2"><TakoLogo size={24} /><span className="text-xs font-bold opacity-50">/ Trattoria da Nino</span></div>
                <div className="flex gap-2 text-xs font-bold">
                  {tabs.map((tname, i) => (
                    <button
                      key={tname}
                      onClick={() => setTab(i)}
                      className="px-3 py-1 rounded-full transition-all"
                      style={{
                        background: tab === i ? 'var(--coral)' : 'rgba(42,31,26,0.06)',
                        color: tab === i ? 'white' : 'inherit',
                        boxShadow: tab === i ? '0 4px 0 var(--coral-deep)' : 'none',
                      }}
                    >{tname}</button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div key={tab} className="pop-in">
                {tab === 0 && <LiveTables />}
                {tab === 1 && (
                  <div className="p-5 grid md:grid-cols-2 gap-3">
                    {[
                      { it: 'Carbonara T7', s: 'In preparazione', t: '4:32', col: 'var(--sun)' },
                      { it: 'Tagliata T3', s: 'Pronto', t: '0:00', col: 'var(--mint)' },
                      { it: 'Pizza × 3 T11', s: 'In forno', t: '6:18', col: 'var(--coral)' },
                      { it: 'Tiramisù T5', s: 'Pronto', t: '0:00', col: 'var(--mint)' },
                    ].map((o, i) => (
                      <div key={i} className="rounded-2xl p-4 border-2 bg-white flex items-center justify-between" style={{ borderColor: 'var(--ink)' }}>
                        <div>
                          <div className="font-bold">{o.it}</div>
                          <div className="text-xs opacity-60">{o.s}</div>
                        </div>
                        <div className="font-display font-black text-2xl" style={{ color: o.col }}>{o.t}</div>
                      </div>
                    ))}
                  </div>
                )}
                {tab === 2 && (
                  <div className="p-5 grid md:grid-cols-3 gap-3">
                    {[
                      { l: 'Aperti', v: '7 conti', col: 'var(--coral)' },
                      { l: 'Da chiudere', v: '2 conti', col: 'var(--sun)' },
                      { l: 'Incasso oggi', v: '€1.842', col: 'var(--mint)' },
                    ].map((c, i) => (
                      <div key={i} className="rounded-2xl p-5 border-2 bg-white" style={{ borderColor: 'var(--ink)' }}>
                        <div className="text-xs font-bold opacity-60 mb-1">{c.l}</div>
                        <div className="font-display font-black text-3xl" style={{ color: c.col }}>{c.v}</div>
                      </div>
                    ))}
                  </div>
                )}
                {tab === 3 && (
                  <div className="p-5 grid md:grid-cols-[2fr,1fr] gap-3">
                    <BarChart />
                    <OrderTicker />
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-center mt-6 text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>
            ↑ Clicca i tab per esplorare le viste della dashboard
          </p>
        </div>
      </section>

      {/* Feature grid with hover-orbit */}
      <section className="py-24 px-6" style={{ background: 'linear-gradient(180deg, #FFF8F3 0%, #FFEEE8 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl mb-12 max-w-2xl reveal">Tutti gli strumenti, <span className="grad-text">una sola app.</span></h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="chunky p-7 hover-rise reveal-pop relative overflow-hidden group" style={{ transitionDelay: `${i*0.06}s` }}>
                <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-30 transition-opacity" style={{ background: 'var(--coral)' }} />
                <div className="text-3xl mb-3 relative">{f.icon}</div>
                <h3 className="text-2xl mb-2 relative">{f.t}</h3>
                <p className="text-[15px] relative" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Animated KPIs with counters */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="chip mb-4 reveal">Numeri reali</span>
            <h2 className="text-4xl md:text-5xl reveal">Cosa cambia <span className="grad-text">dopo un mese.</span></h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: <Counter to={42} suffix="%" prefix="−" />, l: 'Tempo di servizio' },
              { n: <Counter to={18} suffix="%" prefix="+" />, l: 'Ticket medio' },
              { n: <Counter to={180} prefix="−€" />, l: 'Spesa software/mese' },
              { n: <><Counter to={4.9} decimals={1} duration={1800} />★</>, l: 'Soddisfazione team' },
            ].map((s, i) => (
              <div key={i} className="text-center reveal-pop" style={{ transitionDelay: `${i*0.08}s` }}>
                <div className="font-display font-black text-6xl mb-1 grad-text">{s.n}</div>
                <div className="font-bold" style={{ color: 'var(--ink-soft)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Side panel — chef Tako */}
      <section className="py-20 px-6" style={{ background: 'var(--ink)', color: 'var(--cream)' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-[auto,1fr] items-center gap-10">
          <img src="assets/tako-chef.png" alt="Tako chef" className="w-48 wiggle" style={{ filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.3))' }} />
          <div>
            <h2 className="text-4xl md:text-5xl mb-3" style={{ color: 'var(--cream)' }}>Tako lavora con te. <span style={{ color: 'var(--coral)' }}>Non al posto tuo.</span></h2>
            <p className="text-lg opacity-80 mb-6">Niente automazione invasiva: ogni decisione passa dalle tue mani. L'AI suggerisce, tu approvi.</p>
            <a href="#" className="btn-coral px-7 py-3.5">Vedi una demo →</a>
          </div>
        </div>
      </section>
    </>
  );
}

/* ——— LATO CLIENTE PAGE ——— */
function CustomerPhone1() {
  const dishes = [
    [
      { n: 'Spaghetti vongole', p: '€14', tag: '🐚 Pesce' },
      { n: 'Risotto porcini', p: '€16', tag: '🌱 Veg' },
      { n: 'Tagliatelle al ragù', p: '€12', tag: '🍝 Tradizione' },
    ],
    [
      { n: 'Polpo alla griglia', p: '€18', tag: '🐙 Specialità' },
      { n: 'Branzino al sale', p: '€24', tag: '🐟 Fresco' },
      { n: 'Calamari fritti', p: '€15', tag: '🦑 Pesce' },
    ],
    [
      { n: 'Tagliata di manzo', p: '€22', tag: '🥩 Carne' },
      { n: 'Pollo al limone', p: '€14', tag: '🍋 Light' },
      { n: 'Vitello tonnato', p: '€16', tag: '🥗 Antipasti' },
    ],
  ];
  const sections = ['PRIMI', 'PESCE', 'CARNI'];
  const [page, setPage] = useStateP(0);
  useEffectP(() => {
    const id = setInterval(() => setPage((p) => (p + 1) % dishes.length), 3200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="phone w-[280px] mx-auto">
      <div className="phone-screen">
        <div className="px-5 py-4 flex items-center justify-between border-b-2" style={{ borderColor: 'rgba(42,31,26,0.08)' }}>
          <div className="font-display font-black">Trattoria da Nino</div>
          <span className="text-xs font-bold opacity-60">T7</span>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b" style={{ borderColor: 'rgba(42,31,26,0.06)' }}>
          {sections.map((s, i) => (
            <span key={s} className="text-[10px] font-black px-3 py-1 rounded-full transition-all" style={{
              background: i === page ? 'var(--coral)' : 'transparent',
              color: i === page ? 'white' : 'var(--ink-soft)',
            }}>{s}</span>
          ))}
        </div>
        <div className="p-4 space-y-3" key={page} style={{ minHeight: 200 }}>
          {dishes[page].map((d, i) => (
            <div key={`${page}-${i}`} className="flex items-center justify-between py-2 border-b border-dashed pop-in" style={{ borderColor: 'rgba(42,31,26,0.12)', animationDelay: `${i*0.1}s`, animationDuration: '0.5s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border-2" style={{ background: i % 2 ? 'var(--coral-tint)' : '#FFF4E0', borderColor: 'var(--ink)' }} />
                <div>
                  <div className="font-bold text-sm">{d.n}</div>
                  <div className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{d.tag}</div>
                </div>
              </div>
              <div className="font-display font-black text-sm">{d.p}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomerPhone2() {
  const script = [
    { who: 'them', text: 'Avete qualcosa senza glutine?' },
    { who: 'me', text: 'Sì! Risotto porcini, tagliata di manzo e tiramisù sono tutti gluten-free 🌾' },
    { who: 'them', text: 'Il tiramisù ha alcol?' },
    { who: 'me', text: 'Solo un velo di Marsala. Posso chiedere alla cucina di farlo senza, dimmi pure.' },
  ];
  const [step, setStep] = useStateP(0);
  useEffectP(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % (script.length + 2));
    }, 2200);
    return () => clearInterval(id);
  }, []);
  const showTyping = step > 0 && step <= script.length && script[step - 1] && script[step - 1].who === 'them';
  return (
    <div className="phone w-[280px] mx-auto">
      <div className="phone-screen">
        <div className="px-5 py-4 flex items-center gap-3 border-b-2" style={{ borderColor: 'rgba(42,31,26,0.08)' }}>
          <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: 'var(--coral)' }}>
            <span className="text-white font-display font-black text-xs">T</span>
          </div>
          <div>
            <div className="font-bold text-sm">Tako AI</div>
            <div className="text-[10px] flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--mint)' }} /> online
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3" style={{ minHeight: 280 }}>
          {script.slice(0, Math.min(step, script.length)).map((m, i) => (
            <div key={i} className={m.who === 'them' ? 'bubble-them text-xs pop-in' : 'bubble-me text-xs pop-in'} style={{ animationDuration: '0.5s' }}>
              {m.text}
            </div>
          ))}
          {showTyping && (
            <div className="bubble-me text-xs inline-flex gap-1.5 items-center pop-in" style={{ animationDuration: '0.4s' }}>
              <span className="dot" style={{ background: 'var(--cream)' }} />
              <span className="dot" style={{ background: 'var(--cream)' }} />
              <span className="dot" style={{ background: 'var(--cream)' }} />
            </div>
          )}
        </div>
        <div className="p-3 border-t-2" style={{ borderColor: 'rgba(42,31,26,0.08)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: 'var(--coral-tint)' }}>
            <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Chiedi qualcosa…</span>
            <div className="ml-auto w-6 h-6 rounded-full grid place-items-center text-white text-xs" style={{ background: 'var(--coral)' }}>↑</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerPhone3() {
  const stages = [
    { l: 'Ricevuto', t: 'Tako lo ha ricevuto', step: 0 },
    { l: 'In cucina', t: 'Lo chef sta cucinando', step: 1 },
    { l: 'In arrivo', t: 'In arrivo al tavolo', step: 2 },
    { l: 'Servito', t: 'Buon appetito! 🍝', step: 3 },
  ];
  const [s, setS] = useStateP(0);
  useEffectP(() => {
    const id = setInterval(() => setS((p) => (p + 1) % stages.length), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="phone w-[280px] mx-auto">
      <div className="phone-screen">
        <div className="px-5 py-4 border-b-2 flex items-center justify-between" style={{ borderColor: 'rgba(42,31,26,0.08)' }}>
          <div className="font-display font-black text-sm">Il tuo ordine</div>
          <span className="chip" style={{ padding: '3px 8px', fontSize: 9 }}>T7</span>
        </div>
        <div className="p-4">
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--coral-tint)' }}>
            <div className="text-[11px] font-bold opacity-70 mb-1">STATO</div>
            <div key={s} className="font-display font-black text-xl pop-in" style={{ animationDuration: '0.5s' }}>{stages[s].t}</div>
            <div className="mt-3 flex items-center gap-1">
              {stages.map((stg, i) => (
                <div key={i} className="flex-1 h-2 rounded-full transition-all duration-700" style={{
                  background: i <= s ? 'var(--coral)' : 'rgba(42,31,26,0.1)',
                  boxShadow: i === s ? '0 0 0 3px rgba(237,113,89,0.3)' : 'none',
                }} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[9px] font-black opacity-70">
              {stages.map((stg, i) => (<span key={i} style={{ color: i <= s ? 'var(--coral-deep)' : 'var(--ink-soft)' }}>{stg.l}</span>))}
            </div>
          </div>
          {[
            { n: 'Risotto porcini', p: '€16' },
            { n: 'Tagliata', p: '€22' },
            { n: 'Tiramisù', p: '€7' },
          ].map((d, i) => (
            <div key={i} className="flex justify-between text-sm py-2 border-b border-dashed" style={{ borderColor: 'rgba(42,31,26,0.12)' }}>
              <span>{d.n}</span><span className="font-bold">{d.p}</span>
            </div>
          ))}
          <div className="flex justify-between font-display font-black text-lg pt-3">
            <span>Totale</span><span>€45</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerPage() {
  return (
    <>
      <PageHeader
        kicker="Lato cliente"
        title={<>Scansiona. <span className="grad-text">Ordina. Goditi.</span></>}
        subtitle="L'esperienza che i tuoi clienti vorrebbero in ogni ristorante. Niente app da scaricare, niente attese, niente sbagli sull'ordine."
        mascot="assets/tako-hello.png"
      />

      <section className="py-24 px-6 relative overflow-hidden">
        {/* Animated swimming background polipo */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(237,113,89,0.25) 2px, transparent 2px)', backgroundSize: '40px 40px' }} />

        <div className="max-w-6xl mx-auto relative">
          <h2 className="text-4xl md:text-5xl text-center mb-3 reveal">Tre tap per cenare.</h2>
          <p className="text-center mb-16 text-lg max-w-xl mx-auto reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
            Niente download, niente account. Si scansiona il QR del tavolo e parte tutto.
          </p>

          {/* Connecting curved line between phones */}
          <svg className="hidden md:block absolute top-32 left-0 w-full h-32 pointer-events-none" viewBox="0 0 1200 100" preserveAspectRatio="none">
            <path className="tentacle-path" d="M180,50 Q400,0 600,50 T1020,50" stroke="var(--coral)" strokeWidth="3" strokeDasharray="6 8" />
          </svg>

          <div className="grid md:grid-cols-3 gap-10 items-start relative">
            {/* Phone 1 — scan & menu auto-cycling */}
            <div className="reveal relative" style={{ transitionDelay: '0s' }}>
              <CustomerPhone1 />
              {/* Floating QR badge */}
              <div className="absolute -top-4 -left-2 chunky px-3 py-2 wiggle hidden md:block" style={{ background: 'white' }}>
                <span className="font-display font-black text-xs" style={{ color: 'var(--coral-deep)' }}>📷 QR scansionato</span>
              </div>
              <div className="text-center mt-6">
                <div className="inline-flex items-center gap-2 mb-1">
                  <span className="font-display font-black text-2xl" style={{ color: 'var(--coral)' }}>1</span>
                  <span className="font-display font-black text-2xl">Sfoglia</span>
                </div>
                <p style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Foto, prezzi, allergeni. Sempre aggiornato.</p>
              </div>
            </div>

            {/* Phone 2 — AI chat auto-running */}
            <div className="reveal md:mt-12 relative" style={{ transitionDelay: '0.15s' }}>
              <CustomerPhone2 />
              <div className="absolute -top-4 -right-2 chunky px-3 py-2 float-soft hidden md:block" style={{ background: 'var(--ink)', color: 'var(--cream)', borderColor: 'var(--ink)' }}>
                <span className="font-display font-black text-xs">⚡ AI risponde</span>
              </div>
              <div className="text-center mt-6">
                <div className="inline-flex items-center gap-2 mb-1">
                  <span className="font-display font-black text-2xl" style={{ color: 'var(--coral)' }}>2</span>
                  <span className="font-display font-black text-2xl">Chiedi</span>
                </div>
                <p style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>L'AI conosce ogni piatto. Risponde subito.</p>
              </div>
            </div>

            {/* Phone 3 — order live progress */}
            <div className="reveal md:mt-24 relative" style={{ transitionDelay: '0.3s' }}>
              <CustomerPhone3 />
              <div className="absolute -bottom-2 -left-2 chunky px-3 py-2 wiggle hidden md:block" style={{ background: 'var(--mint)', color: 'white', borderColor: 'var(--ink)' }}>
                <span className="font-display font-black text-xs">🍝 In arrivo!</span>
              </div>
              <div className="text-center mt-6">
                <div className="inline-flex items-center gap-2 mb-1">
                  <span className="font-display font-black text-2xl" style={{ color: 'var(--coral)' }}>3</span>
                  <span className="font-display font-black text-2xl">Goditi</span>
                </div>
                <p style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Stato live, paga al tavolo, basta.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Animated stats strip */}
      <section className="py-16 px-6" style={{ background: 'var(--ink)', color: 'var(--cream)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { v: <Counter to={42} suffix="s" />, l: 'tempo medio per ordinare' },
            { v: <Counter to={12} />, l: 'lingue tradotte' },
            { v: <Counter to={0} />, l: 'app da scaricare' },
            { v: <><Counter to={4.8} decimals={1} duration={1800} />★</>, l: 'rating clienti' },
          ].map((s, i) => (
            <div key={i} className="reveal-pop" style={{ transitionDelay: `${i*0.1}s` }}>
              <div className="font-display font-black text-5xl md:text-6xl" style={{ color: 'var(--coral)' }}>{s.v}</div>
              <div className="text-sm font-bold opacity-70 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6" style={{ background: 'linear-gradient(180deg, #FFF8F3 0%, #FFEEE8 100%)' }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="reveal-l">
            <h2 className="text-4xl md:text-5xl mb-5">Senza app. <span className="grad-text">Senza attese. Senza stress.</span></h2>
            <ul className="space-y-3">
              {[
                'Niente download: scansiona e ordini',
                '12 lingue tradotte automaticamente',
                'AI che risponde a tutte le domande',
                'Pagamento contactless dal telefono',
                'Notifiche quando l\'ordine è pronto',
                'Recensioni e mance dirette al cameriere',
              ].map((t, i) => (
                <li key={i} className="flex items-center gap-3 font-bold reveal" style={{ transitionDelay: `${i*0.06}s` }}>
                  <span className="w-7 h-7 grid place-items-center rounded-full text-white text-sm" style={{ background: 'var(--coral)' }}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center reveal-r relative">
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="w-72 h-72 rounded-full" style={{ background: 'rgba(237,113,89,0.15)', animation: 'pulse-ring 3s ease-out infinite' }} />
            </div>
            <img src="assets/tako-hugplate.png" alt="Tako with plate" className="w-72 float-y relative" />
          </div>
        </div>
      </section>
    </>
  );
}

window.HowPage = HowPage;
window.RestaurantPage = RestaurantPage;
window.CustomerPage = CustomerPage;
