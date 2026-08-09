// Firma release dell'APK Android (F7.4) — config plugin.
//
// Perché un plugin e non una modifica a mano in `android/`: la cartella `android/`
// è generata da `expo prebuild` ed è in `.gitignore`. Qualunque riga scritta lì
// dentro sparisce al prossimo `prebuild --clean`, cioè alla prima build di un altro
// computer. La configurazione della firma è *configurazione*, quindi vive qui.
//
// Il segreto invece NON vive qui: password e alias stanno in
// `~/.tako/android-keystore/credentials.txt` (chmod 600, fuori dal repo), scritto
// una volta insieme al keystore. Il plugin lo legge al momento del prebuild e
// travasa i valori in `android/gradle.properties`, che è generato e ignorato da git.
//
// Se il file delle credenziali non c'è (macchina nuova, CI, un altro sviluppatore),
// il plugin NON fa nulla: la build release resta firmata con la chiave di debug,
// che è esattamente il comportamento di default di React Native. Meglio una build
// non distribuibile che una build che fallisce con un errore di Gradle illeggibile.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins')

const CREDENTIALS_PATH = path.join(os.homedir(), '.tako', 'android-keystore', 'credentials.txt')

const KEYS = [
  'TAKO_RELEASE_STORE_FILE',
  'TAKO_RELEASE_KEY_ALIAS',
  'TAKO_RELEASE_STORE_PASSWORD',
  'TAKO_RELEASE_KEY_PASSWORD',
]

/** Legge `credentials.txt` (righe `CHIAVE=valore`, `#` commento). `null` se manca o è incompleto. */
function readCredentials() {
  let raw
  try {
    raw = fs.readFileSync(CREDENTIALS_PATH, 'utf8')
  } catch {
    return null
  }
  const found = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    // La password può contenere `=`: si spezza solo sul PRIMO uguale.
    const key = trimmed.slice(0, eq).trim()
    if (KEYS.includes(key)) found[key] = trimmed.slice(eq + 1).trim()
  }
  if (!KEYS.every((k) => found[k])) return null
  if (!fs.existsSync(found.TAKO_RELEASE_STORE_FILE)) return null
  return found
}

const SIGNING_CONFIG = `        release {
            storeFile file(TAKO_RELEASE_STORE_FILE)
            storePassword TAKO_RELEASE_STORE_PASSWORD
            keyAlias TAKO_RELEASE_KEY_ALIAS
            keyPassword TAKO_RELEASE_KEY_PASSWORD
        }
`

module.exports = function withAndroidReleaseSigning(config) {
  const credentials = readCredentials()
  if (!credentials) {
    console.warn(
      `[tako] ${CREDENTIALS_PATH} non trovato: la build release userà la chiave di debug ` +
        `(APK non distribuibile). Vedi il diario F7.4 nel piano.`,
    )
    return config
  }

  config = withGradleProperties(config, (cfg) => {
    for (const key of KEYS) {
      // Rimpiazza invece di accodare: un prebuild senza --clean rileggerebbe il file.
      cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === key))
      cfg.modResults.push({ type: 'property', key, value: credentials[key] })
    }
    return cfg
  })

  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents
    if (gradle.includes('TAKO_RELEASE_STORE_FILE')) return cfg

    // 1. Il signingConfig `release`, accanto a quello di debug generato da RN.
    const anchor = 'signingConfigs {\n'
    if (!gradle.includes(anchor)) {
      throw new Error('[tako] blocco signingConfigs non trovato in app/build.gradle')
    }
    gradle = gradle.replace(anchor, anchor + SIGNING_CONFIG)

    // 2. Il buildType `release` deve usarlo. La stessa riga compare anche nel
    //    buildType `debug`: si sostituisce SOLO quella che segue il commento
    //    «Caution!» che RN scrive dentro il blocco release.
    const releaseSigning = /(\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n\s*signingConfig )signingConfigs\.debug/
    if (!releaseSigning.test(gradle)) {
      throw new Error('[tako] riga `signingConfig signingConfigs.debug` del buildType release non trovata')
    }
    gradle = gradle.replace(releaseSigning, '$1signingConfigs.release')

    cfg.modResults.contents = gradle
    return cfg
  })
}
