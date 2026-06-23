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

/// Handle al processo server, per poterlo terminare alla chiusura dell'app.
struct ServerChild(Mutex<Option<Child>>);

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .manage(ServerChild(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let child = spawn_server(app.handle());
            *app.state::<ServerChild>().0.lock().unwrap() = child;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        // Alla chiusura dell'app, termina con GRAZIA il gruppo del server: SIGTERM
        // a node + Postgres così node può fermare Postgres pulito (no orfani).
        // Su non-unix, kill diretto del figlio.
        if let RunEvent::ExitRequested { .. } = event {
            if let Some(mut child) = app_handle
                .state::<ServerChild>()
                .0
                .lock()
                .unwrap()
                .take()
            {
                #[cfg(unix)]
                {
                    let pid = child.id() as i32;
                    // -pid = tutto il gruppo di processi (node + postgres)
                    unsafe { libc::kill(-pid, libc::SIGTERM) };
                }
                #[cfg(not(unix))]
                {
                    let _ = child.kill();
                }
                // breve attesa per lo spegnimento pulito di Postgres
                let _ = child.wait();
            }
        }
    });
}
