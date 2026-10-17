// Adattatore del bot NUOVO «che ragiona per primo» (perimetro N). Stub: lo implementa N seguendo
// docs/webapp/bot-cervello-2026-10-17/eval/CONTRATTO.md. Finché `ready` è false il runner lo salta e lo scrive nel report.
//
// Strada consigliata (CONTRATTO §2): stesso route vero dell'adattatore attuale, con l'interruttore acceso e le tabelle
// nuove emulate in memoria:
//   return createRouteBot({name:'nuovo',settings:{botBrain:true},extraSql:newBotSql})
// dove newBotSql(text,params) risponde alle query delle tabelle nuove (cronologia, memoria appresa) e restituisce
// undefined per tutte le altre. La traccia del contesto (CONTRATTO §3) si aggiunge a TurnResult.context.
import type {BotUnderTest} from '../types.js'
import type {createRouteBot as CreateRouteBot} from '../route-harness.js'

export function createNewBot(_createRouteBot:typeof CreateRouteBot):BotUnderTest{
 return{name:'nuovo',ready:false,async run(){throw new Error('bot nuovo non ancora collegato al banco (vedi CONTRATTO.md)')}}
}
