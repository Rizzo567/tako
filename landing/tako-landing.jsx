/* global React */
/* tako-landing.jsx — LANDING root: page routing + home assembly + the new
   hand-holding-phone showcase section. (Separato da tako-app.jsx, che è la PWA
   cliente: i due file condividevano lo stesso nome e collidevano.) */

const { useState: lS, useEffect: lE, useRef: lR } = React;

/* ─────────────── Hand-holding-phone showcase ───────────────
   3 strati: slot schermo (iframe app Tako, dietro) + foto mano/telefono (davanti,
   con notch/dita "bakate"). Geometria dello slot misurata sull'immagine 1536×2752. */
function HandPhone() {
  const stageRef = lR(null);
  const slotRef = lR(null);
  const APP_W = 390; // larghezza CSS reale dell'app Tako nell'iframe

  lE(() => {
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
        <iframe className="hp-live" src="app.html?bare=1&demo=1" scrolling="no" tabIndex="-1" title="App Tako — demo menù"></iframe>
      </div>
      <img className="hp-hand" src="assets/hand-phone.png" alt="Mano che impugna lo smartphone con l'app Tako" />
    </div>
  );
}
window.HandPhone = HandPhone;

function HandPhoneShowcase() {
  return (
    <section className="relative overflow-hidden py-24 px-6" style={{ background: 'linear-gradient(180deg, #FFEEE8 0%, #FFF8F3 100%)' }}>
      {/* decorative blobs */}
      <div className="absolute -top-24 -left-24 w-[420px] h-[420px] blob-1 pointer-events-none" style={{ background: 'rgba(248,183,166,0.4)', filter: 'blur(2px)' }}></div>
      <div className="absolute bottom-0 right-0 w-[460px] h-[460px] blob-2 pointer-events-none" style={{ background: 'rgba(189,217,232,0.35)', filter: 'blur(2px)' }}></div>

      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-center relative">
        {/* LEFT — placeholder (da definire) */}
        <div className="reveal-l order-2 md:order-1">
          <div className="rounded-3xl border-2 border-dashed grid place-items-center text-center px-8 py-20"
            style={{ borderColor: 'rgba(42,31,26,0.18)', minHeight: 320 }}>
            <div>
              <span className="chip mb-4" style={{ borderStyle: 'dashed' }}>Colonna sinistra</span>
              <p className="font-display font-black text-2xl mb-2" style={{ color: 'var(--ink)' }}>Contenuto in arrivo</p>
              <p style={{ color: 'var(--ink-soft)', fontWeight: 500, maxWidth: 360 }}>
                Spazio riservato — lo definiamo insieme nel prossimo passo.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT — photoreal hand + live app */}
        <div className="reveal-r order-1 md:order-2 w-full">
          <HandPhone />
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Landing theme (tweakable primary) ─────────────── */
function applyLandingTheme(primary) {
  if (!primary) return;
  const r = document.documentElement;
  r.style.setProperty('--coral', primary);
}

/* ─────────────── Landing root ─────────────── */
const LANDING_TWEAKS = /*EDITMODE-BEGIN*/{
  "page": "home",
  "primary": "#ED7159"
}/*EDITMODE-END*/;

function LandingApp() {
  const [t, setTweak] = useTweaks(LANDING_TWEAKS);
  const page = t.page;
  const setPage = (p) => setTweak('page', p);

  useReveal(); // re-observes .reveal* every render (re-triggers on page change)
  lE(() => { applyLandingTheme(t.primary); }, [t.primary]);

  // Arrivo da un'altra pagina del sito con ?page=<id> → apri quella vista.
  lE(() => {
    const p = new URLSearchParams(location.search).get('page');
    if (p && ['home', 'how', 'restaurant', 'customer'].includes(p)) setTweak('page', p);
  }, []);

  // Arrivo con #cta (es. pulsante "Contattaci") → torna alla home e scorri al form.
  lE(() => {
    if (location.hash !== '#cta') return;
    setTweak('page', 'home');
    const id = setTimeout(() => {
      const el = document.getElementById('cta');
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth' });
    }, 450);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <Navbar page={page} setPage={setPage} />

      <main key={page}>
        {page === 'home' && (
          <>
            <Hero />
            <TrustTape />
            <Features />
            <MenuSmart />
            <HowItWorks />
            <AIAssistant />
            <DashboardPreview />
            <Testimonials />
            <FinalCTA />
          </>
        )}
        {page === 'how' && <HowPage />}
        {page === 'restaurant' && <RestaurantPage />}
        {page === 'customer' && <CustomerPage />}
      </main>

      <Footer />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Brand" />
        <TweakColor label="Colore primario" value={t.primary} options={['#ED7159', '#2A6FDB', '#1F8A5B', '#7A4FD0', '#E0A23C']} onChange={v => setTweak('primary', v)} />
        <TweakSection label="Pagina" />
        <TweakRadio label="Vai a" value={t.page} options={['home', 'how', 'restaurant', 'customer']} onChange={v => { setTweak('page', v); window.scrollTo({ top: 0 }); }} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LandingApp />);
