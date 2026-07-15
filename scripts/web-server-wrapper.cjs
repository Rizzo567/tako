// Entry point del web CLIENTE nel bundle desktop (resources/web/apps/web/server.js).
// Il bundler rinomina il server.js generato da Next in server.next.js e mette questo
// file al suo posto: prima di cedere il controllo a Next, bonifica il web node ORFANO
// del run precedente, poi carica il server vero.
//
// Perché serve: se la shell Tauri muore per CRASH (non chiusura pulita), i figli node
// vengono reparentati e restano vivi. Il figlio SERVER si bonifica da solo in
// apps/server/src/bootstrap.ts (reclaimOrphanServer, via pidfile); il figlio WEB non
// aveva nessuna bonifica → l'orfano continuava a tenere :3002, il nuovo figlio moriva
// con EADDRINUSE e il watchdog si arrendeva dopo 5 tentativi. La PWA restava servita
// dall'orfano (quindi "sembrava" funzionare) ma nessuno lo supervisionava più e
// sopravviveva anche alla chiusura pulita dell'app.
//
// Qui NON usiamo un pidfile ma il proprietario reale della PORTA: è la domanda giusta
// ("chi tiene :3002?") e non ha il rischio PID-reuse di un pidfile stantio. Il kill
// parte solo dopo la verifica d'identità: la command line del proprietario deve
// contenere il path ESATTO di QUESTO file (l'orfano esegue lo stesso server.js che
// stiamo eseguendo noi → identità certa, non euristica). Un processo estraneo sulla
// porta non viene mai toccato (Next fallirà come prima, ed è corretto: non è roba
// nostra).
const { execFileSync } = require('node:child_process')

const PORT = parseInt(process.env.PORT, 10) || 3002
const IS_WIN = process.platform === 'win32'

/** Path normalizzato per confronto: separatori uniformi e, su Windows, case-insensitive. */
function normPath(p) {
  const s = String(p).replace(/\\/g, '/')
  return IS_WIN ? s.toLowerCase() : s
}

/** Identità di QUESTO server web: l'orfano esegue esattamente lo stesso file. */
const SELF = normPath(__filename)

/**
 * PID che tiene in LISTEN la porta, o null.
 * Su Windows usiamo netstat e NON PowerShell: l'avvio del runtime PS costa ~1.8s a
 * chiamata e questa funzione viene richiamata nel loop d'attesa del rilascio → con PS
 * si arrivava a decine di secondi di stallo (execFileSync blocca l'event loop e Next
 * non binda). netstat è un singolo exe nativo.
 */
function portOwnerPid(port) {
  try {
    if (IS_WIN) {
      const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', timeout: 5000, windowsHide: true })
      for (const line of out.split('\n')) {
        const f = line.trim().split(/\s+/)
        // TCP  <local>  <remote>  LISTENING  <pid>
        if (f.length < 5 || f[0] !== 'TCP' || !/^LISTENING$/i.test(f[3])) continue
        const local = f[1]
        if (parseInt(local.slice(local.lastIndexOf(':') + 1), 10) !== port) continue
        const pid = parseInt(f[4], 10)
        if (Number.isInteger(pid) && pid > 1) return pid
      }
      return null
    }
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8', timeout: 4000 }).trim()
    const pid = parseInt(out.split('\n')[0], 10)
    return Number.isInteger(pid) && pid > 1 ? pid : null
  } catch (e) {
    // Nessun listener (lsof esce 1) o strumento assente: in entrambi i casi non
    // possiamo bonificare. Distinguere non serve: il chiamante procede comunque.
    return null
  }
}

/**
 * Verifica d'identità: la command line di `pid` contiene il path esatto di questo
 * file? Solo allora è il NOSTRO web node. Un confronto a substring generica (es.
 * /server\.js/) colpirebbe anche `…/next/dist/server/lib/start-server.js` o il
 * server.js di un progetto altrui dell'utente.
 * `ps -ww` (unix): senza -ww BSD/macOS TRONCA gli args alla larghezza del terminale
 * e il nostro path (lungo, dentro Tako.app) sparirebbe → bonifica muta e inerte.
 */
function isOurWebProcess(pid) {
  try {
    if (IS_WIN) {
      const cmd = execFileSync(
        'powershell',
        ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select -Expand CommandLine`],
        { encoding: 'utf8', timeout: 8000, windowsHide: true },
      )
      return normPath(cmd).includes(SELF)
    }
    const out = execFileSync('ps', ['-ww', '-p', String(pid), '-o', 'args='], { encoding: 'utf8', timeout: 4000 })
    return normPath(out).includes(SELF)
  } catch (e) {
    console.log(`[web] verifica identità del pid ${pid} fallita (${e?.message ?? e}): non lo tocco`)
    return false
  }
}

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function reclaimOrphanWeb() {
  const pid = portOwnerPid(PORT)
  if (pid === null || pid === process.pid) return
  if (!isOurWebProcess(pid)) {
    console.log(`[web] :${PORT} è tenuta dal pid ${pid}, che non è il web Tako: non lo tocco`)
    return
  }
  console.log(`[web] web orfano precedente (pid ${pid}) tiene :${PORT}, lo termino`)
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    /* già morto */
  }
  for (let i = 0; i < 8 && alive(pid); i++) await sleep(300)
  // Ri-verifica PRIMA di forzare: tra il SIGTERM e ora l'orfano può essere morto e
  // Windows può aver riciclato il suo PID per un processo innocente — che verrebbe
  // ucciso al posto suo. `alive()` da solo non lo distingue.
  if (alive(pid) && isOurWebProcess(pid)) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* ignore */
    }
  }
  // Attendi il rilascio effettivo del listener prima di lasciare bindare Next.
  for (let i = 0; i < 10 && portOwnerPid(PORT) !== null; i++) await sleep(300)
}

;(async () => {
  try {
    await reclaimOrphanWeb()
  } catch (e) {
    // Best-effort: un errore qui non deve impedire l'avvio del web.
    console.log(`[web] bonifica orfano fallita (${e?.message ?? e}), proseguo`)
  }
  require('./server.next.js')
})()
