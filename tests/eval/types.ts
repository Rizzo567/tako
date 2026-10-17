// Banco di valutazione del bot titolare (perimetro E, 17/10/2026).
// Tipi condivisi: conversazioni, attese, interfaccia astratta del bot sotto test, esiti del giudice.
// Contratto completo per chi implementa un nuovo bot: docs/webapp/bot-cervello-2026-10-17/eval/CONTRATTO.md

/** Menu di prova. È il documento `workspace` del menu (stessa forma di menu-workspace-contract), ridotto ai campi che il giudice legge. */
export type EvalItem={id:string,name:string,price:number,available?:boolean,hidden?:boolean,featured?:boolean,description?:string|null,tags?:string[],promo?:{price:number,until:string|null}|null,scarcity?:{lastPortions?:boolean,onlyToday?:string|null}|null}
export type EvalSection={id:string,name:string,items:EvalItem[]}
export type EvalMenu={menus:{id:string,name:string,type:string,sections:EvalSection[]}[],design?:Record<string,unknown>}
export type MenuFixture={key:string,restaurant:string,menu:EvalMenu}

/** Un turno del titolare. `q:true` = domanda pura: in quel turno il bot non deve scrivere nulla. */
export type Turn=
 |{text:string,q?:boolean}
 |{voice:string,q?:boolean} // trascrizione già storpiata, come la restituirebbe Whisper
 |{wait:number} // minuti che passano senza messaggi
 |{dash:{dish:string,field:'price'|'available'|'hidden'|'featured',value:unknown}} // modifica fatta dalla dashboard nel frattempo

/** Modifica attesa sullo stato finale del menu, per nome del piatto (i nomi sono unici nella fixture). */
export type Change=
 |{op:'price',dish:string,price:number}
 |{op:'available'|'hidden'|'featured'|'last',dish:string,value:boolean}
 |{op:'promo',dish:string,price:number|null}
 |{op:'create',name:string,price:number,section?:string}
 |{op:'description',dish:string,text:string}
 // VERIFICA-V 17/10: capacità che il bot oggi non ha (eliminare, rinominare, spostare tra categorie); il giudice le vede già nel diff.
 |{op:'delete',dish:string}
 |{op:'rename',dish:string,name:string}
 |{op:'move',dish:string,section:string}

/** Attesa dinamica: «sì la seconda» dipende dall'ordine delle opzioni che il bot ha mostrato al turno `turn`. */
export type Pick={turn:number,pick:number|'all',make:(dish:string)=>Change}

export type Conversation={
 id:string
 family:Family
 menu:string // chiave della fixture
 turns:Turn[]
 changes:Change[] // stato finale atteso = menu iniziale + queste modifiche, nient'altro
 alt?:Change[][] // stati finali alternativi accettati (ognuno completo)
 interim?:Change[] // scritture giuste a metà conversazione che il titolare poi corregge/annulla (se restano: correzione non applicata)
 ask?:number[] // turni (da 1) in cui il bot DEVE fare una domanda di chiarimento
 askNoWrite?:boolean // nei turni `ask` non deve neppure scrivere (default: true)
 pick?:Pick
 reply?:RegExp // la risposta finale deve contenere questo (solo BASSO se manca)
 mods?:Mods // variazioni della fixture per questa conversazione
 source?:string // provenienza (QA 17/10, round2 memoria-13, Manuel 17/10…)
 note?:string
}
export type Mods={prices?:Record<string,number>,unavail?:string[],hidden?:string[],featured?:string[],promo?:Record<string,number>,last?:string[]}

export const FAMILIES=['anche','correzione','ripristino','chiarimento','multipla','scaduto','domanda','negazione','ambiguita','togli','vocale','qa1710','manuel','batterie'] as const
// Famiglie della verifica V (17/10, tests/eval/cases/manuel-1017.ts): fuori dal banco principale, che resta com'è.
export const V_FAMILIES=['v-deixis','v-elimina','v-aggiunte','v-categorie','v-composti','v-correzioni','v-risposte','v-prezzi','v-verbi','v-asr','v-stato','v-annulla','v-misti','v-frasefissa','v-coerenza','v-rinomina'] as const
// Batterie delle correzioni di fase A (17/10, docs/webapp/bot-correzioni-2026-10-17): tests/eval/cases/fix-a.ts.
export const A_FAMILIES=['a1-composti','a2-prezzi','a3-nomi','a4-validatore','a5-asr'] as const
export type Family=typeof FAMILIES[number]|typeof V_FAMILIES[number]|typeof A_FAMILIES[number]

/** Traccia facoltativa del contesto usato dal bot in un turno (il bot nuovo la espone; l'attuale no). Vedi CONTRATTO.md §3. */
export type ContextTrace={history:{role:'owner'|'bot',text:string,at:string}[],pending?:unknown,memory?:unknown,promptTokens?:number}

export type TurnResult={reply:string,menuAfter:EvalMenu,latencyMs:number,llm:{calls:number,tokens:number,misses:number,recordedMs:number},context?:ContextTrace}
export type BotRun={turns:TurnResult[],finalMenu:EvalMenu,pending?:unknown}

/** Bot sotto test: riceve conversazione + menu iniziale, restituisce le risposte e lo stato del menu dopo ogni turno. */
export interface BotUnderTest{
 name:string
 /** false = adattatore non ancora implementato: il runner salta il bot e lo dice nel report. */
 ready:boolean
 run(conv:Conversation,menu:EvalMenu,ctx:{restaurant:string}):Promise<BotRun>
}

export type Severity='GRAVE'|'MEDIO'|'BASSO'
export type Fail={sev:Severity,code:string,why:string}
export type Verdict={id:string,family:Family,menu:string,success:boolean,fails:Fail[],expected:string[],actual:string[],replies:string[],turns:string[],clarifications:number,unexpectedClarifications:number,llmCalls:number,llmMisses:number,llmTokens:number,latencyMs:number[],recordedLlmMs:number,usedLlm:boolean,source?:string,note?:string}
