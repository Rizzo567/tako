import { db } from '@tako/db'
import { sql } from 'drizzle-orm'
import { enqueueEmail } from './outbox.js'

/** Only events captured after feature activation. Never scan historical customers. */
export async function materializeWelcomeEmails() {
  let queued = 0
  for(let n=0;n<20;n++) {
    const result = await db.transaction(async tx=>{
      const events=await tx.execute(sql`select * from tako_email_welcome_events where processed_at is null and available_at<=now() order by created_at for update skip locked limit 1`)
      const event=events[0];if(!event)return false
      const rows=await tx.execute(sql`select u.id,u.name,u.email,r.name as restaurant_name,r.slug from users u join restaurants r on r.id=${event.restaurant_id} join tako_whatsapp_links l on l.restaurant_id=r.id and l.actor_id=u.id where u.id=${event.user_id} and u.active=true and u.role='owner' and r.active=true and l.activated_at is not null limit 1`)
      const user=rows[0]
      if(user && !/\.(?:invalid|local|example)$/i.test(String(user.email))) {
        const origin=process.env.WEB_ORIGIN || 'https://takoitalia.com'
        const number=(process.env.TWILIO_WHATSAPP_NUMBER || '').replace('whatsapp:','')
        if(!number)throw new Error('WhatsApp sender unavailable')
        await enqueueEmail(tx,{key:`welcome:${event.restaurant_id}:${event.user_id}`,userId:String(user.id),recipient:String(user.email),template:'benvenuto',values:{nome_titolare:String(user.name),nome_locale:String(user.restaurant_name),utente:String(user.email),link_dashboard:origin+'/staff/',link_menu:origin+'/'+encodeURIComponent(String(user.slug)),numero_bot:number},guard:{kind:'welcome',id:String(event.restaurant_id)}})
        queued++
      }
      if((!user||/\.(?:invalid|local|example)$/i.test(String(user.email))) && Date.now()-new Date(String(event.created_at)).getTime()<23*3600000){
        await tx.execute(sql`update tako_email_welcome_events set available_at=now()+interval '5 minutes' where user_id=${event.user_id} and restaurant_id=${event.restaurant_id}`)
        return true
      }
      await tx.execute(sql`update tako_email_welcome_events set processed_at=now() where user_id=${event.user_id} and restaurant_id=${event.restaurant_id}`)
      return true
    })
    if(!result)break
  }
  return queued
}
