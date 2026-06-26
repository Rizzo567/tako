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
function TakoLogo({ size = 44, collapseWord = false }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src="assets/tako-chef.png"
        alt="Tako"
        style={{ width: size, height: size, objectFit: 'contain' }}
        className="logo-bob"
      />
      <span className={`tnav-word font-display font-black text-2xl tracking-tight ${collapseWord ? 'tnav-word-hidden' : ''}`} style={{ color: 'var(--ink)' }}>Tako</span>
    </div>
  );
}

/* ——— Sticky Navbar ——— */

/* ——— Mappa codici errore backend → messaggi UI (italiano) ——— */
const AUTH_ERROR_IT = {
  VALIDATION: 'Controlla i dati inseriti.',
  WEAK_PASSWORD: 'La password deve avere almeno 10 caratteri.',
  INVALID_CREDENTIALS: 'Email o password non corretti.',
  EMAIL_NOT_VERIFIED: 'Devi prima verificare la tua email.',
  RATE_LIMIT: 'Troppi tentativi. Riprova tra qualche minuto.',
  NETWORK: 'Impossibile contattare il server. Riprova.',
  SERVER_ERROR: 'Errore del server. Riprova tra poco.',
};
function authErr(res) {
  return (res.code && AUTH_ERROR_IT[res.code]) || res.error || 'Errore imprevisto.';
}

/* ——— Messaggi per i query param OAuth (?oauth_error=...) ——— */
const OAUTH_ERROR_IT = {
  '1': 'Accesso con il provider non riuscito. Riprova.',
  email_unverified: "L'email del tuo account social non è verificata: verificala dal provider e riprova.",
  verify_existing_account: 'Esiste già un account con questa email. Accedi con email e password (o verifica prima la tua email).',
};

/* ——— Bottoni OAuth condivisi (Google / GitHub) ——— */
function OAuthButtons({ disabled }) {
  const go = (provider) => () => {
    const api = window.TakoAPI;
    if (!api) return;
    window.location.href = api.oauthUrl(provider);
  };
  const base = 'w-full py-3 rounded-xl border-2 font-bold text-[15px] inline-flex items-center justify-center gap-2.5 transition';
  const style = { borderColor: 'var(--ink)', background: 'white', color: 'var(--ink)', boxShadow: '3px 3px 0 var(--ink)' };
  return (
    <div className="space-y-3">
      <button type="button" onClick={go('google')} disabled={disabled} className={base} style={style} aria-label="Continua con Google">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continua con Google
      </button>
      <button type="button" onClick={go('github')} disabled={disabled} className={base} style={style} aria-label="Continua con GitHub">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/>
        </svg>
        Continua con GitHub
      </button>
    </div>
  );
}
window.OAuthButtons = OAuthButtons;

/* ——— Divisore "oppure" ——— */
function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-5" aria-hidden="true">
      <span className="flex-1 h-px" style={{ background: 'rgba(42,31,26,.16)' }} />
      <span className="text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>oppure</span>
      <span className="flex-1 h-px" style={{ background: 'rgba(42,31,26,.16)' }} />
    </div>
  );
}

/* ——— Login modal (riquadro "Accedi") — collegato al control-plane cloud ——— */
function LoginModal({ open, onClose, initialView = 'login' }) {
  const [view, setView] = useState(initialView); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');      // messaggio neutro/success generico
  const [needVerify, setNeedVerify] = useState(false); // login → EMAIL_NOT_VERIFIED
  const [resendDone, setResendDone] = useState(false);
  const [done, setDone] = useState(false);        // schermata finale (register/forgot)

  const reset = () => {
    setEmail(''); setPassword(''); setName('');
    setLoading(false); setError(''); setNotice('');
    setNeedVerify(false); setResendDone(false); setDone(false);
  };
  const switchView = (v) => { setError(''); setNotice(''); setNeedVerify(false); setResendDone(false); setDone(false); setView(v); };

  useEffect(() => { if (open) { reset(); setView(initialView); } }, [open, initialView]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;

  const fieldStyle = { borderColor: 'rgba(42,31,26,.16)', background: '#FFFDFB' };
  const Label = ({ children }) => <label className="block text-[13px] font-bold mb-1" style={{ color: 'var(--ink)' }}>{children}</label>;
  const linkStyle = { color: 'var(--coral-deep)' };
  const api = () => window.TakoAPI;

  /* ——— LOGIN ——— */
  const submitLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(''); setNeedVerify(false);
    setLoading(true);
    const res = await api().apiPost('/api/auth/login', { email: email.trim(), password });
    setLoading(false);
    if (res.ok) {
      // Sessione attiva. Confermiamo con /me (best-effort) e chiudiamo.
      try { await api().apiGet('/api/auth/me'); } catch (_) {}
      onClose();
      // Ricarica per riflettere lo stato loggato (qui non c'è ancora un'area riservata sul sito).
      window.location.reload();
      return;
    }
    if (res.code === 'EMAIL_NOT_VERIFIED') { setNeedVerify(true); return; }
    setError(authErr(res));
  };

  const resendVerification = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    const res = await api().apiPost('/api/auth/resend-verification', { email: email.trim() });
    setLoading(false);
    // Risposta sempre generica (anti-enumeration): mostriamo conferma comunque.
    if (res.ok || res.status === 200) setResendDone(true);
    else setError(authErr(res));
  };

  /* ——— REGISTER ——— */
  const submitRegister = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (password.length < 10) { setError('La password deve avere almeno 10 caratteri.'); return; }
    setLoading(true);
    const res = await api().apiPost('/api/auth/register', { name: name.trim(), email: email.trim(), password });
    setLoading(false);
    if (res.ok) { setDone(true); return; }
    setError(authErr(res));
  };

  /* ——— FORGOT ——— */
  const submitForgot = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    const res = await api().apiPost('/api/auth/forgot-password', { email: email.trim() });
    setLoading(false);
    // 200 generico sempre.
    if (res.ok || res.status === 200) setDone(true);
    else setError(authErr(res));
  };

  const ErrorBox = () => error ? (
    <div role="alert" className="mb-4 px-4 py-3 rounded-xl border-2 text-[14px] font-semibold" style={{ borderColor: 'var(--coral-deep)', background: '#FFF1ED', color: 'var(--coral-deep)' }}>{error}</div>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(42,31,26,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="chunky relative w-full max-w-md p-8 pop-in"
        style={{ borderRadius: 28 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-4 right-4 w-9 h-9 rounded-full grid place-items-center text-xl leading-none border-2"
          style={{ borderColor: 'var(--ink)', background: 'white', color: 'var(--ink)', fontWeight: 900 }}
        >×</button>

        {/* ——— LOGIN ——— */}
        {view === 'login' && (
          <>
            <div className="text-center mb-6">
              <img src="assets/tako-chef.png" alt="" className="w-20 h-20 mx-auto mb-3 logo-bob" style={{ objectFit: 'contain' }} />
              <h3 className="text-3xl mb-1" style={{ color: 'var(--ink)' }}>Bentornato!</h3>
              <p className="text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Accedi al tuo ristorante Tako</p>
            </div>
            <ErrorBox />
            {needVerify ? (
              <div className="px-4 py-4 rounded-xl border-2 mb-2" style={{ borderColor: 'var(--sun)', background: '#FFF8E8' }}>
                <p className="text-[14px] font-bold mb-3" style={{ color: 'var(--ink)' }}>
                  La tua email non è ancora verificata. Controlla la posta o richiedi un nuovo link.
                </p>
                {resendDone ? (
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--ink-soft)' }}>
                    Se l'indirizzo esiste, ti abbiamo reinviato il link di verifica. ✓
                  </p>
                ) : (
                  <button type="button" onClick={resendVerification} disabled={loading} className="btn-coral w-full py-3 text-[15px]">
                    {loading ? 'Invio…' : 'Reinvia email di verifica'}
                  </button>
                )}
                <button type="button" onClick={() => { setNeedVerify(false); setResendDone(false); }} className="block w-full text-center mt-3 text-[13px] font-bold" style={linkStyle}>← Torna all'accesso</button>
              </div>
            ) : (
              <>
                <form onSubmit={submitLogin}>
                  <Label>Email</Label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@ristorante.it" className="w-full mb-4 px-4 py-3 rounded-xl border-2 font-semibold" style={fieldStyle} />
                  <Label>Password</Label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mb-2 px-4 py-3 rounded-xl border-2 font-semibold" style={fieldStyle} />
                  <div className="text-right mb-5">
                    <button type="button" onClick={() => switchView('forgot')} className="text-[13px] font-bold" style={linkStyle}>Password dimenticata?</button>
                  </div>
                  <button type="submit" disabled={loading} className="btn-coral w-full py-3.5 text-lg">{loading ? 'Accesso…' : 'Accedi →'}</button>
                </form>
                <OrDivider />
                <OAuthButtons disabled={loading} />
                <p className="text-center text-[14px] mt-5" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                  Non hai un account?{' '}
                  <button type="button" onClick={() => switchView('register')} className="font-bold" style={linkStyle}>Registrati ora</button>
                </p>
              </>
            )}
          </>
        )}

        {/* ——— REGISTER ——— */}
        {view === 'register' && (
          <>
            <div className="text-center mb-6">
              <img src="assets/tako-chef.png" alt="" className="w-20 h-20 mx-auto mb-3 logo-bob" style={{ objectFit: 'contain' }} />
              <h3 className="text-3xl mb-1" style={{ color: 'var(--ink)' }}>{done ? 'Controlla la tua email' : 'Registrati ora'}</h3>
              <p className="text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{done ? 'Ti abbiamo inviato un link di conferma' : '30 giorni di prova, senza carta'}</p>
            </div>
            {done ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full grid place-items-center text-3xl border-2" style={{ background: 'var(--coral-tint)', borderColor: 'var(--coral)', color: 'var(--coral-deep)', fontWeight: 900 }}>✉️</div>
                <p className="text-[15px] mb-6" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                  Abbiamo inviato un'email a <b style={{ color: 'var(--ink)' }}>{email}</b>. Apri il link per attivare il tuo account, poi accedi.
                </p>
                <button type="button" onClick={() => switchView('login')} className="btn-coral w-full py-3.5 text-lg">Torna all'accesso</button>
              </div>
            ) : (
              <>
                <ErrorBox />
                <form onSubmit={submitRegister}>
                  <Label>Nome del ristorante</Label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Trattoria da Mario" className="w-full mb-4 px-4 py-3 rounded-xl border-2 font-semibold" style={fieldStyle} />
                  <Label>Email</Label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@ristorante.it" className="w-full mb-4 px-4 py-3 rounded-xl border-2 font-semibold" style={fieldStyle} />
                  <Label>Password</Label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Almeno 10 caratteri" className="w-full mb-5 px-4 py-3 rounded-xl border-2 font-semibold" style={fieldStyle} />
                  <button type="submit" disabled={loading} className="btn-coral w-full py-3.5 text-lg">{loading ? 'Creazione…' : 'Crea il mio Tako →'}</button>
                </form>
                <OrDivider />
                <OAuthButtons disabled={loading} />
                <p className="text-center text-[14px] mt-5" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                  Hai già un account?{' '}
                  <button type="button" onClick={() => switchView('login')} className="font-bold" style={linkStyle}>Accedi</button>
                </p>
              </>
            )}
          </>
        )}

        {/* ——— FORGOT PASSWORD ——— */}
        {view === 'forgot' && (
          <>
            <div className="text-center mb-6">
              <img src="assets/tako-chef.png" alt="" className="w-20 h-20 mx-auto mb-3 logo-bob" style={{ objectFit: 'contain' }} />
              <h3 className="text-3xl mb-1" style={{ color: 'var(--ink)' }}>Password dimenticata</h3>
              <p className="text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                {done ? 'Controlla la tua posta' : 'Inserisci la tua email, ti inviamo il link'}
              </p>
            </div>
            {done ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full grid place-items-center text-3xl border-2" style={{ background: 'var(--coral-tint)', borderColor: 'var(--coral)', color: 'var(--coral-deep)', fontWeight: 900 }}>✓</div>
                <p className="text-[15px] mb-6" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Se l'email esiste, riceverai un link per reimpostare la password. Controlla la posta in arrivo.</p>
                <button type="button" onClick={() => switchView('login')} className="btn-coral w-full py-3.5 text-lg">Torna all'accesso</button>
              </div>
            ) : (
              <>
                <ErrorBox />
                <form onSubmit={submitForgot}>
                  <Label>Email</Label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@ristorante.it" className="w-full mb-5 px-4 py-3 rounded-xl border-2 font-semibold" style={fieldStyle} />
                  <button type="submit" disabled={loading} className="btn-coral w-full py-3.5 text-lg">{loading ? 'Invio…' : 'Invia il link →'}</button>
                </form>
                <p className="text-center text-[14px] mt-5" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                  <button type="button" onClick={() => switchView('login')} className="font-bold" style={linkStyle}>← Torna all'accesso</button>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
window.LoginModal = LoginModal;

/* ——— Banner globale: esiti redirect (?verified=1 / ?oauth_error=...) ——— */
function AuthBanner() {
  const [msg, setMsg] = useState(null); // { kind:'ok'|'err', text }
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    let next = null;
    if (qs.get('verified') === '1') {
      next = { kind: 'ok', text: 'Email verificata! Ora puoi accedere.' };
    } else if (qs.has('oauth_error')) {
      const code = qs.get('oauth_error') || '1';
      next = { kind: 'err', text: OAUTH_ERROR_IT[code] || OAUTH_ERROR_IT['1'] };
    }
    if (!next) return;
    setMsg(next);
    // Ripulisce i query param dall'URL senza ricaricare (evita ri-trigger al refresh).
    try {
      qs.delete('verified'); qs.delete('oauth_error');
      const clean = window.location.pathname + (qs.toString() ? '?' + qs.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
    } catch (_) {}
    const t = setTimeout(() => setMsg(null), 9000);
    return () => clearTimeout(t);
  }, []);
  if (!msg) return null;
  const ok = msg.kind === 'ok';
  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 z-[200] -translate-x-1/2 px-5 py-3.5 rounded-2xl border-2 font-bold text-[15px] flex items-center gap-3 pop-in max-w-[92vw]"
      style={{ borderColor: 'var(--ink)', background: ok ? '#E8F4ED' : '#FFF1ED', color: 'var(--ink)', boxShadow: '4px 4px 0 var(--ink)' }}
    >
      <span aria-hidden="true">{ok ? '✓' : '⚠️'}</span>
      <span>{msg.text}</span>
      <button onClick={() => setMsg(null)} aria-label="Chiudi" className="ml-1 text-lg leading-none" style={{ color: 'var(--ink-soft)', fontWeight: 900 }}>×</button>
    </div>
  );
}
window.AuthBanner = AuthBanner;

function Navbar({ page, setPage }) {
  const [scrolled, setScrolled] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // Stato sessione: se /api/auth/me risponde ok l'utente è loggato → mostriamo
  // l'avatar a cerchio (iniziale del ristorante) al posto della scritta "Accedi".
  const [owner, setOwner] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    const api = window.TakoAPI;
    if (!api) return;
    api.apiGet('/api/auth/me')
      .then((res) => { if (alive && res && res.ok && res.data && res.data.owner) setOwner(res.data.owner); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = () => setMenuOpen(false);
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [menuOpen]);
  const logout = async () => {
    try { await window.TakoAPI.apiPost('/api/auth/logout', {}); } catch (_) {}
    setOwner(null); setMenuOpen(false);
    window.location.reload();
  };
  const ownerInitial = owner && owner.name ? owner.name.trim().charAt(0).toUpperCase() : '·';
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setScrolled(y > 30);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, []);
  const links = [
    { id: 'home', label: 'Home', icon: 'assets/nav/nav-home.png', anim: 'nav-bounce' },
    { id: 'how', label: 'Come funziona', icon: 'assets/nav/nav-how.png', anim: 'nav-wiggle' },
    { id: 'restaurant', label: 'Lato ristoratore', icon: 'assets/nav/nav-restaurant.png', anim: 'nav-tilt' },
    { id: 'customer', label: 'Lato cliente', icon: 'assets/nav/nav-customer.png', anim: 'nav-swing' },
  ];
  // Cross-page aware: sulla landing setPage gestisce il routing SPA; sulle altre
  // pagine setPage è assente e i link navigano alla landing con ?page=<id>.
  const LANDING = 'Tako%20Landing.html';
  const hrefFor = (id) => id === 'home' ? LANDING : (LANDING + '?page=' + id);
  const go = (id) => (e) => {
    if (typeof setPage === 'function') {
      e.preventDefault();
      setPage(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // altrimenti lascia che l'<a href> navighi alla landing
  };
  return (
    <>
    <header className={`tnav fixed top-0 inset-x-0 z-50 ${scrolled ? 'tnav-scrolled' : ''}`}>
      <div className="tnav-inner mx-auto flex items-center justify-between">
        <a href={hrefFor('home')} onClick={go('home')} className="cursor-pointer"><TakoLogo collapseWord={scrolled} /></a>
        <nav className="hidden md:flex items-end gap-1 font-bold text-[14px]">
          {links.map((l) => (
            <a
              key={l.id}
              href={hrefFor(l.id)}
              onClick={go(l.id)}
              className={`tnav-link ${page === l.id ? 'is-active' : ''}`}
            >
              <span className="tnav-ico-wrap"><img src={l.icon} alt="" className={`tnav-ico ${l.anim}`} /></span>
              <span className="tnav-label">{l.label}</span>
              <span className="tnav-underline" />
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {owner ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label="Il tuo account"
                onClick={() => setMenuOpen((v) => !v)}
                className="w-10 h-10 rounded-full border-2 grid place-items-center font-display font-black text-[17px] cursor-pointer select-none"
                style={{ background: 'var(--coral)', borderColor: 'var(--ink)', color: '#fff' }}
              >
                {ownerInitial}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border-2 shadow-xl overflow-hidden" style={{ background: '#FFFDFB', borderColor: 'var(--ink)' }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(42,31,26,.12)' }}>
                    <div className="font-bold text-[14px] truncate" style={{ color: 'var(--ink)' }}>{owner.name || 'Il tuo ristorante'}</div>
                    <div className="text-[12px] truncate" style={{ color: 'var(--ink-soft)' }}>{owner.email}</div>
                  </div>
                  <button type="button" onClick={logout} className="w-full text-left px-4 py-3 text-[14px] font-bold cursor-pointer hover:opacity-80" style={{ color: 'var(--coral-deep)' }}>Esci</button>
                </div>
              )}
            </div>
          ) : (
            <a href="#" onClick={(e) => { e.preventDefault(); setLoginOpen(true); }} className="tnav-accedi hidden md:inline-block font-bold text-[15px] cursor-pointer">Accedi</a>
          )}
          <a href="Tako%20Landing.html#cta" className="btn-coral px-5 py-2.5 text-[14px]">Contattaci</a>
        </div>
      </div>
    </header>
    <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    <AuthBanner />
    </>
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
            <a href="#cta" onClick={(e) => { e.preventDefault(); const el = document.getElementById('cta'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }} className="btn-coral px-8 py-4 text-lg inline-flex items-center gap-2">
              Prova gratis 30 giorni
              <span aria-hidden>→</span>
            </a>
            <a href="Tako%20Demo.html" className="btn-ghost px-8 py-4 text-lg">Guarda la demo</a>
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
    <section id="features" className="relative py-16 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="chip mb-5 reveal">Perché Tako</span>
          <h2 className="text-5xl md:text-6xl reveal">Quattro pinze. <span className="grad-text">Mille soluzioni.</span></h2>
          <p className="text-lg md:text-xl mt-4 max-w-2xl mx-auto reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
            Tutto quello che serve al tuo ristorante in un unico posto. Senza pagare 4 abbonamenti diversi.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {cards.map((c, i) => (
            <div key={i} className="chunky p-4 md:p-7 hover-rise reveal-pop" style={{ transitionDelay: `${i*0.08}s` }}>
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl grid place-items-center text-2xl md:text-3xl mb-3 md:mb-5 border-2" style={{ background: c.color, borderColor: 'var(--ink)' }}>
                {c.icon}
              </div>
              <h3 className="text-lg md:text-2xl mb-1.5 md:mb-2 leading-tight">{c.title}</h3>
              <p className="text-[13px] md:text-[15px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{c.desc}</p>
              <a href="#" className="mt-3 md:mt-5 inline-flex items-center gap-1 font-bold text-[13px] md:text-sm" style={{ color: 'var(--coral-deep)' }}>
                Scopri di più <span aria-hidden>→</span>
              </a>
            </div>
          ))}
        </div>

        {/* Connecting tentacle SVG decoration */}
        <svg className="hidden lg:block absolute left-1/2 -translate-x-1/2 bottom-2 w-[800px] pointer-events-none" viewBox="0 0 800 120">
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

/* ——— Scroll-pinned card stack: un riquadro alla volta; scrollando i riquadri
   escono verso l'alto e arriva il successivo (animazione guidata dallo scroll) ——— */
function ScrollCardStack({ id, header, items, renderCard, accent, cardVh = 88 }) {
  const sectionRef = useRef(null);
  const cardRefs = useRef([]);
  const dotRefs = useRef([]);
  const n = items.length;
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const total = Math.max(section.offsetHeight - vh, 1);
      const top = section.getBoundingClientRect().top;
      const scrolled = Math.min(Math.max(-top, 0), total);
      const progress = scrolled / total;            // 0..1
      const focus = progress * (n - 1);             // 0..n-1
      const active = Math.round(focus);
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = focus - i;                        // <0 in arrivo, >0 già uscito
        const ty = -d * 60;                         // vh
        const op = Math.max(0, Math.min(1, 1.4 - Math.abs(d) * 1.85));
        const sc = 1 - 0.1 * Math.min(Math.abs(d), 1.3);
        const rot = Math.max(-6, Math.min(6, d * -4));
        el.style.transform = `translate3d(0, ${ty}vh, 0) scale(${sc.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
        el.style.pointerEvents = Math.abs(d) < 0.5 ? 'auto' : 'none';
      });
      dotRefs.current.forEach((el, i) => {
        if (!el) return;
        el.style.opacity = i === active ? '1' : '0.28';
        el.style.transform = i === active ? 'scale(1.35)' : 'scale(1)';
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [n]);
  return (
    <section ref={sectionRef} id={id} className="relative px-6" style={{ height: `${n * cardVh + 24}vh` }}>
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center" style={{ clipPath: 'inset(0 -100vw)' }}>
        {header && <div className="text-center mb-6 md:mb-10 px-2 shrink-0">{header}</div>}
        <div className="relative w-full shrink-0" style={{ height: 'min(60vh, 540px)' }}>
          <div className="absolute inset-0 grid place-items-center">
            {items.map((it, i) => (
              <div key={i} ref={(el) => (cardRefs.current[i] = el)} style={{ gridArea: '1 / 1', width: '100%', willChange: 'transform, opacity' }}>
                {renderCard(it, i)}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2.5 mt-7 shrink-0">
          {items.map((_, i) => (
            <span key={i} ref={(el) => (dotRefs.current[i] = el)} className="w-2.5 h-2.5 rounded-full" style={{ background: accent || 'var(--coral)', transition: 'opacity .3s ease, transform .3s ease' }} />
          ))}
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
    <ScrollCardStack
      id="how"
      header={(
        <>
          <span className="chip mb-4">Come funziona</span>
          <h2 className="text-4xl md:text-6xl">Tre passi. <span className="grad-text">Zero stress.</span></h2>
        </>
      )}
      items={steps}
      renderCard={(s) => (
        <div className="chunky p-6 md:p-12 max-w-md md:max-w-xl mx-auto text-center" style={{ background: '#fff' }}>
          <div className="step-num mx-auto mb-4 md:mb-5">{s.n}</div>
          <img src={s.mascot} alt={s.alt} className="mascot w-28 md:w-40 mx-auto mb-4 float-y" />
          <h3 className="text-2xl md:text-4xl mb-2 md:mb-3">{s.title}</h3>
          <p className="text-[15px] md:text-lg" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{s.desc}</p>
        </div>
      )}
    />
  );
}

window.TakoLogo = TakoLogo;
window.OrDivider = OrDivider;
window.Navbar = Navbar;
window.Hero = Hero;
window.TrustTape = TrustTape;
window.Features = Features;
window.MenuSmart = MenuSmart;
window.HowItWorks = HowItWorks;
window.ScrollCardStack = ScrollCardStack;
window.useReveal = useReveal;
