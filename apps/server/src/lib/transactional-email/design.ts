/** Approved Onest-derived family, adapted to table/inline email HTML (no browser JS). */
export const EMAIL_DESIGN_VERSION = '20261023'
export const EMAIL_ASSET_BASE = 'https://tcfccmvpycivxuxkoqpw.supabase.co/storage/v1/object/public/takomenu-email-assets/design-20261023'
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const petrol = '#19434c', coral = '#f16a4c', paper = '#edeee9'
const table = (content: string, style = '') => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;${style}">${content}</table>`
const row = (content: string, style = '') => `<tr><td style="${style}">${content}</td></tr>`
const title = (s: string, size = 48) => `<h1 style="margin:0;font-family:Fraunces,Georgia,'Times New Roman',serif;font-size:${size}px;line-height:1.04;font-weight:900;letter-spacing:-1px">${s}</h1>`
export function renderEmailDesign(input: {id: string; subject: string; values: Record<string,string>; body: string; button: string; assetBase?: string}) {
  const {id,subject,values,body,button} = input
  const val = (key: string): string => { const value = values[key]; if (!value?.trim()) throw new Error('Missing email variable: '+key); return value }
  const base = input.assetBase || EMAIL_ASSET_BASE
  const image = (name: string, alt: string, width = 600) => `<img src="${esc(base+'/'+name)}" width="${width}" alt="${esc(alt)}" border="0" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none">`
  const brand = (white = false) => `<img src="${esc(base+'/'+(white?'takomenu-white.png':'takomenu.png'))}" width="176" alt="Takomenu" border="0" style="display:block;margin:0 auto;width:176px;max-width:70%;height:auto;border:0">`
  const action = (url: string, label: string) => table(row(`<a href="${esc(url)}" style="display:inline-block;background:${petrol};color:#ffffff;text-decoration:none;padding:17px 24px;border-radius:14px;font:700 17px Arial,Helvetica,sans-serif;mso-padding-alt:0">${esc(label)}</a>`, 'text-align:center;padding:12px 0 0'))
  const paddedCard = (content: string) => row(table(row(content,'background:#ffffff;border-radius:38px;padding:32px 26px;text-align:center;font-size:17px;line-height:1.55;color:#242626')),'padding:0 36px 36px;background:'+paper)
  const paragraph = (s: string) => `<p style="margin:0 0 20px">${s}</p>`
  const top = id==='benvenuto'?'Il tuo Takomenu è pronto':id==='conferma-email'?'Conferma del nuovo indirizzo':id==='avviso-cambio-email'?'Avviso al tuo indirizzo attuale':id==='servizio'?'Comunicazione di servizio':'Sicurezza del tuo account'
  const headings: Record<string,string> = {'reset-password':'UNA NUOVA<br>PASSWORD.','password-cambiata':'PASSWORD<br>AGGIORNATA.','conferma-email':'LA TUA<br>NUOVA EMAIL.','avviso-cambio-email':'RICHIESTO UN<br>CAMBIO EMAIL.','servizio':esc(values.titolo||'Un messaggio per il tuo locale')}
  let content = row(esc(top),`background:${petrol};color:white;padding:13px 16px;text-align:center;font-size:14px`)
  const header = (heading: string, kicker: string) => row(`${brand()}<p style="font-size:16px;margin:28px 0 18px">${kicker}</p>${title(heading)}`,`padding:34px 24px 30px;background:${coral};background-image:linear-gradient(90deg,${coral},#ffb18c);color:#fffaf5;text-align:center`)
  if(id==='benvenuto') {
    content += header('IL TUO MENU.<br>BASTA UN<br>MESSAGGIO.','Benvenuto, '+esc(val('nome_titolare')))
    content += row(image('welcome-menu-scene.png','Esempio dimostrativo: menu digitale e aggiornamenti via WhatsApp'),`background:${paper}`)
    content += row(paragraph(`Il menu di <strong>${esc(val('nome_locale'))}</strong> è pronto.`)+paragraph('Un prezzo da cambiare, un piatto da aggiungere o una proposta finita? Scrivi o manda un vocale: <strong>puoi chiedere più modifiche insieme.</strong>')+action(val('link_menu'),'Guarda il tuo menu'),'padding:22px 36px 36px;text-align:center;font-size:17px;line-height:1.55;background:'+paper)
    const password = values.password_temporanea ? paragraph('La tua password temporanea<br><strong>'+esc(values.password_temporanea)+'</strong>') : paragraph('Se non ricordi la password, usa <strong>Password dimenticata</strong> nella pagina di accesso.')
    content += paddedCard(`<h2 style="margin:0 0 24px;color:${petrol};font:900 33px/1.1 Fraunces,Georgia,serif">Il tuo menu,<br>sotto controllo.</h2>`+paragraph('La tua email<br><strong style="word-break:break-word">'+esc(val('utente'))+'</strong>')+password+button+`<p style="font-size:13px;margin:22px 0 0">Piatti, prezzi e disponibilità, in un solo posto.</p>`)
    content += row(image('welcome-dashboard-scene.png','Esempio della dashboard Takomenu su iPhone'),`background:${paper}`)
    const bubble = (s:string, received=false) => row(table(row(s,`padding:20px;color:#fafafa;font:16px/1.4 Arial;background:${received?'#232626':'#134d36'};border-radius:22px`)),`padding:0 ${received?'40px 20px 0':'0 20px 40px'}`)
    content += row(`<h2 style="margin:0 0 30px;font:900 36px/1.1 Fraunces,Georgia,serif;color:white;text-align:center">Cambia il menu.<br>Continua il servizio.</h2>`+table(bubble('Per stasera: carbonara a 12 €, tiramisù a 6 €, nascondi la caprese e rimetti disponibile la tagliata.')+bubble('Ecco le <strong>4 modifiche</strong>:<br>1. Carbonara: 12 €<br>2. Tiramisù: 6 €<br>3. Caprese nascosta<br>4. Tagliata disponibile<br><br>Scrivi <strong>OK</strong> per confermare.',true))+`<p style="font-size:11px;text-align:center;color:white;margin:24px 0 0">Schermate e conversazioni dimostrative.</p>`+action('https://wa.me/'+val('numero_bot').replace(/\D/g,''),'Scrivi su WhatsApp'),`padding:30px 28px 40px;background:${coral}`)
    // Promotional/newsletter/social destinations were never configured. No dead links or implicit subscriptions.
  } else {
    content += header(headings[id]||esc(subject),'Per il tuo account Takomenu')
    const scene = id==='reset-password'||id==='password-cambiata'?'password-scene.png':id==='servizio'?'welcome-menu-scene.png':'email-scene.png'
    content += row(image(scene,id==='servizio'?'Takomenu: il menu digitale':'Sicurezza del tuo account Takomenu'),`background:${paper}`)
    content += paddedCard(`<div style="margin-bottom:24px">${body}</div>${button}`)
  }
  content += row(`${brand(true)}<p style="font-size:20px;margin:24px 0 30px">Il tuo menu. Basta un messaggio.</p><p style="border-top:1px solid #ffffff55;padding-top:24px;font-size:12px;line-height:1.8;margin:0">Takomenu · Hai bisogno di aiuto?<br><a href="mailto:manuelrizzo474@gmail.com" style="color:#ffffff;text-decoration:underline">manuelrizzo474@gmail.com</a></p>`,`padding:32px 30px;background:${petrol};color:white;text-align:center`)
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-takomenu-email-design" content="${EMAIL_DESIGN_VERSION}"><title>${esc(subject)}</title><style>@font-face{font-family:Fraunces;src:url('${esc(base)}/fraunces-900.woff2') format('woff2');font-weight:900}body{margin:0}a{color:${petrol}}@media(max-width:480px){h1{font-size:36px!important}}</style></head><body style="margin:0;padding:0;background:#fff1e7;font-family:Arial,Helvetica,sans-serif;color:#242626">${table(row(table(content,'width:100%;max-width:600px;background:'+paper+';border-radius:32px;overflow:hidden;margin:0 auto'),'padding:24px 8px;text-align:center'))}</body></html>`
}
