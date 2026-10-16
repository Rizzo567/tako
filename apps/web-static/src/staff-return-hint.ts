// Indizio locale lasciato dalla dashboard agenzia («Apri menu»), solo nella stessa scheda.
// Non è una prova: serve solo a evitare qualsiasi richiesta in più ai clienti anonimi.
export const STAFF_RETURN_KEY='tako-staff-return'
export const STAFF_RETURN_RESTORE_KEY='tako-staff-return-restore'
const MAX_AGE_MS=12*60*60*1000
export function hasStaffReturnHint(now=Date.now()):boolean{
 try{
  const raw=sessionStorage.getItem(STAFF_RETURN_KEY);if(!raw)return false
  const hint=JSON.parse(raw)
  if(hint?.v===1&&typeof hint.at==='number'&&now-hint.at>=0&&now-hint.at<MAX_AGE_MS)return true
  sessionStorage.removeItem(STAFF_RETURN_KEY)
 }catch{}
 return false
}
