// Permette a Metro di impacchettare il file standalone come asset (require .html),
// così la WebView mobile lo carica verbatim dal bundle dell'app.
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('html')

module.exports = config
