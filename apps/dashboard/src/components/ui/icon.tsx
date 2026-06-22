import type { CSSProperties } from 'react'

// Set icone Lucide-style (stroke 2, viewBox 24) dal design handoff — leggero e
// pixel-accurate. Sostituibile con lucide-react in futuro mantenendo i nomi.
export const IC = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  orders: 'M5 3h11l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM8 8h8M8 12h8M8 16h5',
  kitchen: 'M5 11h14v1a7 7 0 0 1-14 0zM3 11h18M5 12H3M19 12h2M8.3 6c.6-.8.2-1.9-.3-2.6M12 6c.6-.8.2-1.9-.3-2.6M15.7 6c.6-.8.2-1.9-.3-2.6',
  cassa: 'M3 7h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 7l2-3h14l2 3M16 13h2',
  menu: 'M4 4h13a3 3 0 0 1 0 6H4zM4 4v16M4 14h13a3 3 0 0 1 0 6H4',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  insights: 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4',
  inventory: 'M3 8 12 3l9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v9',
  staff: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H.1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 1.4 6M4.6 4.6l.1.1A1.6 1.6 0 0 0 7 4.6M9 1.4V1a2 2 0 0 1 4 0v.1',
  sala: 'M3 3h18v18H3zM3 9h18M9 9v12',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  comanda: 'M9 3h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1zM9 5h6M9 12l2 2 4-4',
  plus: 'M5 12h14M12 5v14', minus: 'M5 12h14', check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12', search: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.3-4.3',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5z', bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  chevL: 'm15 18-6-6 6-6', chevR: 'm9 18 6-6-6-6', chevD: 'm6 9 6 6 6-6', chevU: 'm18 15-6-6-6 6',
  arrowR: 'M5 12h14M13 5l7 7-7 7', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 7v5l3 2',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0M12 9v4M12 17h.01',
  sparkles: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18z',
  printer: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  split: 'M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7', banknote: 'M3 6h18v12H3zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 9v.01M18 15v.01',
  card: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M2 10h20',
  smartphone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1M11 18h2',
  euro: 'M19 5a7 7 0 1 0 0 14M5 9h7M5 13h6',
  coins: 'M8 8m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82',
  user: 'M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14', flame: 'M12 22a7 7 0 0 0 7-7c0-3-2-5-3-7-1.5 1-2 2-2 2s-1-4-4-6c0 4-3 5-3 11a5 5 0 0 0 5 5',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', map: 'M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  table: 'M3 9h18M3 9 5 4h14l2 5M4 9v11M20 9v11M9 9v4M15 9v4',
  move: 'M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3',
} as const

export type IconName = keyof typeof IC

export function Icon({ name, size = 20, stroke = 2, fill = 'none', style }: {
  name: IconName; size?: number; stroke?: number; fill?: string; style?: CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flex: 'none', ...style }}>
      <path d={IC[name] ?? ''} fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
