// Batteria R8 (18/10/2026, agente R5): bug dal vivo di Manuel sul QA 12:56–12:58 («ora in primi aggiungi pasta al pesto, pasta al
// ragu, pasta carbonara, riso giallo. metti le paste a 10 euro e il riso a 8 euro» → «Non ho cambiato nulla.», poi «Aggiunti i nuovi
// piatti…» senza scrittura). Famiglia: creare N piatti con prezzi per gruppo, nella categoria creata nel messaggio prima o già
// esistente, con varianti dei prezzi («le paste a 10 e il riso a 8», «tutti a 10 tranne il riso a 8», «a 10, 10, 10 e 8»…), piatti
// già nel menu chiesti come nuovi (domanda «lo aggiorno o ne creo un altro?»), richieste senza prezzo o con categoria che non c'è.
// Menu = QA vero riletto dal DB il 18/10 (sola lettura). Regole: > 3 modifiche → riepilogo e OK; mai «fatto» senza scrittura.
// Runner: tests/eval/eval-adv-r8.test.ts.
import {readFileSync} from 'node:fs'
import type {Change,Conversation,Family,Turn} from '../types.js'
import {FIXTURES} from '../fixtures/menus.js'

const load=(f:string)=>JSON.parse(readFileSync(new URL('../fixtures/'+f,import.meta.url),'utf8'))
FIXTURES.qalive={key:'qalive',restaurant:'Tako · Verifica web',menu:load('qa-live-1018-before.json')}
FIXTURES.qalive2={key:'qalive2',restaurant:'Tako · Verifica web',menu:load('qa-live-1018-after.json')}

type In=string|Turn
const T=(s:string):Turn=>({text:s})
const CR=(name:string,price:number,section?:string):Change=>({op:'create',name,price,...(section?{section}:{})})
const SEC=(name:string):Change=>({op:'section',name}),MV=(dish:string,section:string):Change=>({op:'move',dish,section})
const NONE:Change[]=[]
type Extra={ask?:number[],askNoWrite?:boolean,alt?:Change[][],interim?:Change[],note?:string}
export const ADV_R8_CASES:Conversation[]=[]
let fam='nuova-categoria'
const c=(menu:string,turns:In[],changes:Change[],x:Extra={})=>{const id=`r8-${fam}-${String(ADV_R8_CASES.filter(k=>k.source===`r8:${fam}`).length+1).padStart(3,'0')}`
 ADV_R8_CASES.push({id,family:'b2-categorie' as Family,menu,turns:turns.map(t=>typeof t==='string'?T(t):t),changes,source:`r8:${fam}`,...x})}

// Gruppi di piatti: le «paste» e un piatto diverso (riso/risotto), con i prezzi detti per gruppo.
type Set3={list:string,paste:string[],other:string,otherWord:string}
const SETS:Set3[]=[
 {list:'pasta al pesto, pasta carbonara, riso giallo',paste:['pasta al pesto','pasta carbonara'],other:'riso giallo',otherWord:'il riso'},
 {list:'pasta al pesto , pasta all\'amatriciana, pasta carbonara, riso giallo',paste:['pasta al pesto',"pasta all'amatriciana",'pasta carbonara'],other:'riso giallo',otherWord:'il riso'},
 {list:'pasta alla norma, pasta e fagioli, risotto ai funghi',paste:['pasta alla norma','pasta e fagioli'],other:'risotto ai funghi',otherWord:'il risotto'},
 {list:'pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi',paste:['pasta alla norma','pasta al tonno','pasta e fagioli'],other:'risotto ai funghi',otherWord:'il risotto'}]
// Varianti dei prezzi (paste a 10, l'altro a 8).
const PRICES:((s:Set3)=>string)[]=[
 s=>`metti le paste a 10 euro e ${s.otherWord} a 8 euro`,
 s=>`le paste a 10 e ${s.otherWord} a 8`,
 s=>`tutti a 10 tranne ${s.otherWord} a 8`,
 s=>`a ${s.paste.map(()=>'10').join(', ')} e 8`,
 s=>`le paste 10 euro, ${s.otherWord} 8`,
 s=>`10 euro le paste e 8 euro ${s.otherWord}`,
 s=>`paste a 10 €, ${s.otherWord} a 8 €`,
 s=>`tutte le paste a dieci euro e ${s.otherWord} a otto`]
const creates=(s:Set3,section:string)=>[...s.paste.map(p=>CR(p,10,section)),CR(s.other,8,section)]
const okAfter=(s:Set3)=>s.paste.length+1>3?['ok']:[]

// ---- 1. categoria creata nel messaggio prima, poi i piatti «in primi» ----
fam='nuova-categoria'
const NEWSEC:[string,string][]=[['crea la categoria "primi"','Primi'],['crea una nuova sezione primi','Primi'],['aggiungi la categoria Paste e risi','Paste e risi']]
for(const [cmd,sec] of NEWSEC)for(const s of [SETS[0]!,SETS[1]!])for(const pr of PRICES){const ref=sec==='Primi'?'in primi':'in paste e risi'
 c('qalive',[cmd,`ora ${ref} aggiungi ${s.list}.\n${pr(s)}`,...okAfter(s)],[SEC(sec),...creates(s,sec)],{note:'categoria nuova al turno 1 (chiede il sì o crea), piatti al turno 2'})}

// ---- 2. il flusso esatto di Manuel: sposta un piatto in una sezione nuova, poi i piatti ----
fam='sposta-poi-piatti'
for(const s of [SETS[0]!,SETS[1]!,SETS[2]!,SETS[3]!])for(const pr of PRICES){
 c('qalive',['sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi"',`ora nella sezione primi aggiungi ${s.list}.\n${pr(s)}`,...okAfter(s)],[SEC('Primi'),MV('tiramisù','Primi'),...creates(s,'Primi')])}

// ---- 3. categoria già esistente (stato del QA dopo le 12:56) ----
fam='categoria-esistente'
const REFS=['ora in primi aggiungi','ora nella sezione primi aggiungi','nei primi aggiungi','aggiungi nei primi']
for(const ref of REFS)for(const s of [SETS[2]!,SETS[3]!])for(const pr of PRICES.slice(0,6))c('qalive2',[`${ref} ${s.list}.\n${pr(s)}`,...okAfter(s)],creates(s,'Primi'))

// ---- 4. piatto già nel menu chiesto come nuovo («pasta al ragu» c'è già, nascosta a 20): domanda, nessuna modifica sul ragù ----
fam='piatto-esistente'
for(const ref of ['ora in primi aggiungi','ora nella sezione primi aggiungi'])for(const pr of PRICES){const s:Set3={list:'pasta al pesto , pasta al ragu, pasta carbonara, riso giallo',paste:['pasta al pesto','pasta al ragu','pasta carbonara'],other:'riso giallo',otherWord:'il riso'}
 const clear=creates({...s,paste:['pasta al pesto','pasta carbonara']},'Primi')
 c('qalive2',[`${ref} ${s.list}.\n${pr(s)}`],clear,{ask:[1],askNoWrite:false,alt:[NONE],note:'nota 62: «C’è già pasta al ragù a 20 €: lo aggiorno o ne creo un altro?»; le parti chiare aspettano o si pubblicano'})}

// ---- 5. niente da scrivere: mai «fatto» ----
fam='niente-fatto'
const NOWRITE:[string,string][]=[
 ['in primi aggiungi pasta al pesto e riso giallo','manca il prezzo'],
 ['nei secondi aggiungi pasta al pesto a 10 e riso giallo a 8','categoria che non c’è'],
 ['in primi aggiungi le paste a 10 e il riso a 8','piatti non detti'],
 ['ora in primi aggiungi pasta al pesto, pasta carbonara. metti le paste a','prezzo troncato'],
 ['nella sezione dolci aggiungi pasta al pesto a 10','categoria che non c’è'],
 ['aggiungi in primi','niente piatti'],
 ['in primi metti riso giallo a','prezzo mancante']]
for(const [msg,why] of NOWRITE)c('qalive2',[msg],NONE,{ask:[1],note:why})
c('qalive2',[{text:'quanto costano le paste in primi?',q:true}],NONE,{note:'domanda: si risponde, nessuna scrittura'})
c('qalive',['crea la categoria "primi"',{text:'quanto costano le paste in primi?',q:true}],[SEC('Primi')],{note:'domanda dopo la categoria nuova'})
for(const [msg,why] of NOWRITE)c('qalive',['crea la categoria "primi"',msg],[SEC('Primi')],{ask:[2],alt:[NONE],note:why+' (dopo la categoria nuova)'})

if(ADV_R8_CASES.length<150)throw new Error('batteria R8: meno di 150 conversazioni ('+ADV_R8_CASES.length+')')
