import { db } from '@tako/db'
import { sql } from 'drizzle-orm'
export type WebMail = { to: string; subject: string; html: string; text?: string }
export type MailDelivery = (mail: WebMail, idempotencyKey: string) => Promise<{ id: string }>
export const escapeMail = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
export const deliverWebMail: MailDelivery = async (mail, idempotencyKey) => {
  if (process.env.WEB_EMAIL_ENABLED !== '1' || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email delivery unavailable')
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, reply_to: process.env.EMAIL_REPLY_TO || 'manuelrizzo474@gmail.com', ...mail }) })
  if (!response.ok) throw new Error('Email delivery failed')
  const body = await response.json() as { id?: string }
  if (!body.id) throw new Error('Email delivery response invalid')
  return { id: body.id }
}

export async function enqueueReservationReminder(executor: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0], booking: { id: string; restaurantId: string; customerEmail?: string | null; reminderConsent?: boolean; reminderRevision: number; status: string; startsAt: Date }) {
  await executor.execute(sql`update web_mail_outbox set status='cancelled' where reservation_id=${booking.id} and status in ('pending','sending') and (dedupe_key<>${`reservation:${booking.id}:${booking.reminderRevision}`} or ${booking.status !== 'confirmed' || !booking.reminderConsent || !booking.customerEmail})`)
  if (booking.status !== 'confirmed' || !booking.reminderConsent || !booking.customerEmail) return
  const scheduled = new Date(booking.startsAt.getTime() - 24 * 3600000)
  if (scheduled < new Date()) return
  const key = `reservation:${booking.id}:${booking.reminderRevision}`
  await executor.execute(sql`insert into web_mail_outbox(restaurant_id,reservation_id,kind,dedupe_key,recipient,subject,html,scheduled_at)
    values(${booking.restaurantId},${booking.id},'reservation_reminder',${key},${booking.customerEmail},'Promemoria prenotazione Tako',${'<p>Hai una prenotazione confermata. Per modifiche contatta il ristorante.</p>'},${scheduled.toISOString()})
    on conflict(dedupe_key) do nothing`)
}

/** Explicit invocation only. No automatic worker or provider activation. */
export async function processReservationReminders(deliver: MailDelivery = deliverWebMail, now = new Date()) {
  const outcomes = { sent: 0, failed: 0, cancelled: 0 }
  for (let index = 0; index < 20; index++) {
    const claimed = await db.transaction(async tx => {
      const rows = await tx.execute(sql`select o.* from web_mail_outbox o where o.kind='reservation_reminder'
        and o.scheduled_at<=${now.toISOString()} and o.attempts<5
        and (o.status='pending' or (o.status='sending' and o.claimed_at<${new Date(now.getTime() - 5 * 60000).toISOString()}))
        order by o.scheduled_at for update skip locked limit 1`)
      const row = rows[0] as any
      if (!row) return null
      const bookings = await tx.execute(sql`select status,reminder_consent,reminder_revision,starts_at from reservations where id=${row.reservation_id} and restaurant_id=${row.restaurant_id}`)
      const booking = bookings[0] as any
      if (!booking || booking.status !== 'confirmed' || !booking.reminder_consent || new Date(booking.starts_at) <= now
        || row.dedupe_key !== `reservation:${row.reservation_id}:${booking.reminder_revision}`) {
        await tx.execute(sql`update web_mail_outbox set status='cancelled' where id=${row.id}`)
        outcomes.cancelled++
        return { skip: true }
      }
      await tx.execute(sql`update web_mail_outbox set status='sending',claimed_at=${now.toISOString()},attempts=attempts+1 where id=${row.id}`)
      return row
    })
    if (!claimed) break
    if (claimed.skip) continue
    try {
      const result = await deliver({ to: claimed.recipient, subject: claimed.subject, html: claimed.html }, claimed.dedupe_key)
      await db.execute(sql`update web_mail_outbox set status='sent',sent_at=${now.toISOString()},provider_id=${result.id},last_error=null where id=${claimed.id}`)
      outcomes.sent++
    } catch {
      await db.execute(sql`update web_mail_outbox set status=case when attempts>=5 then 'failed' else 'pending' end,
        scheduled_at=${new Date(now.getTime() + 5 * 60000).toISOString()},last_error='DELIVERY_FAILED' where id=${claimed.id}`)
      outcomes.failed++
    }
  }
  return outcomes
}
