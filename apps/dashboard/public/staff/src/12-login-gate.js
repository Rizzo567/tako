/* ───────────────── Tako Dashboard — Gate di accesso ─────────────────
   Avvolge la Login email/password (definita in 07) e le passa il modo runtime
   letto da /api/system/info (webMode → recupero password, registrazione).
   Espone window.LoginGate, così l'aggancio in 07 è UNA riga.                 */
function LoginGate({ onDone }) {
  const [runtime, setRuntime] = useState(null);
  useEffect(() => {
    let active = true;
    window.TakoActions.systemInfo().then(info => { if (active) setRuntime(info); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <Login onDone={onDone} webMode={runtime?.mode === "web"} registrationAllowed={!!runtime && runtime.registrationEnabled !== false} />
    </div>
  );
}

if (typeof window !== "undefined") { window.LoginGate = LoginGate; }
