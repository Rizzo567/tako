/* global React, TAKO_PAGES, PageHero, Band */
/* tako-pages-reset.jsx — pagina "Reimposta password" (router ?p=reset&token=...).
   Legge il token dalla query, mostra il form nuova password (policy min 10),
   chiama POST /api/auth/reset-password { token, password }. Gestisce
   successo / errore / token mancante o scaduto.
   SEC-013: la pagina che ospita questo componente imposta Referrer-Policy: no-referrer
   (meta nell'head di Tako Pagine.html) per non perdere il token nel referrer. */

const { useState: rS, useEffect: rE } = React;

function ResetPasswordPage() {
  const [token, setToken] = rS('');
  const [password, setPassword] = rS('');
  const [confirm, setConfirm] = rS('');
  const [loading, setLoading] = rS(false);
  const [error, setError] = rS('');
  const [done, setDone] = rS(false);
  const [invalid, setInvalid] = rS(false); // token assente/scaduto a priori

  rE(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    if (!t) { setInvalid(true); return; }
    setToken(t);
  }, []);

  const fieldStyle = { borderColor: 'rgba(42,31,26,.16)', background: '#FFFDFB' };
  const LANDING = (typeof window !== 'undefined' && window.LANDING_URL) || 'Tako%20Landing.html';

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (password.length < 10) { setError('La password deve avere almeno 10 caratteri.'); return; }
    if (password !== confirm) { setError('Le due password non coincidono.'); return; }
    const api = window.TakoAPI;
    if (!api) { setError('Servizio non disponibile. Riprova più tardi.'); return; }
    setLoading(true);
    const res = await api.apiPost('/api/auth/reset-password', { token, password });
    setLoading(false);
    if (res.ok) { setDone(true); return; }
    if (res.code === 'INVALID_TOKEN') {
      setInvalid(true);
      setError('Il link non è più valido o è scaduto. Richiedi un nuovo link dalla schermata di accesso.');
      return;
    }
    if (res.code === 'WEAK_PASSWORD') { setError('La password deve avere almeno 10 caratteri.'); return; }
    setError(res.error || 'Impossibile reimpostare la password. Riprova.');
  };

  return (
    <>
      <PageHero
        kicker="Account"
        title={<span>Reimposta la <span className="grad-text">password.</span></span>}
        sub="Scegli una nuova password per il tuo account Tako."
      />
      <Band tint="cream" narrow>
        <div className="chunky p-8 max-w-md mx-auto">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full grid place-items-center text-3xl border-2" style={{ background: 'var(--coral-tint)', borderColor: 'var(--coral)', color: 'var(--coral-deep)', fontWeight: 900 }}>✓</div>
              <h3 className="text-2xl mb-2" style={{ color: 'var(--ink)' }}>Password aggiornata!</h3>
              <p className="text-[15px] mb-6" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                Ora puoi accedere con la tua nuova password. Per sicurezza, le sessioni aperte sono state disconnesse.
              </p>
              <a href={LANDING} className="btn-coral inline-block px-7 py-3.5 text-lg">Vai all'accesso →</a>
            </div>
          ) : invalid ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full grid place-items-center text-3xl border-2" style={{ background: '#FFF1ED', borderColor: 'var(--coral-deep)', color: 'var(--coral-deep)', fontWeight: 900 }}>!</div>
              <h3 className="text-2xl mb-2" style={{ color: 'var(--ink)' }}>Link non valido</h3>
              <p className="text-[15px] mb-6" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                {error || 'Questo link di reset è mancante, già usato o scaduto. Richiedine uno nuovo dalla schermata di accesso.'}
              </p>
              <a href={LANDING} className="btn-coral inline-block px-7 py-3.5 text-lg">Torna all'accesso →</a>
            </div>
          ) : (
            <>
              <h3 className="text-2xl mb-1" style={{ color: 'var(--ink)' }}>Nuova password</h3>
              <p className="text-[14px] mb-6" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Almeno 10 caratteri.</p>
              {error && (
                <div role="alert" className="mb-4 px-4 py-3 rounded-xl border-2 text-[14px] font-semibold" style={{ borderColor: 'var(--coral-deep)', background: '#FFF1ED', color: 'var(--coral-deep)' }}>{error}</div>
              )}
              <form onSubmit={submit}>
                <label className="block text-[13px] font-bold mb-1" style={{ color: 'var(--ink)' }}>Nuova password</label>
                <input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Almeno 10 caratteri" className="w-full mb-4 px-4 py-3 rounded-xl border-2 font-semibold" style={fieldStyle} />
                <label className="block text-[13px] font-bold mb-1" style={{ color: 'var(--ink)' }}>Conferma password</label>
                <input type="password" required minLength={10} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ripeti la password" className="w-full mb-5 px-4 py-3 rounded-xl border-2 font-semibold" style={fieldStyle} />
                <button type="submit" disabled={loading} className="btn-coral w-full py-3.5 text-lg">{loading ? 'Salvataggio…' : 'Reimposta password →'}</button>
              </form>
            </>
          )}
        </div>
      </Band>
    </>
  );
}
window.ResetPasswordPage = ResetPasswordPage;

TAKO_PAGES['reset'] = {
  title: 'Reimposta password',
  render: () => <ResetPasswordPage />,
};
