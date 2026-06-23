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
            // "programma arg1 arg2 ..." — split su spazi (sufficiente per i nostri casi).
            let mut parts = line.split_whitespace();
            let prog = parts.next().unwrap_or("node").to_string();
            let mut c = Command::new(prog);
            for a in parts {
                c.arg(a);
            }
            c
        }
        None => {
            // Layout bundle (F4): risorsa "server/index.js" eseguita con node.
            // Finché il packaging non è pronto, senza TAKO_SERVER_CMD non si avvia nulla.
            match app.path().resource_dir() {
                Ok(dir) => {
                    let mut c = Command::new("node");
                    c.arg(dir.join("server").join("bootstrap.js"));
                    c
                }
                Err(_) => return None,
            }
        }
    };

    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    command
        .env("EMBEDDED_DB", "1")
        .env("PORT", TAKO_PORT)
        .env(
            "JWT_SECRET",
            std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "tako-local-dev-secret-change-me-please".into()),
        );

    match command.spawn() {
        Ok(child) => {
            log::info!(
                "server Tako avviato (pid {}) su porta {}",
                child.id(),
                TAKO_PORT
            );
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
        // Alla chiusura dell'app, termina il server figlio: niente processi orfani.
        if let RunEvent::ExitRequested { .. } = event {
            if let Some(mut child) = app_handle
                .state::<ServerChild>()
                .0
                .lock()
                .unwrap()
                .take()
            {
                let _ = child.kill();
            }
        }
    });
}
