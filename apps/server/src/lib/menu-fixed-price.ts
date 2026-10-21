/** Menu «a prezzo fisso» (21/10/2026, decisione Manuel): helper UNICI per server, bot, PDF e (copiati) client.
 * Contratto: docs/webapp/menu-prezzo-fisso-2026-10-21/CONTRATTO.md. Assente = alla carta. In un menu fisso il prezzo dei
 * piatti resta salvato ma non si mostra né si chiede; le opzioni (formule) e «Compreso» sono sul Menu. */
export type FixedFormula={id:string,name:string,price:number,note?:string|null,sectionIds?:string[],translations?:Record<string,{name:string,description?:string}>}
export type FixedMenuLike={pricing?:'carta'|'fisso',formulas?:FixedFormula[],included?:string|null}
export const isFixed=(m:FixedMenuLike|null|undefined)=>m?.pricing==='fisso'
/** Opzioni da mostrare: solo nei menu fissi, nell'ordine salvato, con nome non vuoto. */
export const visibleFormulas=(m:FixedMenuLike|null|undefined):FixedFormula[]=>isFixed(m)?(m!.formulas??[]).filter(f=>f&&typeof f.name==='string'&&f.name.trim()):[]
export const euroIt=(n:number)=>n.toFixed(2).replace('.',',')+' €'
/** «Completo · 12,00 €» */
export const formulaLabel=(f:Pick<FixedFormula,'name'|'price'>)=>f.name.trim()+' · '+euroIt(f.price)
