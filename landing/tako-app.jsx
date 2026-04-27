/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakColor, TweakToggle, TweakRadio, TweakText */
const { useEffect, useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primary": "#ED7159",
  "primaryDeep": "#D9533A",
  "ink": "#2A1F1A",
  "cream": "#FFF8F3"
}/*EDITMODE-END*/;

function ApplyTheme({ tweaks }) {
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--coral', tweaks.primary);
    r.style.setProperty('--coral-deep', tweaks.primaryDeep);
    r.style.setProperty('--ink', tweaks.ink);
    r.style.setProperty('--cream', tweaks.cream);
  }, [tweaks]);
  return null;
}

/* Home page (original sections, minus AI and Pricing) */
function HomePage() {
  return (
    <>
      <Hero />
      <TrustTape />
      <Features />
      <MenuSmart />
      <HowItWorks />
      <DashboardPreview />
      <Testimonials />
      <FinalCTA />
    </>
  );
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = useState('home');
  useReveal();

  // re-trigger reveal animations on page change
  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelectorAll('.reveal, .reveal-l, .reveal-r, .reveal-pop, .tentacle-path').forEach((el) => el.classList.remove('in'));
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.15 });
      document.querySelectorAll('.reveal, .reveal-l, .reveal-r, .reveal-pop, .tentacle-path').forEach((el) => io.observe(el));
    }, 50);
    return () => clearTimeout(t);
  }, [page]);

  return (
    <>
      <ApplyTheme tweaks={tweaks} />
      <Navbar page={page} setPage={setPage} />
      <main key={page}>
        {page === 'home' && <HomePage />}
        {page === 'how' && <HowPage />}
        {page === 'restaurant' && <RestaurantPage />}
        {page === 'customer' && <CustomerPage />}
      </main>
      <Footer />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Brand colors">
          <TweakColor label="Primary (coral)" value={tweaks.primary} onChange={(v) => setTweak('primary', v)} />
          <TweakColor label="Primary deep" value={tweaks.primaryDeep} onChange={(v) => setTweak('primaryDeep', v)} />
          <TweakColor label="Ink (dark)" value={tweaks.ink} onChange={(v) => setTweak('ink', v)} />
          <TweakColor label="Background" value={tweaks.cream} onChange={(v) => setTweak('cream', v)} />
        </TweakSection>
        <TweakSection title="Pagine">
          <TweakRadio label="Vai a" value={page} onChange={setPage} options={[
            { label: 'Home', value: 'home' },
            { label: 'Come funziona', value: 'how' },
            { label: 'Ristoratore', value: 'restaurant' },
            { label: 'Cliente', value: 'customer' },
          ]} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
