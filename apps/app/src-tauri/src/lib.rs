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
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

/// Porta su cui il server Tako serve API + Socket.io + dashboard. Fissa e inusuale
/// per ridurre i conflitti su una macchina ristorante.
const TAKO_PORT: &str = "4317";

/// Porta dell'app CLIENTE (Next standalone): i telefoni la raggiungono via QR
/// sulla LAN (http://<IP-Mac>:3002/...). Coerente con CLIENT_PORT lato server.
const WEB_PORT: &str = "3002";

/// Handle ai processi figli (API server + web cliente), terminati alla chiusura.
struct ServerChild(Mutex<Vec<Child>>);

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
            let server_dir = res.join("resources").join("server");
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
    command
        .env("EMBEDDED_DB", "1")
        .env("PORT", TAKO_PORT)
        .env("NODE_ENV", "production");

    // Dati scrivibili (DB, upload, segreto) in app-data utente, fuori dal bundle.
    if let Ok(data) = app.path().app_data_dir() {
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
    let web_root = res.join("resources").join("web");
    let node_bin = res
        .join("resources")
        .join("server")
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
        .manage(ServerChild(Mutex::new(Vec::new())))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let mut children: Vec<Child> = Vec::new();
            if let Some(c) = spawn_server(app.handle()) {
                children.push(c);
            }
            if let Some(c) = spawn_web(app.handle()) {
                children.push(c);
            }
            *app.state::<ServerChild>().0.lock().unwrap() = children;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        // Alla chiusura dell'app, termina con GRAZIA i gruppi dei figli: SIGTERM al
        // gruppo del server (node + Postgres, spegnimento pulito) e a quello del web.
        // Su non-unix, kill diretto.
        if let RunEvent::ExitRequested { .. } = event {
            let children: Vec<Child> = std::mem::take(
                &mut *app_handle.state::<ServerChild>().0.lock().unwrap(),
            );
            for mut child in children {
                #[cfg(unix)]
                {
                    let pid = child.id() as i32;
                    // -pid = tutto il gruppo di processi (es. node + postgres)
                    unsafe { libc::kill(-pid, libc::SIGTERM) };
                }
                #[cfg(not(unix))]
                {
                    let _ = child.kill();
                }
                // breve attesa per lo spegnimento pulito
                let _ = child.wait();
            }
        }
    });
}
