// Tipi degli asset immagine importati come moduli.
//
// Metro risolve `import logo from './x.png'` in un id numerico (`ImageSourcePropType`),
// ma né `expo/types` né i tipi di React Native dichiarano il wildcard `*.png`: senza
// questo file l'unico modo di caricare un'immagine sarebbe `require()`, che la regola
// `@typescript-eslint/no-require-imports` vieta nel repo.

declare module '*.png' {
  const asset: number
  export default asset
}

declare module '*.jpg' {
  const asset: number
  export default asset
}

declare module '*.svg' {
  const asset: number
  export default asset
}
