// Token di marca del guscio nativo.
//
// Sono gli STESSI valori di `apps/dashboard/owner-src/tokens.css` (che a sua volta
// copia la dashboard staff). Duplicati e non importati perché un file CSS non è
// leggibile da React Native: se la palette cambia là, si allinea qui — è la stessa
// palette, non due palette.
//
// Qui serve solo il sottoinsieme che il nativo disegna davvero: la schermata di
// collegamento e lo sfondo dietro la WebView. Tutto il resto della UI vive dentro
// la pagina `/owner/`.

export const T = {
  brand: '#ED7159',
  brandDeep: '#D9533A',
  brandTint: '#FCE7DF',
  onBrand: '#FFFFFF',

  bg: '#F2EBE2',
  surface: '#FBF8F4',
  raised: '#FFFFFF',
  sunken: '#F4EEE7',
  hairline: '#E7DDD1',

  ink: '#2A1F1A',
  ink2: '#6B5A50',
  ink3: '#9A8B82',

  ok: '#4FA980',
  okBg: '#E4F2EB',
  okDeep: '#2F7D58',
  danger: '#D9534A',
  dangerBg: '#FAE6E4',

  // Port nativo (F8.2+): il resto della palette di tokens.css, per le schermate
  // RN vere. Stessi valori, stessa regola: se cambia là, si allinea qui.
  brandWash: '#FBF1ED',
  wait: '#E0A23C',
  waitBg: '#FAEFD8',
  info: '#5B8DB8',
  infoBg: '#E2EDF4',
  muted: '#9A8B82',
  mutedBg: '#EFE8E0',
  stFree: '#4FA980',
  stBusy: '#ED7159',
  stWait: '#E0A23C',
  stReady: '#5B8DB8',
  stClean: '#94A7B5',
  stResv: '#A98FCB',

  rSm: 10,
  rMd: 14,
  rLg: 18,
  rPill: 999,
} as const

// Famiglie font del port nativo: Nunito per display/numeri (900 per i numeri,
// come la classe .num della PWA), DM Sans per la UI. Caricate in app/_layout.tsx.
export const F = {
  display: 'Nunito_800ExtraBold',
  num: 'Nunito_900Black',
  ui: 'DMSans_400Regular',
  uiMedium: 'DMSans_500Medium',
  uiBold: 'DMSans_700Bold',
} as const
