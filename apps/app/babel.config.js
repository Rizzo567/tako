// pnpm + Babel: il preset va risolto per PERCORSO, non per nome.
//
// `babel-preset-expo` è una dipendenza di `expo`, non nostra: con pnpm (link rigidi,
// niente hoisting) non compare in `apps/app/node_modules`, e Babel — che risolve i
// preset dalla cartella del file di configurazione — non lo trova. Con `expo start`
// non si vede, perché il dev server passa dalla sua copia; salta fuori solo nel
// bundling delle build native (`export:embed` dentro Xcode/Gradle), con un
// «Cannot find module 'babel-preset-expo'» che non nomina pnpm da nessuna parte.
//
// Scoperto in F7.3: primo `xcodebuild -configuration Release` fallito qui.

const path = require('path')

const presetExpo = require.resolve('babel-preset-expo', {
  paths: [path.dirname(require.resolve('expo/package.json'))],
})

module.exports = function (api) {
  api.cache(true)
  return {
    presets: [presetExpo],
  }
}
