import { describe, it, expect } from 'vitest'
import { reservationLocalInstant, nextCalendarDay } from '../../apps/server/src/lib/reservation-capacity.js'
import { dayStartInTz } from '../../apps/server/src/lib/billing.js'

describe('reservation calendar boundaries', () => {
  it('local evening remains correct across both Rome DST transitions', () => {
    expect(reservationLocalInstant('2026-03-29', '19:00', 'Europe/Rome').toISOString()).toBe('2026-03-29T17:00:00.000Z')
    expect(reservationLocalInstant('2026-10-25', '19:00', 'Europe/Rome').toISOString()).toBe('2026-10-25T18:00:00.000Z')
  })
  it('rejects nonexistent, ambiguous and normalized impossible dates', () => {
    expect(() => reservationLocalInstant('2026-03-29', '02:30', 'Europe/Rome')).toThrow('Nonexistent')
    expect(() => reservationLocalInstant('2026-10-25', '02:30', 'Europe/Rome')).toThrow('Ambiguous')
    expect(() => nextCalendarDay('2026-02-31')).toThrow()
  })
  it('uses actual calendar boundaries for 23 and 25-hour days', () => {
    const length = (day: string) => (dayStartInTz(nextCalendarDay(day), 'Europe/Rome').getTime() - dayStartInTz(day, 'Europe/Rome').getTime()) / 3600000
    expect(length('2026-03-29')).toBe(23)
    expect(length('2026-10-25')).toBe(25)
  })
})
