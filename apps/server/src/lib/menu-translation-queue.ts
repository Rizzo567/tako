// Interfaccia verso il servizio traduzioni della Feature 2 (cache per testo, tutte le lingue, una volta sola).
// STUB della Feature 1: la Feature 2 sostituisce SOLO il corpo di enqueueNewTextTranslations, firma invariata
// (contratto in docs/webapp/feature-vendita-2026-10-16/contracts.md, sezione F1).
// Regole del contratto: riceve solo testi italiani NUOVI (nomi/descrizioni mai visti nel menu del locale); non deve
// mai ritradurre un testo già tradotto; deve solo accodare (niente chiamate al modello in linea): chi la chiama non aspetta
// le traduzioni e la pubblicazione non si blocca. Finché non sono pronte il menu pubblico mostra l'italiano.
export type TranslationEnqueue=(restaurantId:string,texts:string[])=>Promise<void>
// F2: implementazione reale (cache per testo e lingua, solo accodamento; mai bloccante per il bot).
let impl:TranslationEnqueue=async(restaurantId,texts)=>{
 const {enqueueNewTextTranslations:enqueue}=await import('./menu-text-translations.js')
 try{await enqueue(restaurantId,texts)}catch(error){console.warn(JSON.stringify({event:'menu_translation_enqueue_failed',restaurant:restaurantId,detail:error instanceof Error?error.message:String(error)}))}
}
export async function enqueueNewTextTranslations(restaurantId:string,texts:string[]):Promise<void>{
 const unique=[...new Set(texts.map(t=>t.trim()).filter(Boolean))];if(!unique.length)return
 await impl(restaurantId,unique)
}
/** Solo per i test. */
export function setTranslationEnqueue(next:TranslationEnqueue){const previous=impl;impl=next;return()=>{impl=previous}}
