import {describe,expect,it} from 'vitest'
import {capabilityText,linkMarkers} from '../apps/server/src/lib/twilio-menu-ai.js'
import {capabilities} from '../apps/server/src/lib/twilio-menu-copy.js'
import {linkIntent,botQuestion} from '../apps/server/src/lib/twilio-menu-nlu.js'
import {simplePassword,passwordWords,publicMenuUrl,dashboardUrl,ownerEmailSchema} from '../apps/server/src/lib/whatsapp-owner-account.js'
// 19/10: batteria avversaria su link dashboard / menu digitale («ho perso la password» → link + utente: niente password in chat). Le frasi simili che NON devono scattare
// (lamentele, modifiche al menu, menu del giorno) restano al bot normale.
const should:[string,'dashboard'|'menu'][]=[
 ['dashboard','dashboard'],['Dashboard?','dashboard'],['link dashboard','dashboard'],['mi mandi il link della dashboard?','dashboard'],['dove trovo la dashboard','dashboard'],
 ['come entro nella dashboard?','dashboard'],['qual è il link del pannello','dashboard'],['dammi l’accesso al gestionale','dashboard'],['la dashboard','dashboard'],['password della dashboard','dashboard'],
 ['qual è la mia password?','dashboard'],['utente e password dashboard','dashboard'],['nuova password','dashboard'],['ho perso la password','dashboard'],['ho dimenticato la password','dashboard'],
 ['cambia password','dashboard'],['reimposta la password per favore','dashboard'],['menu digitale','menu'],['link del menu','menu'],['link menu','menu'],
 ['dove vedo il menu?','menu'],['mandami il link del menu digitale','menu'],['qual è il link del mio menu?','menu'],['come vedono i clienti il menu?','menu'],['dov’è il menu online?','menu'],
 ['indirizzo del menu','menu'],['fammi vedere il menu','menu'],['dove apro il menu digitale','menu'],['Link del menu digitale','menu'],['mandami il menu','menu'],
]
const never=[
 'il menu digitale è lento','metti sul menu la carbonara','aggiungi al menu la diavola 9 euro','togli dal menu il polpo','menu di oggi: primi carbonara 10, amatriciana 9',
 'ho cambiato il prezzo dalla dashboard','il menu digitale non si apre','cosa c’è nel menu?','quali piatti ci sono nel menu','la carbonara è finita',
 'il menu è aggiornato?','nel menu scrivi: guanciale e pecorino','carbonara 12 euro','cosa sai fare','grazie',
 'sposta il polpo nei secondi del menu','pubblica il menu','dove metto il tiramisù nel menu?','il menu digitale ha un errore sul prezzo','cambia il menu',
 'il menu del giorno','fai vedere la carbonara nel menu','nascondi dal menu digitale la diavola','aggiorna la dashboard','il pannello è bloccato',
 'menu nuovo per stasera','il menu completo','quanto costa la tagliata?','tiramisù finito','metti la password sul menu',
 'il link del menu non funziona','rimetti nel menu la gricia','la dashboard non mi fa entrare, è bloccata','menu di oggi','carica il menu nuovo',
]
describe('link dashboard / menu digitale: batteria avversaria (19/10)',()=>{
 it('scatta sulle richieste di link (anche «ho perso la password»)',()=>{const wrong=should.filter(([t,want])=>linkIntent(t)!==want).map(([t,want])=>`${t} → ${linkIntent(t)} (atteso ${want})`);expect(wrong).toEqual([])})
 it('non scatta su lamentele, modifiche al menu e menu del giorno',()=>{const wrong=never.filter(t=>linkIntent(t)!==null).map(t=>`${t} → ${linkIntent(t)}`);expect(wrong).toEqual([])})
 it('la batteria ha almeno 40 frasi',()=>{expect(should.length+never.length).toBeGreaterThanOrEqual(40)})
})
describe('account titolare: email, password e link',()=>{
 it('email del titolare: formato valido, minuscola',()=>{
  expect(ownerEmailSchema(' Mario.Rossi@Gmail.com ')).toBe('mario.rossi@gmail.com')
  for(const bad of['','mario','mario@','@gmail.com','mario@gmail','ma rio@gmail.com',null,42,'a@b.c'])expect(ownerEmailSchema(bad as any)).toBeNull()})
 it('password: tre parole diverse, minuscole, separate da punto, dalla lista',()=>{
  expect(passwordWords.length).toBeGreaterThanOrEqual(190);expect(new Set(passwordWords).size).toBe(passwordWords.length)
  for(let i=0;i<200;i++){const p=simplePassword(),parts=p.split('.');expect(parts).toHaveLength(3);expect(new Set(parts).size).toBe(3);for(const w of parts){expect(passwordWords).toContain(w);expect(w).toMatch(/^[a-z]+$/)}}
  const seq=[0,1,1,2];expect(simplePassword(()=>seq.shift()!)).toBe(passwordWords.slice(0,3).join('.'))})
 it('link: dashboard /staff/ e menu pubblico del locale (slug se c’è, altrimenti /r/<id>/menu)',()=>{
  expect(dashboardUrl()).toMatch(/^https:\/\/[^/]+\/staff\/$/)
  expect(publicMenuUrl('528e263c-634e-4695-9632-6c5cc6a3302f')).toMatch(/\/victoria-bar$/)
  expect(publicMenuUrl('26050ecd-2e55-4057-a4c5-bff2b449cd47')).toMatch(/\/r\/26050ecd-2e55-4057-a4c5-bff2b449cd47\/menu$/)
  expect(()=>publicMenuUrl('x')).toThrow()})
})
describe('catalogo «cosa sai fare»',()=>{
 it('il catalogo ha le voci dashboard e menulink; il server le trasforma nel link vero',()=>{
  expect(capabilities.map(c=>c.id)).toEqual(expect.arrayContaining(['dashboard','menulink']))
  expect(capabilityText(['dashboard'])).toBe(linkMarkers.dashboard);expect(capabilityText(['menulink'])).toBe(linkMarkers.menulink);expect(capabilityText(['photo'])).not.toContain('\u0003')})
})
// 19/10 (richiesta Manuel): la riga «assistente automatico» esce dal benvenuto e resta come risposta fissa a «sei un bot?» / «sei una persona?».
describe('«sei un bot?»: risposta assistente automatico (19/10)',()=>{
 const yes=['sei un bot?','Sei un bot','sei una persona?','sei una persona vera?','sei umano?','ma sei un robot?','sei tu un bot?','sei davvero una persona?','sto parlando con un bot?','parlo con una persona?','parlo con un umano?','sei un’intelligenza artificiale?','sei una AI?','sei un programma?','chi sei?','ma chi sei','sei vero?','scrivo con un bot?','c’è una persona?','sei automatico?']
 const no=['la carbonara è ai funghi?','sei aperto domani?','il risotto è vero parmigiano?','carbonara 12 euro','tiramisù finito','cosa sai fare','sei ai fornelli?','metti la carbonara, sei un genio','sei bravo','persona allergica al glutine?','menu per una persona','chi sei tu per dirmi il prezzo della carbonara 12','grazie','è vero che la carbonara è finita?','dashboard']
 it('scatta sulle domande esplicite',()=>{expect(yes.filter(t=>!botQuestion(t))).toEqual([])})
 it('non scatta su frasi di menu simili',()=>{expect(no.filter(t=>botQuestion(t))).toEqual([])})
})
