export type OnboardingAssetRole='logo'|'hero'|'ambiguous'|null
/** Explicit asset labels win over mentions of the other asset inside preservation instructions. */
export function onboardingAssetRole(caption:string):OnboardingAssetRole{
 const prefix=caption.match(/^\s*(logo|marchio|hero|copertina)(?:\s*[:—–-]|\s*$)/i)
 if(prefix){const rest=caption.slice(prefix[0].length).trim();if(/^(?:non|mai|evita)\b/i.test(rest))return 'ambiguous';return /logo|marchio/i.test(prefix[1]!)?'logo':'hero'}
 const roles=new Set<'logo'|'hero'>();let mentioned=false
 for(const clause of caption.split(/[.!?;\n]+/))for(const mention of clause.matchAll(/\b(logo|marchio|hero|copertina)\b/gi)){
  mentioned=true;const before=clause.slice(0,mention.index),lastWords=before.split(/\s+/).slice(-7).join(' ')
  if(/\b(non|senza|mai|evita)\b/i.test(lastWords))continue
  roles.add(/logo|marchio/i.test(mention[1]!)?'logo':'hero')
 }
 return roles.size===1?[...roles][0]!:mentioned?'ambiguous':null
}
/** A currency amount in a follow-up is itself source material even when metadata extraction omits menuText. */
export function onboardingHasPrice(text:string){
 return /€|\b\d+[,.]\d{2}\b|\b(?:\d+(?:[,.]\d{1,2})?|zero|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|vent\w*|trent\w*|quarant\w*|cinquant\w*|sessant\w*|settant\w*|ottant\w*|novant\w*|cento)\s+eur[oi]\b/i.test(text)
}
