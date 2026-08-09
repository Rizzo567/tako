// Icone — stesso dizionario della dashboard staff (public/staff/src/02-kit.js).
//
// Non è una libreria e non è uno sprite: è un oggetto di stringhe `d` disegnate in
// stile Lucide su viewBox 24, rese da un solo <path> con stroke="currentColor".
// Costo: ~2 KB di testo, zero dipendenze, zero richieste. Qui c'è il SOTTOINSIEME
// che l'app owner usa davvero — le 44 icone della staff non servono tutte sul telefono.
export const IC: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  orders: 'M5 3h11l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM8 8h8M8 12h8M8 16h5',
  cassa: 'M3 7h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 7l2-3h14l2 3M16 13h2',
  map: 'M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M5 12h14M12 5v14',
  chevR: 'm9 18 6-6-6-6',
  chevL: 'm15 18-6-6 6-6',
  chevD: 'm6 9 6 6 6-6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 7v5l3 2',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0M12 9v4M12 17h.01',
  banknote: 'M3 6h18v12H3zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 9v.01M18 15v.01',
  card: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M2 10h20',
  euro: 'M19 5a7 7 0 1 0 0 14M5 9h7M5 13h6',
  coins: 'M8 8m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82',
  smartphone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1M11 18h2',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  user: 'M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  table: 'M3 9h18M3 9 5 4h14l2 5M4 9v11M20 9v11M9 9v4M15 9v4',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  wifi: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 20h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8M4.6 4.6l.1.1',
  search: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.3-4.3',
  sparkles: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18z',
}

export function Icon({ name, size = 20, stroke = 2, style }: {
  name: string
  size?: number
  stroke?: number
  style?: React.CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flex: 'none', ...style }} aria-hidden="true">
      <path d={IC[name] ?? ''} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
