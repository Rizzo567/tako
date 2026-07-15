// Shell desktop Tako (Tauri 2). Modello AIKE: aprendo l'app si avvia il server Tako
// come processo FIGLIO, la finestra carica la dashboard, e alla chiusura il server
// viene terminato. Nessun daemon: vive quanto la finestra.
//
// Risoluzione del comando server (in ordine di priorità):
//  1. env TAKO_SERVER_CMD  — comando esplicito (dev: es. "node_modules/.bin/tsx src/index.ts")
//     + TAKO_SERVER_CWD per la working dir.
//  2. bundle: node + server impacchettati come risorsa Tauri "server/index.js" (F4).
// Porta e flag DB embedded sono passati via env al figlio.

use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

/// Porta su cui il server Tako serve API + Socket.io + dashboard. Fissa e inusuale
/// per ridurre i conflitti su una macchina ristorante.
const TAKO_PORT: &str = "4317";

/// Porta dell'app CLIENTE (Next standalone): i telefoni la raggiungono via QR
/// sulla LAN (http://<IP-Mac>:3002/...). Coerente con CLIENT_PORT lato server.
const WEB_PORT: &str = "3002";

/// Su Windows impedisce che lo spawn di un processo console (node.exe, taskkill)
/// faccia lampeggiare una finestra nera davanti all'utente. No-op altrove.
fn no_console_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: nessuna finestra console per il figlio.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd; // niente da fare fuori da Windows
    }
}

/// (Windows) Rimuove il prefisso "verbatim"/extended-length `\\?\` da un path.
/// `resource_dir()` di Tauri su Windows restituisce path estesi tipo
/// `\\?\C:\Users\...\resources\server`. Passato come argv a `node.exe`, il
/// resolver del main-module di Node (v22) NON gestisce quel prefisso e riduce il
/// path alla sola radice `C:`, facendo fallire l'avvio del server embedded con
/// `EISDIR: illegal operation on a directory, lstat 'C:'` — quindi niente API su
/// :4317 e app inutilizzabile. Normalizziamo prima di spawnare i figli Node.
/// No-op fuori da Windows e per path senza prefisso.
fn deverbatim(p: std::path::PathBuf) -> std::path::PathBuf {
    #[cfg(windows)]
    {
        if let Some(s) = p.to_str() {
            if let Some(rest) = s.strip_prefix(r"\\?\") {
                return std::path::PathBuf::from(rest);
            }
        }
    }
    p
}

/// Token per-lancio che autorizza la richiesta interna di shutdown ordinato
/// (`POST /internal/shutdown`). Gira solo su localhost: non è materiale di
/// sicurezza forte, basta che sia imprevedibile per lancio. Deriva da orologio
/// ad alta risoluzione + PID, generato una volta sola e condiviso col figlio via
/// env `TAKO_SHUTDOWN_TOKEN`.
static SHUTDOWN_TOKEN: OnceLock<String> = OnceLock::new();

fn shutdown_token() -> &'static str {
    SHUTDOWN_TOKEN.get_or_init(|| {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        format!("{:x}{:x}", nanos, std::process::id())
    })
}

/// Stato di supervisione dei processi figli (API server + web cliente).
///
/// Ogni figlio ha un thread-watchdog dedicato che lo possiede e ne attende
/// l'uscita: se muore in modo inatteso lo riavvia con backoff. Qui teniamo solo
/// ciò che serve alla chiusura volontaria: il flag `shutting_down` (che dice ai
/// watchdog di NON riavviare più) e, per ogni figlio, un `AtomicU32` col PID
/// corrente (aggiornato a ogni respawn) per killarne il gruppo, più il
/// JoinHandle del watchdog per attenderne lo spegnimento pulito.
struct Supervisor {
    /// Alzato quando l'app chiude di proposito: distingue lo shutdown volontario
    /// da un crash, così i watchdog escono invece di riavviare.
    shutting_down: Arc<AtomicBool>,
    /// PID correnti dei processi supervisionati (0 = nessuno / watchdog arreso).
    pids: Mutex<Vec<Arc<AtomicU32>>>,
    /// Handle dei thread-watchdog, per attenderne l'uscita alla chiusura.
    threads: Mutex<Vec<std::thread::JoinHandle<()>>>,
    /// (Windows) Stesso Arc del PID-slot del server (proprietario di Postgres):
    /// il watchdog lo azzera quando il server esce da solo, così la chiusura sa
    /// attendere lo shutdown ordinato prima del fallback taskkill. 0 = non avviato.
    #[cfg(windows)]
    server_pid: Arc<AtomicU32>,
}

/// Termina l'intero gruppo/albero di processi di `pid` (node + il Postgres che
/// ha generato), coerente su unix e windows. È la STESSA semantica usata dalla
/// chiusura volontaria: su unix SIGTERM al gruppo (`-pid`, spegnimento pulito),
/// su windows `taskkill /T` sull'albero (un semplice kill lascerebbe Postgres
/// orfano a bloccare la data dir).
fn kill_group(pid: u32) {
    if pid == 0 {
        return;
    }
    #[cfg(unix)]
    {
        // -pid = tutto il gruppo di processi (es. node + postgres)
        unsafe { libc::kill(-(pid as i32), libc::SIGTERM) };
    }
    #[cfg(not(unix))]
    {
        let mut c = Command::new("taskkill");
        c.args(["/F", "/T", "/PID", &pid.to_string()]);
        no_console_window(&mut c);
        let _ = c.status();
    }
}

/// (Windows) Chiede al server, via HTTP grezzo su localhost, uno shutdown
/// ORDINATO: il lato node chiude Postgres in modo pulito e rilascia la data dir
/// prima di uscire, evitando il `taskkill` duro (che lascerebbe il cluster in
/// stato sporco). Best-effort con timeout corti: se fallisce, il chiamante
/// ripiega comunque sul taskkill dell'albero.
#[cfg(windows)]
fn request_server_shutdown() {
    use std::io::{Read, Write};
    use std::net::TcpStream;

    let addr: std::net::SocketAddr = match format!("127.0.0.1:{TAKO_PORT}").parse() {
        Ok(a) => a,
        Err(_) => return,
    };
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("shutdown ordinato: connessione fallita ({e}), userò taskkill");
            return;
        }
    };
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let req = format!(
        "POST /internal/shutdown HTTP/1.1\r\n\
         Host: 127.0.0.1:{TAKO_PORT}\r\n\
         x-tako-shutdown-token: {}\r\n\
         content-length: 0\r\n\
         connection: close\r\n\r\n",
        shutdown_token()
    );
    if let Err(e) = stream.write_all(req.as_bytes()) {
        log::warn!("shutdown ordinato: invio richiesta fallito ({e}), userò taskkill");
        return;
    }
    let _ = stream.flush();
    // Leggiamo (best-effort) la risposta: conferma che il server l'ha presa.
    let mut buf = [0u8; 256];
    let _ = stream.read(&mut buf);
    log::info!("shutdown ordinato richiesto al server su porta {TAKO_PORT}");
}

/// Avvia il watchdog di un processo figlio in un thread dedicato che ne possiede
/// il `Child`. Attende l'uscita del processo: se avviene durante lo shutdown
/// volontario (flag alzato) esce in silenzio; altrimenti è un crash e lo riavvia
/// con backoff crescente (1s, 2s, 5s) fino a un tetto di `MAX_RESTARTS` restart
/// in una finestra scorrevole di 60s, oltre il quale si arrende e logga un
/// errore chiaro (il servizio resta giù finché Manuel non riavvia l'app).
///
/// `respawn` è la funzione di (ri)avvio del figlio (es. `spawn_server`), invocata
/// col `AppHandle` per ricreare il processo con lo stesso ambiente.
fn supervise(
    name: &'static str,
    app: tauri::AppHandle,
    shutting_down: Arc<AtomicBool>,
    pid_slot: Arc<AtomicU32>,
    mut child: Child,
    respawn: fn(&tauri::AppHandle) -> Option<Child>,
) -> std::thread::JoinHandle<()> {
    /// Massimo numero di restart tollerati nella finestra prima di arrendersi.
    const MAX_RESTARTS: usize = 5;
    /// Finestra scorrevole su cui contare i restart.
    const WINDOW: Duration = Duration::from_secs(60);
    /// Backoff (secondi) tra i tentativi, per indice di tentativo nella finestra.
    const BACKOFF: [u64; 3] = [1, 2, 5];

    std::thread::spawn(move || {
        // Timestamp dei restart ancora dentro la finestra scorrevole.
        let mut restart_times: Vec<Instant> = Vec::new();

        loop {
            // Attende l'uscita del processo corrente (blocca finché vive).
            let status = child.wait();

            // Uscita durante lo shutdown volontario: nessun riavvio. Azzera il
            // PID così la chiusura sa che il figlio è uscito DA SOLO (su Windows
            // segnala che lo shutdown ordinato di Postgres è andato a buon fine,
            // evitando il fallback taskkill).
            if shutting_down.load(Ordering::SeqCst) {
                pid_slot.store(0, Ordering::SeqCst);
                return;
            }

            match status {
                Ok(s) => log::warn!("{name}: uscito in modo inatteso ({s}), riavvio in corso"),
                Err(e) => log::warn!("{name}: attesa del processo fallita ({e}), riavvio in corso"),
            }
            pid_slot.store(0, Ordering::SeqCst);

            // Riavvia con backoff finché ci riesce o supera il tetto. Ogni
            // tentativo (riuscito o no) conta nella finestra.
            let new_child = loop {
                let now = Instant::now();
                restart_times.retain(|t| now.duration_since(*t) < WINDOW);
                if restart_times.len() >= MAX_RESTARTS {
                    log::error!(
                        "{name}: superato il tetto di {MAX_RESTARTS} restart in {}s — mi arrendo. \
                         Il servizio resta giù: riavvia l'app Tako manualmente.",
                        WINDOW.as_secs()
                    );
                    return;
                }

                let delay = BACKOFF[restart_times.len().min(BACKOFF.len() - 1)];
                std::thread::sleep(Duration::from_secs(delay));

                // L'app potrebbe aver chiuso durante il backoff.
                if shutting_down.load(Ordering::SeqCst) {
                    return;
                }

                restart_times.push(Instant::now());
                match respawn(&app) {
                    Some(c) => {
                        log::warn!(
                            "{name}: riavviato (pid {}) — tentativo {}/{} nella finestra di {}s",
                            c.id(),
                            restart_times.len(),
                            MAX_RESTARTS,
                            WINDOW.as_secs()
                        );
                        break c;
                    }
                    None => log::error!("{name}: respawn fallito, nuovo tentativo dopo backoff"),
                }
            };

            pid_slot.store(new_child.id(), Ordering::SeqCst);
            child = new_child;

            // Chiusura avvenuta DURANTE il respawn (race con lo shutdown volontario):
            // uccidi il figlio appena creato ed esci, così il join in chiusura non
            // resta appeso su un processo che nessuno killerebbe.
            if shutting_down.load(Ordering::SeqCst) {
                kill_group(child.id());
                let _ = child.wait();
                // Azzera il PID-slot come su ogni altra uscita: chi chiude aspetta
                // che diventi 0 per sapere che il figlio è uscito. Lasciarlo pieno
                // gli farebbe consumare l'intero timeout (8s) per nulla — e ora quel
                // timeout ritarderebbe anche l'installazione di un aggiornamento.
                pid_slot.store(0, Ordering::SeqCst);
                return;
            }
        }
    })
}

fn spawn_server(app: &tauri::AppHandle) -> Option<Child> {
    let cmd_str = std::env::var("TAKO_SERVER_CMD").ok();
    let cwd = std::env::var("TAKO_SERVER_CWD").ok();

    let mut command = match cmd_str {
        Some(line) => {
            // DEV: "programma arg1 arg2 ..." iniettato dallo script `desktop`
            // (es. node_modules/.bin/tsx src/bootstrap.ts), eseguito in TAKO_SERVER_CWD.
            let mut parts = line.split_whitespace();
            let prog = parts.next().unwrap_or("node").to_string();
            let mut c = Command::new(prog);
            for a in parts {
                c.arg(a);
            }
            c
        }
        None => {
            // BUNDLE: node impacchettato + server.mjs dalle risorse (F4).
            let res = app.path().resource_dir().ok()?;
            // deverbatim: senza questo, su Windows node riceve `\\?\C:\...\server.mjs`
            // e fallisce con `EISDIR lstat 'C:'` (vedi commento su `deverbatim`).
            let server_dir = deverbatim(res.join("resources").join("server"));
            let node_bin = server_dir.join(if cfg!(windows) { "node.exe" } else { "node" });
            let mut c = Command::new(node_bin);
            c.arg(server_dir.join("server.mjs"));
            c
        }
    };

    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    // Gruppo di processi dedicato: così alla chiusura possiamo terminare insieme
    // node E il Postgres che ha generato (evita Postgres orfani che bloccano la
    // data dir al riavvio).
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    // Su Windows: nessuna finestra console per node.exe.
    no_console_window(&mut command);
    command
        .env("EMBEDDED_DB", "1")
        .env("PORT", TAKO_PORT)
        .env("NODE_ENV", "production")
        // Token per-lancio per la richiesta interna di shutdown ordinato.
        .env("TAKO_SHUTDOWN_TOKEN", shutdown_token());

    // Dati scrivibili (DB, upload, segreto) in app-data LOCALE utente, fuori dal
    // bundle. Locale (non Roaming su Windows): il cluster Postgres NON deve
    // finire in una cartella sincronizzata (OneDrive) che ne locka i file. Su
    // mac/linux il path resta identico ad app_data_dir.
    if let Ok(data) = app.path().app_local_data_dir() {
        let _ = std::fs::create_dir_all(&data);
        command
            .env("TAKO_HOME", &data)
            .env("PGDATA_DIR", data.join("pgdata"))
            .env("UPLOADS_DIR", data.join("uploads"));
    }

    match command.spawn() {
        Ok(child) => {
            log::info!("server Tako avviato (pid {}) su porta {}", child.id(), TAKO_PORT);
            Some(child)
        }
        Err(e) => {
            log::error!("impossibile avviare il server Tako: {e}");
            None
        }
    }
}

/// Avvia l'app CLIENTE (Next standalone) come 2º processo figlio sulla porta 3002,
/// così i telefoni aprono il menu via QR sulla LAN. Solo in modalità BUNDLE: in dev
/// (TAKO_SERVER_CMD impostato) il web si avvia a parte con `pnpm dev`.
fn spawn_web(app: &tauri::AppHandle) -> Option<Child> {
    if std::env::var("TAKO_SERVER_CMD").is_ok() {
        return None;
    }
    let res = app.path().resource_dir().ok()?;
    // deverbatim: come per il server, evita `\\?\C:\...` che rompe l'avvio Node.
    let web_root = deverbatim(res.join("resources").join("web"));
    let node_bin = deverbatim(res.join("resources").join("server"))
        .join(if cfg!(windows) { "node.exe" } else { "node" });
    let entry = web_root.join("apps").join("web").join("server.js");
    if !entry.exists() {
        log::error!("web cliente: server.js mancante ({:?})", entry);
        return None;
    }
    let mut command = Command::new(node_bin);
    command.arg(&entry).current_dir(&web_root);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    // Su Windows: nessuna finestra console per node.exe.
    no_console_window(&mut command);
    command
        .env("PORT", WEB_PORT)
        .env("HOSTNAME", "0.0.0.0")
        .env("NODE_ENV", "production")
        .env("NEXT_PUBLIC_API_URL", format!("http://127.0.0.1:{TAKO_PORT}"));

    match command.spawn() {
        Ok(child) => {
            log::info!("web cliente avviato (pid {}) su porta {}", child.id(), WEB_PORT);
            Some(child)
        }
        Err(e) => {
            log::error!("impossibile avviare il web cliente: {e}");
            None
        }
    }
}

/// Termina con GRAZIA i figli (server + web) e attende i watchdog.
///
/// Su unix: SIGTERM al gruppo di ciascun figlio (node + Postgres, spegnimento pulito).
/// Su Windows: prima si chiede al server uno shutdown ORDINATO via HTTP (così il lato
/// node ferma Postgres e rilascia la data dir), gli si dà tempo di uscire, e solo in
/// fallback si abbatte l'albero con taskkill. Nota: su Windows il `taskkill /T` da solo
/// NON basterebbe a fermare Postgres, che è figlio di `pg_ctl` (già uscito) e quindi
/// fuori dall'albero di node: è lo shutdown ordinato a fermarlo.
///
/// Idempotente: alla seconda chiamata i PID-slot sono già a 0 (`kill_group` è un no-op)
/// e i JoinHandle sono già stati presi (nessun join). Serve perché la chiamiamo sia
/// alla chiusura volontaria sia PRIMA di installare un aggiornamento.
fn teardown_children(app: &tauri::AppHandle) {
    let sup = app.state::<Supervisor>();
    // 1) Segnala lo shutdown volontario PRIMA di killare: quando i watchdog vedranno
    //    i figli uscire NON li riavvieranno (crash vs. chiusura).
    sup.shutting_down.store(true, Ordering::SeqCst);

    // 2) Termina i figli.
    #[cfg(not(windows))]
    {
        // unix: SIGTERM al gruppo di ogni figlio col suo PID corrente.
        let pids: Vec<u32> = sup
            .pids
            .lock()
            .unwrap()
            .iter()
            .map(|p| p.load(Ordering::SeqCst))
            .collect();
        for pid in pids {
            kill_group(pid);
        }
    }
    #[cfg(windows)]
    {
        // Chiedi al server uno shutdown ordinato (chiude Postgres pulito).
        request_server_shutdown();
        // Attendi che il server esca DA SOLO: il suo watchdog azzera il PID-slot
        // quando lo vede uscire. Poll ogni 200ms fino a max 8s.
        let deadline = Instant::now() + Duration::from_secs(8);
        while sup.server_pid.load(Ordering::SeqCst) != 0 && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(200));
        }
        // Fallback (server non uscito in tempo) + web cliente (senza endpoint di
        // shutdown): abbatti l'albero di ogni figlio ancora vivo. Un PID a 0 rende
        // kill_group un no-op.
        let pids: Vec<u32> = sup
            .pids
            .lock()
            .unwrap()
            .iter()
            .map(|p| p.load(Ordering::SeqCst))
            .collect();
        for pid in pids {
            kill_group(pid);
        }
    }

    // 3) Attendi che i watchdog escano: ognuno fa child.wait() sul proprio figlio,
    //    quindi il join garantisce lo spegnimento pulito (Postgres rilascia la data
    //    dir) prima che il chiamante prosegua.
    let threads = std::mem::take(&mut *sup.threads.lock().unwrap());
    for t in threads {
        let _ = t.join();
    }
}

/// Controlla all'avvio se c'è un aggiornamento (latest.json su Cloudflare, firma
/// minisign verificata dal pubkey in tauri.conf). Se sì, chiede all'owner e — su
/// conferma — scarica, installa e riavvia. Non blocca l'avvio: gira in un task
/// async e ogni errore (rete giù, endpoint assente) viene solo loggato.
fn spawn_update_check(app: &tauri::AppHandle) {
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let updater = match handle.updater() {
            Ok(u) => u,
            Err(e) => {
                log::warn!("updater non disponibile: {e}");
                return;
            }
        };
        match updater.check().await {
            Ok(Some(update)) => {
                let ver = update.version.clone();
                log::info!("aggiornamento disponibile: {ver}");
                let install = handle
                    .dialog()
                    .message(format!(
                        "È disponibile l'aggiornamento {ver} di Tako. Installarlo e riavviare ora?\n\nConsiglio: fallo a servizio chiuso."
                    ))
                    .title("Aggiornamento Tako")
                    .buttons(MessageDialogButtons::OkCancelCustom(
                        "Installa e riavvia".into(),
                        "Più tardi".into(),
                    ))
                    .blocking_show();
                if install {
                    // Download e install sono SEPARATI di proposito (invece di
                    // download_and_install): tra i due dobbiamo fermare i figli.
                    // Il download è la parte lenta (rete) e qui l'app è ancora
                    // pienamente funzionante: il servizio non si ferma per scaricare.
                    let bytes = match update.download(|_, _| {}, || {}).await {
                        Ok(b) => b,
                        Err(e) => {
                            log::error!("download aggiornamento fallito: {e}");
                            return;
                        }
                    };
                    // L'installer deve SOVRASCRIVERE i binari dentro resources/
                    // (node.exe, le DLL di Postgres…). Se i figli sono ancora vivi
                    // quei file sono LOCKATI e su Windows l'installer NSIS si pianta
                    // su "Error opening file for writing: …\resources\server\node.exe"
                    // (Abort/Retry/Ignore) → installazione MISTA: app.exe nuovo,
                    // resources vecchie. `install()` non passa dal
                    // RunEvent::ExitRequested (il processo non esce dall'event loop),
                    // quindi il teardown va fatto qui a mano.
                    teardown_children(&handle);
                    if let Err(e) = update.install(bytes) {
                        // Su Windows si arriva qui solo se l'installer non è nemmeno
                        // partito (es. scrittura in temp fallita): a spawn avvenuto
                        // `install()` fa `std::process::exit(0)` e non torna mai.
                        // I figli sono già fermi, quindi l'app è senza backend:
                        // riavviamo per tornare a una versione funzionante invece di
                        // restare a metà. Nota: al riavvio il check ripropone il
                        // dialog; se l'install continua a fallire l'owner se lo vede
                        // a ogni avvio finché non sceglie "Più tardi".
                        log::error!("installazione aggiornamento fallita: {e}, riavvio");
                        handle.restart();
                        return;
                    }
                    // Windows: irraggiungibile — `install()` esce dal processo e sarà
                    // NSIS a rilanciare l'app. macOS: `install()` torna e riavviamo noi.
                    log::info!("aggiornamento installato, riavvio");
                    handle.restart();
                }
            }
            Ok(None) => log::info!("Tako è aggiornato"),
            Err(e) => log::warn!("controllo aggiornamenti fallito: {e}"),
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // DEVE essere il PRIMO plugin: se l'app è già aperta, la 2ª istanza esce
        // subito (prima di avviare un 2º server/Postgres sullo stesso pgdata, che
        // corromperebbe i dati) e porta in primo piano la finestra esistente.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Flag condiviso di shutdown volontario: i watchdog lo leggono per
            // distinguere una chiusura voluta da un crash.
            let shutting_down = Arc::new(AtomicBool::new(false));
            let mut pids: Vec<Arc<AtomicU32>> = Vec::new();
            let mut threads: Vec<std::thread::JoinHandle<()>> = Vec::new();
            // (Windows) PID-slot del server, condiviso col Supervisor per attendere
            // lo shutdown ordinato di Postgres alla chiusura.
            #[cfg(windows)]
            let mut server_pid: Arc<AtomicU32> = Arc::new(AtomicU32::new(0));

            // Ogni figlio parte una volta qui e poi è tenuto in vita dal suo
            // watchdog: se crasha a metà servizio viene riavviato da solo.
            if let Some(child) = spawn_server(app.handle()) {
                let slot = Arc::new(AtomicU32::new(child.id()));
                #[cfg(windows)]
                {
                    server_pid = slot.clone();
                }
                threads.push(supervise(
                    "server Tako",
                    app.handle().clone(),
                    shutting_down.clone(),
                    slot.clone(),
                    child,
                    spawn_server,
                ));
                pids.push(slot);
            }
            if let Some(child) = spawn_web(app.handle()) {
                let slot = Arc::new(AtomicU32::new(child.id()));
                threads.push(supervise(
                    "web cliente",
                    app.handle().clone(),
                    shutting_down.clone(),
                    slot.clone(),
                    child,
                    spawn_web,
                ));
                pids.push(slot);
            }

            app.manage(Supervisor {
                shutting_down,
                pids: Mutex::new(pids),
                threads: Mutex::new(threads),
                #[cfg(windows)]
                server_pid,
            });

            // Controllo aggiornamenti in background (non blocca l'avvio).
            spawn_update_check(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        // Chiusura volontaria: spegni i figli con grazia (stesso teardown usato
        // prima di installare un aggiornamento).
        if let RunEvent::ExitRequested { .. } = event {
            teardown_children(app_handle);
        }
    });
}
