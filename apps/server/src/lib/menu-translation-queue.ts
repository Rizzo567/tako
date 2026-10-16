// Interfaccia verso il servizio traduzioni della Feature 2 (cache per testo, tutte le lingue, una volta sola).
// STUB della Feature 1: la Feature 2 sostituisce SOLO il corpo di enqueueNewTextTranslations, firma invariata
// (contratto in docs/webapp/feature-vendita-2026-10-16/contracts.md, sezione F1).
// Regole del contratto: riceve solo testi italiani NUOVI (nomi/descrizioni mai visti nel menu del locale); non deve
// mai ritradurre un testo già tradotto; deve solo accodare (niente chiamate al modello in linea): chi la chiama non aspetta
// le traduzioni e la pubblicazione non si blocca. Finché non sono pronte il menu pubblico mostra l'italiano.
export type TranslationEnqueue=(restaurantId:string,texts:string[])=>Promise<void>
let impl:TranslationEnqueue=async(restaurantId,texts)=>{
 if(texts.length)console.info(JSON.stringify({event:'menu_translation_enqueue_stub',restaurant:restaurantId,texts:texts.length}))
}
export async function enqueueNewTextTranslations(restaurantId:string,texts:string[]):Promise<void>{
 const unique=[...new Set(texts.map(t=>t.trim()).filter(Boolean))];if(!unique.length)return
 await impl(restaurantId,unique)
}
/** Solo per i test. */
export function setTranslationEnqueue(next:TranslationEnqueue){const previous=impl;impl=next;return()=>{impl=previous}}
