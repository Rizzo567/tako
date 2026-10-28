import {describe,it,expect,vi,afterEach} from 'vitest'
import {pdfIntent,linkIntent} from '../apps/server/src/lib/twilio-menu-nlu.js'
import {twiml,withMedia,withoutMedia,splitMedia,nextMessage,lateReply} from '../apps/server/src/lib/twilio-menu-command.js'
import {signMenuPdfToken,readMenuPdfToken,menuPdfUrl,MENU_PDF_TTL_MS} from '../apps/server/src/lib/whatsapp-menu-pdf.js'
import {sendWhatsApp} from '../apps/server/src/lib/twilio-menu-ai.js'

// Menu di un locale come Victoria (nomi reali dei Menu, id sintetici).
const G='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222',B='33333333-3333-4333-8333-333333333333',A='44444444-4444-4444-8444-444444444444',N='55555555-5555-4555-8555-555555555555'
const menus=[{id:G,name:'Menu Giorno'},{id:C,name:'Cena'},{id:B,name:'Bevande'},{id:A,name:'Alla carta'}]
const dishes=['Lasagna','Strozzapreti al ragù','Orecchiette cime di rapa','Cotoletta alla milanese','Arrosto di vitello','Patate al forno','Spinaci al burro','Carbonara']
const ids=(t:string,ms=menus)=>{const r=pdfIntent(t,ms,dishes);return r&&'menuIds' in r?r.menuIds:r}
const tenant='26050ecd-2e55-4057-a4c5-bff2b449cd47',secret='x'.repeat(40)

describe('pdfIntent — «mandami il menu giorno»',()=>{
 it('riconosce il Menu richiesto, anche detto in modi diversi',()=>{
  for(const t of['mandami il menu giorno','Inviami il menu del giorno','mi mandi il menu di oggi?','puoi mandarmi il menu giorno da stampare','mandami il pdf del menu giorno','girami il menu giorno','Mandami il menu giorno come ha chiesto Luisa','stampami il menu giorno','mi serve il menu giorno in pdf','mandami il menu giorno aggiornato'])expect(ids(t),t).toEqual([G])
  expect(ids('mandami il menu della cena')).toEqual([C])
  expect(ids('mandami il menu bevande')).toEqual([B])
  expect(ids('mandami il menu alla carta in pdf')).toEqual([A])
  expect(ids('mandami il menu giorno e il menu cena')).toEqual([G,C])})
 it('con parola da stampa ma senza Menu: chiede quale (o manda l unico)',()=>{
  expect(pdfIntent('mandami il pdf',menus)).toEqual({ask:['Menu Giorno','Cena','Bevande','Alla carta']})
  expect(pdfIntent('mi serve il menu da stampare',menus)).toEqual({ask:['Menu Giorno','Cena','Bevande','Alla carta']})
  expect(ids('mandami il pdf del menu',[menus[0]!])).toEqual([G])})
 it('vince il nome più lungo («Cena» e «Cena di Natale»)',()=>{
  const ms=[...menus,{id:N,name:'Cena di Natale'}]
  expect(ids('mandami il menu cena di natale',ms)).toEqual([N])
  expect(ids('mandami il menu cena',ms)).toEqual([C])})
 it('non scatta su modifiche, domande, lamentele, link e piatti',()=>{
  for(const t of['togli la lasagna dal menu giorno','metti la carbonara nel menu giorno','cosa c è nel menu giorno','quali piatti ci sono nel menu del giorno','il menu giorno non si apre','il pdf non si stampa','mandami il link del menu giorno','mandami il menu','mandami il menu digitale','mandami il qr del menu','la cotoletta è finita','svuota il menu giorno','menu giorno','mandami la lasagna del menu giorno','il prezzo del menu giorno è 12','aggiorna il menu giorno e mandamelo'])expect(pdfIntent(t,menus,dishes),t).toBeNull()})
 it('«mandami il menu» resta il link del menu digitale',()=>{
  expect(linkIntent('mandami il menu')).toBe('menu')
  expect(pdfIntent('mandami il menu',menus,dishes)).toBeNull()})
})

describe('pdfIntent — frasi della revisione 28/10',()=>{
 const A=[{id:G,name:'Menu del giorno'},{id:C,name:'Pranzo'},{id:B,name:'Cena'}],only=[{id:G,name:'Menu'}],D=[{id:G,name:'Giorno'},{id:C,name:'Vini'}]
 const never=['ti mando il menu del giorno','ora ti mando il menu del giorno in foto','adesso ti mando il menu stampato così lo copi','ti mando la foto del menu cartaceo','ti invio il menu cena nuovo','hai ricevuto il menu del giorno che ti ho mandato?','domani il menu del giorno lo mando io','per il menu del giorno vorrei pasta e fagioli trippa e panna cotta','menu del giorno vorrei pasta e fagioli e trippa','vorrei rifare il menu del giorno','voglio creare un nuovo menu pranzo','voglio rimuovere il menu cena','voglio disattivare il menu pranzo','vorrei sostituire il primo del menu giorno con la gricia','voglio tradurre il menu cena in inglese','voglio duplicare il menu cena','vorrei chiudere il menu pranzo','voglio sapere se il menu giorno è visibile','mi serve il menu del giorno più corto','voglio il menu del giorno solo con primi','nel pdf manca la carbonara','il pdf del menu ha la pagina bianca','ho bisogno che il menu cena sia pronto per stasera','mandami il menu','mi mandi il menu?','voglio vedere il menu','vorrei il menu','ti mando il menu','il volantino per sabato','voglio fare un volantino col menu','foglio','stampa','vorrei stampare il menu ma non riesco','la stampante non va col menu','menu di oggi voglio solo la pasta al forno','oggi menu giorno voglio pasta al forno, arrosto e patate','vorrei mettere nel menu del giorno la pasta al forno','mi serve un menu per la cena di natale','ho bisogno di un menu nuovo per il pranzo','mandami la lista del menu cena','quando mando il menu del giorno ai clienti','invia il menu del giorno ai clienti','vorrei inviare il menu cena ai clienti su whatsapp','mandalo ai clienti il menu del giorno','sì mandamelo']
 it('non scatta su lavoro sul menu, invii del titolare, lamentele',()=>{for(const ms of [A,only,D]){const wrong=never.filter(t=>pdfIntent(t,ms,dishes)!==null).map(t=>`${ms[0]!.name}: ${t} → ${JSON.stringify(pdfIntent(t,ms,dishes))}`);expect(wrong).toEqual([])}})
 it('scatta sulle richieste vere',()=>{
  const want:[string,unknown][]=[['mandami il menu giorno',{menuIds:[G]}],['mandami il menù del giorno',{menuIds:[G]}],['il menu cena me lo mandi',{menuIds:[B]}],['puoi inviarmi il menu pranzo',{menuIds:[C]}],['ehi tako mi mandi il pdf del menu cena per favore',{menuIds:[B]}],['me lo mandi il menu del giorno in pdf',{menuIds:[G]}],['inviami menu cena e pranzo',{menuIds:[C,B]}],['mandami il pdf',{ask:['Menu del giorno','Pranzo','Cena']}],['stampami il menu',{ask:['Menu del giorno','Pranzo','Cena']}],['mandami il menu del giorno che ho appena cambiato',{menuIds:[G]}],['Mandami il menu giorno come ha chiesto Luisa',{menuIds:[G]}]]
  const wrong=want.filter(([t,r])=>JSON.stringify(pdfIntent(t,A,dishes))!==JSON.stringify(r)).map(([t,r])=>`${t} → ${JSON.stringify(pdfIntent(t,A,dishes))} (atteso ${JSON.stringify(r)})`);expect(wrong).toEqual([])
  expect(pdfIntent('mandami il pdf del menu',only)).toEqual({menuIds:[G]});expect(pdfIntent('mandami il menu',only)).toBeNull()})
})

describe('token del link PDF',()=>{
 it('firma e legge locale, Menu e scadenza',()=>{
  const now=1_800_000_000_000,tok=signMenuPdfToken({tenant,menuIds:[G]},secret,now)
  expect(readMenuPdfToken(tok,secret,now+1000)).toEqual({tenant,menuIds:[G]})
  expect(readMenuPdfToken(tok,secret,now+MENU_PDF_TTL_MS+1)).toBeNull()
  expect(readMenuPdfToken(tok,'y'.repeat(40),now)).toBeNull()
  const [p,s]=tok.split('.') as [string,string],forged=Buffer.from(JSON.stringify({t:tenant,m:[C],e:now+MENU_PDF_TTL_MS})).toString('base64url')
  expect(readMenuPdfToken(forged+'.'+s,secret,now)).toBeNull()
  expect(readMenuPdfToken(p+'.',secret,now)).toBeNull()
  expect(readMenuPdfToken('../../etc',secret,now)).toBeNull()})
 it('rifiuta segreto mancante e id non validi',()=>{
  expect(()=>signMenuPdfToken({tenant,menuIds:[G]},'')).toThrow()
  expect(()=>signMenuPdfToken({tenant:'x',menuIds:[G]},secret)).toThrow()
  expect(()=>signMenuPdfToken({tenant,menuIds:[]},secret)).toThrow()
  expect(readMenuPdfToken('',secret)).toBeNull()})
 it('indirizzo pubblico con nome file leggibile',()=>{
  const tok=signMenuPdfToken({tenant,menuIds:[G]},secret)
  expect(menuPdfUrl(tok,'Menu Giorno')).toMatch(new RegExp(`^https://[^/]+/api/public/whatsapp-pdf/menu-giorno\\.pdf\\?k=${tok}$`))})
})

describe('allegato nel messaggio',()=>{
 const url='https://takoitalia.com/api/public/whatsapp-pdf/abc.def/menu-giorno.pdf'
 it('TwiML con <Body> e <Media>, testo normale invariato',()=>{
  const x=twiml(withMedia('Ecco il PDF & co',url))
  expect(x).toContain('<Message><Body>Ecco il PDF &amp; co</Body><Media>'+url+'</Media></Message>')
  expect(twiml('ciao')).toContain('<Message>ciao</Message>')
  expect(twiml('a'+nextMessage+withMedia('b',url))).toContain('<Message>a</Message><Message><Body>b</Body><Media>')})
 it('URL non https: solo testo, mai il marcatore',()=>{
  const x=twiml(withMedia('Ecco','http://evil.test/x.pdf'));expect(x).toContain('<Message>Ecco</Message>');expect(x).not.toContain('\u0004')
  expect(splitMedia(withMedia('t','javascript:alert(1)'))).toEqual({text:'t'})})
 it('memoria del turno senza URL',()=>{expect(withoutMedia(withMedia('Ecco',url))).toBe('Ecco')})
 it('risposta tardiva via REST conserva l allegato',()=>{const r=lateReply(withMedia('Ecco',url),{gatewayAt:1,arrivedAt:20_000});expect(r.send).toEqual([withMedia('Ecco',url)])})
})

describe('sendWhatsApp con allegato',()=>{
 afterEach(()=>vi.unstubAllGlobals())
 it('manda Body + MediaUrl in un solo messaggio',async()=>{
  const calls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(_u:string,init:{body:string})=>{calls.push(init.body);return new Response(JSON.stringify({sid:'SM1',status:'queued'}),{status:201})}))
  const url='https://takoitalia.com/api/public/whatsapp-pdf/abc.def/menu-giorno.pdf'
  await sendWhatsApp('AC1','tok','whatsapp:+1','whatsapp:+39333',withMedia('Ecco il PDF',url))
  expect(calls).toHaveLength(1);const f=new URLSearchParams(calls[0]!);expect(f.get('Body')).toBe('Ecco il PDF');expect(f.get('MediaUrl')).toBe(url)
  await sendWhatsApp('AC1','tok','whatsapp:+1','whatsapp:+39333','solo testo');expect(new URLSearchParams(calls[1]!).get('MediaUrl')).toBeNull()})
})
