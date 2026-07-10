import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEuro(n: number) {
  // Evita "NaN €" se un valore arriva undefined/NaN dall'API.
  const v = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)
}
