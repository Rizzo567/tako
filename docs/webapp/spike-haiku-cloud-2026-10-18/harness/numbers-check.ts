// Controllo rapido del lettore di numeri del validatore (eseguito a mano durante lo spike).
import {numbersIn} from './spike.ts'
for(const t of ['La carbonare mettila a tre dici euro.','abbassa di 50 centesimi lo spritz aperol','la gricia a 12, anzi no a 11 e 50','metti il piatto di verifica a tredici euro e cinquanta','tavolo 7','ventidue euro','alza il cappuccino del 25%'])console.log(t,'→',numbersIn(t).join(' '))
