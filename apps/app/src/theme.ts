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
  danger: '#D9534A',
  dangerBg: '#FAE6E4',

  rSm: 10,
  rMd: 14,
  rLg: 18,
  rPill: 999,
} as const
